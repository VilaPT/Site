# Chama O Pro — Arquitetura de Interação

Build 27 introduz uma camada transversal para tornar o comportamento da interface previsível, acessível e escalável.

## 1. Princípio base

A interface distingue três tipos de interação:

1. **Página interna** — altera a área principal da aplicação e deve começar no topo. Exemplos: Pedidos, Profissional, Mensagens e Conta.
2. **Overlay** — uma tarefa curta que aparece sobre a página atual e tem de ficar presa ao viewport. Exemplos: autenticação, verificação de identidade, chat, agenda, perfil público e formulários pontuais.
3. **Navegação contextual** — uma ação que precisa de levar o utilizador a um ponto concreto da interface. Exemplo: tentar pedir um serviço sem telefone e ser levado diretamente ao campo Telefone da Conta.

Não se deve resolver estes três casos com o mesmo mecanismo.

## 2. Controlador central

O ficheiro `js/ui27.js` é a fonte de verdade para comportamentos transversais de UI.

Responsabilidades:

- abrir e fechar overlays;
- manter overlays presos ao viewport;
- bloquear o scroll da página enquanto um overlay está aberto;
- colocar o conteúdo do overlay no topo quando abre;
- mover o foco para o primeiro controlo útil;
- manter o foco dentro do diálogo com teclado;
- fechar o overlay superior com `Escape`;
- permitir fecho pelo backdrop sem ignorar a lógica específica do componente;
- devolver o foco ao elemento que abriu o overlay;
- reconhecer automaticamente modais existentes e novos através de `MutationObserver`;
- normalizar páginas internas para abrirem no topo;
- navegar para secções e alvos concretos com `navigateSection()` e `revealTarget()`;
- realçar temporariamente o campo ou elemento para onde o utilizador foi encaminhado;
- levar automaticamente ao primeiro campo inválido de um formulário.

A API fica também disponível em `window.COPUI` para integrações progressivas e para código legado.

## 3. Contrato para overlays

Para novos componentes, usar:

```js
import { openOverlay, closeOverlay } from './ui27.js?v=27';

openOverlay('meuModal', { focus: '#campoPrincipal' });
closeOverlay('meuModal');
```

O componente continua responsável pela sua lógica de negócio, por exemplo parar a câmara, remover uma subscrição Realtime ou limpar estado. O controlador central trata apenas do comportamento visual, foco, viewport e acessibilidade.

## 4. Contrato para navegação contextual

Quando uma ação depende de dados que estão noutra secção, não se deve mostrar um alerta e deixar o utilizador à procura do campo.

Usar:

```js
await navigateSection('profile', {
  target: '#accountPhone',
  focus: true,
  hint: 'Completa este dado para continuares.',
});
```

O sistema:

1. abre a secção correta;
2. espera que a página esteja pronta;
3. desloca-se até ao alvo;
4. realça o alvo;
5. coloca o foco no campo;
6. explica ao utilizador porque foi encaminhado para ali.

## 5. Correção do problema dos modais fora do ecrã

O Build 26 animava o elemento `body` com `transform` e `filter` e mantinha o estado final da animação. Um ancestral transformado pode alterar o containing block de descendentes `position: fixed`. Em navegadores móveis, isto pode fazer um modal comportar-se como se estivesse preso ao documento e não ao viewport.

No Build 27, a transição inicial do `body` usa apenas `opacity`. Assim, overlays `position: fixed` voltam a ser relativos ao viewport.

A classe defensiva `cop-ui-viewport-safe` também garante que `transform` e `filter` não ficam presos ao `body` depois da abertura da plataforma.

## 6. Compatibilidade com código existente

A migração é progressiva, não um rewrite de risco.

`ui27.js` observa automaticamente qualquer `.modal` que passe a ter a classe `.open`, incluindo modais criados dinamicamente por outras funcionalidades. Isto significa que funcionalidades antigas beneficiam imediatamente do novo comportamento, mesmo antes de serem refatoradas para chamar `openOverlay()` diretamente.

Novas funcionalidades devem usar a API central desde o início.

## 7. Regras para novas funcionalidades

Antes de criar uma interação, decidir:

- É uma página interna, um overlay ou um salto contextual?
- Qual é o primeiro elemento que o utilizador precisa de ver ou usar?
- O componente deve bloquear o scroll de fundo?
- Qual é o comportamento ao carregar em Escape ou no backdrop?
- É necessário devolver o foco ao botão de origem?
- Existe um estado intermédio que deva mostrar feedback?
- Se faltar um dado, é possível levar o utilizador diretamente ao local onde o pode corrigir?

Evitar:

- `window.alert()` para explicar onde o utilizador deve ir;
- abrir uma secção e obrigar o utilizador a procurar manualmente o campo;
- implementar lógica de foco e scroll separadamente em cada feature;
- aplicar `transform` ou `filter` ao `body` quando existem elementos `position: fixed`;
- duplicar regras de abertura/fecho de modais em múltiplos ficheiros.

## 8. Exemplo aplicado no Build 27

No pedido direto a um profissional, o sistema valida se existem:

- telefone;
- morada;
- código postal;
- localidade.

Se faltar um destes dados, identifica o primeiro campo em falta e usa a navegação contextual para levar o utilizador exatamente até esse campo na Conta. Deixa de existir o fluxo antigo de `alert()` + abertura genérica da Conta.

## 9. Como explicar isto numa entrevista

Uma forma curta de apresentar a decisão:

> “Tínhamos lógica de modais, navegação e scroll espalhada por várias features. Em vez de corrigir cada bug isoladamente, criei uma camada transversal de interação. Separei páginas internas, overlays e navegação contextual. O controlador central trata viewport, foco, scroll, teclado e acessibilidade, mas deixa a lógica de negócio dentro de cada módulo. Mantive compatibilidade com o código existente através de observação de modais, o que permitiu uma migração progressiva sem reescrever a aplicação toda.”

Pontos técnicos que vale a pena mencionar:

- separation of concerns;
- progressive refactor;
- backward compatibility;
- focus management;
- keyboard accessibility;
- scroll locking;
- `MutationObserver` para componentes dinâmicos;
- deep/contextual navigation;
- redução de duplicação;
- prevenção de regressões de UI;
- correção de containing block causado por `transform` num ancestral de elementos `fixed`.
