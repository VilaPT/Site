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

check('Entrada oficial Chama O Pro existe e usa o logótipo correto', () => {
  const source = file('chamaopro/index.html');
  mustMatch(source, /logo-chama-o-pro-transparent\.png/, 'O loading deixou de usar o logótipo oficial.');
  mustMatch(source, /\.\.\/fazja-preview\/index\.html/, 'A entrada estável da aplicação deixou de ser carregada.');
});

check('Shell consolidado substitui apenas as camadas previstas', () => {
  const source = file('chamaopro/index.html');
  for (const token of ['shell-early.css', 'shell-late.css']) {
    if (!source.includes(token)) throw new Error(`Bundle consolidado em falta: ${token}`);
  }
  for (const legacy of ['brand20.css', 'ux24.css', 'ux25.css', 'ux33.css', 'ux34.css']) {
    if (source.includes(`'${legacy}'`)) throw new Error(`O loader continua a carregar ${legacy} diretamente.`);
  }
});

check('Splash COP legado permanece neutralizado', () => {
  const source = file('chamaopro/index.html') + '\n' + file('fazja-preview/shell-early.css');
  mustMatch(source, /body::before\s*,?\s*body::after|body::before[\s\S]{0,100}body::after/, 'Falta proteção contra o splash legado.');
  mustMatch(source, /content\s*:\s*none\s*!important/, 'O pseudo-elemento do splash legado pode voltar a aparecer.');
});

check('URL pública canónica aponta para /chamaopro/', () => {
  const source = file('fazja-preview/js/config.js');
  mustMatch(source, /https:\/\/vilapt\.github\.io\/Site\/chamaopro\//, 'PUBLIC_APP_URL deixou de apontar para /chamaopro/.');
});

check('Entrar continua a normalizar para Entrar / Criar conta', () => {
  const source = file('fazja-preview/navigation25.js');
  mustMatch(source, /Entrar \/ Criar conta/, 'O texto de criação de conta desapareceu da navegação.');
});

check('Navegação principal preserva Pedidos, Profissional, Mensagens e Conta', () => {
  const source = file('fazja-preview/navigation25.js');
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
