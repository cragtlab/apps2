const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('goals/gamgee-mvp.htm', 'utf8');
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptEnd = html.lastIndexOf('</script>');
assert(scriptStart > '<script>'.length - 1 && scriptEnd > scriptStart, 'app script must exist');

class MockElement {
  constructor(id) {
    this.id = id;
    this.innerHTML = '';
    this.dataset = {};
    this.listeners = {};
    this.classList = { toggle: () => {}, remove: () => {}, add: () => {} };
  }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  click() { return this.listeners.click ? this.listeners.click({ preventDefault() {} }) : undefined; }
}

const ids = ['toast', 'seed-btn', 'export-btn', 'view-dashboard', 'view-new-case', 'view-cases', 'view-investors', 'view-detail'];
const elements = new Map(ids.map((id) => [id, new MockElement(id)]));
const navButtons = ['dashboard', 'new-case', 'cases', 'investors'].map((view) => {
  const button = new MockElement('nav-' + view);
  button.dataset.view = view;
  return button;
});

global.localStorage = {
  value: null,
  getItem() { return this.value; },
  setItem(key, value) { this.value = value; }
};
global.window = {
  crypto: { randomUUID: () => 'smoke-test-uuid' },
  confirm: () => true,
  scrollTo: () => {}
};
global.crypto = window.crypto;
global.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new MockElement(id));
    return elements.get(id);
  },
  querySelectorAll(selector) {
    return selector === '.nav button' ? navButtons : [];
  },
  createElement() { return new MockElement('download'); }
};
global.URL = { createObjectURL: () => 'blob:smoke', revokeObjectURL: () => {} };
global.Blob = class Blob { constructor(parts, options) { this.parts = parts; this.options = options; } };
const apiCase = { id: 'api-case', name: 'API Miso', breed: 'Demo mix', cancer: 'Demo tumour', stage: 'Unconfirmed', clinic: 'API clinic', priority: 'Medium', step: 1, next: 'Sample', consent: true, sample: { tumour: 'Received', blood: 'Received', custody: 'Clinic -> partner lab', received: new Date().toISOString() }, candidates: [], events: [{ id: 'api-event', text: 'Synthetic API case', when: new Date().toISOString() }] };
function apiResponse(body, status) { return { ok: (status || 200) < 400, status: status || 200, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) }; }
global.fetch = async function (route) {
  if (route === '/api/health') return apiResponse({ ok: true, storage: 'memory-only', clinicalUse: false });
  if (route === '/api/cases') return apiResponse({ cases: [apiCase], count: 1 });
  if (route === '/api/readiness') return apiResponse({ items: [{ ready: true }, { ready: false }], ready: 1, total: 2 });
  if (route === '/api/targets') return apiResponse({ targets: [{ id: 'target-sginnovate', name: 'SGInnovate', kind: 'Investor', status: 'Route verified', ask: 'Synthetic target', url: 'https://example.com' }], count: 1 });
  if (route === '/api/technology') return apiResponse({ technology: [{ id: 'tech-intake', area: 'Case intake + consent', owner: 'Canopy', status: 'MVP', proof: 'Synthetic MVP' }], count: 1 });
  if (route === '/api/milestones') return apiResponse({ startedAt: new Date().toISOString(), milestones: [{ id: 'gate-clinical', month: 2, title: 'Clinical champion', owner: 'Synthetic', status: 'Open', evidence: 'Synthetic' }], count: 1, decision: { status: 'ON TRACK / EVIDENCE PENDING', stopReasons: [], overdue: [], nextGate: { title: 'Clinical champion', daysRemaining: 60 }, met: 0, total: 1, hardGates: 1 } });
  if (route === '/api/decision') return apiResponse({ status: 'ON TRACK / EVIDENCE PENDING', stopReasons: [], overdue: [], nextGate: { title: 'Clinical champion', daysRemaining: 60 }, met: 0, total: 1, hardGates: 1 });
  if (route === '/api/actions') return apiResponse({ actions: [{ id: 'action-indication-brief', title: 'Write the narrow indication brief', category: 'Clinical', owner: 'Synthetic', gate: 'gate-clinical', status: 'Open', requiredOutput: 'Synthetic', dueDate: new Date().toISOString() }], count: 1 });
  if (route === '/api/investor-snapshot') return apiResponse({ schemaVersion: 'canopy-investor-snapshot.v1', productProof: {}, targets: [], technology: [] });
  throw new Error('Unexpected route: ' + route);
};

const appScript = html.slice(scriptStart, scriptEnd);
new Function(appScript)();

const stored = JSON.parse(localStorage.value);
assert.strictEqual(stored.cases.length, 3, 'demo workspace should seed three cases');
assert.strictEqual(stored.proof.length, 5, 'investor proof checklist should have five gates');
assert.strictEqual(stored.milestones.length, 6, 'demo workspace should seed six year-one gates');
assert.strictEqual(stored.actions.length, 8, 'demo workspace should seed the first-30-day evidence board');
assert(stored.milestones[0].dueDate, 'year-one gates should have absolute due dates');
assert(elements.get('view-dashboard').innerHTML.includes('Miso'), 'dashboard should render a demo case');
assert(elements.get('view-new-case').innerHTML.includes('new-case-form'), 'new-case view should render the intake form');
assert(elements.get('view-investors').innerHTML.includes('Startup SG Equity'), 'investor view should render the Singapore route');
assert(elements.get('view-investors').innerHTML.includes('Log update'), 'investor view should render target interaction logging');
assert(elements.get('view-investors').innerHTML.includes('First 30-day evidence sprint'), 'investor view should render the founder evidence board');
assert(elements.get('view-investors').innerHTML.includes('A*STAR BTI / NATi mRNA BioFoundry'), 'investor view should render evidence-backed technology discussion routes');
assert(elements.get('view-investors').innerHTML.includes('Official source'), 'technology routes should link to official sources');
assert(elements.get('view-detail').innerHTML.includes('Case not found'), 'detail view should be safe when no case is selected');

const legacy = JSON.parse(localStorage.value);
legacy.targets = [{ id: 'target-sginnovate', name: 'SGInnovate', status: 'Prepared', note: 'Keep this synthetic founder note.' }];
legacy.technology = [{ id: 'tech-genomics', area: 'Legacy genomics row', status: 'Quote requested', note: 'Keep technology status.' }];
legacy.actions = [{ id: 'action-indication-brief', title: 'Legacy action', status: 'In progress', note: 'Keep action note.' }];
localStorage.value = JSON.stringify(legacy);
new Function(appScript)();
const migrated = JSON.parse(localStorage.value);
assert.strictEqual(migrated.targets.length, 8, 'offline migration should add newly researched target routes');
assert.strictEqual(migrated.targets.find((item) => item.id === 'target-sginnovate').status, 'Prepared', 'offline migration should preserve target status');
assert.strictEqual(migrated.targets.find((item) => item.id === 'target-sginnovate').note, 'Keep this synthetic founder note.', 'offline migration should preserve target notes');
assert(migrated.targets.find((item) => item.id === 'target-vertex-hc').nextAction, 'offline migration should add qualification fields to new target routes');
assert.strictEqual(migrated.technology.find((item) => item.id === 'tech-genomics').status, 'Quote requested', 'offline migration should preserve technology status');
assert.strictEqual(migrated.actions.length, 8, 'offline migration should add the first-30-day action board');
assert.strictEqual(migrated.actions.find((item) => item.id === 'action-indication-brief').status, 'In progress', 'offline migration should preserve action status');

(async function () {
  navButtons.find((button) => button.dataset.view === 'new-case').click();
  assert.strictEqual(JSON.parse(localStorage.value).currentView, 'new-case', 'navigation should persist the active view');
  assert(elements.get('view-new-case').innerHTML.includes('Create case record'), 'new-case navigation should render the submit action');
  navButtons.find((button) => button.dataset.view === 'dashboard').click();
  assert.strictEqual(JSON.parse(localStorage.value).currentView, 'dashboard', 'navigation should return to the overview');
  await elements.get('snapshot-btn').click();

  await elements.get('mode-toggle-btn').click();
  const apiState = JSON.parse(localStorage.value);
  assert.strictEqual(apiState.source, 'api', 'API mode should become authoritative after a successful health check');
  assert.strictEqual(apiState.cases[0].id, 'api-case', 'API mode should load server cases');
  assert.strictEqual(apiState.proof[0], true, 'API mode should load server readiness state');
  assert.strictEqual(apiState.targets[0].id, 'target-sginnovate', 'API mode should load investor/partner targets');
  assert.strictEqual(apiState.technology[0].id, 'tech-intake', 'API mode should load technology requirements');
  assert.strictEqual(apiState.milestones[0].id, 'gate-clinical', 'API mode should load year-one gates');
  assert.strictEqual(apiState.actions[0].id, 'action-indication-brief', 'API mode should load founder evidence actions');

  await elements.get('mode-toggle-btn').click();
  assert.strictEqual(JSON.parse(localStorage.value).source, 'offline', 'the user should be able to return to offline mode');
  console.log('Canopy MVP smoke test: OK');
}()).catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
