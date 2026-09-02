/* Chama O Pro — navegação + shell de mensagens consolidado.
   Junta o comportamento ativo de enhancements26.js e navigation25.js.
   A contagem global de notificações pertence a social38.js; aqui fica apenas
   a navegação, abertura de Mensagens e marcação de conversas como lidas. */
import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';

/* Mensagens entre utilizadores. */
{
  const $ = (id) => document.getElementById(id);
  let currentSession = null;
  let readRealtimeChannel = null;
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

  function requestNotificationRefresh() {
    document.dispatchEvent(new CustomEvent('cop:notifications-refresh'));
  }

  async function markThreadRead(requestId) {
    if (!requestId || !await ensureSession()) return;
    const { error } = await S.rpc('mark_user_message_thread_read', { p_request_id: requestId });
    if (error) {
      console.error('Não foi possível marcar a conversa como lida:', error);
      return;
    }
    requestNotificationRefresh();
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
    requestNotificationRefresh();
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

  async function startReadRealtime() {
    if (readRealtimeChannel) {
      S.removeChannel(readRealtimeChannel);
      readRealtimeChannel = null;
    }
    const session = await ensureSession();
    if (!session) return;
    const uid = session.user.id;
    readRealtimeChannel = S.channel(`direct-read-${uid}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_messages' }, (payload) => {
        if (payload.new?.sender_id === uid) return;
        const requestId = payload.new?.request_id;
        const chatOpen = $('communityChatModal')?.classList.contains('open');
        if (chatOpen && activeDirectThreadId && requestId === activeDirectThreadId) {
          markThreadRead(requestId).catch(console.error);
        }
      })
      .subscribe();
  }

  async function initMessages() {
    injectMessagesNav();
    bindMessagesNav();
    prepareDirectMessagesPanel();
    suppressLegacyAccountMessageBadge();
    bindInfoPages();
    await startReadRealtime();

    S.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      activeDirectThreadId = null;
      queueMicrotask(() => startReadRealtime().catch(() => {}));
    });
  }

  initMessages().catch(console.error);
}

/* Navegação principal. Mantém a sequência que anteriormente corria após enhancements26.js. */
{
  const $ = (id) => document.getElementById(id);
  const accountModal = $('accountModal');
  const authBtn = $('authBtn');
  const navIds = ['navHome', 'navRequests', 'navPro', 'navMessages', 'navAccount'];
  const sectionByNav = { navRequests: 'requests', navPro: 'professional', navMessages: 'messages', navAccount: 'profile' };
  const navBySection = { requests: 'navRequests', professional: 'navPro', messages: 'navMessages', profile: 'navAccount' };
  const titleBySection = { requests: 'Pedidos', professional: 'Área profissional', messages: 'Mensagens', profile: 'A minha conta' };

  let pendingSection = null;
  let restoringHistory = false;

  function normalizeAuthLabel() {
    if (!authBtn) return;
    const text = authBtn.textContent.trim();
    if (text === 'Entrar') authBtn.textContent = 'Entrar / Criar conta';
  }

  function setActiveNav(id) {
    navIds.forEach((navId) => {
      const button = $(navId);
      if (!button) return;
      const active = navId === id;
      button.classList.toggle('active', active);
      button.classList.toggle('is-current', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function setSectionUrl(section, method = 'push') {
    const url = new URL(window.location.href);
    const wanted = section || null;
    const current = url.searchParams.get('secao');
    if (current === wanted) return;
    if (wanted) url.searchParams.set('secao', wanted);
    else url.searchParams.delete('secao');
    const state = wanted ? { copSection: wanted } : { copSection: 'home' };
    if (method === 'replace') history.replaceState(state, '', url);
    else history.pushState(state, '', url);
  }

  function applyPage(section, historyMethod = 'push') {
    if (!accountModal?.classList.contains('open')) return false;
    document.body.classList.remove('cop-info-page');
    document.body.classList.add('cop-section-page');
    document.body.dataset.copSection = section;
    const heading = accountModal.querySelector(':scope > .box > h2');
    if (heading) heading.textContent = titleBySection[section] || 'A minha conta';
    setActiveNav(navBySection[section] || 'navAccount');
    if (!restoringHistory) setSectionUrl(section, historyMethod);
    window.scrollTo({ top:0, behavior:'smooth' });
    return true;
  }

  function leavePage({ updateHistory = true } = {}) {
    document.body.classList.remove('cop-section-page');
    delete document.body.dataset.copSection;
    pendingSection = null;
    setActiveNav('navHome');
    if (updateHistory && !restoringHistory) setSectionUrl(null, 'push');
  }

  navIds.forEach((id) => {
    const button = $(id);
    if (!button) return;
    button.addEventListener('click', () => {
      if (id === 'navHome') {
        accountModal?.classList.remove('open');
        $('legalModal')?.classList.remove('open');
        document.body.classList.remove('cop-info-page');
        leavePage();
        return;
      }
      const section = sectionByNav[id];
      pendingSection = section;
      setActiveNav(id);
      setTimeout(() => {
        if (!applyPage(section)) {
          if (!$('authModal')?.classList.contains('open')) return;
          pendingSection = null;
          setActiveNav('navHome');
        }
      }, id === 'navMessages' ? 140 : 90);
    });
  });

  if (accountModal) {
    new MutationObserver(() => {
      if (accountModal.classList.contains('open')) {
        if (pendingSection) applyPage(pendingSection);
      } else if (document.body.classList.contains('cop-section-page')) {
        leavePage({ updateHistory:false });
      }
    }).observe(accountModal, { attributes:true, attributeFilter:['class'] });
  }

  if (authBtn) {
    normalizeAuthLabel();
    new MutationObserver(normalizeAuthLabel).observe(authBtn, { childList:true, characterData:true, subtree:true });
  }

  window.addEventListener('popstate', () => {
    const section = new URL(window.location.href).searchParams.get('secao');
    restoringHistory = true;
    try {
      if (section && navBySection[section]) {
        pendingSection = section;
        $(navBySection[section])?.click();
        setTimeout(() => applyPage(section, 'replace'), 0);
      } else {
        accountModal?.classList.remove('open');
        leavePage({ updateHistory:false });
        window.scrollTo({ top:0, behavior:'smooth' });
      }
    } finally {
      setTimeout(() => { restoringHistory = false; }, 0);
    }
  });

  const initialSection = new URL(window.location.href).searchParams.get('secao');
  setActiveNav('navHome');
  normalizeAuthLabel();
  if (initialSection && navBySection[initialSection]) setTimeout(() => $(navBySection[initialSection])?.click(), 0);
}
