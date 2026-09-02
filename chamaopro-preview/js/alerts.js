import { supabase as S } from './supabase.js';

const DEFAULTS = { enabled: true, vibrate: true, sound: true, reminder_minutes: 30 };
let preferences = { ...DEFAULTS };
let reminderTimer = null;
let currentUserId = null;

function storageKey(id, startsAt) {
  return `cop-reminder:${id}:${startsAt}`;
}

async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const pageUrl = new URL(window.location.href);
    if (!pageUrl.pathname.includes('/chamaopro/')) return null;
    const swUrl = new URL('./sw.js', pageUrl).href;
    return await navigator.serviceWorker.register(swUrl, { scope: './' });
  } catch {
    return null;
  }
}

function playTone() {
  if (!preferences.sound) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 780;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.22);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {}
}

export async function loadAlertPreferences(userId) {
  currentUserId = userId || null;
  preferences = { ...DEFAULTS };
  if (!userId) return preferences;
  const { data, error } = await S.from('notification_preferences')
    .select('enabled,vibrate,sound,reminder_minutes')
    .eq('user_id', userId)
    .maybeSingle();
  if (!error && data) preferences = { ...DEFAULTS, ...data };
  return { ...preferences };
}

export function getAlertPreferences() {
  return { ...preferences };
}

export async function saveAlertPreferences(next) {
  if (!currentUserId) return { error: new Error('Sessão necessária') };
  preferences = {
    enabled: Boolean(next.enabled),
    vibrate: Boolean(next.vibrate),
    sound: Boolean(next.sound),
    reminder_minutes: Number(next.reminder_minutes || 30),
  };
  return S.from('notification_preferences').upsert({
    user_id: currentUserId,
    ...preferences,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function requestAlertPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export async function deviceAlert(title, body = '', tag = 'chama-o-pro') {
  if (!preferences.enabled) return;
  if (preferences.vibrate && navigator.vibrate) {
    try { navigator.vibrate([140, 70, 140]); } catch {}
  }
  if (document.visibilityState === 'visible') playTone();

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = {
    body,
    tag,
    renotify: true,
    silent: !preferences.sound,
    vibrate: preferences.vibrate ? [140, 70, 140] : undefined,
    icon: undefined,
  };
  const registration = await ensureServiceWorker();
  if (registration?.showNotification) {
    await registration.showNotification(title, options).catch(() => {});
    return;
  }
  try { new Notification(title, options); } catch {}
}

async function checkAppointmentReminders() {
  if (!currentUserId || !preferences.enabled) return;
  const now = Date.now();
  const horizon = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await S.from('service_appointments')
    .select('id,request_id,starts_at,notes')
    .eq('professional_id', currentUserId)
    .eq('status', 'scheduled')
    .gte('starts_at', new Date(now - 5 * 60 * 1000).toISOString())
    .lte('starts_at', horizon)
    .order('starts_at');
  if (error) return;

  for (const appointment of data || []) {
    const starts = new Date(appointment.starts_at).getTime();
    const minutes = (starts - now) / 60000;
    if (minutes < 0 || minutes > Number(preferences.reminder_minutes || 30)) continue;
    const key = storageKey(appointment.id, appointment.starts_at);
    if (localStorage.getItem(key)) continue;
    localStorage.setItem(key, new Date().toISOString());
    const when = new Date(appointment.starts_at).toLocaleString('pt-PT', {
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    await deviceAlert('Serviço a aproximar-se', `Tens um serviço marcado para ${when}.`, `appointment-${appointment.id}`);
  }
}

export function startAppointmentReminders(userId) {
  stopAppointmentReminders();
  currentUserId = userId || currentUserId;
  if (!currentUserId) return;
  checkAppointmentReminders().catch(() => {});
  reminderTimer = setInterval(() => checkAppointmentReminders().catch(() => {}), 60000);
}

export function stopAppointmentReminders() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = null;
}
