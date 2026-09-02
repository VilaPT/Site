import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';
import { openServiceChat } from './js/chat.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let session = null;
let channel = null;
let timer = null;
let observer = null;
let loading = false;

const iconByKind = {
  new_request: '📥', proposal_accepted: '✅', proposal_rejected: '↩️', completed: '⭐', message: '💬',
  appointment_scheduled: '📅', appointment_updated: '📅', appointment_cancelled: '📅',
};

async function ensureSession() {
  session = getSession();
  if (!session) session = (await S.auth.getSession()).data.session;
  return session;
}

function stamp(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function showToast(message) {
  const el = $('toast'); if (!el) return;
  el.textContent = message; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 2600);
}

function panelHost() { return $('accountProfessional'); }
function shouldMount(host) {
  if (!host) return false;
  const text = host.textContent || '';
  if (text.includes('A carregar')) return false;
  if (text.includes('Ainda não tens perfil profissional')) return false;
  return true;
}

function ensurePanel() {
  const host = panelHost(); if (!shouldMount(host)) return null;
  let panel = $('professionalActivity');
  if (panel && panel.parentElement === host) return panel;
  panel = document.createElement('section');
  panel.id = 'professionalActivity'; panel.className = 'professional-activity';
  panel.innerHTML = '<div class="professional-activity-loading">A carregar atividade…</div>';
  host.insertBefore(panel, host.firstChild);
  return panel;
}

function render(rows) {
  const panel = ensurePanel(); if (!panel) return;
  const unread = rows.filter((item) => !item.read_at).length;
  panel.innerHTML = `
    <div class="professional-activity-head">
      <div><span class="professional-activity-eyebrow">🔔 ATIVIDADE</span><h3>Notificações profissionais</h3><p>Aqui vês exatamente o que aconteceu e a que pedido pertence.</p></div>
      ${unread ? `<button class="professional-activity-read-all" type="button" data-prof-activity-read-all>Marcar todas como lidas</button>` : ''}
    </div>
    <div class="professional-activity-list">
      ${rows.length ? rows.map((item) => {
        const icon = iconByKind[item.kind] || '🔔';
        const context = item.skill_name || item.request_description || 'Pedido de serviço';
        return `<article class="professional-activity-item ${item.read_at ? 'is-read' : 'is-unread'}" data-prof-activity-id="${item.notification_id}">
          <div class="professional-activity-icon" aria-hidden="true">${icon}</div>
          <div class="professional-activity-copy"><div class="professional-activity-title-row"><strong>${escapeHtml(item.title || 'Atualização')}</strong>${item.read_at ? '' : '<span class="professional-activity-new">Nova</span>'}</div>${item.body ? `<p>${escapeHtml(item.body)}</p>` : ''}<small>${escapeHtml(context)} · ${escapeHtml(stamp(item.created_at))}</small></div>
          <div class="professional-activity-actions">${item.request_id ? `<button class="professional-activity-open" type="button" data-prof-activity-open="${item.notification_id}" data-request-id="${item.request_id}">Ver pedido</button>` : ''}${item.read_at ? '' : `<button class="professional-activity-read" type="button" data-prof-activity-read="${item.notification_id}">Marcar como lida</button>`}</div>
        </article>`;
      }).join('') : '<div class="professional-activity-empty">Ainda não tens atividade profissional registada.</div>'}
    </div>`;
}

function setBadge(targetId, count) {
  const target=$(targetId); if(!target) return;
  target.querySelectorAll('.notification-badge').forEach((b,i)=>{ if(i) b.remove(); });
  let badge=target.querySelector('.notification-badge');
  if(!count){ badge?.remove(); return; }
  if(!badge){ badge=document.createElement('span'); badge.className='notification-badge cop-root-badge'; (target.querySelector('.nav-icon')||target).appendChild(badge); }
  badge.textContent=Number(count)>9?'9+':String(count);
}

async function refreshProfessionalBadge() {
  if(!await ensureSession()) return;
  const {data,error}=await S.rpc('notification_counts');
  if(error) return;
  const count=Number(data?.professional_count||0);
  setBadge('navPro',count); setBadge('proCta',count);
}

async function markInformationalSeen() {
  if(!await ensureSession()) return;
  const {data,error}=await S.rpc('mark_professional_activity_seen');
  if(error){ console.error('Falha ao marcar atividade profissional como vista:',error); return; }
  if(Number(data||0)>0) await refreshProfessionalBadge();
}

async function loadActivity() {
  if (loading) return;
  const panel = ensurePanel();
  if (!panel || !await ensureSession()) return;
  loading = true;
  await markInformationalSeen();
  const { data, error } = await S.rpc('my_professional_activity', { p_limit: 30 });
  loading = false;
  if (error) {
    console.error('Falha ao carregar atividade profissional:', error);
    panel.innerHTML = '<div class="professional-activity-empty">Não foi possível carregar as notificações.</div>';
    return;
  }
  render(data || []);
}

async function markRead(notificationId) {
  if (!notificationId || !await ensureSession()) return false;
  const { data, error } = await S.rpc('mark_professional_activity_read', { p_notification_id: notificationId });
  if (error) { console.error(error); showToast('Não foi possível marcar a notificação como lida.'); return false; }
  await refreshProfessionalBadge();
  return Boolean(data);
}

async function markAllRead() {
  if (!await ensureSession()) return;
  const { error } = await S.rpc('mark_all_professional_activity_read');
  if (error) { showToast('Não foi possível marcar as notificações como lidas.'); return; }
  await refreshProfessionalBadge(); await loadActivity(); showToast('Notificações marcadas como lidas');
}

async function openActivity(notificationId, requestId) {
  await markRead(notificationId); await loadActivity();
  if (!requestId) return;
  const existing = document.querySelector(`[data-chat-request="${CSS.escape(requestId)}"]`);
  if (existing) { existing.click(); return; }
  try { await openServiceChat(requestId); }
  catch (error) { console.error(error); showToast('O pedido foi marcado como lido, mas não foi possível abrir a conversa.'); }
}

function bindClicks() {
  document.addEventListener('click', (event) => {
    const read = event.target.closest?.('[data-prof-activity-read]');
    if (read) { markRead(read.dataset.profActivityRead).then(() => loadActivity()).catch(console.error); return; }
    const readAll = event.target.closest?.('[data-prof-activity-read-all]');
    if (readAll) { markAllRead().catch(console.error); return; }
    const open = event.target.closest?.('[data-prof-activity-open]');
    if (open) { openActivity(open.dataset.profActivityOpen, open.dataset.requestId).catch(console.error); return; }
    if (event.target.closest?.('#navPro,#proCta,[data-account-tab="professional"]')) setTimeout(() => loadActivity().catch(console.error), 220);
  });
}

function observeProfessionalArea() {
  const host = panelHost(); if (!host || observer) return;
  observer = new MutationObserver(() => {
    if (!shouldMount(host)) return;
    if (!$('professionalActivity')) setTimeout(() => loadActivity().catch(console.error), 20);
  });
  observer.observe(host, { childList: true });
}

async function startRealtime() {
  if (channel) S.removeChannel(channel); if (timer) clearInterval(timer);
  channel = null; timer = null;
  if (!await ensureSession()) return;
  channel = S.channel(`professional-activity-${session.user.id}-${Date.now()}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'service_notifications' }, () => loadActivity().catch(() => {})).subscribe();
  timer = setInterval(() => { if ($('professionalActivity')) loadActivity().catch(() => {}); }, 30000);
}

async function init() {
  bindClicks(); observeProfessionalArea(); await ensureSession(); await startRealtime();
  if (shouldMount(panelHost())) await loadActivity();
  S.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; setTimeout(() => startRealtime().catch(console.error), 0); });
}

init().catch(console.error);
