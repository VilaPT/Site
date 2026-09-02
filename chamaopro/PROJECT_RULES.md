# Chama O Pro — Regras permanentes de manutenção

Estas regras são obrigatórias em alterações futuras ao projeto Chama O Pro, salvo pedido explícito do proprietário do projeto para abrir uma exceção.

## 1. Preservação de funcionalidades
- Nenhuma alteração deve remover, apagar ou desativar uma funcionalidade existente sem pedido explícito.
- Antes de substituir código existente, confirmar qual é o comportamento atual e preservar esse comportamento na nova implementação.
- Se uma funcionalidade for reescrita, a versão anterior deve continuar recuperável através do histórico Git e de um ponto estável identificado.

## 2. Versão estável antes de refatorações
- Antes de refatorações estruturais ou conjuntos relevantes de alterações, criar um ponto de recuperação estável.
- A versão estável confirmada em 2026-09-02 está preservada na branch `stable-chamaopro-2026-09-02`.
- Alterações experimentais ou estruturais devem ser feitas fora dessa branch estável.

## 3. Regra de não eliminação
- Não apagar ficheiros, funções, estilos, tabelas, RPCs, dados ou comportamentos só porque parecem antigos ou redundantes.
- Primeiro classificar cada elemento como: ativo, duplicado, substituído, legado ou órfão.
- Elementos comprovadamente obsoletos devem preferencialmente ser movidos para uma área `legacy/` ou preservados apenas no histórico Git antes de qualquer eliminação definitiva.
- Eliminação definitiva exige pedido explícito do proprietário.

## 4. Refatoração do frontend
Objetivo: reduzir bastante a complexidade sem perder funcionalidades.

Estrutura alvo aproximada:

```
chamaopro/
├── index.html
├── assets/
├── css/
│   ├── base.css
│   ├── components.css
│   ├── layout.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── api.js
│   ├── navigation.js
│   ├── location.js
│   ├── search.js
│   ├── professionals.js
│   ├── messages.js
│   ├── comments.js
│   ├── notifications.js
│   └── admin.js
└── legacy/
```

Princípios:
- Consolidar CSS sobreposto e remover apenas regras redundantes depois de validado o resultado final.
- Evitar cadeias de ficheiros de patch como `ux24`, `ux25`, `homepage36`, `homepage37`, etc., quando puderem ser absorvidas numa fonte única e clara.
- Evitar múltiplos listeners ou MutationObservers para a mesma responsabilidade.
- Cada domínio funcional deve ter uma fonte principal de verdade.
- Menos linhas é desejável apenas quando melhora legibilidade, manutenção e desempenho. Não minificar código-fonte apenas para reduzir contagem de linhas.

## 5. Refatoração do backend
- Organizar a lógica por domínio: auth, profiles, professionals, services, messages, comments, notifications, location e admin.
- Consolidar funções/RPCs repetidas apenas depois de confirmar que todos os consumidores usam o novo contrato.
- Preservar RLS e controlos de segurança.
- Nunca expor chaves secretas ou `service_role` no cliente.
- Alterações de schema devem ser pequenas, reversíveis e verificadas.

## 6. Método obrigatório para alterações futuras
1. Partir de uma versão estável conhecida.
2. Fazer uma alteração pequena por vez.
3. Não remover comportamento existente sem autorização explícita.
4. Verificar o diff antes de concluir.
5. Testar os fluxos afetados.
6. Se houver regressão, voltar imediatamente ao último ponto estável em vez de empilhar novos remendos.

## 7. Fluxos que devem ser preservados
Entre outros já existentes no projeto:
- arranque/loading único com logótipo Chama O Pro;
- autenticação e criação de conta;
- pesquisa de serviços;
- categorias e competências;
- localização portuguesa por freguesia, concelho e código postal;
- ordenação de profissionais por proximidade e raio de deslocação;
- perfil profissional;
- grelha de competências na área profissional;
- pedidos de serviço;
- chat cliente-profissional;
- comentários e respostas encadeadas;
- nomes públicos no formato definido para utilizadores comuns e profissionais;
- mensagens entre utilizadores apenas após aceitação;
- notificações;
- área de conta;
- área profissional;
- administração;
- navegação e identidade visual Chama O Pro.

## 8. Objetivo da reorganização
Transformar o projeto atual, que cresceu por camadas sucessivas, numa base mais pequena, clara e profissional, mantendo 100% das funcionalidades confirmadas.

A prioridade é:
1. preservar comportamento;
2. reduzir duplicação;
3. organizar responsabilidades;
4. reduzir número de ficheiros carregados;
5. melhorar desempenho e manutenção;
6. só depois reduzir linhas de código.
