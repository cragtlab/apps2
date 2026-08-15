# Canopy local proof

Canopy is the Singapore-focused case-orchestration prototype for the Gamgee competitor plan. It demonstrates the software boundary around intake, consent, sample custody, workflow states, review hand-off, outcome records and investor-readiness evidence.

## Run it locally

From the workspace root:

```powershell
node goals/canopy-api.js
```

Open `http://127.0.0.1:8787/` for the MVP, or use `/strategy` and `/investors` for the planning pages.

In the MVP, click **Use API mode** to load cases and investor-readiness state from the local server. **Use offline mode** returns to the browser-local demo. The API mode is still memory-only and development-only.

The Investor proof view also contains an eight-route Singapore investor/partner pipeline. Each route has a desk-research fit score, priority, evidence requirements and a due-date next action. Changing a target status records preparation evidence locally; it does not submit a form, send an email or imply interest.

The same view contains nine technology requirements, from intake and consent through sequencing, canine candidate review, mRNA hand-off, QC/cold chain, monitoring and security/regulatory work. Statuses distinguish MVP evidence from partner-required or counsel-required gaps. Relevant rows now include public, evidence-backed discussion routes for A*STAR iCORE/GIS, AMPL/TPC, A*STAR BTI/NATi, Hilleman Laboratories, BioNTech Singapore and VES; each route is explicitly conversation-only and does not imply access, qualification, availability, interest or approval.

Use **Export investor snapshot** to download a case-free JSON summary for diligence. It includes product counts, target statuses, technology readiness and caveats, but deliberately excludes case names, context and clinical records.

The Investor proof view also exposes the six one-year gates: clinical champion (month 2), regulatory/ethics path (month 3), manufacturing route (month 4), funding plus qualified cases (month 6), permitted pilot evidence (month 9), and scale/stop decision (month 12). Marking a hard gate `Missed` visibly becomes `STOP / PIVOT`.

The API also exposes `/api/decision`. It evaluates open gates against their due dates and returns `ON TRACK / EVIDENCE PENDING`, `OVERDUE / STOP REVIEW`, `STOP / PIVOT` or `GO / SCALE REVIEW`. An overdue gate is a stop-review condition; the service does not silently mark it as met.

The Investor proof view also contains a first-30-day evidence board: indication brief, clinical interview packet, AVS/counsel question log, genomics/manufacturing packets, investor one-pager, company/IP checklist, synthetic demo review and sprint decision. `/api/actions` exposes the same board. Marking an action `Done` records that the local artifact exists; it does not mean an external party responded or approved anything.

The two external-facing gate documents are [canopy-pilot-brief.md](canopy-pilot-brief.md) and [canopy-partner-rfp.md](canopy-partner-rfp.md). When the API is running they are also available at `/pilot-brief` and `/partner-rfp`.

The company/IP/data-room checklist is [CANOPY-READINESS.md](CANOPY-READINESS.md), also served at `/readiness-pack` by the local API.

The executable first-month plan is [CANOPY-FOUNDER-SPRINT.md](CANOPY-FOUNDER-SPRINT.md), also served at `/founder-sprint`. It is mirrored by `/api/actions` and the MVP’s local action board.

The technical handoff is [CANOPY-ARCHITECTURE.md](CANOPY-ARCHITECTURE.md), with the [OpenAPI contract](canopy-api.openapi.yml). The API serves these at `/architecture` and `/api-contract`.

## Test the API

```powershell
node goals/canopy-api.smoke.js
```

The smoke test uses synthetic data and checks health, static serving, consent rejection, case creation, sample receipt, workflow advancement, readiness evidence and reset.

## Deliberate boundaries

This local server is memory-only and binds to `127.0.0.1`. It has no authentication, production authorization, encryption-at-rest, durable audit identity, clinical prediction, sequencing, manufacturing, veterinary care or regulatory approval. Never enter a real owner, dog or clinical record.

The production path requires qualified Singapore legal, veterinary, scientific, privacy/security and regulatory partners before identifiable data or animal work is introduced.
