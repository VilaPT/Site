# Web Dev Jrs Portugal

Hub de comunidade para aprendizagem de Web Development, com frontend multipágina (fase visual/mock) e backend Node.js + PostgreSQL preparado para autenticação e progressão.

## Estado atual

- Frontend comunitário multipágina já funcional (sem consumo de API nesta fase).
- Conteúdo dinâmico mock no cliente (desafios, projetos, recursos, feed e comentários).
- Alternância de idioma `PT/EN` com persistência em `localStorage`.
- Menu responsivo, header fixo, popover de autenticação visual.
- Backend existente com endpoints de auth e learning (desacoplado do frontend comunitário).

## Páginas públicas

- `/`
- `/desafios.html`
- `/projetos.html`
- `/recursos.html`
- `/comunidade.html`
- `/sobre.html`

## Stack

### Frontend
- HTML5
- CSS3
- JavaScript (vanilla)

### Backend
- Node.js
- Express
- PostgreSQL (`pg`)
- JWT (`jsonwebtoken`)
- Email (`nodemailer`)

## Estrutura do projeto

```text
.
├── assets/
│   ├── favicon.png
│   ├── icons/
│   ├── images/
│   └── logo/
├── css/
│   └── style.css
├── js/
│   └── script.js
├── index.html
├── desafios.html
├── projetos.html
├── recursos.html
├── comunidade.html
├── sobre.html
├── server.js
├── init.sql
└── .env.example
```

## Como correr localmente

1. Instalar dependências:

```bash
npm install
```

2. Configurar ambiente:

- Copiar `.env.example` para `.env`
- Preencher variáveis (DB, JWT, SMTP se necessário)

3. Inicializar base de dados (opcional para fase visual, obrigatório para endpoints de backend):

```bash
psql -h localhost -U postgres -d postgres -f init.sql
```

4. Arrancar servidor:

```bash
npm run dev
```

5. Abrir:

- `http://localhost:3000`

## Scripts

- `npm run dev` -> arranca servidor local
- `npm start` -> arranca servidor local
- `npm test` -> placeholder (sem testes automatizados nesta fase)

## API disponível (backend atual)

- `GET /health`
- `POST /auth/register`
- `GET /auth/verify?token=...`
- `POST /auth/login`
- `GET /auth/me`
- `GET /tracks`
- `GET /learning/state`
- `PUT /learning/state`
- `GET /learning/quiz/config`
- `POST /learning/quiz/submit`

## Próxima fase (Fase 2)

- Ligar frontend comunitário ao backend real.
- Ativar login/registo reais com confirmação por email.
- Persistir posts e comentários em base de dados.
- Implementar estados de loading/erro/sucesso no frontend.
