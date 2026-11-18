// Run: node --test tests/image-editor-annotate.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('image_editor/index.html');
function extract(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert(a !== -1 && b > a, `Missing source markers: ${start}`);
  return html.slice(a, b);
}

test('APP_VERSION と service-worker の CACHE_VERSION が一致している', () => {
  const app = /const APP_VERSION = '([^']+)'/.exec(html)[1];
  const sw = /const CACHE_VERSION = '([^']+)'/.exec(read('image_editor/service-worker.js'))[1];
  assert.equal(app, sw);
  assert.match(app, /^\d{4}-\d{2}-\d{2}-\d{2}$/);
});

test('manifest に file_handlers（png/jpeg/webp → ./index.html）がある', () => {
  const m = JSON.parse(read('image_editor/manifest.json'));
  assert.equal(m.file_handlers.length, 1);
  assert.equal(m.file_handlers[0].action, './index.html');
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) assert(m.file_handlers[0].accept[type]);
});

test('番号マーカーはレイヤー順に連番になり、削除しても欠番にならない', () => {
  const editState = { layers: [] };
  const context = vm.createContext({ editState });
  vm.runInContext(extract('function markerNumber(', 'function contrastColor('), context);
  const marker = id => ({ id, type: 'shape', shape: 'marker' });
  const [a, b, c] = [marker('a'), marker('b'), marker('c')];
  editState.layers = [a, { id: 'r', type: 'shape', shape: 'rect' }, b, c];
  assert.deepEqual([a, b, c].map(l => context.markerNumber(l)), [1, 2, 3]);
  editState.layers = [a, c];
  assert.deepEqual([a, c].map(l => context.markerNumber(l)), [1, 2]);
  assert.equal(context.markerNumber({ id: 'new' }), 3); // 未追加のプレビューは「次の番号」
});

test('番号の文字色は背景の明るさで切り替わる', () => {
  const context = vm.createContext({});
  vm.runInContext(extract('function contrastColor(', 'function drawMarker('), context);
  assert.equal(context.contrastColor('#FF0000'), '#ffffff');
  assert.equal(context.contrastColor('#000000'), '#ffffff');
  assert.equal(context.contrastColor('#FFD400'), '#000000');
  assert.equal(context.contrastColor('#FFFFFF'), '#000000');
});

test('注釈モードの塗りつぶしは四角/楕円だけに効き、編集モードは従来どおり', () => {
  const inputs = { shapeFill: { checked: true }, shapeFillColor: { value: '#ffffff' } };
  const context = vm.createContext({ currentMode: 'annotate', document: { getElementById: id => inputs[id] } });
  vm.runInContext(extract('function shapeFillProps(', 'function createFreehandLayer('), context);
  assert.deepEqual({ ...context.shapeFillProps('rect') }, { fill: true });
  assert.deepEqual({ ...context.shapeFillProps('arrow') }, { fill: false });
  context.currentMode = 'edit';
  assert.deepEqual({ ...context.shapeFillProps('arrow') }, { fill: true, fillColor: '#ffffff' });
});
