/* Build 26, atualizado no Build 38: mensagens apenas entre utilizadores e contador persistente vindo do backend. */
import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';

const $ = (id) => document.getElementById(id);
let currentSession = null;
let realtimeChannel = null;
let badgeTimer = null;
let activeDirectThreadId = null;
let panelAttempts = 0;

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

function prepareDirectMessagesPanel() {
  const panel = document.querySelector('[data-account-panel="messages"]');
  const inbox = $('communityInbox');
  if (!panel || !inbox) {
    panelAttempts += 1;
    if (panelAttempts < 80) setTimeout(prepareDirectMessagesPanel, 50);
    return;
  }
  if (panel.dataset.copMessages26 === '1') return;
  panel.dataset.copMessages26 = '1';
  const heading = panel.querySelector(':scope > h3');
  if (heading) heading.textContent = 'Mensagens';
  const note = panel.querySelector(':scope > .account-privacy-note');
  if (note) note.textContent = 'Aqui encontras apenas mensagens entre utilizadores. Os pedidos e as conversas associadas a serviços continuam nas respetivas áreas de Pedidos e Profissional.';
}

function badgeElement(create = true) {
  const nav = $('navMessages');
  if (!nav) return null;
  let badge = nav.querySelector('.cop-messages-badge');
  if (!badge && create) {
    badge = document.createElement('span');
    badge.className = 'notification-badge cop-messages-badge';
    badge.setAttribute('aria-label', 'Mensagens não lidas');
    (nav.querySelector('.nav-icon') || nav).appendChild(badge);
  }
  return badge;
}

function setBadgeValue(count) {
  const total = Math.max(0, Number(count || 0));
  if (!total) {
    badgeElement(false)?.remove();
    return;
  }
  const badge = badgeElement(true);
  if (!badge) return;
  badge.textContent = total > 9 ? '9+' : String(total);
  badge.setAttribute('aria-label', `${total} ${total === 1 ? 'notificação de mensagem não lida' : 'notificações de mensagens não lidas'}`);
}

async function refreshMessagesBadge() {
  injectMessagesNav();
  const session = await ensureSession();
  if (!session) {
    setBadgeValue(0);
    return;
  }
  const { data, error } = await S.rpc('notification_counts');
  if (error) {
    console.error('Não foi possível atualizar o contador de mensagens:', error);
    return;
  }
  setBadgeValue(Number(data?.messages_count || 0));
}

async function markThreadRead(requestId) {
  if (!requestId || !await ensureSession()) return;
  const { error } = await S.rpc('mark_user_message_thread_read', { p_request_id: requestId });
  if (error) {
    console.error('Não foi possível marcar a conversa como lida:', error);
    return;
  }
  await refreshMessagesBadge();
  document.dispatchEvent(new CustomEvent('cop:notifications-refresh'));
}

async function openMessagesPage() {
  const session = await ensureSession();
  if (!session) {
    $('authBtn')?.click();
    return;
  }
  prepareDirectMessagesPanel();
  $('accountModal')?.classList.add('open');
  $('communityMessagesTab')?.click();
  await refreshMessagesBadge();
}

function bindMessagesNav() {
  injectMessagesNav();
  $('navMessages')?.addEventListener('click', () => openMessagesPage().catch(console.error));

  /* Ler a lista não marca as conversas como lidas. Só abrir a conversa o faz. */
  document.addEventListener('click', (event) => {
    const open = event.target.closest('[data-message-open]');
    if (open?.dataset.messageOpen) {
      activeDirectThreadId = open.dataset.messageOpen;
      markThreadRead(activeDirectThreadId).catch(console.error);
      return;
    }
    if (event.target.closest('#communityChatClose')) activeDirectThreadId = null;
  }, true);
}

function suppressLegacyAccountMessageBadge() {
  const account = $('navAccount');
  if (!account) return;
  const clean = () => account.querySelectorAll('.community-message-badge').forEach((badge) => badge.remove());
  clean();
  new MutationObserver(clean).observe(account, { childList: true, subtree: true });
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
}

async function startRealtime() {
  if (realtimeChannel) {
    S.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (badgeTimer) {
    clearInterval(badgeTimer);
    badgeTimer = null;
  }

  const session = await ensureSession();
  if (!session) {
    setBadgeValue(0);
    return;
  }

  const uid = session.user.id;
  const refresh = () => refreshMessagesBadge().catch(console.error);
  realtimeChannel = S.channel(`direct-messages-38-${uid}-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_messages' }, (payload) => {
      if (payload.new?.sender_id === uid) { refresh(); return; }
      const requestId = payload.new?.request_id;
      const chatOpen = $('communityChatModal')?.classList.contains('open');
      if (chatOpen && activeDirectThreadId && requestId === activeDirectThreadId) {
        markThreadRead(requestId).catch(console.error);
      } else {
        refresh();
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_messages' }, refresh)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'user_messages' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_message_requests' }, refresh)
    .subscribe();

  /* O Realtime é um sinal; a fonte de verdade continua a ser notification_counts(). */
  badgeTimer = setInterval(() => refreshMessagesBadge().catch(() => {}), 30000);
}

async function init() {
  injectMessagesNav();
  bindMessagesNav();
  prepareDirectMessagesPanel();
  suppressLegacyAccountMessageBadge();
  bindInfoPages();
  await refreshMessagesBadge();
  await startRealtime();

  S.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    activeDirectThreadId = null;
    setTimeout(() => {
      refreshMessagesBadge().catch(() => {});
      startRealtime().catch(() => {});
    }, 0);
  });
}

init().catch(console.error);
