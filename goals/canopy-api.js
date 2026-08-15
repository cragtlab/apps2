/*
 * Canopy local API proof.
 *
 * This server is intentionally dependency-free and memory-only. It is a
 * development contract for the workflow, not a production clinical system:
 * there is no authentication, encryption-at-rest, persistence, audit-grade
 * identity, regulatory approval, sequencing, treatment prediction or
 * manufacturing capability here. Never put a real patient's data into it.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 64 * 1024;
const STAGES = ['Intake', 'Sample', 'Analysis', 'Clinical review', 'Manufacturing', 'Treatment', 'Monitoring'];
const PROOF_LABELS = [
  'Named Singapore veterinary oncology champion',
  'Written genomics / pathology partner scope',
  'Manufacturing and quality feasibility quote',
  'Regulator-informed pilot brief',
  'Committed runway for the next evidence milestone'
];
const TARGET_SEEDS = [
  { id: 'target-sginnovate', name: 'SGInnovate', kind: 'Investor / ecosystem', status: 'Route verified', priority: 'P1', deskScore: 8, ask: 'Request a biotech/deep-tech investor or translational partner introduction.', nextAction: 'Prepare the one-page technical wedge, scientific-lead profile and pilot brief for a fit conversation.', dueMonth: 1, fit: 'Strong early deep-tech and biotech ecosystem fit; useful for investor validation and translational introductions.', routeEvidence: 'Official materials describe investment in deep-tech startups and list BioTech among investment-focus domains.', evidenceUrl: 'https://www.sginnovate.com/startup-growth-funding', fitBoundary: 'Current ticket, canine/animal-health appetite, access and investment decision are unconfirmed.', evidenceRequired: ['Singapore entity/IP plan', 'Scientific cofounder or advisor', 'Pilot brief', 'Partner-route map'], url: 'https://www.sginnovate.com/contact-us' },
  { id: 'target-startup-sg', name: 'Startup SG Equity', kind: 'Co-investment route', status: 'Eligibility review', priority: 'P1', deskScore: 7, ask: 'Confirm appointed-manager and qualified third-party investor fit.', nextAction: 'Test whether Canopy can meet the Singapore-based deep-tech and research-IP definition before relying on this route.', dueMonth: 2, fit: 'Potential co-investment route if Canopy is Singapore-based, owns research-driven IP and has an independent qualified investor.', routeEvidence: 'EnterpriseSG says SSGE supports Singapore-based deep-tech startups with differentiated research-based IP and works through appointed fund managers.', evidenceUrl: 'https://www.startupsg.gov.sg/programmes/4895/startup-sg-equity', fitBoundary: 'This is not a direct grant or open application promise; eligibility, investor qualification and route selection are unconfirmed.', evidenceRequired: ['Singapore incorporation plan', 'IP ownership/assignment chain', 'Qualified third-party investor', 'Deep-tech technical differentiation'], url: 'https://www.startupsg.gov.sg/programmes/4895/startup-sg-equity' },
  { id: 'target-clavystbio', name: 'ClavystBio / 65LAB', kind: 'Life-science investor / builder', status: 'Route verified', priority: 'P1', deskScore: 8, ask: 'Request a scientific and venture-building conversation.', nextAction: 'Ask whether Canopy fits a life-science company-creation or venture-building pathway after the scientific and clinical wedge is defined.', dueMonth: 2, fit: 'High life-science translation fit; potentially relevant if Canopy has a credible scientific asset and company-building plan.', routeEvidence: 'ClavystBio describes itself as a life-sciences investor and venture builder; 65LAB supports translation of research into new biotech companies from Singapore.', evidenceUrl: 'https://www.clavystbio.com/partnerships', fitBoundary: 'A workflow company without proprietary therapeutic science may not fit; current intake, stage and investment decision are unconfirmed.', evidenceRequired: ['Scientific cofounder', 'Defensible IP thesis', 'Clinical champion path', 'Partner feasibility scopes'], url: 'https://www.clavystbio.com/contact' },
  { id: 'target-edbi', name: 'EDBI', kind: 'Strategic health / biotech investor', status: 'Route verified', priority: 'P2', deskScore: 6, ask: 'Ask whether the regional platform fits its health and bio-economy mandate.', nextAction: 'Defer a formal investor ask until clinical, manufacturing and regional expansion evidence exists; request mandate feedback only.', dueMonth: 3, fit: 'Strategic health/biotech relevance and Singapore capability-building angle, but likely a later diligence route.', routeEvidence: 'EDBI describes focus clusters including Healthcare, Emerging Technology and strategic growth, and positions itself as an active global venture investor.', evidenceUrl: 'https://edbi.com/about/', fitBoundary: 'Stage, ticket, canine-health appetite and willingness to back a pre-proof workflow are unconfirmed.', evidenceRequired: ['Clinical letter', 'Manufacturing feasibility', 'Regional market evidence', 'Unit-economics draft'], url: 'https://www.edbi.com/contact-edbi/' },
  { id: 'target-nsgbio', name: 'NSG Bio / NSG Bio Tomorrow', kind: 'Lab / biotech support', status: 'Route verified', priority: 'P1', deskScore: 7, ask: 'Ask about the next programme and a lab-visit or residency fit.', nextAction: 'Confirm whether a software-led, partner-orchestration company can enter without performing wet-lab work.', dueMonth: 1, fit: 'Potential early biotech support route for technical talent, lab context and ecosystem introductions.', routeEvidence: 'Public programme materials identify NSG Bio Tomorrow as an early-stage biotech support route; current programme terms must be confirmed directly.', evidenceUrl: 'https://nsgbio.com/about-nsg-bio-tomorrow/', fitBoundary: 'Programme availability, lab requirements, credits, funding and suitability for veterinary oncology are unconfirmed.', evidenceRequired: ['Founder/scientist profile', 'Lab and biosafety boundary', '12-month budget', 'Specific programme fit'], url: 'https://nsgbio.com/contact/' },
  { id: 'target-ves', name: 'VES Hospital / oncology lead', kind: 'Clinical partner', status: 'Route verified', priority: 'P1', deskScore: 9, ask: 'Request a workflow interview; do not ask for patient enrolment yet.', nextAction: 'Request a 30-minute oncology workflow interview and ask for the first narrow indication, clinical owner and stop criteria.', dueMonth: 1, fit: 'Critical clinical route: Canopy needs a licensed oncology owner before any prospective case or treatment claim.', routeEvidence: 'VES publicly describes specialist veterinary cancer care in Singapore.', evidenceUrl: 'https://www.veshospital.com.sg/services/cancer-care/', fitBoundary: 'No endorsement, enrolment, treatment agreement, outcome-data access or clinical partnership is implied.', evidenceRequired: ['Workflow interview', 'Named clinical lead', 'Indication recommendation', 'Non-binding support letter'], url: 'https://www.veshospital.com.sg/services/cancer-care/' },
  { id: 'target-vertex-hc', name: 'Vertex Ventures HC via Vertex Holdings', kind: 'Healthcare investor route', status: 'Route verified', priority: 'P2', deskScore: 6, ask: 'Seek a warm introduction to the independently managed healthcare fund team.', nextAction: 'Request an introduction only after the clinical wedge and partner feasibility packet are ready; do not use a media inbox as a funding application.', dueMonth: 3, fit: 'Relevant healthcare VC network with early-stage healthcare exposure and Singapore base.', routeEvidence: 'Vertex says its network includes Vertex Ventures HC for early-stage healthcare opportunities, with independently managed funds.', evidenceUrl: 'https://vertexholdings.com/', fitBoundary: 'Fund mandate, current stage/ticket, animal-health appetite and access are unconfirmed.', evidenceRequired: ['Clinical champion', 'Scientific advisor', 'Partner scopes', 'Regional market thesis'], url: 'https://vertexholdings.com/contact/' },
  { id: 'target-novo-asia', name: 'Novo Holdings Asia', kind: 'Life-science investor route', status: 'Route verified', priority: 'P2', deskScore: 6, ask: 'Request a Singapore/Asia life-science fit conversation or warm introduction.', nextAction: 'Approach only with a credible life-science asset, regional pathway and evidence plan; ask which team owns the opportunity.', dueMonth: 4, fit: 'Regional life-science investor with Singapore presence and stated Southeast Asia focus.', routeEvidence: 'Novo Holdings says its Asia team is based in Singapore and invests across life sciences and healthcare in Southeast Asia and other Asian markets.', evidenceUrl: 'https://novoholdings.dk/investment-regions/asia', fitBoundary: 'Current stage, ticket, canine-health appetite and appetite for a workflow-led company are unconfirmed.', evidenceRequired: ['Defensible scientific/IP thesis', 'Clinical and manufacturing route', 'Regional scale plan', 'Early evidence'], url: 'https://novoholdings.dk/investments/principal-investments' }
];
const TARGET_STATUSES = ['Route verified', 'Eligibility review', 'Prepared', 'Contacted', 'Meeting requested', 'Meeting held', 'Partner lead', 'Committed', 'Pass'];
const TECHNOLOGY_SEEDS = [
  { id: 'tech-intake', area: 'Case intake + consent', owner: 'Canopy product', status: 'MVP', proof: 'Structured synthetic intake, explicit consent checkbox and case export.' },
  { id: 'tech-sample-chain', area: 'Sample identity + custody', owner: 'Clinic + genomics partner', status: 'Partner required', proof: 'Barcode, matched samples, receipt and rejection rules.', partnerCandidates: [
    { name: 'AMPL / Translational Pathology Consortium (A*STAR)', role: 'Veterinary pathology and tissue-workflow discussion', url: 'https://www.rsc.a-star.edu.sg/technologyplatforms/scientific-side-menu/scientific-information/national-shared-platform/translational-pathlogy-consortium', evidence: 'The official TPC page lists veterinary pathology and says AMPL is a primary provider of diagnostic pathology services for veterinary clinics and hospitals in Singapore.', boundary: 'Conversation only: sample types, canine tumour fit, custody, turnaround, commercial terms and project acceptance are unconfirmed.' },
    { name: 'iCORE Genomics / Genome Institute of Singapore (A*STAR)', role: 'Sequencing intake and bioinformatics discussion', url: 'https://www.a-star.edu.sg/icore/icore-platforms/core-platforms/icore-genomics---sequencing', evidence: 'The official iCORE page describes end-to-end genomic solutions and whole-exome sequencing.', boundary: 'Conversation only: canine diagnostic use, sample logistics, data geography and qualification are unconfirmed.' }
  ] },
  { id: 'tech-genomics', area: 'Tumour / normal sequencing', owner: 'Qualified genomics lab', status: 'Partner required', proof: 'Written assay, QC, turnaround and data-transfer scope.', partnerCandidates: [
    { name: 'iCORE Genomics / Genome Institute of Singapore (A*STAR)', role: 'Whole-exome sequencing and analytics discussion', url: 'https://www.a-star.edu.sg/icore/icore-platforms/core-platforms/icore-genomics---sequencing', evidence: 'The official page lists WES, WGS, RNA-seq, sequencing and data analysis as part of end-to-end genomic solutions.', boundary: 'Conversation only: canine tumour/normal validation, clinical reporting, capacity, pricing and data-transfer terms are unconfirmed.' },
    { name: 'MEDBANK / NTU LKCMedicine', role: 'Research sequencing backup discussion', url: 'https://medbank.sg/service/', evidence: 'The official service page lists whole-genome, whole-exome, RNA-seq and small RNA-seq services in Singapore.', boundary: 'Research conversation only: veterinary diagnostic status, matched tumour/normal workflow, QA, capacity and commercial terms are unconfirmed.' }
  ] },
  { id: 'tech-ranking', area: 'Canine neoantigen review', owner: 'Scientific partner', status: 'Partner required', proof: 'Versioned model evidence, clinician review and decision record.', partnerCandidates: [
    { name: 'Genome Institute of Singapore (A*STAR)', role: 'Genome-informatics and scientific-method discussion', url: 'https://www.a-star.edu.sg/gis/about-us/welcome-message', evidence: 'The official GIS page describes high-quality sequencing and large-scale genome informatics capabilities.', boundary: 'Conversation only: canine neoantigen model, immunogenicity validation and clinical decision support are not established by this source.' }
  ] },
  { id: 'tech-mrna', area: 'mRNA design hand-off', owner: 'RNA / manufacturing partner', status: 'Partner required', proof: 'Controlled design package and responsibility boundary.', partnerCandidates: [
    { name: 'A*STAR BTI / NATi mRNA BioFoundry', role: 'mRNA-LNP process-development discussion', url: 'https://www.a-star.edu.sg/bti/programmes-in-bti', evidence: 'The official BTI programme page says the mRNA BioFoundry develops cGMP-compatible processes for transition from research to manufacturing; the launched NATi facility is described as non-GMP.', boundary: 'Conversation only: canine oncology design, external access, GMP release and clinical use are unconfirmed.' },
    { name: 'Hilleman Laboratories Singapore', role: 'RNA-platform and manufacturing discussion', url: 'https://hilleman-labs.org/platforms/', evidence: 'The official platform page describes a Singapore R&D/manufacturing hub and an RNA-based platform using circular RNA; its stated focus is vaccines and biologics.', boundary: 'Conversation only: veterinary oncology fit, mRNA versus circRNA scope, external capacity, pricing and release pathway are unconfirmed.' }
  ] },
  { id: 'tech-gmp', area: 'Manufacturing + QC release', owner: 'Qualified manufacturing partner', status: 'Partner required', proof: 'Feasibility quote, release criteria, storage and deviations.', partnerCandidates: [
    { name: 'Hilleman Laboratories Singapore', role: 'Pilot-scale cGMP biologics feasibility discussion', url: 'https://hilleman-labs.org/press-release/hilleman-laboratories-officially-opens-us20-million-facility-in-singapore-to-bolster-resilience-in-vaccine-manufacturing/', evidence: 'The official release describes an operational Singapore ACES cGMP facility and an RNA-platform collaboration with A*STAR.', boundary: 'Conversation only: it is not a confirmed Canopy supplier; canine product classification, batch size, release tests and availability require written review.' },
    { name: 'BioNTech Singapore', role: 'Strategic mRNA manufacturing discussion', url: 'https://www.biontech.com/int/en/home/mediaroom/news/press-releases/2022/11/biontech-expands-global-footprint-acquiring-gmp-manufacturing.html', evidence: 'BioNTech’s official release describes a Singapore GMP mRNA facility intended for regional clinical and commercial manufacturing.', boundary: 'Higher-bar conversation only: external startup access, veterinary fit, capacity, pricing and collaboration terms are not established.' }
  ] },
  { id: 'tech-cold-chain', area: 'Cold-chain logistics', owner: 'Clinic + logistics partner', status: 'Partner required', proof: 'Temperature, label, shipment and receipt records.' },
  { id: 'tech-monitoring', area: 'Veterinary outcome monitoring', owner: 'Licensed veterinary team', status: 'Partner required', proof: 'Safety, imaging, pathology and owner-reported outcome schedule.', partnerCandidates: [
    { name: 'VES Hospital cancer care', role: 'Veterinary oncology workflow discussion', url: 'https://www.veshospital.com.sg/services/cancer-care/', evidence: 'The official VES page describes a Singapore veterinary oncology service and specialist-led cancer care.', boundary: 'Conversation only: no clinical endorsement, enrolment, treatment agreement or outcome-data access is assumed.' }
  ] },
  { id: 'tech-security', area: 'Security, QA + regulatory', owner: 'Counsel + QA lead', status: 'Gap / counsel', proof: 'Role access, audit identity, data map, AVS pathway and ethics plan.' }
];
const TECHNOLOGY_STATUSES = ['MVP', 'Research plan', 'Partner required', 'Quote requested', 'Pilot-ready', 'Validated', 'Gap / counsel', 'Out of year one'];
const MILESTONE_STATUSES = ['Open', 'In progress', 'Met', 'Missed', 'Stopped'];
const ACTION_STATUSES = ['Open', 'In progress', 'Waiting on external', 'Done', 'Blocked', 'Stop'];
const MILESTONE_SEEDS = [
  { id: 'gate-clinical', month: 2, title: 'Clinical champion', owner: 'Founder + veterinary lead', stopIfMissed: true, evidence: 'Signed clinical-partner letter with eligibility and care responsibilities.' },
  { id: 'gate-regulatory', month: 3, title: 'Regulatory / ethics path', owner: 'QA + counsel + AVS', stopIfMissed: true, evidence: 'Written classification/pathway memo and pilot ethics plan.' },
  { id: 'gate-manufacturing', month: 4, title: 'Manufacturing route', owner: 'Scientific lead + qualified partner', stopIfMissed: true, evidence: 'Written feasibility quote, QC/release scope and cold-chain responsibility.' },
  { id: 'gate-funding-cases', month: 6, title: 'Funding + qualified cases', owner: 'Founder / investor lead', stopIfMissed: true, evidence: 'Committed runway plus 10 qualified case leads, not social interest.' },
  { id: 'gate-pilot', month: 9, title: 'Permitted pilot evidence', owner: 'Clinical + regulatory team', stopIfMissed: true, evidence: 'Approved route and first permitted cases with safety/operations records.' },
  { id: 'gate-decision', month: 12, title: 'Scale or stop decision', owner: 'Founders + board', stopIfMissed: true, evidence: 'Unit economics, evidence review and written go / stop decision.' }
];
const ACTION_SEEDS = [
  { id: 'action-indication-brief', dueDays: 3, title: 'Write the narrow indication brief', category: 'Clinical', owner: 'Founder + veterinary lead', gate: 'gate-clinical', requiredOutput: 'One-page indication, eligibility, exclusion, endpoint and stop-rule brief.', instruction: 'Use the pilot brief questions; do not promise treatment or efficacy.' },
  { id: 'action-clinical-interview', dueDays: 7, title: 'Prepare the clinical workflow interview', category: 'Clinical', owner: 'Founder', gate: 'gate-clinical', requiredOutput: '30-minute interview script, named questions and non-binding support-letter template.', instruction: 'Prepare a conversation only; do not enrol a dog or request identifiable records.' },
  { id: 'action-regulatory-log', dueDays: 10, title: 'Build the AVS/counsel question log', category: 'Regulatory', owner: 'Founder + QA/counsel', gate: 'gate-regulatory', requiredOutput: 'Facts, questions, owner, date, response and attachment fields for classification, import, possession, ethics and clinical roles.', instruction: 'A website answer is not clearance; request written direction for the actual facts.' },
  { id: 'action-partner-packets', dueDays: 14, title: 'Prepare genomics and manufacturing packets', category: 'Technology', owner: 'Scientific lead', gate: 'gate-manufacturing', requiredOutput: 'Two partner-ready capability packets with sample/QC, mRNA/QC, cold-chain, data/IP and quote questions.', instruction: 'Prepare packets only; the prototype never sends outreach automatically.' },
  { id: 'action-investor-one-pager', dueDays: 14, title: 'Prepare the investor one-pager', category: 'Capital', owner: 'Founder / investor lead', gate: 'gate-funding-cases', requiredOutput: 'One-page thesis, wedge, team gaps, 12-month gates, planning budget and explicit caveats.', instruction: 'Use public route research as context, not as investor interest or commitment.' },
  { id: 'action-company-ip-check', dueDays: 21, title: 'Close company and IP readiness gaps', category: 'Company / IP', owner: 'Founder + counsel/CSP', gate: 'gate-regulatory', requiredOutput: 'Incorporation decision, founder IP assignments, invention log, data-rights schedule and restricted data-room index.', instruction: 'Do not publicly disclose patentable detail before counsel reviews novelty and confidentiality.' },
  { id: 'action-demo-review', dueDays: 21, title: 'Run a synthetic MVP evidence review', category: 'Product', owner: 'Founder + technical lead', gate: 'gate-regulatory', requiredOutput: 'Five-minute demo, API smoke output, case-free investor snapshot and recorded product gaps.', instruction: 'Synthetic/local data only; this does not prove clinical safety or efficacy.' },
  { id: 'action-sprint-decision', dueDays: 30, title: 'Hold the 30-day evidence review', category: 'Decision', owner: 'Founders', gate: 'gate-clinical', requiredOutput: 'Written review of completed artifacts, external responses, blockers and continue/stop/pivot recommendation.', instruction: 'A missing clinical owner or credible regulatory route remains a stop risk; sunk cost is not progress.' }
];

function id(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toISOString(); }
function text(value, max) { return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max || 240) : ''; }
function event(message) { return { id: id('evt'), text: text(message, 300), when: now() }; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function seedTargets(startedAt) { return TARGET_SEEDS.map(function (target) { return Object.assign({}, target, { dueDate: addMonths(startedAt || now(), target.dueMonth), note: '', updated: now(), history: [] }); }); }
function seedTechnology() { return TECHNOLOGY_SEEDS.map(function (technology) { return Object.assign({}, technology, { note: '', updated: now(), history: [] }); }); }
function addMonths(iso, months) { const date = new Date(iso); date.setMonth(date.getMonth() + months); return date.toISOString(); }
function addDays(iso, days) { const date = new Date(iso); date.setDate(date.getDate() + days); return date.toISOString(); }
function seedMilestones(startedAt) { return MILESTONE_SEEDS.map(function (milestone) { return Object.assign({}, milestone, { dueDate: addMonths(startedAt, milestone.month), status: 'Open', note: '', updated: startedAt, history: [] }); }); }
function seedActions(startedAt) { return ACTION_SEEDS.map(function (action) { return Object.assign({}, action, { dueDate: addDays(startedAt, action.dueDays), status: 'Open', note: '', updated: startedAt, history: [] }); }); }

function decisionState(store, asOf) {
  const evaluatedAt = asOf || now();
  const evaluatedMs = new Date(evaluatedAt).getTime();
  const active = store.milestones.filter(function (item) { return item.status !== 'Met' && item.status !== 'Missed' && item.status !== 'Stopped'; });
  const overdue = active.filter(function (item) { return item.dueDate && new Date(item.dueDate).getTime() < evaluatedMs; });
  const stopped = store.milestones.filter(function (item) { return item.status === 'Missed' || item.status === 'Stopped'; });
  const next = active.slice().sort(function (a, b) { return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); })[0] || null;
  let status = 'ON TRACK / EVIDENCE PENDING';
  if (stopped.length) status = 'STOP / PIVOT';
  else if (overdue.length) status = 'OVERDUE / STOP REVIEW';
  else if (!active.length) status = 'GO / SCALE REVIEW';
  const daysRemaining = next && next.dueDate ? Math.ceil((new Date(next.dueDate).getTime() - evaluatedMs) / 86400000) : null;
  return {
    evaluatedAt,
    status,
    stopReasons: stopped.map(function (item) { return item.title + ' is ' + item.status.toLowerCase() + '.'; }).concat(overdue.map(function (item) { return item.title + ' is overdue.'; })),
    overdue: overdue.map(function (item) { return { id: item.id, title: item.title, dueDate: item.dueDate, month: item.month }; }),
    nextGate: next ? { id: next.id, title: next.title, dueDate: next.dueDate, month: next.month, daysRemaining } : null,
    met: store.milestones.filter(function (item) { return item.status === 'Met'; }).length,
    total: store.milestones.length,
    hardGates: store.milestones.filter(function (item) { return item.stopIfMissed; }).length
  };
}

function investorSnapshot(store) {
  const traceable = store.cases.filter(function (item) { return item.events && item.events.length >= 2; }).length;
  const consented = store.cases.filter(function (item) { return item.consent === true; }).length;
  return {
    schemaVersion: 'canopy-investor-snapshot.v1',
    generatedAt: now(),
    dataBoundary: 'Synthetic/local-development summary. Case-level context, owner data and clinical records are intentionally excluded.',
    productProof: {
      caseRecords: store.cases.length,
      activeCases: store.cases.filter(function (item) { return item.step < STAGES.length - 1; }).length,
      consentedRecords: consented,
      traceableRecords: traceable,
      apiMode: 'memory-only'
    },
    investorReadiness: store.proof.map(function (item) { return { label: item.label, ready: item.ready }; }),
    targets: store.targets.map(function (item) { return { id: item.id, name: item.name, kind: item.kind, status: item.status, priority: item.priority, deskScore: item.deskScore, ask: item.ask, fit: item.fit, routeEvidence: item.routeEvidence, evidenceUrl: item.evidenceUrl, fitBoundary: item.fitBoundary, evidenceRequired: item.evidenceRequired, nextAction: item.nextAction, dueMonth: item.dueMonth, dueDate: item.dueDate, officialRoute: item.url, updated: item.updated, history: (item.history || []).map(function (entry) { return { status: entry.status, when: entry.when }; }) }; }),
    technology: store.technology.map(function (item) { return { id: item.id, area: item.area, owner: item.owner, status: item.status, requiredProof: item.proof, updated: item.updated, partnerCandidates: (item.partnerCandidates || []).map(function (candidate) { return { name: candidate.name, role: candidate.role, officialRoute: candidate.url, evidence: candidate.evidence, boundary: candidate.boundary }; }) }; }),
    milestones: store.milestones.map(function (item) { return { id: item.id, month: item.month, title: item.title, owner: item.owner, dueDate: item.dueDate, status: item.status, stopIfMissed: item.stopIfMissed, evidence: item.evidence, updated: item.updated }; }),
    executionActions: store.actions.map(function (item) { return { id: item.id, dueDays: item.dueDays, title: item.title, category: item.category, owner: item.owner, gate: item.gate, dueDate: item.dueDate, status: item.status, requiredOutput: item.requiredOutput, instruction: item.instruction, updated: item.updated }; }),
    decision: decisionState(store),
    claimBoundary: 'This snapshot does not prove investor interest, regulatory clearance, clinical efficacy, manufacturing qualification or veterinary partnership.',
    nextGate: 'Obtain a clinical-partner letter and regulator-informed pilot brief before enrolling or treating any animal.'
  };
}

function demoCase(caseId, name, breed, cancer, stage, clinic, step, priority, next) {
  return {
    id: caseId, name, breed, cancer, stage, clinic, priority, step, next,
    consent: step > 0,
    created: now(),
    sample: step > 0 ? { tumour: 'Received', blood: 'Received', custody: 'Clinic -> partner lab', received: now() } : { tumour: 'Not collected', blood: 'Not collected', custody: 'Awaiting clinic', received: null },
    candidates: [
      { id: id('neo'), label: 'Candidate A - synthetic demo row', score: 91, selected: step >= 3 },
      { id: id('neo'), label: 'Candidate B - synthetic demo row', score: 84, selected: false },
      { id: id('neo'), label: 'Candidate C - synthetic demo row', score: 76, selected: false }
    ],
    events: [event('Synthetic case record created for API demonstration.')]
  };
}

function seedStore() {
  const startedAt = now();
  return {
    startedAt,
    cases: [
      demoCase('case-miso', 'Miso', 'Singapore Special', 'Mast cell tumour', 'Stage II', 'Demo referral clinic', 3, 'High', 'Clinician review of the design report'),
      demoCase('case-nala', 'Nala', 'Golden Retriever', 'Lymphoma', 'Unconfirmed', 'Demo referral clinic', 1, 'Medium', 'Confirm matched sample receipt'),
      demoCase('case-scout', 'Scout', 'Mixed breed', 'Osteosarcoma', 'Stage III', 'Demo oncology partner', 6, 'Low', 'Record week-4 outcome checkpoint')
    ],
    proof: PROOF_LABELS.map(function (label) { return { label, ready: false }; }),
    targets: seedTargets(startedAt),
    technology: seedTechnology(),
    milestones: seedMilestones(startedAt),
    actions: seedActions(startedAt)
  };
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Canopy-Prototype': 'local-memory-only'
  });
  res.end(payload);
}

function html(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Canopy-Prototype': 'local-memory-only'
  });
  res.end(body);
}

function markdown(res, status, body) {
  return textFile(res, status, body, 'text/markdown; charset=utf-8');
}

function textFile(res, status, body, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType || 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Canopy-Prototype': 'local-memory-only'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    let bytes = 0;
    req.on('data', function (chunk) {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      data += chunk.toString('utf8');
    });
    req.on('end', function () {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (error) { reject(Object.assign(new Error('Request body must be JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function safeCase(store, caseId) { return store.cases.find(function (item) { return item.id === caseId; }); }

function staticPage(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function createCanopyServer() {
  let store = seedStore();

  async function handle(req, res) {
    const requestUrl = new URL(req.url, 'http://' + HOST);
    const pathname = requestUrl.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8787', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      return res.end();
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      return json(res, 200, { ok: true, service: 'canopy-api', mode: 'local-development', storage: 'memory-only', clinicalUse: false, time: now() });
    }

    if (req.method === 'GET' && pathname === '/api/cases') {
      return json(res, 200, { cases: clone(store.cases), count: store.cases.length });
    }

    if (req.method === 'GET' && pathname === '/api/readiness') {
      const ready = store.proof.filter(function (item) { return item.ready; }).length;
      return json(res, 200, { items: clone(store.proof), ready, total: store.proof.length });
    }

    if (req.method === 'GET' && pathname === '/api/targets') {
      return json(res, 200, { targets: clone(store.targets), count: store.targets.length });
    }

    if (req.method === 'GET' && pathname === '/api/technology') {
      return json(res, 200, { technology: clone(store.technology), count: store.technology.length });
    }

    if (req.method === 'GET' && pathname === '/api/investor-snapshot') {
      return json(res, 200, investorSnapshot(store));
    }

    if (req.method === 'GET' && pathname === '/api/milestones') {
      return json(res, 200, { startedAt: store.startedAt, milestones: clone(store.milestones), count: store.milestones.length, decision: decisionState(store) });
    }

    if (req.method === 'GET' && pathname === '/api/actions') {
      return json(res, 200, { startedAt: store.startedAt, actions: clone(store.actions), count: store.actions.length });
    }

    if (req.method === 'GET' && pathname === '/api/decision') {
      return json(res, 200, decisionState(store));
    }

    if (req.method === 'POST' && pathname === '/api/reset') {
      store = seedStore();
      return json(res, 200, { ok: true, startedAt: store.startedAt, cases: clone(store.cases), proof: clone(store.proof), targets: clone(store.targets), technology: clone(store.technology), milestones: clone(store.milestones), actions: clone(store.actions), decision: decisionState(store) });
    }

    if (req.method === 'POST' && pathname === '/api/cases') {
      let body;
      try { body = await readBody(req); } catch (error) { return json(res, error.status || 400, { error: error.message }); }
      const required = ['name', 'breed', 'cancer', 'clinic'];
      const missing = required.filter(function (field) { return !text(body[field], 240); });
      if (missing.length || body.consent !== true) {
        return json(res, 400, { error: 'A synthetic/demo case requires name, breed, cancer, clinic and explicit consent=true.', missing });
      }
      const item = {
        id: id('case'), name: text(body.name, 80), breed: text(body.breed, 100), cancer: text(body.cancer, 160),
        stage: text(body.stage || 'Unconfirmed', 80), clinic: text(body.clinic, 160), priority: ['High', 'Medium', 'Low'].includes(body.priority) ? body.priority : 'Medium',
        context: text(body.context, 1000), step: 0, next: STAGES[0], consent: true, created: now(),
        sample: { tumour: 'Not collected', blood: 'Not collected', custody: 'Awaiting clinic', received: null },
        candidates: [{ id: id('neo'), label: 'Candidate review pending qualified partner analysis', score: null, selected: false }],
        events: [event('Case created through local API with explicit demo consent.')]
      };
      store.cases.unshift(item);
      return json(res, 201, clone(item));
    }

    const caseMatch = pathname.match(/^\/api\/cases\/([^/]+)(?:\/(advance|sample))?$/);
    if (caseMatch) {
      const caseId = decodeURIComponent(caseMatch[1]);
      const action = caseMatch[2];
      const item = safeCase(store, caseId);
      if (!item) return json(res, 404, { error: 'Case not found' });
      if (req.method === 'GET' && !action) return json(res, 200, clone(item));
      if (req.method !== 'POST' || !action) return json(res, 405, { error: 'Method not allowed' });
      if (!item.consent) return json(res, 409, { error: 'Explicit consent is required before workflow actions.' });
      if (action === 'sample') {
        item.sample = { tumour: 'Received', blood: 'Received', custody: 'Clinic -> partner lab', received: now() };
        if (item.step < 1) item.step = 1;
        item.next = STAGES[item.step];
        item.events.push(event('Sample receipt checkpoint recorded through local API.'));
        return json(res, 200, clone(item));
      }
      if (action === 'advance') {
        if (item.step >= STAGES.length - 1) return json(res, 409, { error: 'Case is already in monitoring.' });
        item.step += 1;
        item.next = item.step >= STAGES.length - 1 ? 'Record outcome checkpoint' : STAGES[item.step];
        item.events.push(event('Workflow advanced to ' + STAGES[item.step] + '; production requires evidence attachment and responsible identity.'));
        return json(res, 200, clone(item));
      }
    }

    const proofMatch = pathname.match(/^\/api\/readiness\/(\d+)$/);
    if (proofMatch && req.method === 'PATCH') {
      const index = Number(proofMatch[1]);
      if (!store.proof[index]) return json(res, 404, { error: 'Readiness item not found' });
      let body;
      try { body = await readBody(req); } catch (error) { return json(res, error.status || 400, { error: error.message }); }
      if (typeof body.ready !== 'boolean') return json(res, 400, { error: 'ready must be boolean' });
      store.proof[index].ready = body.ready;
      return json(res, 200, clone(store.proof[index]));
    }

    const targetMatch = pathname.match(/^\/api\/targets\/([^/]+)$/);
    if (targetMatch && req.method === 'PATCH') {
      const target = store.targets.find(function (item) { return item.id === decodeURIComponent(targetMatch[1]); });
      if (!target) return json(res, 404, { error: 'Target not found' });
      let body;
      try { body = await readBody(req); } catch (error) { return json(res, error.status || 400, { error: error.message }); }
      if (!TARGET_STATUSES.includes(body.status)) return json(res, 400, { error: 'Unsupported target status' });
      target.status = body.status;
      target.note = text(body.note, 600);
      target.updated = now();
      target.history.push({ status: target.status, note: target.note, when: target.updated });
      return json(res, 200, clone(target));
    }

    const technologyMatch = pathname.match(/^\/api\/technology\/([^/]+)$/);
    if (technologyMatch && req.method === 'PATCH') {
      const technology = store.technology.find(function (item) { return item.id === decodeURIComponent(technologyMatch[1]); });
      if (!technology) return json(res, 404, { error: 'Technology item not found' });
      let body;
      try { body = await readBody(req); } catch (error) { return json(res, error.status || 400, { error: error.message }); }
      if (!TECHNOLOGY_STATUSES.includes(body.status)) return json(res, 400, { error: 'Unsupported technology status' });
      technology.status = body.status;
      technology.note = text(body.note, 600);
      technology.updated = now();
      technology.history.push({ status: technology.status, note: technology.note, when: technology.updated });
      return json(res, 200, clone(technology));
    }

    const milestoneMatch = pathname.match(/^\/api\/milestones\/([^/]+)$/);
    if (milestoneMatch && req.method === 'PATCH') {
      const milestone = store.milestones.find(function (item) { return item.id === decodeURIComponent(milestoneMatch[1]); });
      if (!milestone) return json(res, 404, { error: 'Milestone not found' });
      let body;
      try { body = await readBody(req); } catch (error) { return json(res, error.status || 400, { error: error.message }); }
      if (!MILESTONE_STATUSES.includes(body.status)) return json(res, 400, { error: 'Unsupported milestone status' });
      milestone.status = body.status;
      milestone.note = text(body.note, 800);
      milestone.updated = now();
      milestone.history.push({ status: milestone.status, note: milestone.note, when: milestone.updated });
      return json(res, 200, clone(milestone));
    }

    const actionMatch = pathname.match(/^\/api\/actions\/([^/]+)$/);
    if (actionMatch && req.method === 'PATCH') {
      const action = store.actions.find(function (item) { return item.id === decodeURIComponent(actionMatch[1]); });
      if (!action) return json(res, 404, { error: 'Action not found' });
      let body;
      try { body = await readBody(req); } catch (error) { return json(res, error.status || 400, { error: error.message }); }
      if (!ACTION_STATUSES.includes(body.status)) return json(res, 400, { error: 'Unsupported action status' });
      action.status = body.status;
      action.note = text(body.note, 800);
      action.updated = now();
      action.history.push({ status: action.status, note: action.note, when: action.updated });
      return json(res, 200, clone(action));
    }

    const pages = { '/': 'gamgee-mvp.htm', '/mvp': 'gamgee-mvp.htm', '/strategy': 'build-gamgee.htm', '/investors': 'gamgee-investor-pack.htm' };
    if (req.method === 'GET' && pages[pathname]) {
      const page = staticPage(pages[pathname]);
      return page ? html(res, 200, page) : json(res, 404, { error: 'Page not found' });
    }

    const documents = {
      '/pilot-brief': { file: 'canopy-pilot-brief.md', type: 'text/markdown; charset=utf-8' },
      '/partner-rfp': { file: 'canopy-partner-rfp.md', type: 'text/markdown; charset=utf-8' },
      '/readiness-pack': { file: 'CANOPY-READINESS.md', type: 'text/markdown; charset=utf-8' },
      '/founder-sprint': { file: 'CANOPY-FOUNDER-SPRINT.md', type: 'text/markdown; charset=utf-8' },
      '/architecture': { file: 'CANOPY-ARCHITECTURE.md', type: 'text/markdown; charset=utf-8' },
      '/api-contract': { file: 'canopy-api.openapi.yml', type: 'application/yaml; charset=utf-8' },
      '/canopy-pilot-brief.md': { file: 'canopy-pilot-brief.md', type: 'text/markdown; charset=utf-8' },
      '/canopy-partner-rfp.md': { file: 'canopy-partner-rfp.md', type: 'text/markdown; charset=utf-8' },
      '/CANOPY-READINESS.md': { file: 'CANOPY-READINESS.md', type: 'text/markdown; charset=utf-8' },
      '/CANOPY-ARCHITECTURE.md': { file: 'CANOPY-ARCHITECTURE.md', type: 'text/markdown; charset=utf-8' },
      '/canopy-api.openapi.yml': { file: 'canopy-api.openapi.yml', type: 'application/yaml; charset=utf-8' }
    };
    if (req.method === 'GET' && documents[pathname]) {
      const document = staticPage(documents[pathname].file);
      return document ? textFile(res, 200, document, documents[pathname].type) : json(res, 404, { error: 'Document not found' });
    }

    return json(res, 404, { error: 'Not found' });
  }

  return http.createServer(function (req, res) {
    handle(req, res).catch(function (error) { json(res, 500, { error: 'Unexpected local API error', detail: error.message }); });
  });
}

function startServer(port) {
  const server = createCanopyServer();
  const listenPort = Number(port || process.env.CANOPY_PORT || DEFAULT_PORT);
  server.listen(listenPort, HOST, function () {
    console.log('Canopy local API: http://' + HOST + ':' + listenPort + '/');
    console.log('Development-only, memory-only, synthetic data only.');
  });
  return server;
}

if (require.main === module) startServer();

module.exports = { createCanopyServer, seedStore, startServer, STAGES };
