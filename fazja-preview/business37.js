/* Build 37 — deslocações, espaço físico público e ligação Waze.
   Mantém a morada privada da conta separada da morada comercial publicada. */
import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';
import { resolvePortugalLocation } from './js/location.js?v=11';

const $ = (id) => document.getElementById(id);
let loadedProfileUpdatedAt = null;
let businessLoadToken = 0;
let cardDecorateTimer = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function currentSession() {
  let session = getSession();
  if (!session) session = (await S.auth.getSession()).data.session;
  return session;
}

function injectBusinessFields() {
  const form = $('proForm');
  if (!form || $('copServiceModes')) return;

  const block = document.createElement('section');
  block.id = 'copServiceModes';
  block.className = 'cop-service-modes';
  block.innerHTML = `
    <div class="cop-service-mode-head">
      <strong>Como atendes os clientes?</strong>
      <span>Podes deslocar-te, receber clientes num espaço físico, ou fazer as duas coisas.</span>
    </div>
    <label class="check cop-mode-check"><input id="copOffersMobile" type="checkbox" checked> Faço deslocações até ao cliente</label>
    <label class="check cop-mode-check"><input id="copHasShop" type="checkbox"> Tenho espaço físico aberto ao público</label>
    <div id="copShopFields" class="cop-shop-fields hidden">
      <div class="field"><label>Nome do espaço / negócio <span class="cop-optional">opcional</span></label><input id="copBusinessName" maxlength="120" placeholder="Ex.: Oficina do Bairro"></div>
      <div class="field"><label>Morada pública</label><input id="copShopAddress" maxlength="180" placeholder="Rua, número, loja"></div>
      <div class="two"><div class="field"><label>Código postal</label><input id="copShopPostal" placeholder="0000-000"></div><div class="field"><label>Localidade</label><input id="copShopCity" maxlength="100" placeholder="Ex.: Olivais, Lisboa"></div></div>
      <div class="cop-public-address-note">Esta morada será pública e poderá ser aberta no Waze. Não uses a tua morada pessoal se não receberes clientes nesse local.</div>
    </div>
    <div id="copBusinessStatus" class="cop-business-status"></div>`;

  const skillsField = $('pskills')?.closest('.field');
  if (skillsField) skillsField.insertAdjacentElement('beforebegin', block);
  else form.insertBefore(block, $('proMsg') || form.lastElementChild);

  $('copOffersMobile')?.addEventListener('change', updateModeUi);
  $('copHasShop')?.addEventListener('change', updateModeUi);
  updateModeUi();
}

function updateModeUi() {
  const mobile = Boolean($('copOffersMobile')?.checked);
  const shop = Boolean($('copHasShop')?.checked);
  const shopFields = $('copShopFields');
  shopFields?.classList.toggle('hidden', !shop);

  const radiusField = $('pradius')?.closest('.field');
  radiusField?.classList.toggle('cop-mode-disabled', !mobile);

  for (const id of ['copShopAddress','copShopCity']) {
    const input = $(id);
    if (input) input.required = shop;
  }
}

async function loadBusinessForm() {
  injectBusinessFields();
  const session = await currentSession();
  if (!session || !$('copServiceModes')) return;

  const token = ++businessLoadToken;
  const [profileResult, shopResult] = await Promise.all([
    S.from('professional_profiles')
      .select('offers_mobile_service,has_public_shop,business_name,updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle(),
    S.from('professional_shop_locations')
      .select('address_line1,postal_code,city,location_label')
      .eq('professional_id', session.user.id)
      .maybeSingle(),
  ]);
  if (token !== businessLoadToken) return;

  const profile = profileResult.data || {};
  const shop = shopResult.data || {};
  loadedProfileUpdatedAt = profile.updated_at || null;
  $('copOffersMobile').checked = profile.offers_mobile_service !== false;
  $('copHasShop').checked = Boolean(profile.has_public_shop);
  $('copBusinessName').value = profile.business_name || '';
  $('copShopAddress').value = shop.address_line1 || '';
  $('copShopPostal').value = shop.postal_code || '';
  $('copShopCity').value = shop.city || shop.location_label || '';
  $('copBusinessStatus').textContent = '';
  updateModeUi();
}

function captureBusinessSnapshot(event) {
  injectBusinessFields();
  const mobile = Boolean($('copOffersMobile')?.checked);
  const hasShop = Boolean($('copHasShop')?.checked);
  const address = $('copShopAddress')?.value.trim() || '';
  const city = $('copShopCity')?.value.trim() || '';

  if (!mobile && !hasShop) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if ($('proMsg')) $('proMsg').textContent = 'Escolhe pelo menos uma forma de atendimento: deslocações ou espaço físico.';
    return;
  }
  if (hasShop && (!address || !city)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if ($('proMsg')) $('proMsg').textContent = 'Para publicar um espaço físico, indica a morada e a localidade.';
    return;
  }

  const snapshot = {
    mobile,
    hasShop,
    businessName: $('copBusinessName')?.value.trim() || '',
    address,
    postalCode: $('copShopPostal')?.value.trim() || '',
    city,
    previousUpdatedAt: loadedProfileUpdatedAt,
  };
  persistAfterBaseProfile(snapshot).catch(console.error);
}

async function waitForBaseProfile(uid, previousUpdatedAt) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await delay(attempt === 0 ? 500 : 250);
    const { data, error } = await S.from('professional_profiles')
      .select('user_id,updated_at')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) return null;
    if (data && (!previousUpdatedAt || data.updated_at !== previousUpdatedAt)) return data;
  }
  return null;
}

async function persistAfterBaseProfile(snapshot) {
  const session = await currentSession();
  if (!session) return;
  const status = $('copBusinessStatus');
  if (status) status.textContent = 'A guardar forma de atendimento…';

  const baseProfile = await waitForBaseProfile(session.user.id, snapshot.previousUpdatedAt);
  if (!baseProfile) {
    if (status) status.textContent = 'A forma de atendimento não foi alterada porque o perfil principal não ficou guardado.';
    return;
  }

  const profileUpdate = await S.from('professional_profiles').update({
    offers_mobile_service: snapshot.mobile,
    has_public_shop: snapshot.hasShop,
    business_name: snapshot.hasShop && snapshot.businessName ? snapshot.businessName : null,
  }).eq('user_id', session.user.id);

  if (profileUpdate.error) {
    if (status) status.textContent = 'Não foi possível guardar a forma de atendimento.';
    return;
  }

  if (snapshot.hasShop) {
    let resolved = null;
    const locationText = [snapshot.postalCode, snapshot.city].filter(Boolean).join(' ');
    if (locationText) resolved = await resolvePortugalLocation(locationText);

    const shopResult = await S.from('professional_shop_locations').upsert({
      professional_id: session.user.id,
      address_line1: snapshot.address,
      postal_code: snapshot.postalCode || null,
      city: snapshot.city,
      location_label: resolved?.label || snapshot.city,
      location_lat: resolved?.lat ?? null,
      location_lon: resolved?.lon ?? null,
      is_public: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'professional_id' });

    if (shopResult.error) {
      if (status) status.textContent = 'O perfil ficou guardado, mas não foi possível guardar a morada pública.';
      return;
    }
  } else {
    const deleteResult = await S.from('professional_shop_locations')
      .delete()
      .eq('professional_id', session.user.id);
    if (deleteResult.error) {
      if (status) status.textContent = 'O perfil ficou guardado, mas não foi possível retirar a morada pública.';
      return;
    }
  }

  loadedProfileUpdatedAt = baseProfile.updated_at;
  if (status) status.textContent = snapshot.hasShop && snapshot.mobile
    ? 'Deslocações e espaço físico guardados ✓'
    : snapshot.hasShop
      ? 'Espaço físico guardado ✓'
      : 'Deslocações guardadas ✓';
}

function ensurePublicBusinessInfo() {
  const modal = $('publicProModal');
  const meta = $('publicProMeta');
  if (!modal || !meta) return null;
  let box = $('copPublicBusinessInfo');
  if (!box) {
    box = document.createElement('div');
    box.id = 'copPublicBusinessInfo';
    box.className = 'cop-public-business-info hidden';
    meta.insertAdjacentElement('afterend', box);
  }
  return box;
}

function wazeUrl(address) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

async function loadPublicBusinessInfo(professionalId) {
  const box = ensurePublicBusinessInfo();
  if (!box || !professionalId) return;
  box.classList.add('hidden');
  box.innerHTML = '';

  const { data: profile, error } = await S.from('professional_profiles')
    .select('offers_mobile_service,has_public_shop,business_name,service_radius_km')
    .eq('user_id', professionalId)
    .maybeSingle();
  if (error || !profile) return;

  let shop = null;
  if (profile.has_public_shop) {
    const result = await S.from('professional_shop_locations')
      .select('address_line1,postal_code,city')
      .eq('professional_id', professionalId)
      .maybeSingle();
    shop = result.data || null;
  }

  const parts = [];
  if (profile.offers_mobile_service) {
    parts.push(`<div class="cop-business-mode"><span class="cop-mode-icon">🚗</span><div><strong>Desloca-se até ao cliente</strong><span>Até ${Number(profile.service_radius_km || 15)} km da zona base.</span></div></div>`);
  }
  if (profile.has_public_shop && shop) {
    const destination = [shop.address_line1, shop.postal_code, shop.city, 'Portugal'].filter(Boolean).join(', ');
    parts.push(`<div class="cop-business-mode"><span class="cop-mode-icon">🏪</span><div><strong>${profile.business_name || 'Espaço físico aberto ao público'}</strong><span>${[shop.address_line1, shop.postal_code, shop.city].filter(Boolean).join(', ')}</span><a class="cop-waze-link" href="${wazeUrl(destination)}" target="_blank" rel="noopener noreferrer">Abrir no Waze</a></div></div>`);
  }

  if (parts.length) {
    box.innerHTML = parts.join('');
    box.classList.remove('hidden');
  }
}

async function decorateProfessionalCards() {
  const cardsRoot = $('cards');
  if (!cardsRoot) return;
  const buttons = [...cardsRoot.querySelectorAll('[data-professional]')];
  const ids = [...new Set(buttons.map((button) => button.dataset.professional).filter(Boolean))];
  if (!ids.length) return;

  const { data, error } = await S.from('professional_profiles')
    .select('user_id,offers_mobile_service,has_public_shop')
    .in('user_id', ids);
  if (error) return;
  const modes = new Map((data || []).map((row) => [row.user_id, row]));

  ids.forEach((id) => {
    const card = cardsRoot.querySelector(`[data-professional="${CSS.escape(id)}"]`)?.closest('.pro-card');
    const badges = card?.querySelector('.badges');
    const mode = modes.get(id);
    if (!badges || !mode) return;
    badges.querySelectorAll('[data-cop-mode-badge]').forEach((badge) => badge.remove());
    if (mode.offers_mobile_service) badges.insertAdjacentHTML('beforeend', '<span class="badge" data-cop-mode-badge>🚗 Desloca-se</span>');
    if (mode.has_public_shop) badges.insertAdjacentHTML('beforeend', '<span class="badge" data-cop-mode-badge>🏪 Espaço físico</span>');
  });
}

function scheduleCardDecoration() {
  clearTimeout(cardDecorateTimer);
  cardDecorateTimer = setTimeout(() => decorateProfessionalCards().catch(console.error), 80);
}

injectBusinessFields();
$('proForm')?.addEventListener('submit', captureBusinessSnapshot, true);

const proModal = $('proModal');
if (proModal) {
  new MutationObserver(() => {
    if (proModal.classList.contains('open')) loadBusinessForm().catch(console.error);
  }).observe(proModal, { attributes: true, attributeFilter: ['class'] });
}

document.addEventListener('click', (event) => {
  const profileButton = event.target.closest('.view-pro[data-professional]');
  if (profileButton) setTimeout(() => loadPublicBusinessInfo(profileButton.dataset.professional).catch(console.error), 0);
});

const cardsRoot = $('cards');
if (cardsRoot) {
  new MutationObserver(scheduleCardDecoration).observe(cardsRoot, { childList: true, subtree: true });
}
scheduleCardDecoration();
