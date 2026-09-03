const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const results = [];

function file(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Ficheiro em falta: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function mustMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

check('Entrada oficial usa handoff direto e não reescreve o documento', () => {
  const source = file('chamaopro/index.html');
  mustMatch(source, /\.\.\/fazja-preview\/index\.html/, 'A entrada oficial deixou de encaminhar para a aplicação real.');
  mustMatch(source, /location\.replace/, 'O handoff direto deixou de usar navegação normal do browser.');
  if (/document\.write|fetchApp\s*\(|document\.open\s*\(/.test(source)) {
    throw new Error('O bootstrap voltou a reescrever o documento em runtime.');
  }
});

check('Página real preserva URL canónica e usa bootstrap resiliente', () => {
  const source = file('fazja-preview/index.html');
  mustMatch(source, /<base href="\/Site\/fazja-preview\/">/, 'A base fixa dos recursos deixou de estar definida.');
  mustMatch(source, /\/Site\/chamaopro\//, 'A página real deixou de restaurar a URL pública /chamaopro/.');
  mustMatch(source, /cop_entry/, 'O marcador de handoff canónico desapareceu.');
  for (const token of ['styles.css?v=14', 'account.css?v=14', 'bootstrap-resilient.js?v=15']) {
    if (!source.includes(token)) throw new Error(`Versão de arranque em falta: ${token}`);
  }
});

check('Arranque móvel não depende de uma única CDN bloqueante', () => {
  const entry = file('fazja-preview/index.html');
  const bootstrap = file('fazja-preview/bootstrap-resilient.js');
  if (/<script[^>]+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/i.test(entry)) {
    throw new Error('O Supabase voltou a ser carregado por uma CDN bloqueante no HTML.');
  }
  for (const token of ['cdn.jsdelivr.net', 'unpkg.com', 'SCRIPT_TIMEOUT_MS=3000', 'showRecovery', 'Tentar novamente']) {
    if (!bootstrap.includes(token)) throw new Error(`Proteção de arranque móvel em falta: ${token}`);
  }
  mustMatch(bootstrap, /await\s+loadClassicScript\(src\)/, 'O fallback de CDN deixou de aguardar a tentativa atual.');
});

check('Shell consolidado é carregado diretamente pela página real', () => {
  const source = file('fazja-preview/index.html');
  for (const token of ['shell-early.css?v=14', 'shell-late.css?v=14']) {
    if (!source.includes(token)) throw new Error(`Bundle consolidado em falta: ${token}`);
  }
  for (const legacy of ['brand20.css', 'ux24.css', 'ux25.css', 'ux33.css', 'ux34.css']) {
    if (source.includes(`./${legacy}`)) throw new Error(`A página real voltou a carregar ${legacy} diretamente.`);
  }
});

check('Homepage consolidada preserva o percurso categoria → serviço → localização', () => {
  const entry = file('fazja-preview/index.html');
  const bootstrap = file('fazja-preview/bootstrap-resilient.js');
  const source = file('fazja-preview/homepage-flow.js');
  const styles = file('fazja-preview/homepage-flow.css');
  if (!entry.includes('homepage-flow.css?v=14')) throw new Error('CSS consolidado da homepage em falta.');
  if (!bootstrap.includes("import('./homepage-flow.js?v=15')")) throw new Error('JS consolidado da homepage em falta no bootstrap.');
  for (const legacy of ['homepage36.js', 'homepage37.js', 'homepage36.css', 'homepage37.css']) {
    if (entry.includes(`./${legacy}`) || bootstrap.includes(`./${legacy}`)) throw new Error(`O arranque continua a carregar ${legacy} diretamente.`);
  }
  for (const token of ['prepareHomepageFlow', 'prepareChoiceFlow', 'decorateLocalServicesCategory', 'guideSelectedService', 'centerSelectedCategory']) {
    if (!source.includes(token)) throw new Error(`Comportamento da homepage em falta: ${token}`);
  }
  mustMatch(styles, /copSearchGuide/, 'Animação de orientação para a localização desapareceu.');
  mustMatch(styles, /copChoiceReveal/, 'Animação de escolha de serviço desapareceu.');
});

check('Navegação e mensagens usam um módulo consolidado sem polling duplicado', () => {
  const bootstrap = file('fazja-preview/bootstrap-resilient.js');
  const source = file('fazja-preview/navigation-messages.js');
  if (!bootstrap.includes("import('./navigation-messages.js?v=15')")) throw new Error('O bootstrap não usa navigation-messages.js.');
  for (const legacy of ['enhancements26.js', 'navigation25.js']) {
    if (bootstrap.includes(`./${legacy}`)) throw new Error(`O bootstrap voltou a carregar ${legacy} diretamente.`);
  }
  for (const token of ['navRequests', 'navPro', 'navMessages', 'navAccount', 'mark_user_message_thread_read', 'cop:notifications-refresh']) {
    if (!source.includes(token)) throw new Error(`Contrato de navegação/mensagens em falta: ${token}`);
  }
  if (source.includes('notification_counts')) throw new Error('navigation-messages.js voltou a duplicar notification_counts().');
  if (/setInterval\s*\(/.test(source)) throw new Error('navigation-messages.js voltou a criar polling periódico de notificações.');
});

check('Loader usa apenas o logótipo real e desaparece de forma suave', () => {
  const styles = file('fazja-preview/styles.css');
  const bootstrap = file('fazja-preview/bootstrap-resilient.js');
  mustMatch(styles, /logo-chama-o-pro-transparent\.png/, 'O loader deixou de usar o logótipo oficial.');
  mustMatch(styles, /copLogoPulse/, 'A pulsação subtil do logótipo desapareceu.');
  mustMatch(bootstrap, /classList\.add\(['"]cop-ready['"]\)/, 'A transição de saída do loader deixou de ser acionada.');
  if (/content:\s*['"]COP['"]|Profissionais perto de ti/.test(styles)) {
    throw new Error('O splash legado com COP/texto voltou a existir.');
  }
});

check('Todos os módulos adicionais críticos são carregados pelo bootstrap', () => {
  const source = file('fazja-preview/bootstrap-resilient.js');
  for (const token of [
    "import('./app.js?v=15')","import('./account.js?v=15')","import('./js/community.js?v=15')",
    "import('./business37.js?v=15')","import('./social38.js?v=15')","import('./professional-activity.js?v=15')",
    "import('./reports.js?v=15')","import('./admin-control.js?v=15')","import('./district-profile.js?v=15')",
    "import('./owner-console.js?v=15')","import('./owner-district-multi.js?v=15')"
  ]) {
    if (!source.includes(token)) throw new Error(`Módulo ativo em falta: ${token}`);
  }
});

check('URL pública canónica aponta para /chamaopro/', () => {
  const source = file('fazja-preview/js/config.js');
  mustMatch(source, /https:\/\/vilapt\.github\.io\/Site\/chamaopro\//, 'PUBLIC_APP_URL deixou de apontar para /chamaopro/.');
});

check('Entrar continua a normalizar para Entrar / Criar conta', () => {
  const source = file('fazja-preview/navigation-messages.js');
  mustMatch(source, /Entrar \/ Criar conta/, 'O texto de criação de conta desapareceu da navegação.');
});

check('Navegação principal preserva Pedidos, Profissional, Mensagens e Conta', () => {
  const source = file('fazja-preview/navigation-messages.js');
  for (const token of ['navRequests', 'navPro', 'navMessages', 'navAccount']) {
    if (!source.includes(token)) throw new Error(`Secção de navegação em falta: ${token}`);
  }
});

check('Localização portuguesa preserva municípios, freguesias e códigos postais', () => {
  const source = file('fazja-preview/js/location.js');
  mustMatch(source, /municipios\/freguesias/, 'Carregamento de freguesias/municípios desapareceu.');
  mustMatch(source, /resolvePostalCode/, 'Resolução de código postal desapareceu.');
  mustMatch(source, /resolvePortugalLocation/, 'Resolução inteligente de localização desapareceu.');
});

check('Pesquisa continua a usar proximidade geográfica', () => {
  const source = file('fazja-preview/js/search.js');
  mustMatch(source, /search_nearby_professionals/, 'A pesquisa por profissionais próximos deixou de usar a RPC geográfica.');
  mustMatch(source, /distance_km/, 'A distância deixou de fazer parte da experiência de pesquisa.');
});

check('Comentários continuam a aceitar respostas encadeadas', () => {
  const community = file('fazja-preview/js/community.js');
  const social = file('fazja-preview/social38.js');
  mustMatch(community, /buildReplyTree\([^)]*depth/, 'A árvore de respostas das avaliações desapareceu.');
  mustMatch(social, /buildProfileCommentTree\([^)]*depth/, 'A árvore de comentários do perfil desapareceu.');
  mustMatch(social, /reply_professional_profile_comment/, 'A RPC de resposta a comentários deixou de ser utilizada.');
});

check('Mensagens entre utilizadores continuam dependentes de aceitação', () => {
  const source = file('fazja-preview/js/community.js');
  mustMatch(source, /respond_user_message_request/, 'Aceitação/recusa de pedidos de mensagem desapareceu.');
  mustMatch(source, /thread\.status\s*!==\s*['"]accepted['"]/, 'O chat pode deixar de exigir um pedido aceite.');
  mustMatch(source, /request_user_message/, 'Criação de pedido de mensagem desapareceu.');
});

check('Área profissional preserva competências e perfil', () => {
  const source = file('fazja-preview/js/professionals.js');
  mustMatch(source, /professional_skills/, 'Ligação às competências profissionais desapareceu.');
  mustMatch(source, /save_professional_profile_v3/, 'Gravação do perfil profissional deixou de usar a RPC esperada.');
});

check('Rotas antigas encaminham para Chama O Pro', () => {
  for (const relativePath of ['fazja/index.html', 'fazperto/index.html']) {
    const source = file(relativePath);
    mustMatch(source, /\/Site\/chamaopro\//, `${relativePath} deixou de encaminhar para /chamaopro/.`);
  }
});

check('Service worker do Chama O Pro não introduz cache agressiva', () => {
  const source = file('chamaopro/sw.js');
  if (/caches\.open|cache\.put|respondWith\s*\(/.test(source)) {
    throw new Error('O service worker voltou a implementar cache de runtime.');
  }
  mustMatch(source, /notificationclick/, 'Tratamento de notificações desapareceu do service worker.');
});

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? '✓' : '✗'} ${result.name}${result.ok ? '' : `\n  ${result.error}`}`);
}

console.log(`\n${results.length - failed.length}/${results.length} contratos passaram.`);
if (failed.length) process.exit(1);
