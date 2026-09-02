/* Build 36 — homepage: categorias antes da pesquisa manual.
   Mantém intacto o motor de pesquisa e altera apenas a ordem/guia do percurso. */

const $ = (id) => document.getElementById(id);

function prepareHomepageFlow() {
  const searchForm = $('searchForm');
  const categoryGrid = $('categoryGrid');
  const categorySection = categoryGrid?.closest('section.section.wrap');
  if (!searchForm || !categorySection || $('copHomeSearchSection')) return;

  const searchSection = document.createElement('section');
  searchSection.id = 'copHomeSearchSection';
  searchSection.className = 'section wrap cop-home-search';
  searchSection.innerHTML = `
    <div class="section-head cop-search-head">
      <div>
        <h2>Onde precisas do serviço?</h2>
        <p>Escolhe uma categoria acima ou descreve manualmente o que precisas e indica a localização.</p>
      </div>
    </div>`;

  categorySection.insertAdjacentElement('afterend', searchSection);
  searchSection.appendChild(searchForm);
}

function guideSelectedService(event) {
  const service = event.target.closest('[data-skill]');
  if (!service) return;

  /* O handler original escolhe/preenche o serviço. Depois conduzimos o utilizador
     diretamente à localização, sem alterar a lógica de pesquisa existente. */
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

prepareHomepageFlow();
document.addEventListener('click', guideSelectedService);
