/* Build 25 — cinco áreas de navegação com Mensagens entre Profissional e Conta. */
(() => {
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
})();
