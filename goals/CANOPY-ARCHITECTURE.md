# Canopy production architecture handoff

**Status:** Technical design for diligence and partner estimates · **Date:** 13 August 2026  
**Current implementation:** standalone HTML + dependency-free Node API, synthetic data, loopback-only.  
**Target:** a Singapore-based, partner-led veterinary oncology workflow that can reach a permitted feasibility pilot or stop within one year.

## 1. Build boundary

Canopy owns the coordination and evidence layer:

```text
clinic / owner
      │ consented referral
      ▼
case + consent service ── sample custody ── partner genomics
      │                         │                  │
      │ clinician review ◄──────┴──── versioned report
      ▼
qualified manufacturing/QC partner ── cold-chain ── licensed vet
      │                                                    │
      └────────────── safety + outcome record ◄────────────┘
```

Canopy does not own the clinical decision, experimental wet-lab method, biologic release or veterinary administration unless a later legal/regulatory structure explicitly permits it.

## 2. Proposed production components

| Boundary | Minimum production capability | Year-one decision |
|---|---|---|
| Web app | Clinician/referral portal, owner-consent flow, case dashboard, partner views | Build narrow workflow; test with synthetic data first |
| API | Typed service, validation, idempotent transitions, role-based authorization | Current Node prototype proves routes; production implementation should be reviewed in TypeScript or equivalent |
| Database | Managed relational database with tenant/clinic boundaries, migrations and backups | Choose after clinic/security requirements; no real data in current local server |
| File store | Encrypted object storage for reports/attachments with malware scan, retention and access log | Separate from transactional records; default-deny URLs |
| Identity | OIDC/SAML-capable identity, MFA, short-lived sessions, clinician role verification | Required before any identifiable record |
| Audit | Append-only event log with actor, time, old/new state, reason and evidence reference | Every consent, sample, review, release and outcome action must be attributable |
| Workflow | Queue/job worker for partner hand-offs, retries and human review | No silent retries for clinical or release decisions |
| Integration | Secure partner transfer/API/SFTP boundary, contract-defined fields and acknowledgements | Start with manual controlled hand-off; automate after partner scope is signed |
| Observability | Error tracking, access alerts, job latency, sample failure and turnaround metrics | No clinical KPI claim until definitions and denominators are agreed |
| Deployment | Singapore-appropriate hosting/data-transfer plan, backups, disaster recovery and vendor register | Counsel/DPO review before selecting geography or subprocessors |

## 3. Core data model

Keep the model narrow and purpose-bound:

- `organisation`: clinic, lab, manufacturer, logistics provider or Canopy;
- `user` and `role`: least privilege, organisation membership, clinician verification;
- `case`: pseudonymous case ID, indication, eligibility state, clinic and consent references;
- `consent`: purpose, version, subject, timestamp, actor, withdrawal and scope;
- `sample`: pseudonymous sample ID, type, collection/receipt state, custody events and rejection reason;
- `analysis_run`: partner, pipeline/version, QC state, report reference and clinician-review state;
- `design_review`: candidates/report reference, reviewer, decision, rationale and timestamp;
- `manufacturing_order`: qualified partner, scope, status, QC/release references and shipment state;
- `clinical_event`: licensed-vet event, safety/outcome measure, source and timestamp;
- `evidence`: document hash/reference, owner, classification, retention and approval state;
- `audit_event`: actor, action, resource, old/new state, reason, time and correlation ID.

Do not store owner names, contact details or raw pathology/genomic files in the current local prototype. Production identifiers must be separated from the case ID and governed by the approved privacy design.

## 4. Security and quality baseline

Before production data:

1. threat model the owner/clinic/partner and admin roles;
2. implement MFA, role-based access and organisation isolation;
3. encrypt transit and storage; manage keys separately from application secrets;
4. validate all inputs and scan uploads; prohibit executable uploads;
5. log privileged access and export events without putting sensitive content in logs;
6. create retention, deletion, withdrawal and backup restoration tests;
7. test cross-border transfer, vendor access and incident notification paths;
8. maintain dependency, patch, vulnerability and secret-rotation processes;
9. version the consent, analysis, design-review and release templates;
10. require qualified clinical/QA sign-off for any workflow transition that could affect an animal or product;
11. keep synthetic-data and production environments separate;
12. run a security/privacy review before a pilot and after material changes.

## 5. Partner-owned technology requirements

Canopy should request evidence, not merely a feature description:

- **Genomics:** accepted sample types, matched tumour/normal scope, QC, report provenance, turnaround, failure/repeat handling and data/sample geography;
- **Scientific analysis:** canine-biology model provenance, validation boundaries, versioning, human-readable review report and clinician sign-off;
- **RNA/manufacturing:** controlled input package, site/quality status, feasibility, batch/release documentation, storage and shipment responsibilities;
- **Veterinary:** licensed clinical owner, eligibility, care, safety escalation and outcomes;
- **Regulatory/quality:** classification, AVS/NACLAR/IACUC route, vendor qualification, records and change control;
- **Logistics:** chain of custody, label, temperature/receipt records and exception handling.

No partner response is accepted as evidence until its scope, owner, assumptions, exclusions, price/capacity and relevant quality/regulatory documents are recorded.

## 6. API contract

The dependency-free prototype exposes the contract in [canopy-api.openapi.yml](canopy-api.openapi.yml). Its current routes are intentionally limited to synthetic/local development and do not provide authentication or production persistence. The `/api/decision` route computes deadline/overdue/stop-review state from the six year-one gates; it is a planning control, not a regulatory or clinical decision.

The contract should be treated as a conversation starter for the technical cofounder and vendors. It must be reviewed before implementation against the chosen identity, database, audit, privacy and regulatory design.

## 7. Engineering acceptance gates

| Gate | Pass evidence |
|---|---|
| Prototype | UI/API smoke tests pass with synthetic data; routes are documented |
| Secure alpha | Auth, roles, audit, encrypted storage and red-team findings have owners |
| Partner alpha | One clinic, one genomics and one manufacturing scope is signed and testable |
| Regulatory alpha | Written classification/pathway assumptions and ethics route are recorded |
| Pilot-ready | Approved/permitted protocol, trained users, vendor QA evidence and rollback/stop process |
| Scale/stop | Real turnaround, failure, safety, workload, outcome and unit-economics data support the decision |

## 8. Do not build yet

- an in-house GMP manufacturing facility;
- autonomous treatment or dosing recommendations;
- a clinical efficacy dashboard based on synthetic or single-case data;
- a public owner intake form that accepts identifiable records;
- cross-border data transfer without a signed purpose, agreement and safeguards;
- a “production” deployment that shares the local prototype’s memory-only credentials or storage model.
