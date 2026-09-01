import { supabase as S } from './supabase.js';
import { getSession, requireAuth } from './auth.js';
import { getSearchContext, resolveSkill } from './search.js?v=11';
import { openServiceChat } from './chat.js?v=11';
import { normalizeLocation, resolvePortugalLocation } from './location.js?v=11';
import { openOverlay, closeOverlay, navigateSection } from './ui27.js?v=27';

const $ = (id) => document.getElementById(id);
let targetProfessional = null;

function openModal() {
  openOverlay('requestModal', { focus: '#reqDesc' });
}

function closeModal() {
  closeOverlay('requestModal');
}

function setMessage(text = '', type = '') {
  const element = $('reqMsg');
  if (!element) return;
  element.className = `msg${type ? ` ${type}` : ''}`;
  element.textContent = text;
}

async function privateRequestReadiness() {
  const session = getSession();
  if (!session) return { complete: false, target: '#accountPhone' };
  const { data, error } = await S.from('profiles')
    .select('phone,address_line1,postal_code,address_city')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error) return { complete: false, target: '#accountPhone' };
  if (!data?.phone) return { complete: false, target: '#accountPhone' };
  if (!data?.address_line1) return { complete: false, target: '#accountAddress1' };
  if (!data?.postal_code) return { complete: false, target: '#accountPostalCode' };
  if (!data?.address_city) return { complete: false, target: '#accountAddressCity' };
  return { complete: true, target: null };
}

export function requestService(professional = null) {
  targetProfessional = professional?.user_id ? professional : null;
  if (!requireAuth('request', 'client')) return false;
  openRequest();
  return true;
}

export async function openRequest() {
  const context = getSearchContext();
  const title = $('requestModal')?.querySelector('h2');

  if (targetProfessional) {
    const readiness = await privateRequestReadiness();
    if (!readiness.complete) {
      await navigateSection('profile', {
        target: readiness.target,
        focus: true,
        hint: 'Completa este dado antes de enviares um pedido direto. Só será partilhado com o profissional escolhido.',
      });
      return;
    }
  }

  if (title) {
    title.textContent = targetProfessional?.public_name
      ? `Pedir serviço a ${targetProfessional.public_name}`
      : 'Guardar pedido';
  }
  if ($('reqDesc')) $('reqDesc').value = context.query || context.skill?.name || '';
  if ($('reqCity')) $('reqCity').value = context.location?.label || context.city || '';
  setMessage(
    targetProfessional?.public_name
      ? `O pedido abre uma conversa privada com ${targetProfessional.public_name}. O teu telefone e morada ficam visíveis apenas para este profissional.`
      : '',
    targetProfessional ? 'ok' : '',
  );
  openModal();
}

async function submitRequest(event) {
  event.preventDefault();
  const session = getSession();
  if (!session) {
    requestService(targetProfessional);
    return;
  }

  const description = $('reqDesc')?.value.trim() || '';
  let city = $('reqCity')?.value.trim() || '';
  const context = getSearchContext();
  const skill = context.skill || resolveSkill(description);

  if (!city) {
    setMessage('Indica a localidade do serviço.', 'err');
    return;
  }

  setMessage('A reconhecer a localidade…');
  let location = context.location && normalizeLocation(context.location.label) === normalizeLocation(city)
    ? context.location
    : null;
  if (!location) location = await resolvePortugalLocation(city);
  if (!location) {
    setMessage('Não consegui reconhecer essa localidade. Experimenta a freguesia, o concelho ou o código postal.', 'err');
    return;
  }

  city = location.label;
  $('reqCity').value = city;

  let requestId = null;
  let error = null;

  if (targetProfessional) {
    const result = await S.rpc('create_targeted_service_request_v2', {
      p_professional_id: targetProfessional.user_id,
      p_skill_id: skill?.id || null,
      p_raw_query: context.query || description,
      p_description: description,
      p_city: city,
      p_location_lat: location.lat,
      p_location_lon: location.lon,
      p_location_label: location.label,
      p_municipality: location.municipality,
      p_parish: location.parish,
    });
    requestId = result.data;
    error = result.error;
  } else {
    const result = await S.from('service_requests').insert({
      client_id: session.user.id,
      professional_id: null,
      skill_id: skill?.id || null,
      raw_query: context.query || description,
      description,
      city,
      district: location.district || null,
      location_lat: location.lat,
      location_lon: location.lon,
      location_label: location.label,
      municipality: location.municipality,
      parish: location.parish,
    }).select('id').single();
    requestId = result.data?.id || null;
    error = result.error;
  }

  if (error) {
    const message = String(error.message || '');
    setMessage(
      message.includes('complete phone and address')
        ? 'Completa primeiro o telefone e a morada na tua Conta.'
        : message.includes('professional unavailable')
          ? 'Este profissional já não está disponível para receber pedidos.'
          : 'Não foi possível enviar o pedido.',
      'err',
    );
    return;
  }

  const name = targetProfessional?.public_name;
  setMessage(
    name
      ? `Pedido enviado a ${name} ✓ A conversa vai abrir.`
      : `Pedido guardado ✓ Localização: ${location.label}`,
    'ok',
  );

  if (targetProfessional && requestId) {
    targetProfessional = null;
    setTimeout(async () => {
      closeModal();
      await openServiceChat(requestId);
    }, 500);
    return;
  }

  targetProfessional = null;
  setTimeout(closeModal, 800);
}

export function initRequests() {
  $('saveDemand')?.addEventListener('click', () => requestService(null));
  $('requestForm')?.addEventListener('submit', submitRequest);
}
