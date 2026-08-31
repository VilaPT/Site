import { supabase as S } from './supabase.js';

const $ = (id) => document.getElementById(id);
let currentRequestId = null;
let currentAppointment = null;
let onChanged = () => {};
let bound = false;

export function formatAppointment(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-PT', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function closeModal() {
  $('appointmentModal')?.classList.remove('open');
  currentRequestId = null;
  currentAppointment = null;
}

function setMessage(text = '', type = '') {
  const el = $('appointmentMsg');
  if (!el) return;
  el.className = `msg${type ? ` ${type}` : ''}`;
  el.textContent = text;
}

export async function openAppointmentScheduler(requestId) {
  if (!requestId) return;
  currentRequestId = requestId;
  setMessage();
  const { data, error } = await S.from('service_appointments')
    .select('id,request_id,starts_at,ends_at,notes,status')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) {
    setMessage('Não foi possível carregar a marcação.', 'err');
    return;
  }
  currentAppointment = data || null;
  $('appointmentStart').value = currentAppointment?.status === 'scheduled' ? toLocalInput(currentAppointment.starts_at) : '';
  $('appointmentNotes').value = currentAppointment?.notes || '';
  let duration = 60;
  if (currentAppointment?.starts_at && currentAppointment?.ends_at) {
    duration = Math.max(15, Math.round((new Date(currentAppointment.ends_at) - new Date(currentAppointment.starts_at)) / 60000));
  }
  $('appointmentDuration').value = ['30','60','90','120'].includes(String(duration)) ? String(duration) : '60';
  $('appointmentTitle').textContent = currentAppointment?.status === 'scheduled' ? 'Alterar marcação' : 'Agendar serviço';
  $('appointmentCancel').classList.toggle('hidden', currentAppointment?.status !== 'scheduled');
  $('appointmentModal')?.classList.add('open');
}

async function submitAppointment(event) {
  event.preventDefault();
  if (!currentRequestId) return;
  const startValue = $('appointmentStart').value;
  if (!startValue) {
    setMessage('Escolhe o dia e a hora.', 'err');
    return;
  }
  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) {
    setMessage('A data indicada não é válida.', 'err');
    return;
  }
  const duration = Number($('appointmentDuration').value || 60);
  const end = new Date(start.getTime() + duration * 60000);
  setMessage('A guardar marcação…');
  const { error } = await S.rpc('professional_schedule_service', {
    p_request_id: currentRequestId,
    p_starts_at: start.toISOString(),
    p_ends_at: end.toISOString(),
    p_notes: $('appointmentNotes').value.trim() || null,
  });
  if (error) {
    const text = String(error.message || '');
    setMessage(text.includes('accepted proposal') ? 'Só podes agendar depois de a proposta ser aceite.' : 'Não foi possível guardar a marcação.', 'err');
    return;
  }
  setMessage('Serviço agendado ✓', 'ok');
  await onChanged();
  setTimeout(closeModal, 650);
}

async function cancelAppointment() {
  if (!currentRequestId || !window.confirm('Cancelar esta marcação?')) return;
  const { error } = await S.rpc('professional_cancel_service_appointment', { p_request_id: currentRequestId });
  if (error) {
    setMessage('Não foi possível cancelar a marcação.', 'err');
    return;
  }
  setMessage('Marcação cancelada.', 'ok');
  await onChanged();
  setTimeout(closeModal, 650);
}

function bind() {
  if (bound) return;
  bound = true;
  $('appointmentForm')?.addEventListener('submit', submitAppointment);
  $('appointmentClose')?.addEventListener('click', closeModal);
  $('appointmentCancel')?.addEventListener('click', cancelAppointment);
}

export function initAppointments({ onAppointmentChange = () => {} } = {}) {
  onChanged = onAppointmentChange;
  bind();
}
