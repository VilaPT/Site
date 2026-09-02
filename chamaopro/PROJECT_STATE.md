# Chama O Pro — Estado do Projeto

Atualizado em 2026-09-02 para o build 42.

Este documento é a referência técnica e funcional da aplicação. Nunca deve conter passwords, chaves secretas, credenciais SMTP, dados pessoais de utilizadores ou tokens de administração.

## 1. Produto

O Chama O Pro é uma plataforma portuguesa que liga pessoas com um problema a profissionais adequados e próximos.

Fluxo principal:

1. escolher uma categoria e um serviço;
2. indicar o problema e a localização;
3. encontrar profissionais compatíveis por proximidade;
4. consultar o perfil e enviar um pedido;
5. conversar, receber uma proposta e agendar;
6. concluir o serviço e avaliar.

Slogan: **Precisas. Encontras. Está feito.**

## 2. Publicação

- URL pública: `https://vilapt.github.io/Site/chamaopro/`
- repositório: `VilaPT/Site`
- ramo publicado: `chamaopro`
- versão atual: build 42
- alojamento: GitHub Pages
- backend: Supabase, região Europa

Os caminhos antigos `/fazja/` e `/fazperto/` encaminham para `/chamaopro/`. Não contêm uma segunda cópia da aplicação.

## 3. Identidade visual

- verde-água/teal, branco, cinza e carvão;
- cartões e controlos arredondados;
- logótipo transparente com contorno subtil;
- cabeçalho cinzento translúcido;
- navegação principal com indicação visual da secção ativa;
- prioridade à utilização em telemóvel;
- feedback tátil discreto e respeito por `prefers-reduced-motion`.

## 4. Estrutura do frontend

### Entrada pública

- `chamaopro/index.html`: ecrã de abertura e carregamento da aplicação;
- `chamaopro/sw.js`: único service worker ativo, responsável por recursos frescos e cliques em notificações;
- `chamaopro/cache-sw.js`: ponte de compatibilidade para instalações antigas;
- `chamaopro/version.json`: número do build público.

### Aplicação

- `chamaopro-preview/index.html`: documento completo da aplicação;
- `chamaopro-preview/platform.js`: ponto de entrada único dos módulos;
- `chamaopro-preview/platform.css`: bundle visual gerado;
- `chamaopro-preview/app.js`: coordenação da homepage, autenticação, pesquisa e perfil profissional;
- `chamaopro-preview/account.js`: conta, pedidos, área profissional, agenda e alertas;
- `chamaopro-preview/js/`: módulos funcionais partilhados;
- módulos adicionais na raiz de `chamaopro-preview/`: navegação, comunidade, negócio, atividade, denúncias e administração.

Os ficheiros CSS de origem continuam separados para manutenção. O comando `npm run build:chama-o-pro` reúne-os, pela ordem definida, em `platform.css`.

Todos os imports JavaScript internos usam agora URLs canónicos, sem versões diferentes do mesmo módulo. Isto garante uma única instância da pesquisa, chat, localização, autenticação e restantes estados partilhados.

## 5. Carregamento e cache

- ecrã de abertura mínimo: cerca de 1,2 segundos;
- logótipo com brilho suave, sem círculos de fundo;
- um único ficheiro CSS público para o visual da plataforma;
- um único ponto de entrada JavaScript;
- parâmetros aleatórios `?fresh=` aplicados no carregamento público para evitar versões antigas;
- um único service worker para cache e notificações.

## 6. Navegação

A navegação principal tem cinco destinos:

- Início;
- Pedidos;
- Profissional;
- Mensagens;
- Conta.

Pedidos, Profissional, Mensagens e Conta são apresentados como vistas de página, e não como pequenas janelas sobre a homepage. O URL acompanha a secção através do parâmetro `secao` e suporta voltar/avançar do navegador.

## 7. Categorias, competências e pesquisa

Estado público verificado em 2026-09-02:

- 11 categorias;
- 89 competências/serviços.

Categorias atuais:

1. Casa;
2. Automóvel;
3. Tecnologia;
4. Limpeza e apoio;
5. Beleza e bem-estar;
6. Educação;
7. Eventos;
8. Animais;
9. Negócios e profissionais;
10. Transportes;
11. Serviços locais.

A pesquisa aceita categoria, competência, texto livre, freguesia, concelho ou código postal. A resolução geográfica usa `geoapi.pt` e os profissionais são ordenados por compatibilidade e distância através do backend.

Pesquisas e pesquisas sem resultados são registadas em `search_events` para análise da procura.

## 8. Área profissional

O profissional pode definir:

- nome público, título e apresentação;
- uma ou várias competências;
- localidade base e raio de deslocação;
- preço indicativo;
- disponibilidade imediata;
- visibilidade pública;
- atendimento com deslocação;
- espaço físico público, quando aplicável.

A seleção de competências usa uma grelha visual multi-seleção com o mesmo comportamento da grelha de distritos da administração. O `select` original permanece como fonte de verdade do formulário, permitindo guardar e recuperar as escolhas existentes.

O perfil profissional é guardado atomicamente através de `save_professional_profile_v3`.

## 9. Plano profissional

- clientes: gratuitos;
- profissionais: 60 dias gratuitos após a criação do primeiro perfil;
- cobrança: ainda desativada;
- preço mensal na base de dados: ainda não definido;
- sem comissão por trabalho e sem créditos por contacto.

Após o período gratuito, o perfil é preservado, mas deve deixar de aparecer publicamente sem uma subscrição ativa.

## 10. Pedidos e execução do serviço

O fluxo atual suporta:

- pedido geral guardado;
- pedido direcionado a um profissional;
- conversa privada associada ao pedido;
- proposta formal com valor e condições;
- aceitação ou recusa pelo cliente;
- desistência controlada por ambas as partes;
- marcação de dia, hora e duração;
- acesso Waze para a morada do serviço;
- confirmação de trabalho terminado;
- avaliação de uma a cinco estrelas apenas no final do fluxo;
- histórico do cliente e do profissional.

## 11. Comunidade e comunicação

- fotografia e perfil público do utilizador;
- comentários livres no perfil profissional;
- respostas encadeadas a comentários e avaliações;
- eliminação do próprio texto, preservando a coerência da conversa;
- pedidos de mensagem entre utilizadores;
- conversa apenas depois de o destinatário aceitar;
- mensagens de serviço separadas das mensagens sociais;
- contadores de não lidas e atualizações Realtime.

## 12. Alertas e atividade

- notificações visuais na navegação;
- atividade profissional agregada;
- alertas de novas mensagens e alterações do pedido;
- lembretes de agenda enquanto a aplicação web está ativa;
- preferências de som, vibração e antecedência.

Ainda não existe infraestrutura de push completa para garantir notificações com a aplicação totalmente fechada.

## 13. Verificação de conta

Existe um protótipo de comparação facial no dispositivo com movimentos, liveness e anti-spoofing. O vídeo e o vetor biométrico não são guardados pela aplicação.

Limitação importante: os resultados são calculados no browser e comunicados ao backend. Enquanto não existir prova validada por servidor ou fornecedor especializado, o símbolo não deve ser apresentado comercialmente como uma verificação de identidade forte.

## 14. Denúncias, moderação e administração

Os utilizadores podem denunciar:

- comentários;
- avaliações;
- mensagens entre utilizadores;
- mensagens de serviço;
- contas/perfis.

Os moderadores podem analisar denúncias e classificá-las. Apenas o Owner pode aplicar sanções, gerir moderadores, eliminar conteúdo administrativo e consultar a auditoria.

A consola do Owner inclui:

- diretório de utilizadores;
- pesquisa por nome;
- filtro multi-distrito em grelha;
- contagem de denúncias;
- restrição temporária;
- bloqueio e reativação;
- nomeação e remoção de moderadores.

## 15. Backend e dados

Serviços usados:

- Supabase Auth;
- PostgreSQL;
- Row Level Security;
- Realtime;
- Storage para fotografias de perfil;
- funções RPC para operações sensíveis e fluxos atómicos.

Uma verificação anónima de leitura confirmou que categorias, competências e perfis profissionais públicos estão disponíveis, enquanto perfis privados, pedidos, mensagens e notificações recusam acesso sem sessão.

Risco pendente: a tabela pública de perfis profissionais permite consultar as coordenadas geográficas da localização base através da API, embora a interface não as mostre. Antes de um lançamento alargado, o acesso público deve passar por uma vista segura ou RPC que devolva apenas os campos necessários.

As alterações de esquema e políticas do Supabase ainda não estão representadas por migrações no repositório. É necessário criar uma base de migrações reproduzível antes da produção.

## 16. Testes automáticos

Executar:

```bash
npm test
```

Os testes atuais validam:

- sintaxe dos módulos públicos;
- existência de todas as dependências locais;
- imports canónicos e instâncias únicas;
- ponto de entrada da aplicação;
- bundle CSS atualizado;
- service worker único;
- grelha e validação de competências;
- ausência de chaves secretas no cliente;
- número do build e elementos essenciais do HTML.

O workflow `.github/workflows/chama-o-pro-checks.yml` executa estes testes automaticamente nas alterações relevantes.

Ainda são necessários testes autenticados, de ponta a ponta, com contas de cliente, profissional, moderador e Owner.

## 17. Segurança e privacidade

Princípios obrigatórios:

- nunca colocar uma `service_role` ou chave secreta no frontend;
- manter RLS em todas as tabelas expostas;
- validar propriedade dos registos no backend;
- tratar funções `SECURITY DEFINER` como operações privilegiadas;
- não autorizar ações através de metadados editáveis pelo utilizador;
- não expor telefone, morada ou mensagens em endpoints públicos;
- manter rate limiting em autenticação, mensagens, comentários e denúncias;
- registar ações administrativas relevantes.

## 18. Estado de lançamento

O Chama O Pro é uma **beta funcional**, ainda não um produto comercial pronto para lançamento nacional.

Bloqueadores principais:

1. SMTP próprio e fiável para autenticação;
2. migrações versionadas do Supabase e revisão completa de RLS/RPC;
3. proteção adequada das coordenadas dos profissionais;
4. solução robusta para verificação de identidade;
5. Termos, Privacidade, RGPD e identificação do operador legal revistos;
6. testes completos com várias contas e dispositivos;
7. faturação/subscrição apenas quando o preço e o modelo estiverem fechados;
8. domínio e infraestrutura de produção quando a beta estiver validada.

## 19. Princípios de desenvolvimento

- não quebrar fluxos funcionais ao alterar o design;
- fazer mudanças pequenas, testáveis e reversíveis;
- manter a experiência mobile como prioridade;
- preservar o nome e identidade “Chama O Pro” em toda a comunicação pública;
- não inventar estados que o backend não suporta;
- nunca expor credenciais ou dados pessoais;
- testar antes de publicar;
- explicar cada desenvolvimento de forma útil para aprendizagem e portefólio.
