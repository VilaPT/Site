# Testes de segurança do Chama O Pro

Esta pasta contém verificações de regressão que preservam os comportamentos confirmados da plataforma antes de qualquer refatoração estrutural.

Executar localmente:

```bash
npm test
```

O workflow `.github/workflows/chamaopro-safety.yml` executa estes contratos automaticamente em alterações à branch `chamaopro` e em Pull Requests dirigidos a essa branch.

## Regra de eliminação

Ficheiros não devem ser eliminados por alterações normais. O workflow falha se detetar eliminações não autorizadas. A marca `[ALLOW-DELETE]` só deve ser usada quando o proprietário do projeto tiver pedido explicitamente a eliminação.

## Objetivo

Os testes verificam contratos essenciais como arranque, URL oficial, navegação, localização, proximidade, comentários, mensagens, perfil profissional, redirecionamentos legados e service worker. Durante a futura reorganização, os testes podem mudar de localização ou implementação, mas os comportamentos protegidos devem continuar equivalentes.
