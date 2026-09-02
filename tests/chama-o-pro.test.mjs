import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { composePlatformCss, cssSources } from '../scripts/build-chama-o-pro.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previewRoot = path.join(repoRoot, 'chamaopro-preview');

const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

function filesBelow(relativePath, extension) {
  const root = path.join(repoRoot, relativePath);
  const files = [];
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const absolute = path.join(directory, name);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else if (absolute.endsWith(extension)) files.push(absolute);
    }
  };
  visit(root);
  return files.sort();
}

function moduleSpecifiers(source) {
  const matches = source.matchAll(/\b(?:from\s+|import\s*(?:\(\s*)?)(['"])([^'"]+)\1/g);
  return [...matches].map((match) => match[2]);
}

test('todos os ficheiros JavaScript públicos têm sintaxe válida', () => {
  const files = [...filesBelow('chamaopro', '.js'), ...filesBelow('chamaopro-preview', '.js')];
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: readFileSync(file, 'utf8'),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${path.relative(repoRoot, file)}\n${result.stderr}`);
  }
});

test('os módulos internos usam um URL canónico e todas as dependências existem', () => {
  for (const file of filesBelow('chamaopro-preview', '.js')) {
    for (const specifier of moduleSpecifiers(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      assert.doesNotMatch(specifier, /[?#]/, `${path.relative(repoRoot, file)} usa ${specifier}`);
      const target = path.resolve(path.dirname(file), specifier);
      assert.equal(statSync(target).isFile(), true, `Importação em falta: ${specifier}`);
    }
  }
});

test('a aplicação tem um único ponto de entrada funcional', () => {
  const expected = [
    './app.js',
    './account.js',
    './js/community.js',
    './enhancements26.js',
    './navigation25.js',
    './homepage36.js',
    './homepage37.js',
    './business37.js',
    './social38.js',
    './professional-activity.js',
    './reports.js',
    './admin-control.js',
    './district-profile.js',
    './owner-console.js',
    './owner-district-multi.js',
  ];
  assert.deepEqual(moduleSpecifiers(read('chamaopro-preview/platform.js')), expected);

  const html = read('chamaopro-preview/index.html');
  assert.match(html, /href="\.\/platform\.css\?v=42"/);
  assert.match(html, /src="\.\/platform\.js\?v=42"/);
  assert.equal((html.match(/rel="stylesheet"/g) || []).length, 1);
  assert.equal((html.match(/type="module"/g) || []).length, 1);
});

test('o bundle visual está atualizado e inclui todas as fontes pela ordem definida', async () => {
  for (const source of cssSources) {
    assert.equal(statSync(path.join(previewRoot, source)).isFile(), true, `CSS em falta: ${source}`);
  }
  assert.equal(read('chamaopro-preview/platform.css'), await composePlatformCss());
});

test('o arranque é curto, declarativo e usa o service worker único', () => {
  const loader = read('chamaopro/index.html');
  assert.match(loader, /const minimumLoadingMs = 1200;/);
  assert.match(loader, /serviceWorker\.register\('\.\/sw\.js'/);
  assert.doesNotMatch(loader, /cache-sw\.js/);
  assert.doesNotMatch(loader, /html\.replace\('\<\/head\>'/);
  assert.doesNotMatch(loader, /html\.replace\('\<\/body\>'/);

  const alerts = read('chamaopro-preview/js/alerts.js');
  assert.match(alerts, /new URL\('\.\/sw\.js', pageUrl\)/);

  const worker = read('chamaopro/sw.js');
  for (const eventName of ['install', 'activate', 'fetch', 'notificationclick']) {
    assert.match(worker, new RegExp(`addEventListener\\('${eventName}'`));
  }
  assert.match(read('chamaopro/cache-sw.js'), /importScripts\('\.\/sw\.js'\)/);
});

test('a grelha de competências mantém seleção múltipla, sincronização e validação', () => {
  const grid = read('chamaopro-preview/owner-district-multi.js');
  assert.match(grid, /class="owner-district-choice pro-skill-choice"/);
  assert.match(grid, /data-pro-skill=/);
  assert.match(grid, /aria-pressed=/);
  assert.match(grid, /option\.selected = !option\.selected/);
  assert.match(grid, /MutationObserver/);

  const professional = read('chamaopro-preview/js/professionals.js');
  assert.match(professional, /selectedOptions/);
  assert.match(professional, /Escolhe pelo menos um serviço\./);
});

test('o cliente público não contém chaves secretas do Supabase', () => {
  const publicScripts = [...filesBelow('chamaopro', '.js'), ...filesBelow('chamaopro-preview', '.js')]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  assert.doesNotMatch(publicScripts, /sb_secret_|service_role/i);
  assert.match(read('chamaopro-preview/js/config.js'), /SUPABASE_PUBLISHABLE_KEY/);
});

test('o build e os elementos essenciais da aplicação estão presentes', () => {
  assert.equal(JSON.parse(read('chamaopro/version.json')).build, '42');
  const html = read('chamaopro-preview/index.html');
  for (const id of ['searchForm', 'categoryGrid', 'pskills', 'accountModal', 'chatModal', 'appointmentModal']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('o nome técnico e o endereço canónico são chamaopro', () => {
  assert.match(read('chamaopro/index.html'), /\.\.\/chamaopro-preview\/index\.html/);
  assert.match(read('chamaopro-preview/js/config.js'), /\/Site\/chamaopro\//);
  assert.match(read('chamaopro-preview/js/alerts.js'), /\/chamaopro\//);
  assert.match(read('chamaopro-preview/js/utils.js'), /chamaopro_sid/);

  for (const legacyPath of ['fazja/index.html', 'fazperto/index.html']) {
    const redirect = read(legacyPath);
    assert.match(redirect, /\.\.\/chamaopro\//);
    assert.match(redirect, /rel="canonical" href="https:\/\/vilapt\.github\.io\/Site\/chamaopro\/"/);
  }
});
