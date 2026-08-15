# Canopy Singapore company, IP and data-room readiness

**Status:** Planning checklist for counsel/CSP review · **Date:** 13 August 2026  
**Purpose:** make the Singapore competitor investable and safe to discuss with partners.  
**Not:** legal, tax, immigration, patent, privacy, veterinary, regulatory or investment advice.

## 1. Recommended legal starting point

Confirm with a Singapore corporate-service provider and counsel whether a Singapore private company limited by shares is appropriate for Canopy. Keep the operating company, founders, investors and partner contracts in a clear chain of title.

Before incorporation, decide:

- proposed name and business activity description;
- founder/shareholder split, vesting, option-pool intention and reserved matters;
- who is the director and whether the local-residency rules are satisfied;
- Singapore registered office and public-access/office-hours arrangement;
- financial year end, share capital and share classes;
- company constitution (model or bespoke, reviewed by counsel);
- company secretary appointment plan;
- whether an auditor is required or an exemption applies;
- whether any founder needs a work pass or EntrePass advice;
- which activities are intentionally excluded from the company until licensed partners and AVS direction exist.

ACRA’s current pages say a local company is a separate legal entity, requires at least one director and shareholder, needs a Singapore registered office, and must appoint a company secretary within the required period. ACRA also states that foreigners must use a corporate service provider and satisfy local-residency/work-pass requirements where applicable. Verify all details at incorporation rather than relying on this checklist.

## 2. Incorporation evidence folder

Store copies in a restricted diligence folder:

```text
00-company/
  01-name-reservation.pdf
  02-bizfile-incorporation.pdf
  03-constitution.pdf
  04-registers-and-cap-table.xlsx
  05-director-secretary-consents.pdf
  06-registered-office-evidence.pdf
  07-financial-year-end-and-accounting-plan.md
  08-corporate-service-provider-engagement.pdf
  09-insurance-plan.md
```

Do not share NRIC, passport, personal bank or home-address material in a normal investor data room. Provide redacted evidence and a controlled diligence path.

## 3. IP chain of title

The company cannot credibly raise against “our IP” if code, models, design work, data rights or inventions still belong to a founder, contractor, university or partner.

Create and sign before substantive partner work:

1. founder IP assignment and confidentiality agreements;
2. employee invention/confidentiality agreements;
3. contractor and consultant IP assignment covering source code, documentation, models, prompts, pipelines and deliverables;
4. partner agreement separating background IP, Canopy foreground IP, jointly developed work and permitted data use;
5. university/research agreement if any academic collaborator contributes science, data, samples or inventions;
6. open-source inventory and licence review;
7. data-rights schedule distinguishing owner data, clinic records, derived features, model improvements and anonymised research outputs;
8. invention-disclosure log before public demos or investor disclosure;
9. trade-secret register for non-public workflow, vendor terms, model/data methods and operational know-how;
10. patent/trade-mark search and counsel decision on filing versus secrecy.

IPOS warns that public disclosure can compromise patent novelty and describes reasonable confidentiality controls for trade secrets, including access limitation, clear records, NDAs and confidentiality clauses. Do not put unpublished patentable detail into an open deck, public repository or unprotected partner email before counsel has reviewed it.

## 4. Personal-data governance

The product may handle owner contact data and information that can be linked to an owner and a dog. Treat it as potentially regulated personal data until Singapore privacy counsel determines the scope.

Minimum pre-production controls:

- appoint a named DPO and publish the correct DPO contact route;
- create a data inventory: owner, clinic, dog, pathology, genomic, imaging, billing and derived data;
- document purpose, legal basis/consent, notice text and withdrawal path for each data class;
- separate care coordination, research, model improvement, marketing and investor-reporting purposes;
- minimise collection and use synthetic records in development;
- define retention/deletion and case-withdrawal behaviour;
- define access/correction and export handling;
- document overseas transfer and vendor safeguards before any sample/data leaves Singapore;
- apply role-based access, MFA, encryption, logging, backup and incident response;
- maintain a vendor/subprocessor register and review access on every contract change;
- create a data-breach assessment and notification playbook;
- ensure the investor snapshot is case-free and cannot be joined back to an owner.

PDPC guidance describes DPO designation, purpose/consent, retention limitation, transfer limitation, access/correction and breach-notification obligations. The exact application to Canopy’s veterinary, genomic and research operations requires a qualified privacy review.

## 5. Partner contract minimums

Every clinical, genomics, manufacturing, logistics and software vendor agreement should identify:

| Topic | Must be explicit |
|---|---|
| Scope | What the partner does and does not do |
| Authority | Licence, accreditation, site and responsible technical/clinical lead |
| Samples | Ownership, custody, acceptance/rejection, destruction/return |
| Data | Purpose, fields, location, access, retention, transfer and breach notice |
| IP | Background, foreground, improvements, model training and publication rights |
| Quality | Records, QC, deviations, change control, audit and release owner |
| Safety | Clinical responsibility, adverse-event escalation and stop authority |
| Regulatory | Assumptions, submissions, importer/record holder and approvals |
| Economics | Setup, per-case, repeats, failed batches, storage, shipping and taxes |
| Exit | Termination, data return/deletion, sample disposition and transition |

An MOU may establish intent; it does not prove capacity, regulatory permission, price or a pilot commitment. Convert critical scopes into contracts before a case is enrolled.

## 6. Investor data-room index

```text
01-company/
02-cap-table-and-financing/
03-ip-and-technical-moat/
04-product-and-mvp/
05-clinical-and-regulatory/
06-partners-and-quotes/
07-data-security-and-privacy/
08-market-and-go-to-market/
09-finance-and-runway/
10-risk-register-and-stop-gates/
```

### Minimum files before broad investor outreach

- one-page thesis and 10-slide deck;
- working MVP and API smoke-test output;
- case-free investor snapshot;
- technology-readiness registry;
- pilot brief and AVS question log;
- clinical-partner discussion note or letter;
- at least one genomics scope/quote;
- at least one manufacturing/QC feasibility scope/quote;
- founder/scientific/clinical team biographies;
- cap-table and IP chain-of-title summary;
- 12-month budget with assumptions and runway;
- risk register with the month 2/3/4/6/9/12 stop gates.
- first-30-day evidence board with the indication brief, clinical interview packet, AVS/counsel question log, partner packets, investor one-pager, IP checklist, synthetic demo review and sprint decision.

The target registry is a discovery aid, not external evidence. Before counting an investor or partner route as progress, attach the actual meeting record, written scope, eligibility response, support letter, quote or funding document. The MVP’s desk-fit score and P1/P2 priority are founder planning judgments, not probabilities.

## 7. Readiness scorecard

| Area | Current workspace evidence | External evidence still required | Gate |
|---|---|---|---|
| Product | Canopy MVP, local API and smoke tests | Clinic usability feedback and production security review | M1 |
| Company | Planning checklist only | Singapore incorporation and officer/office evidence | M1 |
| IP | Architecture and workflow concept | Signed assignments, searches and partner IP terms | M1–3 |
| Data | Case-free snapshot and synthetic mode | DPO, privacy notice, vendor transfer/security controls | M1–3 |
| Clinical | Pilot brief and workflow questions | Licensed clinical champion and signed role boundaries | M2 |
| Regulation | AVS/NACLAR question pack | Written authority/counsel pathway | M3 |
| Genomics | Technical requirement registry | Qualified lab scope, QC, price and turnaround | M4 |
| Manufacturing | High-level RFP | Qualified partner feasibility, QC/release and cold-chain plan | M4 |
| Capital | Investor pack and target pipeline | Meetings, lead investor, term/funding commitment | M6 |

## 8. Stop conditions

Stop the therapeutic build if the company cannot obtain a clinical champion by month 2, a credible regulatory/ethics path by month 3, a qualified manufacturing route by month 4, funding plus qualified case demand by month 6, or permitted reproducible pilot evidence by month 9. The local decision engine surfaces missed and overdue gates as `STOP / PIVOT` or `OVERDUE / STOP REVIEW`; it never silently converts an overdue gate into progress. The software/data product may continue only as a separately validated business with paying customers and lawful data rights.

## 9. Primary references checked 13 August 2026

- [ACRA: choosing a business structure](https://www.acra.gov.sg/register/business/choosing-business-structure/)
- [ACRA: registering via Bizfile](https://www.acra.gov.sg/register/business/registering-different-business-structures/local-company/registering-via-bizfile/)
- [ACRA: directors and key officers](https://www.acra.gov.sg/register/business/registering-different-business-structures/local-company/appointing-company-directors-other-key-officers/)
- [PDPC: data protection obligations](https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act/data-protection-obligations)
- [PDPC: appointing a DPO](https://www.pdpc.gov.sg/overview-of-pdpa/data-protection/business-owner/data-protection-officers)
- [IPOS: trade secrets](https://www.ipos.gov.sg/about-ip/trade-secret/)
- [IPOS: patent registration](https://www.ipos.gov.sg/about-ip/patents/how-to-register-overview/how-to-register/)
- [Canopy pilot brief](canopy-pilot-brief.md)
- [Canopy partner RFP](canopy-partner-rfp.md)
