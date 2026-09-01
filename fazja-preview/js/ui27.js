/* Build 27 — controlador central de interações, overlays, foco e navegação contextual. */

const $ = (id) => document.getElementById(id);
const overlayStack = [];
const previousFocus = new WeakMap();
let observer = null;
let pageObserver = null;

const ROUTE_SURFACES = new Set(['accountModal', 'legalModal']);
const SECTION_NAV = {
  home: 'navHome',
  requests: 'navRequests',
  professional: 'navPro',
  messages: 'navMessages',
  profile: 'navAccount',
};

function resolveElement(target) {
  if (!target) return null;
  if (target instanceof Element) return target;
  const value = String(target);
  return value.startsWith('#') ? document.querySelector(value) : document.getElementById(value) || document.querySelector(value);
}

function isVisible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && !element.hasAttribute('hidden');
}

function focusCandidate(surface, preferred = null) {
  const explicit = resolveElement(preferred);
  if (explicit && surface.contains(explicit) && isVisible(explicit)) return explicit;
  const selectors = [
    '[data-cop-autofocus]',
    'input:not([type="hidden"]):not(:disabled)',
    'textarea:not(:disabled)',
    'select:not(:disabled)',
    '.btn.primary:not(:disabled)',
    'button:not(.x):not(:disabled)',
    'a[href]',
  ];
  for (const selector of selectors) {
    const candidate = [...surface.querySelectorAll(selector)].find(isVisible);
    if (candidate) return candidate;
  }
  return surface.querySelector('.box') || surface;
}

function lockViewport() {
  document.documentElement.classList.add('cop-overlay-open');
  document.body.classList.add('cop-overlay-open');
}

function unlockViewport() {
  if (overlayStack.length) return;
  document.documentElement.classList.remove('cop-overlay-open');
  document.body.classList.remove('cop-overlay-open');
}

function setOverlayA11y(surface, open) {
  if (!surface) return;
  if (open) {
    surface.setAttribute('role', 'dialog');
    surface.setAttribute('aria-modal', 'true');
    surface.removeAttribute('aria-hidden');
    const box = surface.querySelector('.box');
    if (box && !box.hasAttribute('tabindex')) box.setAttribute('tabindex', '-1');
  } else {
    surface.setAttribute('aria-hidden', 'true');
  }
}

function activateOverlay(surface, { focus = null } = {}) {
  if (!surface || ROUTE_SURFACES.has(surface.id)) return;
  if (!overlayStack.includes(surface)) {
    previousFocus.set(surface, document.activeElement instanceof HTMLElement ? document.activeElement : null);
    overlayStack.push(surface);
  }
  surface.classList.add('cop-overlay-active');
  surface.style.zIndex = String(120 + overlayStack.indexOf(surface) * 10);
  setOverlayA11y(surface, true);
  lockViewport();

  requestAnimationFrame(() => {
    const box = surface.querySelector('.box');
    if (box) box.scrollTop = 0;
    const candidate = focusCandidate(surface, focus);
    try { candidate?.focus?.({ preventScroll: true }); } catch { candidate?.focus?.(); }
  });
}

function deactivateOverlay(surface, { restoreFocus = true } = {}) {
  if (!surface || ROUTE_SURFACES.has(surface.id)) return;
  const index = overlayStack.indexOf(surface);
  if (index >= 0) overlayStack.splice(index, 1);
  surface.classList.remove('cop-overlay-active');
  surface.style.removeProperty('z-index');
  setOverlayA11y(surface, false);
  unlockViewport();

  if (restoreFocus) {
    const previous = previousFocus.get(surface);
    if (previous?.isConnected) {
      requestAnimationFrame(() => {
        try { previous.focus({ preventScroll: true }); } catch { previous.focus?.(); }
      });
    }
  }
  previousFocus.delete(surface);
}

export function openOverlay(target, options = {}) {
  const surface = resolveElement(target);
  if (!surface) return false;
  surface.classList.add('open');
  activateOverlay(surface, options);
  return true;
}

export function closeOverlay(target, options = {}) {
  const surface = resolveElement(target);
  if (!surface) return false;
  surface.classList.remove('open');
  deactivateOverlay(surface, options);
  return true;
}

function requestFeatureClose(surface) {
  if (!surface) return;
  const closer = [...surface.querySelectorAll('[data-close], .x, [id$="Close"]')]
    .find((button) => isVisible(button) && !button.disabled);
  if (closer) {
    closer.click();
    return;
  }
  closeOverlay(surface);
}

function topOverlay() {
  for (let index = overlayStack.length - 1; index >= 0; index -= 1) {
    const surface = overlayStack[index];
    if (surface?.classList.contains('open')) return surface;
  }
  return null;
}

function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const surface = topOverlay();
  if (!surface) return;
  const focusable = [...surface.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])')]
    .filter(isVisible);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function waitFor(predicate, timeout = 2200) {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      let value = false;
      try { value = Boolean(predicate()); } catch { value = false; }
      if (value || performance.now() - started >= timeout) {
        resolve(value);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function showInteractionHint(message) {
  const toast = $('toast');
  if (!toast || !message) return;
  toast.textContent = message;
  toast.classList.add('on');
  window.clearTimeout(showInteractionHint.timer);
  showInteractionHint.timer = window.setTimeout(() => toast.classList.remove('on'), 4200);
}

export async function revealTarget(target, { focus = true, highlight = true, block = 'center' } = {}) {
  const element = resolveElement(target);
  if (!element) return false;
  if (highlight) {
    element.classList.add('cop-interaction-target');
    window.setTimeout(() => element.classList.remove('cop-interaction-target'), 2200);
  }
  element.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' });
  if (focus && typeof element.focus === 'function') {
    window.setTimeout(() => {
      try { element.focus({ preventScroll: true }); } catch { element.focus(); }
    }, 260);
  }
  return true;
}

export async function navigateSection(section, { target = null, focus = true, hint = '', block = 'center' } = {}) {
  const normalized = SECTION_NAV[section] ? section : 'home';
  const nav = $(SECTION_NAV[normalized]);
  if (!nav) return false;
  nav.click();

  if (normalized === 'home') {
    await waitFor(() => !document.body.classList.contains('cop-section-page'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (hint) showInteractionHint(hint);
    return true;
  }

  await waitFor(() => document.body.dataset.copSection === normalized && $('accountModal')?.classList.contains('open'));
  if (!target) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (hint) showInteractionHint(hint);
  if (target) {
    await waitFor(() => Boolean(resolveElement(target)));
    await revealTarget(target, { focus, block });
  }
  return true;
}

function normalizeRouteSurface(surface) {
  if (!surface) return;
  surface.setAttribute('role', 'region');
  surface.removeAttribute('aria-modal');
  surface.removeAttribute('aria-hidden');
}

function handleModalMutation(surface) {
  if (!surface?.classList?.contains('modal')) return;
  if (ROUTE_SURFACES.has(surface.id)) {
    normalizeRouteSurface(surface);
    return;
  }
  if (surface.classList.contains('open')) activateOverlay(surface);
  else deactivateOverlay(surface);
}

function observeModals() {
  document.querySelectorAll('.modal').forEach(handleModalMutation);
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        handleModalMutation(mutation.target);
        continue;
      }
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('.modal')) {
          observer.observe(node, { attributes: true, attributeFilter: ['class'] });
          handleModalMutation(node);
        }
        node.querySelectorAll?.('.modal').forEach((modal) => {
          observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
          handleModalMutation(modal);
        });
      });
    }
  });
  document.querySelectorAll('.modal').forEach((modal) => observer.observe(modal, { attributes: true, attributeFilter: ['class'] }));
  observer.observe(document.body, { childList: true, subtree: true });
}

function observePageNavigation() {
  let lastSection = document.body.dataset.copSection || '';
  let infoOpen = document.body.classList.contains('cop-info-page');
  pageObserver = new MutationObserver(() => {
    const nextSection = document.body.dataset.copSection || '';
    const nextInfo = document.body.classList.contains('cop-info-page');
    if (nextSection !== lastSection && nextSection) {
      lastSection = nextSection;
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    } else if (nextSection !== lastSection) {
      lastSection = nextSection;
    }
    if (nextInfo !== infoOpen) {
      infoOpen = nextInfo;
      if (nextInfo) requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    }
  });
  pageObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-cop-section'] });
}

function bindGlobalInteractionRules() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const surface = topOverlay();
      if (surface) {
        event.preventDefault();
        requestFeatureClose(surface);
        return;
      }
    }
    trapFocus(event);
  }, true);

  document.addEventListener('pointerdown', (event) => {
    const surface = event.target instanceof Element ? event.target.closest('.modal.open') : null;
    if (!surface || ROUTE_SURFACES.has(surface.id) || event.target !== surface) return;
    requestFeatureClose(surface);
  });

  document.addEventListener('click', (event) => {
    const action = event.target instanceof Element ? event.target.closest('[data-cop-section]') : null;
    if (!action) return;
    event.preventDefault();
    navigateSection(action.dataset.copSection, {
      target: action.dataset.copTarget || null,
      focus: action.dataset.copFocus !== 'false',
      hint: action.dataset.copHint || '',
    }).catch(console.error);
  });

  document.addEventListener('invalid', (event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement)) return;
    window.setTimeout(() => revealTarget(field, { focus: true, highlight: true, block: 'center' }), 0);
  }, true);
}

function markViewportSafe() {
  document.body.classList.add('cop-ui-viewport-safe');
}

function init() {
  document.documentElement.classList.add('cop-ui-system');
  observeModals();
  observePageNavigation();
  bindGlobalInteractionRules();
  window.setTimeout(markViewportSafe, 1550);
}

export const COPUI = {
  openOverlay,
  closeOverlay,
  navigateSection,
  revealTarget,
  showInteractionHint,
};

window.COPUI = COPUI;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
