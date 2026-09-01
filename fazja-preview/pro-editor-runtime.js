/* Correção runtime isolada para o editor profissional em WebViews móveis. */
const modal = document.getElementById('proModal');
const box = modal?.querySelector(':scope > .box');

const saved = new Map();
let active = false;

function remember(el, prop) {
  if (!el) return;
  const key = `${el === document.documentElement ? 'html' : el === document.body ? 'body' : el.id || 'node'}:${prop}`;
  if (!saved.has(key)) saved.set(key, { el, prop, value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop) });
}

function setImportant(el, prop, value) {
  if (!el) return;
  remember(el, prop);
  el.style.setProperty(prop, value, 'important');
}

function restore() {
  for (const { el, prop, value, priority } of saved.values()) {
    if (value) el.style.setProperty(prop, value, priority || '');
    else el.style.removeProperty(prop);
  }
  saved.clear();
  active = false;
}

function pinToViewport() {
  if (!modal || !box || !modal.classList.contains('open')) return;
  active = true;

  setImportant(document.body, 'animation', 'none');
  setImportant(document.body, 'transform', 'none');
  setImportant(document.body, 'filter', 'none');
  setImportant(document.body, 'overflow', 'hidden');
  setImportant(document.documentElement, 'overflow', 'hidden');

  setImportant(modal, 'position', 'fixed');
  setImportant(modal, 'inset', '0');
  setImportant(modal, 'z-index', '320');
  setImportant(modal, 'width', '100%');
  setImportant(modal, 'height', '100dvh');
  setImportant(modal, 'min-height', '100dvh');
  setImportant(modal, 'display', 'grid');
  setImportant(modal, 'place-items', 'center');
  setImportant(modal, 'padding', '8px');
  setImportant(modal, 'overflow', 'hidden');

  setImportant(box, 'width', 'min(760px, 100%)');
  setImportant(box, 'max-height', 'calc(100dvh - 16px)');
  setImportant(box, 'overflow', 'auto');
  setImportant(box, 'margin', '0');

  const reset = () => {
    modal.scrollTop = 0;
    box.scrollTop = 0;
    box.scrollLeft = 0;
  };
  reset();
  requestAnimationFrame(reset);
  setTimeout(reset, 50);
  setTimeout(reset, 180);
}

if (modal) {
  const observer = new MutationObserver(() => {
    if (modal.classList.contains('open')) pinToViewport();
    else if (active) restore();
  });
  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#accountEditPro')) {
      setTimeout(pinToViewport, 0);
      setTimeout(pinToViewport, 120);
      setTimeout(pinToViewport, 320);
    }
  }, true);

  if (modal.classList.contains('open')) pinToViewport();
}
