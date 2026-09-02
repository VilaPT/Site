/* Build 25 — hub de mensagens e abertura direta das páginas informativas. */
import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';
import { openServiceChat } from './js/chat.js';

const $ = (id) => document.getElementById(id);
let realtimeChannel = null;
let badgeTimer = null;
let currentSession = null;
let panelAttempts = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function ensureSession() {
  currentSession = getSession();
  if (!currentSession) currentSession = (await S.auth.getSession()).data.session;
  return currentSession;
}

function injectMessagesNav() {
  const nav = $('mobileNav');
  if (!nav || $('navMessages')) return;
  const button = document.createElement('button');
  button.id = 'navMessages';
  button.type = 'button';
  button.setAttribute('aria-label', 'Mensagens');
  button.innerHTML = '<span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 10h8M8 13h5"/></svg></span><span>Mensagens</span>';
  nav.insertBefore(button, $('navAccount') || null);
}

function enhanceMessagesPanel() {
  const panel = document.querySelector('[data-account-panel="messages"]');
  const inbox = $('communityInbox');
  if (!panel || !inbox) {
    panelAttempts += 1;
    if (panelAttempts < 80) setTimeout(enhanceMessagesPanel, 50);
    return;
  }
  if (panel.dataset.copMessages25 === '1') return;
  panel.dataset.copMessages25 = '1';
  const heading = panel.querySelector(':scope > h3');
  if (heading) heading.textContent = 'Mensagens';
  const note = panel.querySelector(':scope > .account-privacy-note');
  if (note) note.textContent = 'Aqui encontras as conversas ligadas a serviços e as mensagens entre utilizadores. Pedidos de serviço não contam como mensagens e não ativam o aviso desta secção.';

  const groups = document.createElement('div');
  groups.className = 'cop-message-groups';
  groups.innerHTML = `
    <section class="cop-message-group">
      <div class="cop-message-group-title"><h3>Conversas de serviços</h3><span>Cliente ↔ profissional</span></div>
      <div id="copServiceMessageInbox" class="cop-service-inbox"><div class="cop-message-empty">A carregar conversas…</div></div>
    </section>
    <section class="cop-message-group" id="copUserMessageGroup">
      <div class="cop-message-group-title"><h3>Entre utilizadores</h3><span>Conversas aceites e pedidos de mensagem</span></div>
    </section>`;
  panel.insertBefore(groups, inbox);
  groups.querySelector('#copUserMessageGroup').appendChild(inbox);
}

function formatStamp(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-PT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

async function loadServiceConversations() {
  const session = await ensureSession();
  const container = $('copServiceMessageInbox');
  if (!container) return;
  if (!session) {
    container.innerHTML = '<div class="cop-message-empty">Entra na tua conta para veres as conversas.</div>';
    return;
  }
  const uid = session.user.id;
  const { data: requests, error: requestError } = await S.from('service_requests')
    .select('id,client_id,professional_id,description,status,created_at')
    .or(`client_id.eq.${uid},professional_id.eq.${uid}`)
    .not('professional_id', 'is', null)
    .order('created_at', { ascending:false })
    .limit(80);
  if (requestError) {
    console.error(requestError);
    container.innerHTML = '<div class="cop-message-empty">Não foi possível carregar as conversas de serviços.</div>';
    return;
  }
  const rows = requests || [];
  if (!rows.length) {
    container.innerHTML = '<div class="cop-message-empty">Ainda não tens conversas ligadas a serviços.</div>';
    return;
  }

  const ids = rows.map((row) => row.id);
  const [{ data: messages, error: messageError }, { data: unreadRows }] = await Promise.all([
    S.from('service_messages')
      .select('id,request_id,sender_id,body,kind,created_at')
      .in('request_id', ids)
      .eq('kind', 'message')
      .order('created_at', { ascending:false })
      .limit(300),
    S.from('service_notifications')
      .select('id,request_id')
      .eq('user_id', uid)
      .eq('kind', 'message')
      .is('read_at', null)
      .in('request_id', ids)
      .limit(100),
  ]);
  if (messageError) {
    console.error(messageError);
    container.innerHTML = '<div class="cop-message-empty">Não foi possível carregar as mensagens.</div>';
    return;
  }

  const latestByRequest = new Map();
  (messages || []).forEach((message) => {
    if (!latestByRequest.has(message.request_id)) latestByRequest.set(message.request_id, message);
  });
  const unreadByRequest = new Map();
  (unreadRows || []).forEach((item) => unreadByRequest.set(item.request_id, (unreadByRequest.get(item.request_id) || 0) + 1));

  const visible = rows
    .map((request) => ({ request, message: latestByRequest.get(request.id), unread: unreadByRequest.get(request.id) || 0 }))
    .filter((item) => item.message)
    .sort((a,b) => new Date(b.message.created_at) - new Date(a.message.created_at));

  if (!visible.length) {
    container.innerHTML = '<div class="cop-message-empty">As tuas conversas de serviço aparecerão aqui depois da primeira mensagem.</div>';
    return;
  }

  const professionalIds = [...new Set(visible.filter((item) => item.request.client_id === uid).map((item) => item.request.professional_id).filter(Boolean))];
  let proNames = new Map();
  if (professionalIds.length) {
    const { data } = await S.from('professional_profiles').select('user_id,public_name').in('user_id', professionalIds);
    proNames = new Map((data || []).map((row) => [row.user_id, row.public_name]));
  }

  container.innerHTML = visible.map(({ request, message, unread }) => {
    const counterpart = request.client_id === uid ? (proNames.get(request.professional_id) || 'Profissional') : 'Cliente do pedido';
    return `<button class="cop-service-message ${unread ? 'unread' : ''}" type="button" data-service-conversation="${request.id}">
      <span class="who">${escapeHtml(counterpart)}</span><span class="when">${escapeHtml(formatStamp(message.created_at))}</span>
      <span class="subject">${escapeHtml(request.description || 'Pedido de serviço')}</span>
      <span class="preview">${message.sender_id === uid ? 'Tu: ' : ''}${escapeHtml(message.body || '')}</span>
      ${unread ? `<span class="new-message">${unread > 1 ? `${unread} novas mensagens` : 'Nova mensagem'}</span>` : ''}
    </button>`;
  }).join('');

  container.querySelectorAll('[data-service-conversation]').forEach((button) => {
    button.addEventListener('click', async () => {
      await openServiceChat(button.dataset.serviceConversation);
      setTimeout(() => { loadServiceConversations().catch(()=>{}); refreshMessagesBadge().catch(()=>{}); }, 350);
    });
  });
}

function badgeElement() {
  const nav = $('navMessages');
  if (!nav) return null;
  let badge = nav.querySelector('.cop-messages-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'notification-badge cop-messages-badge';
    nav.appendChild(badge);
  }
  return badge;
}

function seenStorageKey(uid) { return `cop_messages_seen_${uid}`; }

async function directIncomingSinceSeen(uid) {
  const key = seenStorageKey(uid);
  let seen = Number(localStorage.getItem(key) || 0);
  if (!seen) {
    seen = Date.now();
    localStorage.setItem(key, String(seen));
    return 0;
  }
  const { data, error } = await S.from('user_messages')
    .select('id,sender_id,created_at')
    .neq('sender_id', uid)
    .gt('created_at', new Date(seen).toISOString())
    .limit(50);
  if (error) return 0;
  return (data || []).length;
}

async function refreshMessagesBadge() {
  injectMessagesNav();
  const badge = badgeElement();
  if (!badge) return;
  const session = await ensureSession();
  if (!session) { badge.remove(); return; }
  const uid = session.user.id;
  const [serviceResult, threadResult, directUnread] = await Promise.all([
    S.from('service_notifications').select('id').eq('user_id', uid).eq('kind','message').is('read_at',null).limit(50),
    S.rpc('my_user_message_threads'),
    directIncomingSinceSeen(uid),
  ]);
  const serviceUnread = serviceResult.error ? 0 : (serviceResult.data || []).length;
  const pendingMessageRequests = threadResult.error ? 0 : (threadResult.data || []).filter((t) => t.status === 'pending' && t.direction === 'incoming').length;
  const total = serviceUnread + pendingMessageRequests + directUnread;
  if (!total) { badge.remove(); return; }
  badge.textContent = total > 9 ? '9+' : String(total);
}

async function openMessagesPage() {
  const session = await ensureSession();
  if (!session) { $('authBtn')?.click(); return; }
  enhanceMessagesPanel();
  $('accountModal')?.classList.add('open');
  $('communityMessagesTab')?.click();
  localStorage.setItem(seenStorageKey(session.user.id), String(Date.now()));
  await loadServiceConversations();
  setTimeout(() => refreshMessagesBadge().catch(()=>{}), 80);
}

function bindMessagesNav() {
  injectMessagesNav();
  $('navMessages')?.addEventListener('click', () => { openMessagesPage().catch(console.error); });
}

function bindInfoPages() {
  document.querySelectorAll('[data-legal]').forEach((button) => {
    button.addEventListener('click', () => {
      setTimeout(() => {
        const modal = $('legalModal');
        if (!modal?.classList.contains('open')) return;
        document.body.classList.add('cop-info-page');
        document.body.dataset.copInfo = button.dataset.legal || '';
        const box = modal.querySelector('.box');
        if (box) box.scrollTop = 0;
        window.scrollTo({ top:0, behavior:'smooth' });
      }, 0);
    });
  });
  const modal = $('legalModal');
  if (modal) {
    new MutationObserver(() => {
      if (!modal.classList.contains('open')) {
        document.body.classList.remove('cop-info-page');
        delete document.body.dataset.copInfo;
      }
    }).observe(modal, { attributes:true, attributeFilter:['class'] });
  }
}

async function startRealtime() {
  if (realtimeChannel) { S.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (badgeTimer) { clearInterval(badgeTimer); badgeTimer = null; }
  const session = await ensureSession();
  if (!session) { refreshMessagesBadge().catch(()=>{}); return; }
  const uid = session.user.id;
  realtimeChannel = S.channel(`messages25-${uid}-${Date.now()}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'service_notifications',filter:`user_id=eq.${uid}`},(payload)=>{
      if (payload.new?.kind === 'message') { refreshMessagesBadge().catch(()=>{}); loadServiceConversations().catch(()=>{}); }
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'service_notifications',filter:`user_id=eq.${uid}`},()=>refreshMessagesBadge().catch(()=>{}))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'user_messages'},(payload)=>{
      if (payload.new?.sender_id !== uid) refreshMessagesBadge().catch(()=>{});
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'user_message_requests'},(payload)=>{
      if (payload.new?.recipient_id === uid) refreshMessagesBadge().catch(()=>{});
    })
    .subscribe();
  badgeTimer = setInterval(() => refreshMessagesBadge().catch(()=>{}), 8000);
}

async function init() {
  bindMessagesNav();
  enhanceMessagesPanel();
  bindInfoPages();
  await refreshMessagesBadge();
  await startRealtime();
  S.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    setTimeout(() => { refreshMessagesBadge().catch(()=>{}); startRealtime().catch(()=>{}); }, 0);
  });
}

init().catch(console.error);
