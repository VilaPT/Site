# Web Dev Jrs Portugal Roadmap

## Objetivo
Plataforma de ensino web dev do zero ao avançado com módulos por dificuldade, exercícios práticos, limite de tentativas e progressão controlada.

## Regras de progressão
- Cada módulo tem no máximo 5 tentativas.
- Se o aluno passar, avança para o próximo módulo.
- Se falhar 5 tentativas, recua para o módulo anterior.
- A regra aplica-se a todas as áreas (frontend e backend).

## Autenticação
- Registo obrigatório com nome e email.
- Email inválido deve bloquear registo e mostrar mensagem clara.
- Conta só fica ativa após confirmação por email.
- Conteúdo dos módulos apenas para conta ativa.

## Pontuação
- Pontuação global de 1 a 7 estrelas.
- Guardada por utilizador.
- Atualizada com base na conclusão de módulos.

## Estado atual (frontend)
- Interface principal criada.
- Registo com validação de email implementado.
- Confirmação de conta em modo simulado local.
- Progressão de módulos com regra de 5 tentativas implementada.
- Pontuação 1-7 estrelas implementada e persistida em `localStorage`.

## Próxima fase (backend real)
1. API Node.js (Express/Fastify) com PostgreSQL.
2. `POST /auth/register` cria conta `pending` e token de verificação.
3. Envio de email transacional (Resend, SendGrid ou SMTP).
4. `GET /auth/verify?token=...` ativa conta.
5. Endpoints de progresso por área/módulo e registo de tentativas.
6. Endpoints de pontuação e histórico.
7. Proteção de rotas com sessão/JWT.

## Configuração mínima recomendada
- Definir `DB_PASSWORD` forte no `.env` para ambientes não-locais.
- Definir `JWT_SECRET` forte e exclusivo por ambiente.
- Configurar `EMAIL_HOST`, `EMAIL_USER` e `EMAIL_PASS` para verificação por email real.

## Modelo de dados base
- `users(id, name, email, status, created_at, verified_at)`
- `email_verification_tokens(id, user_id, token_hash, expires_at, used_at)`
- `tracks(id, slug, title)`
- `modules(id, track_id, position, title, difficulty)`
- `progress(id, user_id, module_id, status, attempts_used, updated_at)`
- `scores(id, user_id, stars, updated_at)`

