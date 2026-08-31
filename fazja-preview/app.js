import { getSession, initAuth } from './js/auth.js';
import { initSearch } from './js/search.js?v=13';
import { initRequests, openRequest, requestService } from './js/requests.js?v=11';
import {
  initProfessionals,
  openProfessionalProfile,
} from './js/professionals.js?v=11';
import {
  loadMembership,
  loadPlan,
  membershipState,
} from './js/memberships.js';
import { initPortugalPlacesDatalist } from './js/location.js?v=11';
import { initIdentityVerification } from './js/verification.js?v=15';

const $ = (id) => document.getElementById(id);
let session = null;

function ensureFeatureStyles() {
  if (document.querySelector('link[data-cop-features="13"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './feature13.css?v=13';
  link.dataset.copFeatures = '13';
  document.head.appendChild(link);
}

function toast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('on');
  setTimeout(() => element.classList.remove('on'), 2600);
}

function renderSessionUi() {
  const state = membershipState();
  if ($('authBtn')) $('authBtn').textContent = session ? 'Sair' : 'Entrar';
  if ($('proCta')) {
    $('proCta').textContent = !session ? 'Quero prestar serviços' : state === 'trial' || state === 'active' ? 'Área profissional' : state === 'expired' ? 'Reativar profissional' : 'Tornar-me profissional';
  }
}

async function refreshSessionUi(nextSession) {
  session = nextSession;
  await loadMembership(session);
  renderSessionUi();
}

function bindGlobalUi() {
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.onclick = () => button.closest('.modal')?.classList.remove('open');
  });
  $('homeBtn')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

const aboutHtml = `
  <div class="about-grid modal-about-grid">
    <div class="about-card"><strong>Para quem precisa</strong><span>Descreve o problema, indica a localidade e encontra profissionais próximos. Podes comparar disponibilidade, distância, perfil, identidade verificada e avaliações antes de fazeres o pedido.</span></div>
    <div class="about-card"><strong>Para quem sabe fazer</strong><span>Cria o teu perfil profissional, escolhe os serviços que prestas, define a tua localização base e até onde te deslocas. Recebes pedidos compatíveis, falas diretamente com o cliente e organizas os serviços na tua agenda.</span></div>
  </div>
  <p>O <strong>Chama O Pro</strong> aproxima quem precisa de resolver um problema de profissionais que prestam esse serviço na sua zona. Pesquisa pelo que precisas, encontra profissionais por proximidade, fala em privado, recebe uma proposta e, no final, confirma o serviço e deixa uma avaliação.</p>
`;

const faqHtml = `
  <div class="faq-grid modal-faq-grid">
    <details><summary>O que é o Chama O Pro?</summary><p>É uma plataforma que liga pessoas que precisam de um serviço a profissionais adequados e próximos. Podes procurar por problema, serviço ou categoria e escolher a opção que melhor se adapta ao que precisas.</p></details>
    <details><summary>Como encontro um profissional?</summary><p>Indica o que precisas de resolver e a tua localidade ou código postal. O sistema identifica o tipo de serviço e procura profissionais compatíveis, dando prioridade à proximidade e mostrando disponibilidade, perfil e avaliações.</p></details>
    <details><summary>Como funciona a verificação de conta?</summary><p>A verificação é gratuita. Primeiro adicionas uma fotografia de perfil onde exista apenas um rosto. Depois a câmara pede movimentos do rosto para confirmar presença real e compara o rosto ao vivo com a fotografia. Quando a correspondência é confirmada, o símbolo de verificação fica preenchido. Se alterares a fotografia, a verificação é retirada e podes fazê-la novamente.</p></details>
    <details><summary>Posso ler os comentários de outros clientes?</summary><p>Sim. As avaliações e comentários deixados após serviços concluídos aparecem no perfil público do profissional. O profissional também consegue consultar as avaliações recebidas na sua área profissional.</p></details>
    <details><summary>Como é usada a localização?</summary><p>A localização serve para calcular a distância entre a zona do pedido e a base do profissional. Um profissional pode definir até onde aceita deslocar-se. A morada exata do profissional não é apresentada publicamente.</p></details>
    <details><summary>O Chama O Pro é gratuito para clientes?</summary><p>Sim. Criar conta, pesquisar profissionais, verificar a conta e fazer pedidos não tem custo para o cliente.</p></details>
    <details><summary>Como funciona para profissionais?</summary><p>O profissional cria o perfil, escolhe os serviços que presta, a localização base e o raio de deslocação. Os primeiros 60 dias são gratuitos. O valor do plano profissional será sempre apresentado antes da ativação de qualquer pagamento.</p></details>
    <details><summary>O profissional paga por cada contacto ou por cada trabalho?</summary><p>Não cobramos créditos por contacto nem comissão sobre o valor de cada serviço. O modelo profissional é baseado num plano.</p></details>
    <details><summary>Como funciona a agenda?</summary><p>Depois de uma proposta ser aceite, o profissional pode marcar o dia e a hora do serviço. A marcação fica visível para ambas as partes e pode ser alterada ou cancelada pelo profissional.</p></details>
    <details><summary>Posso receber alertas no telemóvel?</summary><p>Sim. Podes ativar alertas do sistema para mensagens e atualizações, e escolher vibração e som quando o dispositivo e o navegador o permitirem. Os profissionais podem ainda escolher um lembrete para serviços marcados.</p></details>
    <details><summary>Quando é que o meu telefone e morada são partilhados?</summary><p>Os dados pessoais do cliente não aparecem num perfil público. Quando fazes um pedido diretamente a um profissional, os dados necessários desse pedido ficam disponíveis apenas para as partes envolvidas.</p></details>
    <details><summary>Posso falar com o profissional antes de aceitar uma proposta?</summary><p>Sim. Cada pedido direcionado abre uma conversa privada. O profissional pode esclarecer dúvidas e enviar uma proposta, e o cliente decide se a aceita ou recusa.</p></details>
    <details><summary>Como funcionam as avaliações?</summary><p>Quando o profissional marca o trabalho como terminado, o cliente confirma a conclusão e atribui uma avaliação de 1 a 5 estrelas, podendo também deixar um comentário. A reputação ajuda outros clientes a tomar decisões mais informadas.</p></details>
    <details><summary>E se não houver nenhum profissional disponível perto de mim?</summary><p>O sistema respeita as zonas e os raios de deslocação definidos pelos profissionais. Se não houver correspondência nesse momento, podes guardar o pedido e voltar mais tarde.</p></details>
    <details><summary>Quem é responsável pela execução e pelo preço do serviço?</summary><p>O Chama O Pro facilita a descoberta, o contacto e a comunicação. A proposta, o preço acordado, as qualificações declaradas e a execução do trabalho são da responsabilidade do profissional e do cliente envolvidos no serviço.</p></details>
  </div>
`;

function bindLegalUi() {
  const legal = {
    about: { title: 'Sobre o Chama O Pro', html: aboutHtml },
    faq: { title: 'Perguntas frequentes', html: faqHtml },
    privacy: {
      title: 'Política de Privacidade',
      body: 'O Chama O Pro utiliza os dados necessários para criar contas, apresentar perfis profissionais, guardar pedidos, gerir marcações, avaliações e melhorar a pesquisa de serviços. A fotografia de perfil pode ser apresentada publicamente. No protótipo de verificação facial, a comparação e a prova de movimento são processadas no dispositivo; o vídeo ao vivo e o vetor biométrico não são guardados, sendo registados apenas o resultado, a data e pontuações técnicas da verificação. A autenticação e a base de dados usam infraestrutura Supabase. A localização indicada é usada para calcular proximidade entre pedidos e profissionais. Não vendemos dados pessoais a anunciantes.',
    },
    terms: {
      title: 'Termos de Utilização',
      body: 'A conta de utilizador é gratuita. A verificação de identidade também é gratuita e serve como um sinal adicional de confiança, não como garantia de competência profissional. O modo profissional inclui 60 dias gratuitos a partir da criação do primeiro perfil profissional. Depois desse período, o perfil profissional deixa de aparecer publicamente sem uma subscrição ativa. O valor da mensalidade será apresentado antes da ativação do pagamento. Cada profissional é responsável pela informação do perfil, qualificações, preços, marcações e execução do serviço.',
    },
  };

  document.querySelectorAll('[data-legal]').forEach((button) => {
    button.onclick = () => {
      const content = legal[button.dataset.legal];
      if (!content) return;
      $('legalTitle').textContent = content.title;
      const body = $('legalBody');
      if (content.html) body.innerHTML = content.html;
      else body.textContent = content.body || '';
      $('legalModal')?.classList.add('open');
    };
  });
}

async function initIdentityVerificationSafely() {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver) {
    await initIdentityVerification({ getSession, toast });
    return;
  }

  class NonReentrantMutationObserver {
    constructor(callback) {
      this.target = null;
      this.options = null;
      this.running = false;
      this.observer = new NativeMutationObserver((mutations) => {
        if (this.running) return;
        this.running = true;
        this.observer.disconnect();
        try {
          callback(mutations, this);
        } finally {
          const target = this.target;
          const options = this.options;
          this.running = false;
          if (target && options) this.observer.observe(target, options);
        }
      });
    }

    observe(target, options) {
      this.target = target;
      this.options = options;
      this.observer.observe(target, options);
    }

    disconnect() {
      this.target = null;
      this.options = null;
      this.observer.disconnect();
    }

    takeRecords() {
      return this.observer.takeRecords();
    }
  }

  window.MutationObserver = NonReentrantMutationObserver;
  try {
    await initIdentityVerification({ getSession, toast });
  } finally {
    window.MutationObserver = NativeMutationObserver;
  }
}

async function init() {
  ensureFeatureStyles();
  bindGlobalUi();
  bindLegalUi();
  initRequests();
  initPortugalPlacesDatalist().catch(() => {});
  session = await initAuth({
    onSessionChange: (nextSession) => { refreshSessionUi(nextSession).catch(console.error); },
    onIntentReady: async (intent, nextSession) => {
      await refreshSessionUi(nextSession);
      if (intent === 'pro') await openProfessionalProfile();
      if (intent === 'request') openRequest();
    },
    onToast: toast,
  });
  await initIdentityVerificationSafely();
  const [searchData] = await Promise.all([
    initSearch({ getSession, onRequest: requestService }),
    loadPlan(),
  ]);
  initProfessionals({ skills: searchData.skills, onMembershipChange: refreshSessionUi });
  await loadMembership(session);
  renderSessionUi();
}

init().catch((error) => {
  console.error(error);
  if ($('categoryGrid')) $('categoryGrid').innerHTML = '<div class="loading-card">Não foi possível carregar os serviços. Recarrega a página.</div>';
});