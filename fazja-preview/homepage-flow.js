/* Chama O Pro — fluxo consolidado da homepage (Builds 36 + 37).
   Preserva: categorias primeiro, serviço, localização e ícone de Serviços locais. */

const $ = (id) => document.getElementById(id);

function prepareHomepageFlow() {
  const searchForm = $('searchForm');
  const categorySection = $('categoryGrid')?.closest('section.section.wrap');
  if (!searchForm || !categorySection || $('copHomeSearchSection')) return;

  const searchSection = document.createElement('section');
  searchSection.id = 'copHomeSearchSection';
  searchSection.className = 'section wrap cop-home-search';
  searchSection.innerHTML = `
    <div class="section-head cop-search-head"><div>
      <h2>Onde precisas do serviço?</h2>
      <p>Escolhe uma categoria acima ou descreve manualmente o que precisas e indica a localização.</p>
    </div></div>`;
  categorySection.insertAdjacentElement('afterend', searchSection);
  searchSection.appendChild(searchForm);
}

function prepareChoiceFlow() {
  const categorySection = $('categoryGrid')?.closest('section.section.wrap');
  const servicesPanel = $('servicesPanel');
  const searchSection = $('copHomeSearchSection');
  if (!categorySection || !servicesPanel || !searchSection || $('copChoiceFlow')) return;

  const flow = document.createElement('section');
  flow.id = 'copChoiceFlow';
  flow.className = 'section wrap cop-choice-flow';
  categorySection.insertAdjacentElement('afterend', flow);
  searchSection.classList.remove('section', 'wrap');
  flow.append(servicesPanel, searchSection);
}

function decorateLocalServicesCategory() {
  const grid = $('categoryGrid');
  if (!grid) return;
  for (const card of grid.querySelectorAll('.category-card')) {
    if (card.querySelector('.cat-name')?.textContent?.trim() !== 'Serviços locais' || card.dataset.copLocalIcon === '1') continue;
    card.dataset.copLocalIcon = '1';
    const icon = card.querySelector('.cat-icon');
    if (icon) icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16l-1.5-5h-13L4 10Z"/><path d="M5 10v9h14v-9"/><path d="M8 19v-5h4v5M15 13h2"/><path d="M4 10c0 1.3 1 2.3 2.3 2.3S8.7 11.3 8.7 10c0 1.3 1 2.3 2.3 2.3s2.3-1 2.3-2.3c0 1.3 1 2.3 2.3 2.3s2.4-1 2.4-2.3"/></svg>';
  }
}

function guideSelectedService(event) {
  if (!event.target.closest('[data-skill]')) return;
  setTimeout(() => {
    const searchSection = $('copHomeSearchSection');
    const city = $('city');
    if (!searchSection || !city) return;
    searchSection.classList.remove('cop-search-attention');
    void searchSection.offsetWidth;
    searchSection.classList.add('cop-search-attention');
    searchSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => city.focus({ preventScroll: true }), 320);
  }, 0);
}

function centerSelectedCategory(event) {
  const category = event.target.closest('[data-cat]');
  if (!category) return;
  setTimeout(() => {
    prepareChoiceFlow();
    const flow = $('copChoiceFlow');
    const services = $('servicesPanel');
    if (!flow || !services || services.classList.contains('hidden')) return;
    flow.classList.add('cop-choice-active');
    category.classList.add('cop-category-picked');
    flow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 40);
}

prepareHomepageFlow();
prepareChoiceFlow();
decorateLocalServicesCategory();
document.addEventListener('click', guideSelectedService);
document.addEventListener('click', centerSelectedCategory);

const categoryGrid = $('categoryGrid');
if (categoryGrid) new MutationObserver(() => {
  decorateLocalServicesCategory();
  prepareChoiceFlow();
}).observe(categoryGrid, { childList: true, subtree: true });
