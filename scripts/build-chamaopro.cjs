// Build the public document before deployment, never in the visitor's browser.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { styles, scripts } = require('./chamaopro-assets.json');
const version = '20260917';
let html = fs.readFileSync(path.join(root, 'fazja-preview/index.html'), 'utf8');
html = html.replace(/<head>/i, `<head>
  <!-- Generated from ../fazja-preview/index.html by npm run build:chamaopro. -->
  <base href="../fazja-preview/">
  <link rel="canonical" href="https://vilapt.github.io/Site/chamaopro/">
  <link rel="stylesheet" href="../chamaopro/boot.css?v=${version}">
  <script src="../chamaopro/boot.js?v=${version}"></script>`);
html = html.replace(/\?v=\d+/g, '?v=' + version);
html = html.replace(/<\/head>/i, [...new Set(styles)].map(src =>
  `  <link rel="stylesheet" href="./${src}?v=${version}">`).join('\n') + '\n</head>');
html = html.replace(/<body>/i, `<body>
  <div id="copBootHandoff" role="status" aria-label="A abrir o Chama O Pro"><img src="./logo-chama-o-pro-transparent.png" alt="Símbolo do Chama O Pro"></div>
  <noscript><p>Ativa o JavaScript no navegador para pesquisar profissionais e entrar na tua conta.</p></noscript>`);
html = html.replace(/<\/body>/i, [...new Set(scripts)].map(src =>
  `<script type="module" src="./${src}?v=${version}"></script>`).join('\n') + '\n</body>');
const output = path.join(root, 'chamaopro/index.html');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(output, 'utf8') !== html) {
    throw new Error('A entrada pública está desatualizada. Executa npm run build:chamaopro.');
  }
} else {
  fs.writeFileSync(output, html);
}
