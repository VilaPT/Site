/*
  Community mock frontend (phase 1)
  Future integration points:
  - GET /community/posts
  - POST /community/posts
  - POST /community/posts/:id/comments
*/

const SUPPORTED_LANGUAGES = ["pt", "en"];
const LANGUAGE_STORAGE_KEY = "wdjp_language";
const AUTH_TOKEN_STORAGE_KEY = "wdjp_auth_token";
const AUTH_USER_STORAGE_KEY = "wdjp_auth_user";
const API_BASE_URL = resolveApiBaseUrl();
let currentLanguage = "pt";
let activeProjectFilter = "all";
let authMode = "login";
let authToken = "";
let authUser = null;
let authRequestInFlight = false;

const translations = {
  pt: {
    titles: {
      index: "Web Dev Jrs Portugal | Community Hub",
      desafios: "Desafios | Web Dev Jrs Portugal",
      projetos: "Projetos | Web Dev Jrs Portugal",
      recursos: "Recursos | Web Dev Jrs Portugal",
      comunidade: "Comunidade | Web Dev Jrs Portugal",
      sobre: "Sobre | Web Dev Jrs Portugal"
    },
    common: {
      navAria: "Navegação principal",
      nav: {
        index: "Início",
        desafios: "Desafios",
        projetos: "Projetos",
        recursos: "Recursos",
        comunidade: "Comunidade",
        sobre: "Sobre",
        cta: "Entrar",
        ctaLogged: "Conta"
      },
      menu: "Menu",
      languageLabel: "Idioma",
      languageAria: "Selecionar idioma",
      footer: "&copy; 2026 Web Dev Jrs Portugal. Comunidade de programação para evolução contínua.",
      auth: {
        title: "Entrar na comunidade",
        loginTab: "Login",
        signupTab: "Criar conta",
        name: "Nome",
        email: "Email",
        password: "Palavra-passe",
        loginBtn: "Entrar",
        signupBtn: "Criar conta",
        note: "Autenticacao real ligada ao backend.",
        processing: "A processar...",
        loginSuccess: "Login efetuado com sucesso.",
        registerSuccess: "Conta criada. Verifica o teu email para ativar.",
        loggedInAs: "Sessao ativa:",
        logoutBtn: "Terminar sessao",
        loggedOut: "Sessao terminada.",
        sessionExpired: "Sessao expirada. Inicia sessao novamente.",
        networkError: "Nao foi possivel comunicar com o servidor.",
        closeAria: "Fechar",
        showPassword: "Mostrar",
        hidePassword: "Ocultar"
      }
    },
    pages: {
      index: {
        heroEyebrow: "Portugal Web Dev Community",
        heroTitle: "Comunidade para aprender, partilhar e construir projetos reais",
        heroDescription:
          "Este é o novo hub da comunidade Web Dev Jrs Portugal. Aqui encontras desafios semanais, projetos em destaque, conversas técnicas e recursos de estudo curados.",
        heroPrimary: "Explorar comunidade",
        heroSecondary: "Ver desafios",
        sections: [
          { title: "Desafio atual", link: "Ver todos" },
          { title: "Feed da comunidade", link: "Abrir feed completo", note: "Perguntas técnicas, feedback de código e partilha de progresso." },
          { title: "Projetos em destaque", link: "Ver galeria" },
          { title: "Recursos rápidos", link: "Abrir biblioteca" }
        ]
      },
      desafios: {
        heroEyebrow: "Painel de desafios",
        heroTitle: "Desafios da comunidade",
        heroDescription:
          "Treinos curtos e progressivos para praticares fundamentos e resolveres problemas reais de frontend e backend em contexto colaborativo.",
        chips: ["Status: aberto", "Dificuldade progressiva", "Entrega semanal"],
        sectionTitle: "Painel de desafios",
        sectionLink: "Partilhar resultado",
        sectionNote: "Seleciona um desafio, trabalha no teu fork e publica feedback no feed da comunidade."
      },
      projetos: {
        heroEyebrow: "Galeria de projetos",
        heroTitle: "Projetos da comunidade",
        heroDescription:
          "Galeria curada de projetos criados por membros. Usa filtros para analisar stacks, arquitetura e padrões de implementação.",
        kpis: ["Total de projetos", "Em destaque", "Autores ativos"],
        sectionTitle: "Explorar projetos",
        sectionLink: "Pedir feedback",
        filterAria: "Filtrar projetos",
        filters: { all: "Todos", frontend: "Frontend", backend: "Backend", fullstack: "Fullstack" }
      },
      recursos: {
        heroEyebrow: "Biblioteca de recursos",
        heroTitle: "Biblioteca de recursos",
        heroDescription:
          "Coleção de links e guias recomendados para acelerar estudo, praticar fundamentos e ganhar consistência no desenvolvimento web.",
        chips: ["HTML", "CSS", "JavaScript", "Backend", "Carreira"],
        sectionTitle: "Recursos recomendados",
        sectionLink: "Sugerir recurso"
      },
      comunidade: {
        heroEyebrow: "Feed da comunidade",
        heroTitle: "Espaço de conversa técnica",
        heroDescription:
          "Faz perguntas, partilha progresso, recebe feedback de código e ajuda outros membros da comunidade a evoluir.",
        feedTitle: "Conversas recentes",
        feedLink: "Novo tópico (fase 2)",
        commentsTitle: "Comentários da comunidade",
        commentsLink: "Ver todas as respostas",
        replyTitle: "Responder a uma conversa",
        replyNote: "Placeholder visual: envio real e autenticação entra na fase backend.",
        replyPlaceholder: "Escreve aqui o teu comentário...",
        replyButton: "Publicar comentário"
      },
      sobre: {
        heroEyebrow: "Sobre o projeto",
        heroTitle: "Web Dev Jrs Portugal",
        heroDescription:
          "Projeto de comunidade para pessoas que querem aprender web development com prática, partilha e colaboração técnica contínua.",
        sectionTitles: ["Missão", "Como funciona", "Regras da comunidade", "Roadmap"],
        mission:
          "Criar um espaço acessível onde iniciantes e júniores possam evoluir com apoio da comunidade, desafios prontos para praticar e feedback orientado para melhoria real.",
        how: [
          { title: "1. Explorar", text: "Consulta desafios, projetos e recursos para escolher foco de estudo." },
          { title: "2. Construir", text: "Desenvolve projetos curtos e publica progresso para receber feedback." },
          { title: "3. Partilhar", text: "Participa no feed com dúvidas, respostas e boas práticas técnicas." },
          { title: "4. Evoluir", text: "Cria rotina de melhoria contínua com base no roadmap da comunidade." }
        ],
        rules: [
          "Respeito total nas conversas, sem ataques pessoais.",
          "Feedback técnico objetivo, com exemplos quando possível.",
          "Partilha de código com contexto e objetivo do problema.",
          "Sem spam ou promoção fora do tema da comunidade."
        ],
        roadmap: [
          "Fase 1: frontend visual multipágina com dados mock.",
          "Fase 2: autenticação e publicação de posts/comentários.",
          "Fase 3: moderação, perfil de utilizador e pesquisa."
        ]
      }
    },
    dynamic: {
      deadlinePrefix: "Prazo:",
      difficultyPrefix: "Dificuldade:",
      challengeOpen: "Abrir desafio",
      readConversation: "Ler conversa",
      viewProject: "Ver projeto",
      openResource: "Abrir recurso",
      resourceHint: "Recurso selecionado para estudo dirigido da comunidade.",
      commentsSuffix: "comentários",
      featured: "Destaque",
      noProjectsTitle: "Sem resultados",
      noProjectsDescription: "Não existem projetos para este filtro.",
      noPostsTitle: "Sem publicações",
      noPostsDescription: "Não há posts para mostrar neste momento.",
      status: { open: "Aberto", review: "Em revisão", closed: "Encerrado" }
    }
  },
  en: {
    titles: {
      index: "Web Dev Jrs Portugal | Community Hub",
      desafios: "Challenges | Web Dev Jrs Portugal",
      projetos: "Projects | Web Dev Jrs Portugal",
      recursos: "Resources | Web Dev Jrs Portugal",
      comunidade: "Community | Web Dev Jrs Portugal",
      sobre: "About | Web Dev Jrs Portugal"
    },
    common: {
      navAria: "Main navigation",
      nav: {
        index: "Home",
        desafios: "Challenges",
        projetos: "Projects",
        recursos: "Resources",
        comunidade: "Community",
        sobre: "About",
        cta: "Enter",
        ctaLogged: "Account"
      },
      menu: "Menu",
      languageLabel: "Language",
      languageAria: "Select language",
      footer: "&copy; 2026 Web Dev Jrs Portugal. Programming community for continuous growth.",
      auth: {
        title: "Join the community",
        loginTab: "Login",
        signupTab: "Create account",
        name: "Name",
        email: "Email",
        password: "Password",
        loginBtn: "Sign in",
        signupBtn: "Create account",
        note: "Real authentication connected to backend.",
        processing: "Processing...",
        loginSuccess: "Signed in successfully.",
        registerSuccess: "Account created. Check your email to activate it.",
        loggedInAs: "Signed in as:",
        logoutBtn: "Sign out",
        loggedOut: "Signed out.",
        sessionExpired: "Session expired. Please sign in again.",
        networkError: "Unable to reach the server.",
        closeAria: "Close",
        showPassword: "Show",
        hidePassword: "Hide"
      }
    },
    pages: {
      index: {
        heroEyebrow: "Portugal Web Dev Community",
        heroTitle: "Community to learn, share and build real projects",
        heroDescription:
          "This is the new Web Dev Jrs Portugal hub. Here you can find weekly challenges, featured projects, technical discussions and curated learning resources.",
        heroPrimary: "Explore community",
        heroSecondary: "View challenges",
        sections: [
          { title: "Current challenge", link: "View all" },
          { title: "Community feed", link: "Open full feed", note: "Technical questions, code feedback and progress sharing." },
          { title: "Featured projects", link: "View gallery" },
          { title: "Quick resources", link: "Open library" }
        ]
      },
      desafios: {
        heroEyebrow: "Challenge board",
        heroTitle: "Community challenges",
        heroDescription:
          "Short progressive drills to practice fundamentals and solve real frontend and backend problems in a collaborative environment.",
        chips: ["Status: open", "Progressive difficulty", "Weekly deadline"],
        sectionTitle: "Challenge board",
        sectionLink: "Share result",
        sectionNote: "Pick a challenge, work in your fork and publish feedback in the community feed."
      },
      projetos: {
        heroEyebrow: "Project gallery",
        heroTitle: "Community projects",
        heroDescription:
          "Curated gallery of projects built by members. Use filters to analyze stacks, architecture and implementation patterns.",
        kpis: ["Total projects", "Featured", "Active authors"],
        sectionTitle: "Explore projects",
        sectionLink: "Ask for feedback",
        filterAria: "Filter projects",
        filters: { all: "All", frontend: "Frontend", backend: "Backend", fullstack: "Fullstack" }
      },
      recursos: {
        heroEyebrow: "Resource library",
        heroTitle: "Resource library",
        heroDescription:
          "Collection of recommended links and guides to speed up learning, practice fundamentals and build consistency in web development.",
        chips: ["HTML", "CSS", "JavaScript", "Backend", "Career"],
        sectionTitle: "Recommended resources",
        sectionLink: "Suggest resource"
      },
      comunidade: {
        heroEyebrow: "Community feed",
        heroTitle: "Technical discussion space",
        heroDescription:
          "Ask questions, share progress, get code feedback and help other community members improve.",
        feedTitle: "Recent discussions",
        feedLink: "New topic (phase 2)",
        commentsTitle: "Community comments",
        commentsLink: "View all replies",
        replyTitle: "Reply to a discussion",
        replyNote: "Visual placeholder: real posting and authentication will come in backend phase.",
        replyPlaceholder: "Write your comment here...",
        replyButton: "Publish comment"
      },
      sobre: {
        heroEyebrow: "About the project",
        heroTitle: "Web Dev Jrs Portugal",
        heroDescription:
          "Community project for people who want to learn web development through practice, sharing and continuous technical collaboration.",
        sectionTitles: ["Mission", "How it works", "Community rules", "Roadmap"],
        mission:
          "Create an accessible space where beginners and juniors can grow with community support, practical challenges and feedback focused on real improvement.",
        how: [
          { title: "1. Explore", text: "Check challenges, projects and resources to choose your study focus." },
          { title: "2. Build", text: "Develop short projects and publish progress to receive feedback." },
          { title: "3. Share", text: "Join the feed with questions, answers and technical best practices." },
          { title: "4. Improve", text: "Build a continuous improvement routine based on the community roadmap." }
        ],
        rules: [
          "Total respect in discussions, no personal attacks.",
          "Objective technical feedback, with examples whenever possible.",
          "Share code with clear context and problem objective.",
          "No spam or off-topic promotion."
        ],
        roadmap: [
          "Phase 1: visual multi-page frontend with mock data.",
          "Phase 2: authentication and post/comment publishing.",
          "Phase 3: moderation, user profile and search."
        ]
      }
    },
    dynamic: {
      deadlinePrefix: "Deadline:",
      difficultyPrefix: "Difficulty:",
      challengeOpen: "Open challenge",
      readConversation: "Read discussion",
      viewProject: "View project",
      openResource: "Open resource",
      resourceHint: "Selected resource for guided community study.",
      commentsSuffix: "comments",
      featured: "Featured",
      noProjectsTitle: "No results",
      noProjectsDescription: "No projects available for this filter.",
      noPostsTitle: "No posts",
      noPostsDescription: "There are no posts to show right now.",
      status: { open: "Open", review: "In review", closed: "Closed" }
    }
  }
};

const weeklyChallenge = {
  id: "wk-12",
  title: "Desafio da Semana",
  prompt: "Cria uma página de perfil responsiva usando apenas HTML e CSS.",
  level: "Iniciante",
  deadline: "Domingo, 23:59",
  objective: "Treinar estrutura semântica, layout responsivo e consistência visual.",
  checklist: [
    "Header com foto, nome e bio curta",
    "Secção de skills em lista",
    "Links para redes sociais",
    "Layout responsivo para mobile e desktop"
  ]
};

const featuredProjects = [
  {
    id: "prj-001",
    title: "To-Do App",
    author: "Joao Silva",
    stack: ["HTML", "CSS", "JavaScript"],
    summary: "Aplicação simples de tarefas com filtros de estado e persistência local.",
    featured: true,
    category: "frontend"
  },
  {
    id: "prj-002",
    title: "Landing de Restaurante",
    author: "Maria Costa",
    stack: ["HTML", "CSS", "A11y"],
    summary: "Landing page com foco em acessibilidade, contraste e navegação por teclado.",
    featured: true,
    category: "frontend"
  },
  {
    id: "prj-003",
    title: "API de Notas",
    author: "Rui Almeida",
    stack: ["Node", "Express", "PostgreSQL"],
    summary: "API REST para notas com autenticação JWT e validações de entrada.",
    featured: true,
    category: "backend"
  },
  {
    id: "prj-004",
    title: "Dashboard de Habit Tracker",
    author: "Carla Ramos",
    stack: ["React", "CSS", "Node"],
    summary: "Dashboard com gráficos simples e fluxo de hábitos diários.",
    featured: false,
    category: "fullstack"
  },
  {
    id: "prj-005",
    title: "Portfolio Tech",
    author: "Pedro Lima",
    stack: ["HTML", "CSS", "JavaScript"],
    summary: "Portfolio pessoal com animações leves e secção de estudos.",
    featured: false,
    category: "frontend"
  }
];

const communityPosts = [
  {
    id: "post-101",
    title: "Como alinhar divs no CSS sem me perder?",
    author: "Ana M.",
    excerpt: "Estou a usar flexbox e grid no mesmo layout. Qual abordagem recomendam para manter consistência?",
    createdAt: "Hoje",
    commentCount: 14
  },
  {
    id: "post-102",
    title: "Feedback ao meu formulário de registo",
    author: "Tiago P.",
    excerpt: "Partilho aqui o meu formulário com validação básica. Gostava de dicas para melhorar UX e acessibilidade.",
    createdAt: "Ontem",
    commentCount: 8
  },
  {
    id: "post-103",
    title: "Qual roadmap para backend em 2026?",
    author: "Luisa F.",
    excerpt: "Já domino frontend base. Quero migrar para Node e SQL. Que sequência de estudo sugerem?",
    createdAt: "Ha 2 dias",
    commentCount: 22
  },
  {
    id: "post-104",
    title: "Partilha: mini clone de dashboard",
    author: "Bruno S.",
    excerpt: "Terminei o meu clone de dashboard. Aceito crítica técnica sobre estrutura de componentes.",
    createdAt: "Ha 3 dias",
    commentCount: 5
  }
];

const quickResources = [
  {
    id: "res-01",
    title: "Guia visual de Flexbox",
    type: "CSS",
    url: "#",
    level: "Iniciante"
  },
  {
    id: "res-02",
    title: "Checklist de semântica HTML",
    type: "HTML",
    url: "#",
    level: "Iniciante"
  },
  {
    id: "res-03",
    title: "Mapa mental de JavaScript",
    type: "JavaScript",
    url: "#",
    level: "Intermédio"
  },
  {
    id: "res-04",
    title: "Guia rápido de PostgreSQL",
    type: "Backend",
    url: "#",
    level: "Intermédio"
  },
  {
    id: "res-05",
    title: "Boas práticas de API REST",
    type: "Backend",
    url: "#",
    level: "Intermédio"
  },
  {
    id: "res-06",
    title: "Plano de carreira júnior para pleno",
    type: "Carreira",
    url: "#",
    level: "Todos"
  }
];

const challengeBoard = [
  {
    id: "ch-01",
    title: "Perfil responsivo",
    status: "open",
    difficulty: "Iniciante",
    deadline: "Domingo",
    cta: "Começar desafio"
  },
  {
    id: "ch-02",
    title: "Formulário acessível",
    status: "open",
    difficulty: "Iniciante",
    deadline: "Quarta",
    cta: "Ver requisitos"
  },
  {
    id: "ch-03",
    title: "Grid dashboard",
    status: "review",
    difficulty: "Intermédio",
    deadline: "Sexta",
    cta: "Submeter progresso"
  },
  {
    id: "ch-04",
    title: "API mini forum",
    status: "closed",
    difficulty: "Avançado",
    deadline: "Encerrado",
    cta: "Ver soluções"
  }
];

const communityComments = [
  {
    author: "Marta",
    text: "No teu caso, eu separava layout macro com Grid e componentes internos com Flexbox.",
    when: "há 3h"
  },
  {
    author: "Rafael",
    text: "Tenta definir primeiro os breakpoints e só depois alinhar componentes individuais.",
    when: "há 2h"
  },
  {
    author: "Ines",
    text: "Se quiseres, posso rever o teu código no tópico de feedback da comunidade.",
    when: "há 40min"
  }
];

const localizedContent = {
  pt: {
    weeklyChallenge,
    featuredProjects,
    communityPosts,
    quickResources,
    challengeBoard,
    communityComments
  },
  en: {
    weeklyChallenge: {
      id: "wk-12",
      title: "Challenge of the Week",
      prompt: "Build a responsive profile page using only HTML and CSS.",
      level: "Beginner",
      deadline: "Sunday, 11:59 PM",
      objective: "Practice semantic structure, responsive layout and visual consistency.",
      checklist: [
        "Header with photo, name and short bio",
        "Skills section in a list",
        "Links to social profiles",
        "Responsive layout for mobile and desktop"
      ]
    },
    featuredProjects: [
      {
        id: "prj-001",
        title: "To-Do App",
        author: "Joao Silva",
        stack: ["HTML", "CSS", "JavaScript"],
        summary: "Simple task app with status filters and local persistence.",
        featured: true,
        category: "frontend"
      },
      {
        id: "prj-002",
        title: "Restaurant Landing",
        author: "Maria Costa",
        stack: ["HTML", "CSS", "A11y"],
        summary: "Landing page focused on accessibility, contrast and keyboard navigation.",
        featured: true,
        category: "frontend"
      },
      {
        id: "prj-003",
        title: "Notes API",
        author: "Rui Almeida",
        stack: ["Node", "Express", "PostgreSQL"],
        summary: "REST API for notes with JWT authentication and input validation.",
        featured: true,
        category: "backend"
      },
      {
        id: "prj-004",
        title: "Habit Tracker Dashboard",
        author: "Carla Ramos",
        stack: ["React", "CSS", "Node"],
        summary: "Dashboard with simple charts and daily habit flow.",
        featured: false,
        category: "fullstack"
      },
      {
        id: "prj-005",
        title: "Tech Portfolio",
        author: "Pedro Lima",
        stack: ["HTML", "CSS", "JavaScript"],
        summary: "Personal portfolio with light animations and study section.",
        featured: false,
        category: "frontend"
      }
    ],
    communityPosts: [
      {
        id: "post-101",
        title: "How to align divs in CSS without getting lost?",
        author: "Ana M.",
        excerpt: "I am using flexbox and grid in the same layout. Which approach keeps things more consistent?",
        createdAt: "Today",
        commentCount: 14
      },
      {
        id: "post-102",
        title: "Feedback on my sign-up form",
        author: "Tiago P.",
        excerpt: "I am sharing my form with basic validation. I would like tips to improve UX and accessibility.",
        createdAt: "Yesterday",
        commentCount: 8
      },
      {
        id: "post-103",
        title: "Best backend roadmap for 2026?",
        author: "Luisa F.",
        excerpt: "I already know frontend basics. I want to move to Node and SQL. Which learning sequence do you suggest?",
        createdAt: "2 days ago",
        commentCount: 22
      },
      {
        id: "post-104",
        title: "Share: mini dashboard clone",
        author: "Bruno S.",
        excerpt: "I finished my dashboard clone. I accept technical feedback on component structure.",
        createdAt: "3 days ago",
        commentCount: 5
      }
    ],
    quickResources: [
      { id: "res-01", title: "Visual Flexbox Guide", type: "CSS", url: "#", level: "Beginner" },
      { id: "res-02", title: "HTML Semantics Checklist", type: "HTML", url: "#", level: "Beginner" },
      { id: "res-03", title: "JavaScript Mind Map", type: "JavaScript", url: "#", level: "Intermediate" },
      { id: "res-04", title: "Quick PostgreSQL Guide", type: "Backend", url: "#", level: "Intermediate" },
      { id: "res-05", title: "REST API Best Practices", type: "Backend", url: "#", level: "Intermediate" },
      { id: "res-06", title: "Junior to Mid Career Plan", type: "Career", url: "#", level: "All levels" }
    ],
    challengeBoard: [
      { id: "ch-01", title: "Responsive profile", status: "open", difficulty: "Beginner", deadline: "Sunday", cta: "Start challenge" },
      { id: "ch-02", title: "Accessible form", status: "open", difficulty: "Beginner", deadline: "Wednesday", cta: "View requirements" },
      { id: "ch-03", title: "Dashboard grid", status: "review", difficulty: "Intermediate", deadline: "Friday", cta: "Submit progress" },
      { id: "ch-04", title: "Mini forum API", status: "closed", difficulty: "Advanced", deadline: "Closed", cta: "View solutions" }
    ],
    communityComments: [
      {
        author: "Marta",
        text: "In your case, I would separate macro layout with Grid and inner components with Flexbox.",
        when: "3h ago"
      },
      {
        author: "Rafael",
        text: "Try defining breakpoints first and only then align individual components.",
        when: "2h ago"
      },
      {
        author: "Ines",
        text: "If you want, I can review your code in the community feedback thread.",
        when: "40m ago"
      }
    ]
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setupMobileMenu();
  setActiveNavigation();
  setupProjectFilters();
  setupAuthPopover();
  setupLanguageSwitcher();
});

function setupLanguageSwitcher() {
  const select = document.getElementById("languageSelect");
  currentLanguage = getInitialLanguage();

  if (select) {
    select.value = currentLanguage;
    select.addEventListener("change", (event) => {
      const nextLanguage = event.target.value;
      if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) {
        return;
      }

      currentLanguage = nextLanguage;
      applyTranslations(true);
    });
  }

  applyTranslations(false);
}

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      return saved;
    }
  } catch (error) {
    // Ignore storage issues.
  }

  return "pt";
}

function applyTranslations(persistSelection) {
  const text = translations[currentLanguage] || translations.pt;
  const page = getCurrentPageKey();

  document.documentElement.lang = currentLanguage === "en" ? "en" : "pt-PT";
  document.title = text.titles[page] || text.titles.index;

  applyCommonTranslations(text.common);
  applyPageTranslations(page, text.pages);

  renderHomePage();
  renderChallengesPage();
  renderProjectsPage();
  renderResourcesPage();
  renderCommunityPage();

  if (persistSelection) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch (error) {
      // Ignore storage issues.
    }
  }
}

function applyCommonTranslations(common) {
  setText("#navToggle", common.menu);
  setAttr("#siteNav", "aria-label", common.navAria);

  setText('.site-nav a[data-path="index.html"]', common.nav.index);
  setText('.site-nav a[data-path="desafios.html"]', common.nav.desafios);
  setText('.site-nav a[data-path="projetos.html"]', common.nav.projetos);
  setText('.site-nav a[data-path="recursos.html"]', common.nav.recursos);
  setText('.site-nav a[data-path="comunidade.html"]', common.nav.comunidade);
  setText('.site-nav a[data-path="sobre.html"]', common.nav.sobre);
  updateAuthTriggerLabel();

  setText(".language-switch label", common.languageLabel);
  setAttr("#languageSelect", "aria-label", common.languageAria);
  setHtml(".footer-inner p", common.footer);
  applyAuthTranslations(common.auth);
}

function applyPageTranslations(page, pages) {
  if (page === "index") {
    applyIndexTranslations(pages.index);
  }

  if (page === "desafios") {
    applyChallengesTranslations(pages.desafios);
  }

  if (page === "projetos") {
    applyProjectsTranslations(pages.projetos);
  }

  if (page === "recursos") {
    applyResourcesTranslations(pages.recursos);
  }

  if (page === "comunidade") {
    applyCommunityTranslations(pages.comunidade);
  }

  if (page === "sobre") {
    applyAboutTranslations(pages.sobre);
  }
}

function applyIndexTranslations(pageText) {
  setText(".hero .eyebrow", pageText.heroEyebrow);
  setText(".hero h1", pageText.heroTitle);
  setText(".hero p:not(.eyebrow)", pageText.heroDescription);
  setText(".hero .button.primary", pageText.heroPrimary);
  setText(".hero .button.ghost", pageText.heroSecondary);

  const sections = document.querySelectorAll(".page-stack > .section");
  if (sections[0]) {
    setTextInElement(sections[0], ".section-head h2", pageText.sections[0].title);
    setTextInElement(sections[0], ".section-head a", pageText.sections[0].link);
  }
  if (sections[1]) {
    setTextInElement(sections[1], ".section-head h2", pageText.sections[1].title);
    setTextInElement(sections[1], ".section-head a", pageText.sections[1].link);
    setTextInElement(sections[1], ".section-note", pageText.sections[1].note);
  }
  if (sections[2]) {
    setTextInElement(sections[2], ".section-head h2", pageText.sections[2].title);
    setTextInElement(sections[2], ".section-head a", pageText.sections[2].link);
  }
  if (sections[3]) {
    setTextInElement(sections[3], ".section-head h2", pageText.sections[3].title);
    setTextInElement(sections[3], ".section-head a", pageText.sections[3].link);
  }
}

function applyChallengesTranslations(pageText) {
  setText(".hero .eyebrow", pageText.heroEyebrow);
  setText(".hero h1", pageText.heroTitle);
  setText(".hero p:not(.eyebrow)", pageText.heroDescription);

  setNthText(".inline-list .chip", 0, pageText.chips[0]);
  setNthText(".inline-list .chip", 1, pageText.chips[1]);
  setNthText(".inline-list .chip", 2, pageText.chips[2]);

  const section = document.querySelector(".page-stack > .section");
  if (!section) {
    return;
  }

  setTextInElement(section, ".section-head h2", pageText.sectionTitle);
  setTextInElement(section, ".section-head a", pageText.sectionLink);
  setTextInElement(section, ".section-note", pageText.sectionNote);
}

function applyProjectsTranslations(pageText) {
  setText(".hero .eyebrow", pageText.heroEyebrow);
  setText(".hero h1", pageText.heroTitle);
  setText(".hero p:not(.eyebrow)", pageText.heroDescription);

  setNthText(".kpi-card .muted", 0, pageText.kpis[0]);
  setNthText(".kpi-card .muted", 1, pageText.kpis[1]);
  setNthText(".kpi-card .muted", 2, pageText.kpis[2]);

  const sections = document.querySelectorAll(".page-stack > .section");
  if (sections[1]) {
    setTextInElement(sections[1], ".section-head h2", pageText.sectionTitle);
    setTextInElement(sections[1], ".section-head a", pageText.sectionLink);
  }

  setAttr(".filters", "aria-label", pageText.filterAria);
  setText('[data-project-filter="all"]', pageText.filters.all);
  setText('[data-project-filter="frontend"]', pageText.filters.frontend);
  setText('[data-project-filter="backend"]', pageText.filters.backend);
  setText('[data-project-filter="fullstack"]', pageText.filters.fullstack);
}

function applyResourcesTranslations(pageText) {
  setText(".hero .eyebrow", pageText.heroEyebrow);
  setText(".hero h1", pageText.heroTitle);
  setText(".hero p:not(.eyebrow)", pageText.heroDescription);

  setNthText(".inline-list .chip", 0, pageText.chips[0]);
  setNthText(".inline-list .chip", 1, pageText.chips[1]);
  setNthText(".inline-list .chip", 2, pageText.chips[2]);
  setNthText(".inline-list .chip", 3, pageText.chips[3]);
  setNthText(".inline-list .chip", 4, pageText.chips[4]);

  const section = document.querySelector(".page-stack > .section");
  if (!section) {
    return;
  }

  setTextInElement(section, ".section-head h2", pageText.sectionTitle);
  setTextInElement(section, ".section-head a", pageText.sectionLink);
}

function applyCommunityTranslations(pageText) {
  setText(".hero .eyebrow", pageText.heroEyebrow);
  setText(".hero h1", pageText.heroTitle);
  setText(".hero p:not(.eyebrow)", pageText.heroDescription);

  const sections = document.querySelectorAll(".page-stack > .section");
  if (sections[0]) {
    setTextInElement(sections[0], ".section-head h2", pageText.feedTitle);
    setTextInElement(sections[0], ".section-head a", pageText.feedLink);
  }
  if (sections[1]) {
    setTextInElement(sections[1], ".section-head h2", pageText.commentsTitle);
    setTextInElement(sections[1], ".section-head a", pageText.commentsLink);
  }

  setText(".comment-box h3", pageText.replyTitle);
  setText(".comment-box .muted", pageText.replyNote);
  setAttr(".comment-box textarea", "placeholder", pageText.replyPlaceholder);
  setText(".comment-box button", pageText.replyButton);
}

function applyAboutTranslations(pageText) {
  setText(".hero .eyebrow", pageText.heroEyebrow);
  setText(".hero h1", pageText.heroTitle);
  setText(".hero p:not(.eyebrow)", pageText.heroDescription);

  const sections = document.querySelectorAll(".page-stack > .section");
  if (sections[0]) {
    setTextInElement(sections[0], ".section-head h2", pageText.sectionTitles[0]);
    setTextInElement(sections[0], ".section-note", pageText.mission);
  }
  if (sections[1]) {
    setTextInElement(sections[1], ".section-head h2", pageText.sectionTitles[1]);
    const cards = sections[1].querySelectorAll(".card");
    pageText.how.forEach((step, index) => {
      if (cards[index]) {
        setTextInElement(cards[index], "h3", step.title);
        setTextInElement(cards[index], "p", step.text);
      }
    });
  }
  if (sections[2]) {
    setTextInElement(sections[2], ".section-head h2", pageText.sectionTitles[2]);
    const rules = sections[2].querySelectorAll("li");
    pageText.rules.forEach((item, index) => {
      if (rules[index]) {
        rules[index].textContent = item;
      }
    });
  }
  if (sections[3]) {
    setTextInElement(sections[3], ".section-head h2", pageText.sectionTitles[3]);
    const roadmap = sections[3].querySelectorAll("li");
    pageText.roadmap.forEach((item, index) => {
      if (roadmap[index]) {
        roadmap[index].textContent = item;
      }
    });
  }
}

function setupProjectFilters() {
  const filters = document.querySelectorAll("[data-project-filter]");
  if (!filters.length) {
    return;
  }

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      activeProjectFilter = button.getAttribute("data-project-filter") || "all";
      updateActiveProjectFilterButtons();
      renderProjectsPage();
    });
  });
}

function updateActiveProjectFilterButtons() {
  const filters = document.querySelectorAll("[data-project-filter]");
  filters.forEach((button) => {
    const value = button.getAttribute("data-project-filter") || "all";
    button.classList.toggle("active", value === activeProjectFilter);
  });
}

function getCurrentPageKey() {
  const file = getCurrentPageFilename();
  const map = {
    "index.html": "index",
    "desafios.html": "desafios",
    "projetos.html": "projetos",
    "recursos.html": "recursos",
    "comunidade.html": "comunidade",
    "sobre.html": "sobre"
  };
  return map[file] || "index";
}

function getCurrentPageFilename() {
  const pathname = window.location.pathname.replace(/\\/g, "/");
  const file = pathname.split("/").pop();
  if (!file || file === "") {
    return "index.html";
  }
  return file.split("?")[0].split("#")[0];
}

function t(path) {
  const keys = path.split(".");
  let value = translations[currentLanguage] || translations.pt;
  for (const key of keys) {
    if (!value || !Object.prototype.hasOwnProperty.call(value, key)) {
      return path;
    }
    value = value[key];
  }
  return value;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && typeof value === "string") {
    element.textContent = value;
  }
}

function setNthText(selector, index, value) {
  const elements = document.querySelectorAll(selector);
  if (elements[index] && typeof value === "string") {
    elements[index].textContent = value;
  }
}

function setAttr(selector, attr, value) {
  const element = document.querySelector(selector);
  if (element && typeof value === "string") {
    element.setAttribute(attr, value);
  }
}

function setHtml(selector, value) {
  const element = document.querySelector(selector);
  if (element && typeof value === "string") {
    element.innerHTML = value;
  }
}

function setTextInElement(container, selector, value) {
  const element = container.querySelector(selector);
  if (element && typeof value === "string") {
    element.textContent = value;
  }
}

function resolveApiBaseUrl() {
  const custom = typeof window !== "undefined" ? window.WDJP_API_BASE_URL : "";
  if (typeof custom === "string" && custom.trim()) {
    return custom.trim().replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "";
  }

  const { protocol, hostname, port } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (protocol === "file:" || (isLocalHost && port && port !== "3000")) {
    return "http://localhost:3000";
  }

  return "";
}

function toApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const cleanPath = String(path).startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

function setAttrInElement(container, selector, attr, value) {
  const element = container.querySelector(selector);
  if (element && typeof value === "string") {
    element.setAttribute(attr, value);
  }
}

function isAuthenticated() {
  return Boolean(authToken);
}

function loadAuthSession() {
  try {
    authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
    const rawUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    authUser = rawUser ? JSON.parse(rawUser) : null;
  } catch (error) {
    authToken = "";
    authUser = null;
  }
}

function saveAuthSession(token, user) {
  authToken = typeof token === "string" ? token : "";
  authUser = user && typeof user === "object" ? user : null;

  try {
    if (authToken) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }

    if (authUser) {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(authUser));
    } else {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  } catch (error) {
    // Ignore storage issues.
  }
}

function clearAuthSession() {
  authToken = "";
  authUser = null;
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  } catch (error) {
    // Ignore storage issues.
  }
}

function getAuthDisplayName() {
  if (authUser && typeof authUser.name === "string" && authUser.name.trim()) {
    return authUser.name.trim();
  }
  if (authUser && typeof authUser.email === "string" && authUser.email.trim()) {
    return authUser.email.trim();
  }
  return "Member";
}

function updateAuthTriggerLabel() {
  const trigger = document.querySelector(".site-nav .nav-cta");
  if (!trigger) {
    return;
  }
  const guestLabel = t("common.nav.cta");
  const loggedLabel = t("common.nav.ctaLogged");
  trigger.textContent = isAuthenticated() ? loggedLabel : guestLabel;
}

function setAuthNote(panel, message, tone = "muted") {
  const note = panel ? panel.querySelector(".auth-note") : null;
  if (!note) {
    return;
  }
  note.textContent = message || "";
  note.classList.remove("is-success", "is-error");
  if (tone === "success") {
    note.classList.add("is-success");
  }
  if (tone === "error") {
    note.classList.add("is-error");
  }
}

function setAuthBusyState(form, isBusy) {
  if (!form) {
    return;
  }

  form.querySelectorAll("input").forEach((input) => {
    input.disabled = isBusy;
  });

  form.querySelectorAll(".auth-password-toggle").forEach((button) => {
    button.disabled = isBusy;
  });

  const submit = form.querySelector(".auth-submit");
  if (submit) {
    if (!submit.dataset.originalLabel) {
      submit.dataset.originalLabel = submit.textContent || "";
    }
    submit.disabled = isBusy;
    submit.textContent = isBusy ? t("common.auth.processing") : submit.dataset.originalLabel;
  }
}

async function requestJson(url, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: { ...(options.headers || {}) },
  };

  if (typeof options.body !== "undefined") {
    config.body = options.body;
  }

  const response = await fetch(toApiUrl(url), config);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload && typeof payload.error === "string"
      ? payload.error
      : t("common.auth.networkError");
    throw new Error(message);
  }

  return payload || {};
}

function getAuthErrorMessage(error) {
  if (error && typeof error.message === "string" && error.message.trim()) {
    const message = error.message.trim();
    const lower = message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
      return t("common.auth.networkError");
    }
    return message;
  }
  return t("common.auth.networkError");
}

function getPasswordToggleIcon(isHidden) {
  if (isHidden) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      <path d="M10.6 5.3A11.8 11.8 0 0 1 12 5.2c6.4 0 10 6 10 6a18.2 18.2 0 0 1-4.1 4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M6.7 6.7C3.8 8.5 2 11.2 2 11.2s3.6 6 10 6c1.9 0 3.5-.5 4.8-1.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
    </svg>
  `;
}

function updatePasswordToggleLabel(button, input) {
  if (!button || !input) {
    return;
  }
  const isHidden = input.type === "password";
  const label = isHidden ? t("common.auth.showPassword") : t("common.auth.hidePassword");
  button.innerHTML = getPasswordToggleIcon(isHidden);
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

function setupPasswordToggles(container) {
  if (!container) {
    return;
  }

  container.querySelectorAll(".auth-password-toggle").forEach((button) => {
    const targetId = button.getAttribute("data-password-target");
    const input = targetId ? container.querySelector(`#${targetId}`) : null;
    if (!input) {
      return;
    }

    updatePasswordToggleLabel(button, input);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.type = input.type === "password" ? "text" : "password";
      updatePasswordToggleLabel(button, input);
    });
  });
}

async function syncAuthSession(popover) {
  if (!isAuthenticated()) {
    updateAuthTriggerLabel();
    if (popover) {
      updateAuthMode(popover);
    }
    return;
  }

  try {
    const data = await requestJson("/auth/me", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (data.user) {
      saveAuthSession(authToken, data.user);
    }
  } catch (error) {
    clearAuthSession();
    authMode = "login";
    if (popover) {
      const loginPanel = popover.querySelector('[data-auth-panel="login"]');
      setAuthNote(loginPanel, t("common.auth.sessionExpired"), "error");
    }
  }

  updateAuthTriggerLabel();
  if (popover) {
    updateAuthMode(popover);
  }
}

function setupAuthPopover() {
  const trigger = document.querySelector(".site-nav .nav-cta");
  if (!trigger) {
    return;
  }

  loadAuthSession();

  const popover = document.createElement("section");
  popover.className = "auth-popover";
  popover.setAttribute("aria-hidden", "true");
  popover.innerHTML = `
    <div class="auth-head">
      <h3 class="auth-title"></h3>
      <button type="button" class="auth-close" aria-label="Fechar">&times;</button>
    </div>
    <div class="auth-tabs">
      <button type="button" class="auth-tab is-active" data-auth-mode="login"></button>
      <button type="button" class="auth-tab" data-auth-mode="signup"></button>
    </div>
    <div class="auth-session" hidden>
      <p class="auth-session-text"></p>
      <button type="button" class="auth-logout"></button>
    </div>
    <form class="auth-panel is-active" data-auth-panel="login">
      <div class="auth-field">
        <label for="authLoginEmail"></label>
        <input id="authLoginEmail" name="email" type="email" autocomplete="email" required>
      </div>
      <div class="auth-field">
        <label for="authLoginPassword"></label>
        <div class="auth-password-row">
          <input id="authLoginPassword" name="password" type="password" autocomplete="current-password" required>
          <button
            type="button"
            class="auth-password-toggle"
            data-password-target="authLoginPassword"
          ></button>
        </div>
      </div>
      <button type="submit" class="auth-submit"></button>
      <p class="auth-note"></p>
    </form>
    <form class="auth-panel" data-auth-panel="signup">
      <div class="auth-field">
        <label for="authSignupName"></label>
        <input id="authSignupName" name="name" type="text" autocomplete="name" required>
      </div>
      <div class="auth-field">
        <label for="authSignupEmail"></label>
        <input id="authSignupEmail" name="email" type="email" autocomplete="email" required>
      </div>
      <div class="auth-field">
        <label for="authSignupPassword"></label>
        <div class="auth-password-row">
          <input id="authSignupPassword" name="password" type="password" autocomplete="new-password" required>
          <button
            type="button"
            class="auth-password-toggle"
            data-password-target="authSignupPassword"
          ></button>
        </div>
      </div>
      <button type="submit" class="auth-submit"></button>
      <p class="auth-note"></p>
    </form>
  `;

  document.body.appendChild(popover);
  setupPasswordToggles(popover);

  const loginForm = popover.querySelector('[data-auth-panel="login"]');
  const signupForm = popover.querySelector('[data-auth-panel="signup"]');
  const logoutButton = popover.querySelector(".auth-logout");

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    const isOpen = popover.classList.contains("is-open");
    if (isOpen) {
      closeAuthPopover(popover);
    } else {
      openAuthPopover(popover);
      updateAuthMode(popover);
    }
  });

  popover.querySelectorAll(".auth-tab").forEach((button) => {
    button.addEventListener("click", () => {
      authMode = button.getAttribute("data-auth-mode") || "login";
      updateAuthMode(popover);
    });
  });

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleLoginSubmit(loginForm, popover);
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSignupSubmit(signupForm, popover);
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      clearAuthSession();
      authMode = "login";
      updateAuthTriggerLabel();
      updateAuthMode(popover);
      const loginPanel = popover.querySelector('[data-auth-panel="login"]');
      setAuthNote(loginPanel, t("common.auth.loggedOut"), "success");
    });
  }

  const closeButton = popover.querySelector(".auth-close");
  if (closeButton) {
    closeButton.addEventListener("click", () => closeAuthPopover(popover));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthPopover(popover);
    }
  });

  document.addEventListener("click", (event) => {
    if (!popover.classList.contains("is-open")) {
      return;
    }
    if (popover.contains(event.target) || trigger.contains(event.target)) {
      return;
    }
    closeAuthPopover(popover);
  });

  updateAuthTriggerLabel();
  updateAuthMode(popover);
  void syncAuthSession(popover);
}

function openAuthPopover(popover) {
  popover.classList.add("is-open");
  popover.setAttribute("aria-hidden", "false");
}

function closeAuthPopover(popover) {
  popover.classList.remove("is-open");
  popover.setAttribute("aria-hidden", "true");
}

function updateAuthMode(popover) {
  const tabs = popover.querySelector(".auth-tabs");
  const session = popover.querySelector(".auth-session");
  const sessionText = popover.querySelector(".auth-session-text");
  const logoutButton = popover.querySelector(".auth-logout");

  if (isAuthenticated()) {
    if (tabs) {
      tabs.style.display = "none";
    }
    if (session) {
      session.hidden = false;
    }
    if (sessionText) {
      sessionText.textContent = `${t("common.auth.loggedInAs")} ${getAuthDisplayName()}`;
    }
    if (logoutButton) {
      logoutButton.textContent = t("common.auth.logoutBtn");
    }
    popover.querySelectorAll(".auth-panel").forEach((panel) => {
      panel.classList.remove("is-active");
    });
    return;
  }

  if (tabs) {
    tabs.style.display = "flex";
  }
  if (session) {
    session.hidden = true;
  }

  popover.querySelectorAll(".auth-tab").forEach((button) => {
    const mode = button.getAttribute("data-auth-mode");
    button.classList.toggle("is-active", mode === authMode);
  });

  popover.querySelectorAll(".auth-panel").forEach((panel) => {
    const mode = panel.getAttribute("data-auth-panel");
    panel.classList.toggle("is-active", mode === authMode);
  });
}

async function handleLoginSubmit(form, popover) {
  if (authRequestInFlight) {
    return;
  }

  const emailInput = form.querySelector('input[name="email"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";

  authRequestInFlight = true;
  setAuthNote(form, t("common.auth.processing"));
  setAuthBusyState(form, true);

  try {
    const payload = await requestJson("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    saveAuthSession(payload.token || "", payload.user || null);
    updateAuthTriggerLabel();
    setAuthNote(form, t("common.auth.loginSuccess"), "success");
    form.reset();
    updateAuthMode(popover);
    setTimeout(() => {
      closeAuthPopover(popover);
    }, 320);
  } catch (error) {
    setAuthNote(form, getAuthErrorMessage(error), "error");
  } finally {
    setAuthBusyState(form, false);
    authRequestInFlight = false;
  }
}

async function handleSignupSubmit(form, popover) {
  if (authRequestInFlight) {
    return;
  }

  const nameInput = form.querySelector('input[name="name"]');
  const emailInput = form.querySelector('input[name="email"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const name = nameInput ? nameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";

  authRequestInFlight = true;
  setAuthNote(form, t("common.auth.processing"));
  setAuthBusyState(form, true);

  try {
    const payload = await requestJson("/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (payload && typeof payload.devToken === "string" && payload.devToken.trim()) {
      await requestJson(`/auth/verify?token=${encodeURIComponent(payload.devToken.trim())}`);

      const loginPayload = await requestJson("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      saveAuthSession(loginPayload.token || "", loginPayload.user || null);
      updateAuthTriggerLabel();
      setAuthNote(form, t("common.auth.loginSuccess"), "success");
      form.reset();
      updateAuthMode(popover);
      setTimeout(() => {
        closeAuthPopover(popover);
      }, 320);
      return;
    }

    const successMessage = payload.message || t("common.auth.registerSuccess");
    form.reset();
    authMode = "login";
    updateAuthMode(popover);
    const loginPanel = popover.querySelector('[data-auth-panel="login"]');
    if (loginPanel) {
      const loginEmailInput = loginPanel.querySelector('input[name="email"]');
      if (loginEmailInput) {
        loginEmailInput.value = email;
      }
      setAuthNote(loginPanel, successMessage, "success");
    }
  } catch (error) {
    setAuthNote(form, getAuthErrorMessage(error), "error");
  } finally {
    setAuthBusyState(form, false);
    authRequestInFlight = false;
  }
}

function applyAuthTranslations(auth) {
  const popover = document.querySelector(".auth-popover");
  if (!popover || !auth) {
    return;
  }

  setAttrInElement(popover, ".auth-close", "aria-label", auth.closeAria);
  setTextInElement(popover, ".auth-title", auth.title);
  setTextInElement(popover, '.auth-tab[data-auth-mode="login"]', auth.loginTab);
  setTextInElement(popover, '.auth-tab[data-auth-mode="signup"]', auth.signupTab);
  setTextInElement(popover, ".auth-logout", auth.logoutBtn);
  popover.querySelectorAll(".auth-password-toggle").forEach((button) => {
    const targetId = button.getAttribute("data-password-target");
    const input = targetId ? popover.querySelector(`#${targetId}`) : null;
    updatePasswordToggleLabel(button, input);
  });

  const loginPanel = popover.querySelector('[data-auth-panel="login"]');
  if (loginPanel) {
    setTextInElement(loginPanel, 'label[for="authLoginEmail"]', auth.email);
    setTextInElement(loginPanel, 'label[for="authLoginPassword"]', auth.password);
    setTextInElement(loginPanel, ".auth-submit", auth.loginBtn);
    const loginSubmit = loginPanel.querySelector(".auth-submit");
    if (loginSubmit) {
      loginSubmit.dataset.originalLabel = auth.loginBtn;
    }
    const loginNote = loginPanel.querySelector(".auth-note");
    if (loginNote && !loginNote.textContent.trim()) {
      loginNote.textContent = auth.note;
    }
  }

  const signupPanel = popover.querySelector('[data-auth-panel="signup"]');
  if (signupPanel) {
    setTextInElement(signupPanel, 'label[for="authSignupName"]', auth.name);
    setTextInElement(signupPanel, 'label[for="authSignupEmail"]', auth.email);
    setTextInElement(signupPanel, 'label[for="authSignupPassword"]', auth.password);
    setTextInElement(signupPanel, ".auth-submit", auth.signupBtn);
    const signupSubmit = signupPanel.querySelector(".auth-submit");
    if (signupSubmit) {
      signupSubmit.dataset.originalLabel = auth.signupBtn;
    }
    const signupNote = signupPanel.querySelector(".auth-note");
    if (signupNote && !signupNote.textContent.trim()) {
      signupNote.textContent = auth.note;
    }
  }

  updateAuthMode(popover);
}

function setupMobileMenu() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("siteNav");

  if (!toggle || !nav) {
    return;
  }

  const closeMenu = () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    nav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.contains("is-open");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) {
      closeMenu();
    }
  });
}

function setActiveNavigation() {
  const links = document.querySelectorAll(".site-nav a[data-path]");
  if (!links.length) {
    return;
  }

  const currentPage = getCurrentPageFilename();

  links.forEach((link) => {
    const href = link.getAttribute("href");
    const isActive = href === currentPage;

    if (isActive) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("active");
      link.removeAttribute("aria-current");
    }
  });
}

function renderHomePage() {
  const content = getLocalizedContent();
  const challengeSlot = document.getElementById("weeklyChallengeCard");
  if (challengeSlot) {
    challengeSlot.innerHTML = createWeeklyChallengeCard(content.weeklyChallenge);
  }

  renderPosts("homeCommunityFeed", content.communityPosts.slice(0, 3));
  renderProjects("homeFeaturedProjects", content.featuredProjects.filter((project) => project.featured));
  renderResources("homeQuickResources", content.quickResources.slice(0, 3));
}

function renderChallengesPage() {
  const content = getLocalizedContent();
  const board = document.getElementById("challengesBoard");
  if (!board) {
    return;
  }

  board.innerHTML = content.challengeBoard.map((challenge) => createChallengeCard(challenge)).join("");
}

function renderProjectsPage() {
  const content = getLocalizedContent();
  const projects = content.featuredProjects;
  const grid = document.getElementById("projectsGrid");
  if (!grid) {
    return;
  }

  const total = document.getElementById("projectsTotal");
  const featured = document.getElementById("projectsFeatured");
  const authors = document.getElementById("projectsAuthors");

  if (total) {
    total.textContent = String(projects.length);
  }
  if (featured) {
    featured.textContent = String(projects.filter((item) => item.featured).length);
  }
  if (authors) {
    authors.textContent = String(new Set(projects.map((item) => item.author)).size);
  }

  updateActiveProjectFilterButtons();

  const filtered = activeProjectFilter === "all"
    ? projects
    : projects.filter((project) => project.category === activeProjectFilter);

  if (!filtered.length) {
    grid.innerHTML = `<article class="card"><h3>${escapeHtml(t("dynamic.noProjectsTitle"))}</h3><p class="muted">${escapeHtml(t("dynamic.noProjectsDescription"))}</p></article>`;
    return;
  }

  grid.innerHTML = filtered.map((project) => createProjectCard(project)).join("");
}

function renderResourcesPage() {
  const content = getLocalizedContent();
  const grid = document.getElementById("resourcesGrid");
  if (!grid) {
    return;
  }

  grid.innerHTML = content.quickResources.map((resource) => createResourceCard(resource)).join("");
}

function renderCommunityPage() {
  const content = getLocalizedContent();
  renderPosts("communityFeedFull", content.communityPosts);

  const commentsSlot = document.getElementById("communityCommentsMock");
  if (commentsSlot) {
    commentsSlot.innerHTML = content.communityComments.map((comment) => {
      return `
        <article class="card">
          <div class="meta-line">
            <strong>${escapeHtml(comment.author)}</strong>
            <span>${escapeHtml(comment.when)}</span>
          </div>
          <p>${escapeHtml(comment.text)}</p>
        </article>
      `;
    }).join("");
  }
}

function renderPosts(containerId, posts) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  if (!posts.length) {
    container.innerHTML = `<article class="card"><h3>${escapeHtml(t("dynamic.noPostsTitle"))}</h3><p class="muted">${escapeHtml(t("dynamic.noPostsDescription"))}</p></article>`;
    return;
  }

  container.innerHTML = posts.map((post) => createPostCard(post)).join("");
}

function renderProjects(containerId, projects) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = projects.map((project) => createProjectCard(project)).join("");
}

function renderResources(containerId, resources) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = resources.map((resource) => createResourceCard(resource)).join("");
}

function getLocalizedContent() {
  return localizedContent[currentLanguage] || localizedContent.pt;
}

function createWeeklyChallengeCard(challenge) {
  return `
    <article class="card">
      <div class="meta-line">
        <span class="badge warning">${escapeHtml(challenge.level)}</span>
        <span>${escapeHtml(t("dynamic.deadlinePrefix"))} ${escapeHtml(challenge.deadline)}</span>
      </div>
      <h3>${escapeHtml(challenge.title)}</h3>
      <p>${escapeHtml(challenge.prompt)}</p>
      <p class="muted">${escapeHtml(challenge.objective)}</p>
      <ul class="list-grid">
        ${challenge.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <a class="button primary" href="desafios.html">${escapeHtml(t("dynamic.challengeOpen"))}</a>
    </article>
  `;
}

function createPostCard(post) {
  return `
    <article class="card">
      <div class="meta-line">
        <span>${escapeHtml(post.author)}</span>
        <span>${escapeHtml(post.createdAt)}</span>
        <span>${post.commentCount} ${escapeHtml(t("dynamic.commentsSuffix"))}</span>
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <p class="post-excerpt">${escapeHtml(post.excerpt)}</p>
      <a class="button ghost" href="comunidade.html">${escapeHtml(t("dynamic.readConversation"))}</a>
    </article>
  `;
}

function createProjectCard(project) {
  const tags = project.stack.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("");
  return `
    <article class="card">
      <div class="meta-line">
        <span>${escapeHtml(project.author)}</span>
        ${project.featured ? `<span class="badge success">${escapeHtml(t("dynamic.featured"))}</span>` : ""}
      </div>
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.summary)}</p>
      <div class="badges">${tags}</div>
      <a class="button ghost" href="projetos.html">${escapeHtml(t("dynamic.viewProject"))}</a>
    </article>
  `;
}

function createResourceCard(resource) {
  return `
    <article class="card">
      <div class="meta-line">
        <span class="badge">${escapeHtml(resource.type)}</span>
        <span>${escapeHtml(resource.level)}</span>
      </div>
      <h3>${escapeHtml(resource.title)}</h3>
      <p class="muted">${escapeHtml(t("dynamic.resourceHint"))}</p>
      <a class="button ghost" href="${escapeHtml(resource.url)}">${escapeHtml(t("dynamic.openResource"))}</a>
    </article>
  `;
}

function createChallengeCard(challenge) {
  const statusMap = {
    open: { label: t("dynamic.status.open"), className: "success" },
    review: { label: t("dynamic.status.review"), className: "warning" },
    closed: { label: t("dynamic.status.closed"), className: "danger" }
  };

  const status = statusMap[challenge.status] || statusMap.open;

  return `
    <article class="card">
      <div class="meta-line">
        <span class="badge ${status.className}">${status.label}</span>
        <span>${escapeHtml(t("dynamic.difficultyPrefix"))} ${escapeHtml(challenge.difficulty)}</span>
      </div>
      <h3>${escapeHtml(challenge.title)}</h3>
      <p class="muted">${escapeHtml(t("dynamic.deadlinePrefix"))} ${escapeHtml(challenge.deadline)}</p>
      <a class="button ghost" href="comunidade.html">${escapeHtml(challenge.cta)}</a>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


