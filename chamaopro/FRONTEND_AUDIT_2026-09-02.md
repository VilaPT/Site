# Chama O Pro — Auditoria do frontend

Data: 2026-09-02

Esta auditoria foi feita antes de qualquer consolidação estrutural. Nenhum ficheiro da aplicação foi apagado, movido ou desativado.

## Método

Foi criado `tests/chamaopro-frontend-audit.cjs`, que:

1. parte de `chamaopro/index.html`;
2. lê os CSS e JS injetados pelo loader;
3. lê os CSS e JS declarados no `fazja-preview/index.html` estável;
4. segue recursivamente imports JavaScript e `@import` CSS;
5. compara o grafo alcançável com todos os ficheiros `.js` e `.css` existentes em `fazja-preview/`;
6. marca o que fica fora do grafo apenas como candidato a legado/órfão, nunca como candidato a eliminação automática.

O auditor passa também a correr no workflow `Chama O Pro Safety` através de `npm run audit:frontend`.

## Resultado

- Ficheiros JS/CSS encontrados: **56**
- Ficheiros ativos/alcançáveis: **53**
- Candidatos a legado/órfão: **3**
- Peso JS/CSS total: **366 970 bytes**
- Peso alcançável: **346 841 bytes**
- Peso candidato: **20 129 bytes**

Isto significa que cerca de 95% do peso JS/CSS atual ainda está ligado ao arranque ou a imports da aplicação. O principal problema estrutural não é código morto: são muitas camadas ativas que se foram acumulando ao longo dos builds.

## Candidatos identificados

### `enhancements25.js`
- Estado: **substituído provável**
- Versão ativa correspondente: `enhancements26.js`
- Tamanho: 11 870 bytes
- O Build 26 é carregado atualmente e contém a evolução posterior da navegação/mensagens.
- Não apagar. Primeiro preservar em `legacy/` quando começar a consolidação e voltar a correr todos os testes.

### `navigation24.js`
- Estado: **substituído provável**
- Versão ativa correspondente: `navigation25.js`
- Tamanho: 4 703 bytes
- A versão 25 acrescenta a área Mensagens ao modelo de navegação que existia no Build 24.
- Não apagar. Primeiro preservar em `legacy/` quando começar a consolidação e voltar a correr todos os testes.

### `feature13.css`
- Estado: **candidato a legado/órfão**
- Tamanho: 3 556 bytes
- Não é alcançado pelo loader atual, pelo HTML base nem pelo grafo de imports CSS.
- Contém estilos antigos de perfil, avaliações, alertas, agenda e outros componentes que foram evoluindo em folhas posteriores.
- Não apagar. Deve ser comparado por seletores com as folhas atuais antes de qualquer movimentação para `legacy/`.

## Entradas diretas atuais

O arranque atual ainda liga diretamente **39 ficheiros CSS/JS**, antes mesmo de contar os módulos importados internamente.

Entre eles estão:

- base: `styles.css`, `account.css`, `app.js`, `account.js`;
- identidade/navegação: `brand20.css`, `ux24.css`, `ux25.css`, `navigation25.js`;
- comunidade/social: `community18.css`, `js/community.js`, `social38.css`, `social38.js`, `directchat35.css`, `enhancements26.js`;
- homepage: `homepage36.css/js` e `homepage37.css/js`;
- profissional: `professional-activity.css/js`, `profile30.css`, `pro-editor-viewport.css`;
- administração: `admin-control.css/js`, `owner-console.css/js`, `owner-district-multi.css/js`, `district-profile.js`, `reports.css/js`;
- outras camadas: `verification29.css`, `chat31.css`, `appointment32.css`, `ux33.css`, `ux34.css`, `business37.css/js`, `auth-viewport.css`.

Os restantes ficheiros ativos são dependências JavaScript importadas por estes módulos, incluindo autenticação, pesquisa, pedidos, profissionais, localização, Supabase, utilitários, chat, alertas, agenda, memberships e verificação.

## Conclusão técnica

A reorganização deve seguir duas pistas diferentes:

1. **Legado real**: os 3 ficheiros fora do grafo podem ser isolados mais tarde, sem eliminação definitiva.
2. **Complexidade ativa**: este é o maior alvo. `ux24`, `ux25`, `ux33`, `ux34`, `homepage36`, `homepage37`, `community18`, `social38`, etc. ainda estão ativos e devem ser consolidados por domínio, um grupo de cada vez.

Não é seguro simplesmente remover os ficheiros numerados. Muitos deles ainda fornecem comportamento ou estilos usados na versão funcional atual.

## Ordem recomendada para a futura consolidação

1. Criar uma branch exclusiva de refatoração a partir do estado funcional atual.
2. Começar pelo CSS, por ter menos risco para regras de negócio.
3. Consolidar primeiro identidade + navegação (`styles.css`, `brand20.css`, `ux24.css`, `ux25.css`, `ux33.css`, `ux34.css`) numa fonte organizada, preservando o resultado visual.
4. Executar os 12 contratos e o auditor.
5. Só depois consolidar homepage e componentes.
6. Passar ao JavaScript por domínio: navegação, mensagens/comunidade, profissional e administração.
7. Nunca eliminar a versão anterior durante a migração. A versão nova só substitui a antiga depois de passar os testes e de o comportamento ser confirmado.

## Regra

Um ficheiro classificado como `candidato a legado/órfão` não significa `pode ser apagado`. Significa apenas que não é alcançado pelo grafo estático atual e que pode ser estudado para arquivo numa fase posterior.
