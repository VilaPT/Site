/* Build 37 — torna o percurso categoria → serviço → localização mais coeso. */

const $ = (id) => document.getElementById(id);

function prepareChoiceFlow() {
  const categoryGrid = $('categoryGrid');
  const categorySection = categoryGrid?.closest('section.section.wrap');
  const servicesPanel = $('servicesPanel');
  const searchSection = $('copHomeSearchSection');
  if (!categorySection || !servicesPanel || !searchSection || $('copChoiceFlow')) return;

  const flow = document.createElement('section');
  flow.id = 'copChoiceFlow';
  flow.className = 'section wrap cop-choice-flow';
  categorySection.insertAdjacentElement('afterend', flow);

  searchSection.classList.remove('section', 'wrap');
  flow.appendChild(servicesPanel);
  flow.appendChild(searchSection);
}

function decorateLocalServicesCategory() {
  const grid = $('categoryGrid');
  if (!grid) return;
  [...grid.querySelectorAll('.category-card')].forEach((card) => {
    const name = card.querySelector('.cat-name')?.textContent?.trim();
    if (name !== 'Serviços locais' || card.dataset.copLocalIcon === '1') return;
    card.dataset.copLocalIcon = '1';
    const icon = card.querySelector('.cat-icon');
    if (icon) {
      icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16l-1.5-5h-13L4 10Z"/><path d="M5 10v9h14v-9"/><path d="M8 19v-5h4v5M15 13h2"/><path d="M4 10c0 1.3 1 2.3 2.3 2.3S8.7 11.3 8.7 10c0 1.3 1 2.3 2.3 2.3s2.3-1 2.3-2.3c0 1.3 1 2.3 2.3 2.3s2.4-1 2.4-2.3"/></svg>';
    }
  });
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

prepareChoiceFlow();
decorateLocalServicesCategory();

document.addEventListener('click', centerSelectedCategory);

const categoryGrid = $('categoryGrid');
if (categoryGrid) {
  new MutationObserver(() => {
    decorateLocalServicesCategory();
    prepareChoiceFlow();
  }).observe(categoryGrid, { childList: true, subtree: true });
}
