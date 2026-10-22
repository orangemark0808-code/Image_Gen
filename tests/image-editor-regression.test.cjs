// Run: node --test tests/image-editor-regression.test.cjs
// Browser APIs are replaced with in-memory doubles; user files/storage are never used.
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
const serialization = extract('function serializeLayers(', 'function saveHistory(');
const persistence = extract('// --- State persistence ---', "document.getElementById('clearAll').addEventListener");
const resizing = extract('function readResizeDimensions(', '// RESIZE タブの');
function environment() {
  const elements = new Map(), handlers = new Map(), storage = new Map(), images = [];
  const options = {mode: 'pixel', target: 'canvas', holdImages: false, failRead: false, failWrite: false};
  const messages = [], drawCalls = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value: '', disabled: false, style: {},
      addEventListener(type, cb) {handlers.set(`${id}:${type}`, cb);}});
    return elements.get(id);
  };
  const context2d = () => ({
    putImageData(data) {if (options.failWrite) {options.failWrite = false; throw new Error('write failure');} this.data = data;},
    drawImage(img) {drawCalls.push(img);},
    getImageData(x, y, width, height) {if(options.failRead) throw new Error('allocation failure'); return {width, height, pixels: 'ready'};},
    save() {}, restore() {}, translate() {}, rotate() {}
  });
  const ctx = context2d();
  class FakeImage {
    set src(value) {
      this.source = value; images.push(this);
      if (!options.holdImages) queueMicrotask(() => this.finish());
    }
    finish() {
      if (this.source === 'broken') this.onerror();
      else {this.ready = true; this.onload();}
    }
    get complete() {return !!this.ready;}
    get naturalWidth() {return this.ready ? 10 : 0;}
  }
  const state = {baseImage: {pixels: 'original'}, baseWidth: 100, baseHeight: 80,
    layers: [{type: 'image', id: 'clip', src: 'clip', x: 2, y: 3, w: 10, h: 20, _img: {ready: true}}],
    cropRect: {x: 2, y: 4, w: 50, h: 40}, selectedLayerId: 'clip', history: ['original'], historyIdx: 0};
  const sandbox = {
    document: {getElementById: element,
      querySelector: selector => ({value: selector.includes('resizeTarget') ? options.target : options.mode}),
      createElement: () => {const c = context2d(); return {width: 0, height: 0, getContext: () => c};}},
    editState: state, canvas: {width: 100, height: 80, style: {}}, ctx, Image: FakeImage,
    BLANK_CANVAS_MAX_SIZE: 8000, clipboardPasteToken: null,
    localStorage: {getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v)},
    canvasToDataURL_base: () => 'base', toast: msg => messages.push(msg),
    render() {}, updateCropStatus() {}, updateCanvasInfo() {}, updateLayerList() {},
    zoomFit() {}, applyZoom() {}, saveHistory() {state.history.push('saved');},
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(serialization + persistence + resizing, context);
  return {context, state, options, element, handlers, storage, images, messages, drawCalls};
}
const saved = () => ({baseWidth: 60, baseHeight: 40, baseImageData: 'base', savedAt: '2026-10-19T00:00:00Z',
  layers: [{type: 'image', id: 'restored', src: 'clip', x: 0, y: 0, w: 20, h: 20, _img: {}}]});

test('all inline scripts and modified service workers parse', () => {
  for (const file of ['image_editor/index.html', 'studio/index.html']) {
    for (const m of read(file).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(m[1], {filename: file});
  }
  for (const file of ['studio/sw.js', 'image_editor/service-worker.js']) new vm.Script(read(file));
});
test('freehand stroke remains drawable after moving, resizing, and serialization', () => {
  const lines = [];
  const context = vm.createContext({
    uid: () => 'stroke', editState: {selectedLayerId: null},
    ctx: {save() {}, restore() {}, beginPath() {}, moveTo(x, y) {lines.push(['start', x, y]);},
      lineTo(x, y) {lines.push(['end', x, y]);}, stroke() {}, arc() {}, fill() {}},
  });
  vm.runInContext(extract('function createFreehandLayer(', 'function appendFreehandPoint(') +
    extract('function drawShape(', 'function drawImageLayer('), context);
  const layer = context.createFreehandLayer([{x: 10, y: 20}, {x: 30, y: 40}], '#000000', 6);
  assert.equal(layer.shape, 'freehand');
  context.drawShape(layer);
  assert.deepEqual(lines, [['start', 10, 20], ['end', 30, 40]]);
  lines.length = 0;
  const restored = JSON.parse(JSON.stringify(layer));
  restored.x1 += 5; restored.x2 += 15; restored.y1 += 10; restored.y2 += 20;
  context.drawShape(restored);
  assert.deepEqual(lines, [['start', 15, 30], ['end', 45, 60]]);
});
test('freehand layer survives state save and restore', async () => {
  const e = environment();
  e.state.layers = [{id: 'stroke', type: 'shape', shape: 'freehand', x1: 2, y1: 3, x2: 12, y2: 13,
    points: [{x: 0, y: 0}, {x: 1, y: 1}], color: '#000000', strokeWidth: 6, fill: false}];
  e.handlers.get('saveState:click')();
  await e.handlers.get('loadState:click')();
  assert.equal(e.state.layers[0].shape, 'freehand');
  assert.deepEqual(JSON.parse(JSON.stringify(e.state.layers[0].points)), [{x: 0, y: 0}, {x: 1, y: 1}]);
});
test('double arrows draw heads at both endpoints after serialization in every direction', () => {
  const starts = [], heads = [];
  const context = vm.createContext({editState: {selectedLayerId: null}, ctx: {
    save() {}, restore() {}, beginPath() {},
    moveTo(x, y) {starts.push([x, y]);}, lineTo() {}, stroke() {}, closePath() {},
    fill() {heads.push(starts.at(-1));},
  }});
  vm.runInContext(extract('function drawShape(', 'function drawImageLayer(') +
    extract('function drawArrow(', 'function drawMoveGuides(') +
    extract('function getShapeHandleHit(', '// 選択中 text レイヤー'), context);
  for (const [x2, y2] of [[100, 20], [-100, 20], [10, 100], [80, -60]]) {
    starts.length = 0; heads.length = 0;
    const layer = JSON.parse(JSON.stringify({id: 'double', type: 'shape', shape: 'doubleArrow',
      x1: 10, y1: 20, x2, y2, color: '#ff0000', strokeWidth: 6, fill: false}));
    context.drawShape(layer);
    assert.deepEqual(heads, [[x2, y2], [10, 20]]);
    assert.equal(context.getShapeHandleHit(layer, 10, 20), 'p1');
    assert.equal(context.getShapeHandleHit(layer, x2, y2), 'p2');
  }
  heads.length = 0;
  context.drawArrow(0, 0, 100, 0, 6);
  assert.equal(heads.length, 1);
});
test('state save omits image caches without changing active layers', () => {
  const e = environment();
  e.handlers.get('saveState:click')();
  const data = JSON.parse(e.storage.get('imageEditor_editState'));
  assert.equal('_img' in data.layers[0], false);
  assert.equal(data.layers[0].src, 'clip');
  assert.equal(e.state.layers[0]._img.ready, true);
});
test('legacy saved image caches are replaced by loaded drawable images', async () => {
  const e = environment();
  e.storage.set('imageEditor_editState', JSON.stringify(saved()));
  await e.handlers.get('loadState:click')();
  assert.equal(e.state.layers[0]._img.complete, true);
  assert.equal(e.state.layers[0]._img.naturalWidth, 10);
  assert.equal(e.state.selectedLayerId, null);
  assert.equal(e.state.cropRect, null);
  vm.runInContext(extract('function drawImageLayer(', '// 選択中 image レイヤー'), e.context);
  e.context.drawImageLayer(e.state.layers[0]);
  assert.equal(e.drawCalls.at(-1), e.state.layers[0]._img);
  assert.equal(e.element('loadState').disabled, false);
});
test('restore waits for every layer and prevents a second concurrent restore', async () => {
  const e = environment(); e.options.holdImages = true;
  e.storage.set('imageEditor_editState', JSON.stringify(saved()));
  const before = JSON.stringify(e.state);
  const pending = e.handlers.get('loadState:click')();
  await e.handlers.get('loadState:click')();
  assert.equal(e.images.length, 2);
  e.images[0].finish(); await Promise.resolve();
  assert.equal(JSON.stringify(e.state), before);
  assert.equal(e.element('loadState').disabled, true);
  e.images[1].finish(); await pending;
  assert.equal(e.state.baseWidth, 60);
  assert.equal(e.element('loadState').disabled, false);
});
for (const kind of ['json', 'image', 'structure', 'canvas']) {
  test(`restore failure (${kind}) preserves current state and unlocks button`, async () => {
    const e = environment(), data = saved();
    if(kind === 'image') data.layers[0].src = 'broken';
    if(kind === 'structure') data.layers = null;
    if(kind === 'canvas') e.options.failRead = true;
    e.storage.set('imageEditor_editState', kind === 'json' ? '{' : JSON.stringify(data));
    const before = JSON.stringify(e.state);
    await e.handlers.get('loadState:click')();
    assert.equal(JSON.stringify(e.state), before);
    assert.equal(e.context.canvas.width, 100);
    assert.equal(e.element('loadState').disabled, false);
    assert.match(e.messages.at(-1), /復元できません/);
  });
}
test('old storage key and newly saved states both restore', async () => {
  const e = environment();
  e.storage.set('note_editor_state', JSON.stringify(saved()));
  await e.handlers.get('loadState:click')();
  e.handlers.get('saveState:click')();
  await e.handlers.get('loadState:click')();
  assert.equal(e.state.layers[0]._img.complete, true);
});
for (const input of ['', '0', '-1', '1.5', 'Infinity', 'NaN', '8001']) {
  test(`invalid pixel resize ${JSON.stringify(input)} preserves image and history`, () => {
    const e = environment(); e.element('resizeWidth').value = input; e.element('resizeHeight').value = '20';
    const before = JSON.stringify(e.state);
    assert.equal(e.context.executeResize(), false);
    assert.equal(JSON.stringify(e.state), before);
    assert.equal(e.context.canvas.width, 100);
  });
}
test('percent resize rounded to zero is rejected for canvas and selected layer', () => {
  const e = environment(); e.options.mode = 'percent'; e.element('resizePercent').value = '1';
  e.state.baseWidth = 10; e.state.baseHeight = 10;
  assert.equal(e.context.executeResize(), false);
  const before = JSON.stringify(e.state);
  e.options.target = 'layer';
  vm.runInContext(extract("document.getElementById('doResizeBtn').addEventListener", "document.getElementById('applyCropOnly').addEventListener"), e.context);
  e.handlers.get('doResizeBtn:click')();
  assert.equal(JSON.stringify(e.state), before);
});
test('normal resize scales base image, layers and crop together', () => {
  const e = environment(); e.element('resizeWidth').value = '200'; e.element('resizeHeight').value = '160';
  assert.equal(e.context.executeResize(), true);
  assert.equal(e.state.baseWidth, 200); assert.equal(e.state.baseImage.width, 200);
  assert.equal(e.context.canvas.width, 200);
  assert.equal(e.state.layers[0].w, 20); assert.equal(e.state.layers[0].x, 4);
  assert.equal(e.state.cropRect.w, 100);
});
for (const stage of ['failRead', 'failWrite']) {
  test(`canvas failure at ${stage} leaves resize state unchanged`, () => {
    const e = environment(); e.element('resizeWidth').value = '200'; e.element('resizeHeight').value = '160';
    e.options[stage] = true; const before = JSON.stringify(e.state);
    assert.equal(e.context.executeResize(), false);
    assert.equal(JSON.stringify(e.state), before);
    assert.equal(e.context.canvas.width, 100); assert.equal(e.context.canvas.height, 80);
  });
}
test('combined crop and resize is atomic on invalid dimensions and render failure', () => {
  const e = environment(); e.state.selectedLayerId = null;
  vm.runInContext(extract("document.getElementById('applyBoth').addEventListener", '// 選択中の図形レイヤー'), e.context);
  const before = JSON.stringify(e.state);
  e.element('resizeWidth').value = '-1'; e.element('resizeHeight').value = '20';
  e.handlers.get('applyBoth:click')(); assert.equal(JSON.stringify(e.state), before);
  e.element('resizeWidth').value = '20'; e.options.failRead = true;
  e.handlers.get('applyBoth:click')(); assert.equal(JSON.stringify(e.state), before);
  e.options.failRead = false; e.handlers.get('applyBoth:click')();
  assert.equal(e.state.baseWidth, 20); assert.equal(e.state.layers.length, 0);
  assert.equal(e.state.cropRect, null);
});
test('combined percent resize uses cropped dimensions', () => {
  const e = environment(); e.options.mode = 'percent'; e.element('resizePercent').value = '50';
  assert.equal(e.context.executeResize(e.state.cropRect), true);
  assert.equal(e.state.baseWidth, 25); assert.equal(e.state.baseHeight, 20);
});

for (const file of ['studio/sw.js', 'image_editor/service-worker.js']) {
  test(`${file}: deletes only its own old named caches and scopes cache reads`, async () => {
    const events = {}, deleted = [], reads = [];
    let name, prefix, claimed = false;
    const context = vm.createContext({URL, console: {log() {}},
      self: {location: {origin: 'https://example.test'}, addEventListener: (n,cb) => events[n] = cb,
        clients: {claim: async () => {claimed = true;}}},
      caches: {keys: async () => [name, prefix+'old', 'prompt-builder-test', 'pdf2img-test', '2026-06-26-03', 'unrelated'],
        delete: async key => {deleted.push(key);},
        match: async (request, opts) => {reads.push(opts); return {from: opts.cacheName};}},
    });
    vm.runInContext(read(file), context);
    name = vm.runInContext('CACHE_NAME', context); prefix = vm.runInContext('CACHE_PREFIX', context);
    const waits = [];
    events.activate({waitUntil: p => waits.push(p)}); await Promise.all(waits);
    assert.deepEqual(deleted, [prefix+'old']); assert.equal(claimed, true);
    let response;
    events.fetch({request: {method: 'GET', url: 'https://example.test/index.html'}, respondWith: p => response = p});
    assert.equal((await response).from, name);
    assert.equal(reads[0].cacheName, name);
    let intercepted = false;
    events.fetch({request: {method: 'POST', url: 'https://example.test/index.html'}, respondWith() {intercepted = true;}});
    assert.equal(intercepted, false);
  });
}

