const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../fazja-preview/owner-district-multi.js'), 'utf8')
  .replace(/^import .*;\s*/m, '');
// Model childList delivery: assigning textContent replaces a text node even
// when the new string is unchanged, queuing another body observer delivery.
let pending = false, writes = 0, text = '';
let bodyCallback;
const summary = {
  get textContent() { return text; },
  set textContent(value) { text = value; writes++; pending = true; }
};
const select = { options: [{ value: 'repair', selected: false }], dataset: { skillGridEnhanced: '1' } };
const grid = { querySelectorAll: () => [] };
const body = {};
const elements = { pskills: select, proSkillsGrid: grid, proSkillsSummary: summary };
vm.runInNewContext(source, {
  document: { body, getElementById: id => elements[id] || null },
  MutationObserver: class {
    constructor(callback) { this.callback = callback; }
    observe(target) { if (target === body) bodyCallback = this.callback; }
  }
});
function drain() {
  let deliveries = 0;
  while (pending && deliveries < 10) {
    pending = false;
    bodyCallback();
    deliveries++;
  }
  assert(!pending, 'Body observer endlessly rewrites the skills summary, freezing the page');
}
drain();
assert.equal(writes, 1);
assert.equal(text, 'Seleciona pelo menos uma competência.');
select.options[0].selected = true;
bodyCallback();
drain();
assert.equal(text, '1 competência selecionada.');
assert.equal(writes, 2);
bodyCallback();
drain();
assert.equal(writes, 2, 'Unrelated DOM changes must not rewrite an unchanged summary');
console.log('Skills observer settles after initialisation and selection changes.');
