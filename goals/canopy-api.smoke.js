const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Loading through a function keeps this smoke test dependency-free and works
// in the workspace even where direct Node script execution is restricted.
const goalDir = fs.existsSync(path.join(__dirname, 'canopy-api.js')) ? __dirname : path.join(process.cwd(), 'goals');
const apiFile = path.join(goalDir, 'canopy-api.js');
const source = fs.readFileSync(apiFile, 'utf8');
const fakeModule = { exports: {} };
new Function('require', 'module', 'exports', '__dirname', '__filename', source)(require, fakeModule, fakeModule.exports, goalDir, apiFile);

const server = fakeModule.exports.createCanopyServer();

function request(base, route, options) {
  return fetch(base + route, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {})).then(async function (response) {
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, body };
  });
}

(async function () {
  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  const base = 'http://127.0.0.1:' + address.port;
  try {
    let result = await request(base, '/api/health');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.storage, 'memory-only');
    assert.strictEqual(result.body.clinicalUse, false);

    result = await request(base, '/');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('Canopy'));

    result = await request(base, '/pilot-brief');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('Decision requested'));

    result = await request(base, '/partner-rfp');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('Packet B'));

    result = await request(base, '/readiness-pack');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('IP chain of title'));

    result = await request(base, '/founder-sprint');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('first-30-day founder sprint'));

    result = await request(base, '/architecture');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('production architecture'));

    result = await request(base, '/api-contract');
    assert.strictEqual(result.status, 200);
    assert(result.body.includes('openapi: 3.1.0'));

    result = await request(base, '/api/cases');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.count, 3);

    result = await request(base, '/api/cases', { method: 'POST', body: JSON.stringify({ name: 'Unsafe', breed: 'Demo', cancer: 'Demo', clinic: 'Demo' }) });
    assert.strictEqual(result.status, 400, 'API must reject missing explicit consent');

    result = await request(base, '/api/cases', { method: 'POST', body: JSON.stringify({ name: 'Taro', breed: 'Demo mix', cancer: 'Demo tumour', stage: 'Unconfirmed', clinic: 'Demo clinic', priority: 'High', consent: true, context: 'Synthetic test record' }) });
    assert.strictEqual(result.status, 201);
    const caseId = result.body.id;

    result = await request(base, '/api/cases/' + caseId + '/sample', { method: 'POST', body: '{}' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.sample.tumour, 'Received');
    assert.strictEqual(result.body.step, 1);

    result = await request(base, '/api/cases/' + caseId + '/advance', { method: 'POST', body: '{}' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.step, 2);

    result = await request(base, '/api/readiness/2', { method: 'PATCH', body: JSON.stringify({ ready: true }) });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.ready, true);

    result = await request(base, '/api/readiness');
    assert.strictEqual(result.body.ready, 1);

    result = await request(base, '/api/targets');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.count, 8);
    const clinicalTarget = result.body.targets.find(function (item) { return item.id === 'target-ves'; });
    assert(clinicalTarget && clinicalTarget.priority === 'P1' && clinicalTarget.deskScore === 9, 'target registry should expose prioritisation and desk-fit fields');
    assert(clinicalTarget.dueDate && clinicalTarget.nextAction && clinicalTarget.evidenceRequired.length >= 3, 'target registry should expose a time-bound next action and evidence requirements');

    result = await request(base, '/api/targets/target-sginnovate', { method: 'PATCH', body: JSON.stringify({ status: 'Prepared', note: 'Synthetic smoke-test status; no outreach sent.' }) });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.status, 'Prepared');
    assert.strictEqual(result.body.history.length, 1);

    result = await request(base, '/api/actions');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.count, 8);
    assert(result.body.actions[0].dueDate && result.body.actions[0].requiredOutput, 'action board should expose a dated evidence output');

    result = await request(base, '/api/actions/action-clinical-interview', { method: 'PATCH', body: JSON.stringify({ status: 'In progress', note: 'Synthetic smoke-test action note.' }) });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.status, 'In progress');
    assert.strictEqual(result.body.history.length, 1);

    result = await request(base, '/api/technology');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.count, 9);
    const genomicsTechnology = result.body.technology.find(function (item) { return item.id === 'tech-genomics'; });
    assert(genomicsTechnology && genomicsTechnology.partnerCandidates.length >= 2, 'technology registry should expose evidence-backed genomics discussion routes');

    result = await request(base, '/api/technology/tech-genomics', { method: 'PATCH', body: JSON.stringify({ status: 'Quote requested', note: 'Synthetic smoke-test status.' }) });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.status, 'Quote requested');
    assert.strictEqual(result.body.history.length, 1);

    result = await request(base, '/api/investor-snapshot');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.schemaVersion, 'canopy-investor-snapshot.v1');
    assert.strictEqual(result.body.targets.length, 8);
    assert.strictEqual(result.body.technology.length, 9);
    assert(result.body.decision && result.body.decision.status === 'ON TRACK / EVIDENCE PENDING', 'snapshot should carry the current year-one decision state');
    assert.strictEqual(result.body.executionActions.length, 8, 'snapshot should carry case-free execution actions');
    assert(!JSON.stringify(result.body).includes('Synthetic smoke-test action note'), 'snapshot should omit free-text action notes');
    const snapshotClinical = result.body.targets.find(function (item) { return item.id === 'target-ves'; });
    assert(snapshotClinical && snapshotClinical.nextAction && snapshotClinical.evidenceRequired.length >= 3, 'snapshot should carry target qualification fields');
    const snapshotGmp = result.body.technology.find(function (item) { return item.id === 'tech-gmp'; });
    assert(snapshotGmp && snapshotGmp.partnerCandidates.some(function (candidate) { return candidate.name === 'Hilleman Laboratories Singapore'; }), 'snapshot should carry manufacturing discussion routes');
    assert.strictEqual(result.body.targets[0].history.length, 1, 'snapshot should carry status history');
    assert(!JSON.stringify(result.body).includes('Synthetic smoke-test status'), 'snapshot should omit free-text target notes');
    assert(!JSON.stringify(result.body).includes('Miso'), 'investor snapshot must not include case-level names');
    assert(!JSON.stringify(result.body).includes('"context"'), 'investor snapshot must not include a case-level context field');

    result = await request(base, '/api/milestones');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.count, 6);
    assert.strictEqual(result.body.milestones[0].status, 'Open');
    assert.strictEqual(result.body.decision.status, 'ON TRACK / EVIDENCE PENDING');
    assert(result.body.decision.nextGate && result.body.decision.nextGate.title === 'Clinical champion', 'decision state should expose the next year-one gate');

    result = await request(base, '/api/milestones/gate-clinical', { method: 'PATCH', body: JSON.stringify({ status: 'Missed', note: 'Synthetic smoke-test miss; this means stop/pivot.' }) });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.status, 'Missed');
    assert.strictEqual(result.body.history.length, 1);

    result = await request(base, '/api/decision');
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.status, 'STOP / PIVOT');
    assert(result.body.stopReasons.some(function (reason) { return reason.includes('Clinical champion'); }), 'decision state should explain a stop reason');

    for (const milestoneId of ['gate-clinical', 'gate-regulatory', 'gate-manufacturing', 'gate-funding-cases', 'gate-pilot', 'gate-decision']) {
      result = await request(base, '/api/milestones/' + milestoneId, { method: 'PATCH', body: JSON.stringify({ status: 'Met' }) });
      assert.strictEqual(result.status, 200);
    }
    result = await request(base, '/api/decision');
    assert.strictEqual(result.body.status, 'GO / SCALE REVIEW');
    assert.strictEqual(result.body.met, 6);

    result = await request(base, '/api/reset', { method: 'POST', body: '{}' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.cases.length, 3);
    assert.strictEqual(result.body.targets.length, 8);
    assert.strictEqual(result.body.technology.length, 9);
    assert.strictEqual(result.body.milestones.length, 6);
    assert.strictEqual(result.body.actions.length, 8);

    console.log('Canopy API smoke test: OK');
  } finally {
    await new Promise(function (resolve) { server.close(resolve); });
  }
}()).catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
