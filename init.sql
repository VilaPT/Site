\set ON_ERROR_STOP on

-- Create database only when missing.
SELECT 'CREATE DATABASE webdev_jrs'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'webdev_jrs'
)\gexec

\connect webdev_jrs;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP
);

-- Tracks
CREATE TABLE IF NOT EXISTS tracks (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL
);

-- Modules
CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  difficulty VARCHAR(50) NOT NULL,
  UNIQUE (track_id, position)
);

-- Progress
CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'not_started',
  attempts_used INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, module_id)
);

-- Scores
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stars INTEGER CHECK (stars >= 1 AND stars <= 7),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id)
);

-- Insert/update initial tracks
INSERT INTO tracks (slug, title) VALUES
('frontend-html', 'Frontend - HTML'),
('frontend-css', 'Frontend - CSS'),
('frontend-js', 'Frontend - JavaScript'),
('backend-core', 'Backend - Node + API')
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title;

-- Insert/update modules by track slug
WITH module_seed(track_slug, position, title, difficulty) AS (
  VALUES
    ('frontend-html', 1, 'Estrutura base e semantica', 'Iniciante'),
    ('frontend-html', 2, 'Formularios acessiveis', 'Iniciante'),
    ('frontend-html', 3, 'Tabelas e conteudo rico', 'Intermedio'),
    ('frontend-html', 4, 'SEO e metadados', 'Intermedio'),
    ('frontend-html', 5, 'Acessibilidade avancada', 'Avancado'),
    ('frontend-css', 1, 'Seletores e cascata', 'Iniciante'),
    ('frontend-css', 2, 'Layout com Flexbox', 'Iniciante'),
    ('frontend-css', 3, 'Layout com Grid', 'Intermedio'),
    ('frontend-css', 4, 'Design system e variaveis', 'Intermedio'),
    ('frontend-css', 5, 'Animacoes e performance', 'Avancado'),
    ('frontend-js', 1, 'Fundamentos da linguagem', 'Iniciante'),
    ('frontend-js', 2, 'DOM e eventos', 'Iniciante'),
    ('frontend-js', 3, 'Estado no cliente', 'Intermedio'),
    ('frontend-js', 4, 'Assincrono e APIs', 'Intermedio'),
    ('frontend-js', 5, 'Arquitetura modular', 'Avancado'),
    ('backend-core', 1, 'HTTP e rotas', 'Iniciante'),
    ('backend-core', 2, 'Autenticacao', 'Intermedio'),
    ('backend-core', 3, 'Email de confirmacao', 'Intermedio'),
    ('backend-core', 4, 'Persistencia e SQL', 'Avancado'),
    ('backend-core', 5, 'Seguranca e observabilidade', 'Avancado')
),
resolved_modules AS (
  SELECT
    tracks.id AS track_id,
    module_seed.position,
    module_seed.title,
    module_seed.difficulty
  FROM module_seed
  INNER JOIN tracks ON tracks.slug = module_seed.track_slug
)
INSERT INTO modules (track_id, position, title, difficulty)
SELECT track_id, position, title, difficulty
FROM resolved_modules
ON CONFLICT (track_id, position) DO UPDATE
SET
  title = EXCLUDED.title,
  difficulty = EXCLUDED.difficulty;
