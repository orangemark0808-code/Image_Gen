// Run: node --test tests/image-editor-navigation.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'image_editor', 'index.html'), 'utf8');
const sectionIds = ['sec-trim', 'sec-resize', 'sec-apply', 'sec-text', 'sec-shape', 'sec-save'];

test('settings navigation and category panels share one sidebar', () => {
  const sidebarStart = html.indexOf('<aside class="sidebar" id="sidebar">');
  const sidebarEnd = html.indexOf('</aside>', sidebarStart);
  const sidebar = html.slice(sidebarStart, sidebarEnd);
  assert(sidebar.includes('<nav class="mode-nav"'));
  assert(sidebar.includes('<div id="editModePanel">'));
  assert(sidebar.includes('<div id="layerDock"'));
  for (const id of sectionIds) {
    assert(sidebar.includes(`data-sec="${id}"`));
    assert(sidebar.includes(`id="${id}"`));
  }
});

function extract(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  assert(a !== -1 && b > a, `Missing source markers: ${start}`);
  return html.slice(a, b);
}

function navigation() {
  const elements = new Map();
  const makeElement = id => {
    const classes = new Set(id === 'tab-trim' || id === 'mode-edit' ? ['active'] : []);
    return {
      id, style: {}, hidden: id.startsWith('sec-') && id !== 'sec-trim',
      dataset: id.startsWith('tab-') ? {sec: `sec-${id.slice(4)}`} : {mode: id.slice(5)},
      attributes: {}, handlers: {}, scrollTop: 42,
      classList: {
        contains: name => classes.has(name),
        toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, handler) { this.handlers[name] = handler; },
    };
  };
  const element = id => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const tabs = sectionIds.map(id => element(`tab-${id.slice(4)}`));
  const modes = [element('mode-edit'), element('mode-transparent')];
  element('editAccMenu').querySelectorAll = () => tabs;
  const state = {currentTool: 'crop'};
  const selectedTools = [];
  let closeCount = 0;
  const context = vm.createContext({
    document: {
      getElementById: element,
      querySelectorAll: selector => selector === '.mode-btn' ? modes : [],
    },
    editState: state,
    closeSidebar() { closeCount++; },
    selectTool(tool) { selectedTools.push(tool); state.currentTool = tool; },
  });
  vm.runInContext(extract("let currentMode = 'edit';", "\ndocument.querySelectorAll('.mode-btn').forEach(btn => {"), context);
  vm.runInContext(extract('// === SECTION NAV ===', '</script>'), context);
  return {context, element, tabs, modes, state, selectedTools, get closeCount() {return closeCount;}};
}

test('six category buttons show only the matching settings panel', () => {
  const ui = navigation();
  for (const id of sectionIds) {
    ui.element(`tab-${id.slice(4)}`).handlers.click();
    for (const sectionId of sectionIds) {
      const selected = sectionId === id;
      assert.equal(ui.element(sectionId).hidden, !selected, `${sectionId} visibility`);
      assert.equal(ui.element(`tab-${sectionId.slice(4)}`).attributes['aria-pressed'], String(selected));
    }
    assert.equal(ui.element('editModePanel').scrollTop, 0);
  }
  assert.deepEqual(ui.selectedTools, ['select']);
  assert.equal(ui.closeCount, sectionIds.length);
});

test('switching modes hides editing categories and restores the selected category', () => {
  const ui = navigation();
  ui.element('tab-text').handlers.click();
  vm.runInContext("switchMode('transparent')", ui.context);
  assert.equal(ui.element('editAccMenu').hidden, true);
  assert.equal(ui.element('transparentModePanel').style.display, 'block');
  assert.equal(ui.modes[1].attributes['aria-pressed'], 'true');

  vm.runInContext("switchMode('edit')", ui.context);
  assert.equal(ui.element('editAccMenu').hidden, false);
  assert.equal(ui.element('sec-text').hidden, false);
  assert.equal(ui.element('sec-trim').hidden, true);
  assert.equal(ui.modes[0].attributes['aria-pressed'], 'true');
});
