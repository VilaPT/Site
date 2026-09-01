import './pro-editor-runtime.js';

/* Filtro visual multi-distrito da consola Owner. Mantém a consulta base sem dados privados. */
const $ = (id) => document.getElementById(id);
const districts = ['Aveiro','Beja','Braga','Bragança','Castelo Branco','Coimbra','Évora','Faro','Guarda','Leiria','Lisboa','Portalegre','Porto','Santarém','Setúbal','Viana do Castelo','Vila Real','Viseu','Açores','Madeira'];
const ALL = '__all__';
const NONE = '__none__';
let selected = new Set([ALL]);
let listObserver = null;

function buttonHtml(value, label, extra='') {
  return `<button type="button" class="owner-district-choice ${extra}" data-owner-district-choice="${value}" aria-pressed="${selected.has(value) ? 'true' : 'false'}"><span class="owner-district-check" aria-hidden="true">✓</span><span>${label}</span></button>`;
}

function renderChoices() {
  const host = $('ownerDistrictMulti');
  if (!host) return;
  host.innerHTML = buttonHtml(ALL, 'Todos', 'all') + districts.map((d) => buttonHtml(d, d)).join('') + buttonHtml(NONE, 'Sem distrito', 'none');
  updateSummary();
}

function updateSummary() {
  const summary = $('ownerDistrictSummary');
  if (!summary) return;
  if (selected.has(ALL)) summary.textContent = 'A mostrar todos os distritos e regiões.';
  else {
    const labels = [...selected].map((value) => value === NONE ? 'Sem distrito' : value);
    summary.textContent = labels.length === 1 ? `A mostrar: ${labels[0]}.` : `A mostrar ${labels.length} opções: ${labels.join(', ')}.`;
  }
}

function cardDistrict(card) {
  const meta = card.querySelector('.owner-user-meta')?.textContent?.trim() || '';
  const district = meta.split(' · ')[0]?.trim() || '';
  return district === 'Sem distrito' || !district ? NONE : district;
}

function applyFilter() {
  const list = $('ownerUserList');
  if (!list) return;
  const cards = [...list.querySelectorAll('.owner-user-card')];
  if (!cards.length) return;
  const showAll = selected.has(ALL);
  let visible = 0;
  let visibleModerators = 0;
  cards.forEach((card) => {
    const show = showAll || selected.has(cardDistrict(card));
    card.hidden = !show;
    if (show) {
      visible += 1;
      if (card.textContent.includes('· Moderador')) visibleModerators += 1;
    }
  });
  const total = $('ownerUsersCount');
  if (total) total.textContent = String(visible);
  const moderators = $('ownerModeratorsCount');
  if (moderators) moderators.textContent = String(visibleModerators);

  let empty = $('ownerDistrictEmpty');
  if (!visible) {
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'ownerDistrictEmpty';
      empty.className = 'owner-console-empty owner-district-empty';
      empty.textContent = 'Não existem utilizadores nas opções selecionadas.';
      list.appendChild(empty);
    }
    empty.hidden = false;
  } else if (empty) empty.hidden = true;
}

function toggleChoice(value) {
  if (value === ALL) {
    selected = new Set([ALL]);
  } else {
    selected.delete(ALL);
    if (selected.has(value)) selected.delete(value); else selected.add(value);
    if (!selected.size) selected.add(ALL);
  }
  renderChoices();
  applyFilter();
}

function attachListObserver() {
  const list = $('ownerUserList');
  if (!list || list.dataset.districtMultiObserved) return;
  list.dataset.districtMultiObserved = '1';
  listObserver?.disconnect();
  listObserver = new MutationObserver(() => requestAnimationFrame(applyFilter));
  listObserver.observe(list, { childList:true });
}

function enhanceDistrictFilter() {
  const select = $('ownerDistrictFilter');
  if (!select || select.dataset.multiEnhanced) return;
  select.dataset.multiEnhanced = '1';
  select.value = '';
  select.classList.add('owner-district-native-hidden');

  const shell = document.createElement('div');
  shell.className = 'owner-district-selector';
  shell.innerHTML = '<div class="owner-district-selector-head"><div><strong>Distritos e regiões</strong><span>Seleciona um, vários ou todos.</span></div><span id="ownerDistrictSummary" class="owner-district-summary"></span></div><div id="ownerDistrictMulti" class="owner-district-grid" role="group" aria-label="Filtrar utilizadores por distrito ou região"></div>';
  select.insertAdjacentElement('beforebegin', shell);
  renderChoices();
  shell.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-owner-district-choice]');
    if (!button) return;
    toggleChoice(button.dataset.ownerDistrictChoice);
  });
  attachListObserver();
  applyFilter();
}

const rootObserver = new MutationObserver(() => {
  enhanceDistrictFilter();
  attachListObserver();
});
rootObserver.observe(document.body, { childList:true, subtree:true });
enhanceDistrictFilter();
