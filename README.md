# VilaPT / Site

Repositório com projetos web da VilaPT.

## Chama O Pro

O projeto ativo neste ramo é o **Chama O Pro**, uma plataforma portuguesa para encontrar profissionais adequados e próximos, acompanhar pedidos e gerir o serviço até à avaliação final.

- aplicação pública: <https://vilapt.github.io/Site/chamaopro/>
- ramo de publicação: `chamaopro`
- entrada pública: `chamaopro/`
- frontend: `chamaopro-preview/`
- estado técnico e funcional: [`chamaopro/PROJECT_STATE.md`](chamaopro/PROJECT_STATE.md)
- backend: Supabase

Os endereços antigos `/fazja/` e `/fazperto/` existem apenas como encaminhamentos para o endereço canónico `/chamaopro/`.

### Validar alterações

```bash
npm run check:chama-o-pro
```

O comando volta a gerar o bundle visual e executa os testes automáticos. O workflow de GitHub Actions repete a validação nas alterações relevantes.

## Web Dev Jrs Portugal

Os ficheiros da raiz, como `index.html`, `desafios.html`, `projetos.html`, `recursos.html`, `comunidade.html`, `server.js` e `init.sql`, pertencem ao projeto separado **Web Dev Jrs Portugal**.

As duas aplicações partilham o repositório, mas o Chama O Pro não depende do backend Node/PostgreSQL desse projeto.
