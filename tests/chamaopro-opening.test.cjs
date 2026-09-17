const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'chamaopro/index.html'), 'utf8');
assert(!/document\.(?:write|open)\s*\(/.test(html), 'Opening must not rewrite the document');
assert(html.includes('<main>') && html.includes('id="searchForm"'), 'Initial response must contain the app');
assert(html.includes('<noscript>'), 'Explain disabled JavaScript');
const base = html.match(/<base href="([^"]+)"/)[1];
const assets = [...html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/g)]
  .map(match => match[1]).filter(src => !/^https?:/.test(src));
for (const entry of [
  'https://vilapt.github.io/Site/chamaopro/',
  'https://vilapt.github.io/Site/chamaopro/index.html',
  'https://vilapt.github.io/Site/chamaopro/?utm_source=google#conta',
  'https://vilapt.github.io/Site/chamaopro/?utm_source=bing#pedidos',
  'http://localhost:3000/chamaopro/'
]) {
  for (const asset of assets) {
    const url = new URL(asset, new URL(base, entry));
    const relative = url.pathname.replace(/^\/Site\//, '').replace(/^\//, '');
    assert(fs.existsSync(path.join(root, relative)), `${entry}: missing ${asset}`);
  }
}
// The SDK must load before all dependent modules, using normal parser semantics.
assert(html.indexOf('supabase.min.js') < html.indexOf('src="./app.js'));
assert(html.indexOf('boot.js') < html.indexOf('supabase.min.js'));
const boot = fs.readFileSync(path.join(root, 'chamaopro/boot.js'), 'utf8');
function bootContext() {
  const classes = new Set(), listeners = {}, timers = [];
  const context = {
    Date, document: { documentElement: { classList: {
      add: name => classes.add(name), remove: name => classes.delete(name)
    } } },
    window: { addEventListener: (event, callback) => { listeners[event] = callback; } },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); }
  };
  vm.runInNewContext(boot, context);
  return { classes, listeners, timers };
}
const stalled = bootContext();
assert(stalled.classes.has('cop-booting'));
stalled.timers.find(timer => timer.delay === 12000).callback();
assert(!stalled.classes.has('cop-booting'), 'Slow dependencies must not trap the opening screen');
const loaded = bootContext();
loaded.listeners.load();
loaded.timers.at(-1).callback();
assert(!loaded.classes.has('cop-booting'));
const restored = bootContext();
restored.listeners.pageshow({ persisted: true });
assert(!restored.classes.has('cop-booting'), 'Back/forward restoration must dismiss the loader');
console.log('Opening: static content, asset URLs, dependency order, timeout and history restoration OK');
