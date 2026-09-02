import { supabase as S } from './supabase.js';
import { getSession, requireAuth } from './auth.js';
import {
  getMembership,
  loadMembership,
  membershipState,
  renderMembershipPlan,
  trialDaysLeft,
} from './memberships.js';
import { escapeHtml } from './utils.js';
import { normalizeLocation, resolvePortugalLocation } from './location.js?v=11';

const $ = (id) => document.getElementById(id);
let membershipChanged = () => {};
let savedLocation = null;

function openModal() {
  $('proModal')?.classList.add('open');
}

function setMessage(text = '', type = '') {
  const element = $('proMsg');
  if (!element) return;
  element.className = `msg${type ? ` ${type}` : ''}`;
  element.textContent = text;
}

function setBusinessStatus(text = '') {
  if ($('copBusinessStatus')) $('copBusinessStatus').textContent = text;
}

export function requestProfessionalMode() {
  if (!requireAuth('pro', 'professional')) return false;
  openProfessionalProfile();
  return true;
}

export async function openProfessionalProfile() {
  const session = getSession();
  if (!session) {
    requestProfessionalMode();
    return;
  }

  await loadMembership(session);
  renderMembershipPlan($('planStatus'));
  setMessage();

  const uid = session.user.id;
  const [profileResult, skillsResult] = await Promise.all([
    S.from('professional_profiles').select('*').eq('user_id', uid).maybeSingle(),
    S.from('professional_skills').select('skill_id').eq('professional_id', uid),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (skillsResult.error) throw skillsResult.error;

  const professional = profileResult.data || {};
  $('pname').value = professional.public_name || '';
  $('headline').value = professional.headline || '';
  $('bio').value = professional.bio || '';
  $('pcity').value = professional.location_label || professional.city || '';
  $('pradius').value = String(professional.service_radius_km || 15);
  $('price').value = professional.base_price ?? '';
  $('available').checked = Boolean(professional.is_available);
  $('public').checked = Boolean(professional.is_public);
  savedLocation = professional.location_lat != null && professional.location_lon != null ? {
    lat: Number(professional.location_lat),
    lon: Number(professional.location_lon),
    label: professional.location_label || professional.city || '',
    municipality: professional.municipality || null,
    parish: professional.parish || null,
    district: professional.district || null,
  } : null;

  const selectedIds = (skillsResult.data || []).map((item) => String(item.skill_id));
  [...$('pskills').options].forEach((option) => {
    option.selected = selectedIds.includes(option.value);
  });

  openModal();
}

async function resolveShopLocation() {
  const hasShop = Boolean($('copHasShop')?.checked);
  if (!hasShop) return null;
  const address = $('copShopAddress')?.value.trim() || '';
  const postalCode = $('copShopPostal')?.value.trim() || '';
  const city = $('copShopCity')?.value.trim() || '';
  if (!address || !city) throw new Error('Para publicar um espaço físico, indica a morada e a localidade.');
  const locationText = [postalCode, city].filter(Boolean).join(' ');
  const resolved = locationText ? await resolvePortugalLocation(locationText).catch(() => null) : null;
  return { address, postalCode, city, resolved };
}

async function submitProfessionalProfile(event) {
  event.preventDefault();

  const session = getSession();
  if (!session) {
    requestProfessionalMode();
    return;
  }

  const selectedIds = [...$('pskills').selectedOptions].map((option) => Number(option.value));
  if (!selectedIds.length) {
    setMessage('Escolhe pelo menos um serviço.', 'err');
    return;
  }

  const typedLocation = $('pcity').value.trim();
  if (!typedLocation) {
    setMessage('Indica a localidade onde prestas serviços.', 'err');
    return;
  }

  const offersMobile = $('copOffersMobile') ? Boolean($('copOffersMobile').checked) : true;
  const hasShop = $('copHasShop') ? Boolean($('copHasShop').checked) : false;
  if (!offersMobile && !hasShop) {
    setMessage('Escolhe pelo menos uma forma de atendimento: deslocações ou espaço físico.', 'err');
    return;
  }

  setMessage('A validar e guardar o perfil…');
  setBusinessStatus('');

  let location = null;
  if (savedLocation && normalizeLocation(savedLocation.label) === normalizeLocation(typedLocation)) location = savedLocation;
  if (!location) location = await resolvePortugalLocation(typedLocation);
  if (!location) {
    setMessage('Não consegui reconhecer essa localidade. Experimenta a freguesia, o concelho ou o código postal.', 'err');
    return;
  }
  $('pcity').value = location.label;

  let shop = null;
  try {
    shop = await resolveShopLocation();
  } catch (error) {
    setMessage(error.message, 'err');
    return;
  }

  const alreadyHadMembership = Boolean(getMembership());
  const basePrice = $('price').value === '' ? null : Number($('price').value);
  const { error } = await S.rpc('save_professional_profile_v3', {
    p_public_name: $('pname').value.trim(),
    p_headline: $('headline').value.trim() || null,
    p_bio: $('bio').value.trim() || null,
    p_city: location.label,
    p_district: location.district || null,
    p_municipality: location.municipality || null,
    p_parish: location.parish || null,
    p_location_label: location.label,
    p_location_lat: location.lat,
    p_location_lon: location.lon,
    p_service_radius_km: Number($('pradius').value || 15),
    p_base_price: Number.isFinite(basePrice) ? basePrice : null,
    p_is_available: $('available').checked,
    p_is_public: $('public').checked,
    p_skill_ids: selectedIds,
    p_offers_mobile_service: offersMobile,
    p_has_public_shop: hasShop,
    p_business_name: hasShop ? ($('copBusinessName')?.value.trim() || null) : null,
    p_shop_address_line1: shop?.address || null,
    p_shop_postal_code: shop?.postalCode || null,
    p_shop_city: shop?.city || null,
    p_shop_location_label: shop?.resolved?.label || shop?.city || null,
    p_shop_location_lat: shop?.resolved?.lat ?? null,
    p_shop_location_lon: shop?.resolved?.lon ?? null,
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('account restricted or blocked')) setMessage('Esta conta está temporariamente impedida de alterar o perfil.', 'err');
    else if (message.includes('confirmed email required')) setMessage('Confirma primeiro o teu email.', 'err');
    else setMessage('Não foi possível guardar o perfil. Revê os dados e tenta novamente.', 'err');
    console.error('Falha ao guardar perfil profissional:', error);
    return;
  }

  savedLocation = location;
  await loadMembership(session);
  renderMembershipPlan($('planStatus'));
  await membershipChanged(session);

  const modeText = hasShop && offersMobile
    ? 'Deslocações e espaço físico guardados ✓'
    : hasShop
      ? 'Espaço físico guardado ✓'
      : 'Deslocações guardadas ✓';
  setBusinessStatus(modeText);

  const message = !alreadyHadMembership && membershipState() === 'trial'
    ? `Perfil criado ✓ Tens cerca de ${trialDaysLeft()} dias gratuitos. A tua zona foi associada a ${location.label}.`
    : $('public').checked
      ? `Perfil publicado ✓ Zona: ${location.label} · raio ${Number($('pradius').value || 15)} km.`
      : 'Perfil guardado ✓';

  setMessage(message, 'ok');
}

export function initProfessionals({ skills = [], onMembershipChange = () => {} } = {}) {
  membershipChanged = onMembershipChange;

  $('pskills').innerHTML = skills.map((skill) => (
    `<option value="${skill.id}">${escapeHtml(skill.name)}</option>`
  )).join('');

  $('proCta')?.addEventListener('click', requestProfessionalMode);
  $('proForm')?.addEventListener('submit', submitProfessionalProfile);
}
