# CCID — Cyber Crime Intelligence & Detection

**Tagline:** Tracing truth · Protecting India

CCID is a full investigation dashboard for cybercrime cells. Officers sign in, open FIRs, upload evidence, run forensic parsers, enrich IOCs, use OSINT and live threat feeds, classify complaints with ML, check image authenticity, and export PDF reports.

This README lists **what is actually in the repository** (frontend, FastAPI backend, ML, Supabase schema). It is not a marketing summary.

---

## Product identity

- Full name: **Cyber Crime Intelligence & Detection** (also referred to as Cyber Crime Investigation Dashboard in the UI).
- Brand mark: `frontend/public/ccid-logo.png` (India-flag “C”, fingerprint, Ashoka Chakra). Used on login, register, sidebar, and as the favicon.
- Login page: dark command-center layout — “YOU CAN LIE. BUT YOUR DIGITAL FOOTPRINT WON’T.”, INDIA watermark, radar rings, cyan **Access Command Center**. Email + password only (no biometric / smart-card).
- Language: English and Hindi (`i18next`). Toggle in the sidebar.
- Roles: `admin`, `investigator`, `viewer` (Supabase Auth + `users` profile).

---

## How you run it

| Piece | URL |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| Backend (FastAPI) | http://127.0.0.1:8000 |
| API docs | http://127.0.0.1:8000/docs |

**Prerequisites:** Node.js 18+, Python 3.11+, Wireshark/`tshark` for PCAP, a Supabase project.

**Database:** run `supabase/migrations/` `001` → `020` in order (or `supabase/combined_migrations.sql`). Create storage bucket `forensic_uploads`.

**Backend** (`backend/`):

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On Windows, skip `--reload` if the server restarts in a loop.

**Frontend** (`frontend/`):

```bash
npm install
copy .env.example .env.local
npm run dev
```

`frontend/.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL=http://localhost:8000/api/v1`.

**Docker (optional):** `docker compose up --build` — nginx on 443. Put `nginx/server.crt` and `nginx/server.key` locally; they are gitignored.

Do not commit `.env`, App Passwords, or TLS private keys.

---

## Screens and modules (what you built)

### 1. Login & register

- **Login (`/login`)** — Officer email, password, “Remember this device” (saves email in `localStorage`), forgot-password message (admin reset, not a full flow). Footer: encrypted connection / system secure. Real Supabase `signInWithPassword`.
- **Register (`/register`)** — Name, email, password, role. Same CCID logo.

### 2. Command Center dashboard (`/dashboard`)

Live numbers from the API (not fake tiles for funds/arrests):

- Total cases, active/open, **closed** (status `Closed`), evidence count, critical findings, correlations, attack chains.
- **Case volume** — 6-month stacked Open vs Closed bars.
- **Priority donut** — low / medium / high / critical from real FIRs.
- **Recent cases** list with status and priority badges.
- **Quick actions** — new case, upload evidence, generate report.
- **India emergency helpline marquee** — 112, 1091, 1098, 14567, **1930 cybercrime**, railway/traffic numbers; click to copy.
- **Delhi-NCR heatmap** — hotspot dots from `/dashboard/hotspots` (case counts by city).
- **Top syndicate graph** — `/dashboard/top-syndicate`.
- **Cyber news ticker** — `/dashboard/forensic-news` (optional `GNEWS_API_KEY`).
- Hindi/English copy for dashboard labels.

### 3. Cases / FIRs (`/cases`, `/cases/new`, `/cases/:id`)

**Create case fields:** title, description, priority (low–critical), category (cybercrime, data breach, malware, ransomware, phishing, insider threat, fraud, DDoS, espionage, other), jurisdiction, incident date, tags, **FIR number**, **police station**, **NCRP complaint ID**, **complainant name**, **sections of law**, optional funds-frozen amount.

**Case statuses:** open, active, pending review, **closed**, archived. Closing a case (edit status or **Close this case**) is what the dashboard closed-count uses.

**Case tabs:**

| Tab | What it does |
|---|---|
| Overview | FIR metadata, description, tags, close case |
| Evidence | Artefacts linked to the case |
| Suspects | Name, identifiers, status (`under_investigation`, `arrested`, `absconding`, `discharged`), funds linked |
| Findings | Investigator findings tied to the case |
| Correlations | Run IOC correlation engine; attack-chain graph |
| Risk | Risk assessment for the case |
| Reports | Generate / download investigation reports |

### 4. Evidence (`/evidence`, `/evidence/:id`)

**Upload types:** digital file, network capture (PCAP), memory dump, disk image, log file, document, screenshot, email export, other.

**On upload:** SHA-256 in the browser, file to Supabase Storage, chain-of-custody notes, signed download URL, hash verify.

**Analysis views (by file type):**

| Artefact | Parser / view |
|---|---|
| `.pcap` / `.pcapng` | Wireshark/tshark — conversations, DNS, suspicious indicators |
| Memory dump | Volatility-style process / dump summary |
| Chrome/Edge History (SQLite) | Visits, searches, downloads |
| `SYSTEM.hive` / `.lnk` | USB connection history |
| `.evtx` | Windows logons, PowerShell, security events |
| CSV as document | Call detail records (CDR) |
| CSV as other | Financial / bank-style rows; crypto trace helper |
| Images | EXIF / image forensics |

### 5. Findings (`/findings`)

Create, edit, list, and detail findings (severity, description, linked case/evidence). Used in reports and correlation.

### 6. Complaint intelligence (`/complaint-ai`)

ML pipeline for NCRP-style complaint text (English + Hindi training data):

- Paste text or drop a complaint file.
- **Category** among: Financial Fraud, UPI Fraud, Phishing, Job/Employment Scam, Investment Scam, Social Media Scam, Account Takeover, Identity Theft, Online Shopping Scam, Sextortion, Cyberbullying/Harassment, Other.
- Confidence scores, **priority** (high/medium/low), extracted entities, identifier hits, NCRP-style draft fields.
- Officer **feedback** (agree / correct category) stored for later retraining.
- Similar-case lookup APIs exist on the backend for a case id.

Code: `backend/ml/complaint_classifier/`, `backend/ml/priority_model/`, `backend/ml/entities/`, `backend/app/services/complaint_intelligence.py`.

### 7. Image authenticity (`/image-auth`)

- Drop one photo (or compare two). Formats: jpg, png, webp, bmp.
- Legacy GAN / fake-face model plus extra flags (officer must still review).
- UI labels: look closer / not sure / cannot say / old GAN test found nothing.
- Backend: `backend/ml/image_auth/`, `backend/app/api/v1/endpoints/image_auth.py`. Train models before use or the API returns 503.

This is **assistive**, not legal proof of a fake or genuine photo.

### 8. OSINT (`/osint`)

- Search box → backend `/osint/search`.
- Tool modals: **CVE / NVD**, **domain reputation**, **IP geolocation**, **Nmap-style ports**, **WHOIS**, **Shodan** (needs `SHODAN_API_KEY`), **SOCMINT**.
- **View PDF** of an OSINT report in-page (inline, not a forced download).
- Optional AlienVault OTX key for enrichment.

### 9. Live threat intelligence (`/threat-intelligence`)

Feeds:

- **AlienVault OTX** — pulses / IOCs (`ALIENVAULT_OTX_KEY`).
- **ThreatFox** — malware IOCs (`THREATFOX_AUTH_KEY`).
- **URLhaus** — malicious URLs (`URLHAUS_AUTH_KEY`).

Investigate page (`/threat-intelligence/investigate`) for a single IOC: enrich, correlated hits, timeline.

### 10. Risk (`/risk`)

Create / view / update a risk assessment per case. Auto-update endpoint can refresh scores from findings.

### 11. Reports (`/reports`, wizard)

Investigation PDF via ReportLab. Wizard sections: executive summary, evidence list, findings, timeline, risk. Download and delete. Section 65B-style evidence certificate endpoint exists on the API. PPT helper service is in the backend (`python-pptx`).

### 12. Cyber Copilot (floating chat)

Always available inside the authenticated layout.

- Answers about cyber incidents, forensics, and using CCID.
- Calls `POST /api/v1/ai/chat`. Default **AI_MODE=disabled** until you configure Ollama/local or approved cloud.
- Draft vs officer-approved; high-risk actions need explicit approval (`approve-draft`).
- Also: OSINT summary and case narrative endpoints.
- Audit rows in `ai_audit_log`.

### 13. Contact & support

Sidebar → Contact. Form: name, email, subject, message. Rate-limited. Saved to `backend/data/contact_submissions.jsonl` and optionally Supabase `contact_submissions`. Email via SMTP (Gmail App Password) to `NOTIFY_EMAIL`.

### 14. Layout chrome

- **Sidebar** — nav groups Overview / Investigation / Analysis / Output; collapse; **chevron stays visible** so you can open it again; hamburger in the top bar when collapsed.
- **Top bar** — breadcrumbs, online indicator.
- Investigation graph component for correlation visuals.

---

## Backend API surface (`/api/v1`)

| Area | Purpose |
|---|---|
| `/health` | API health |
| `/forensics/tools` | Status of Volatility, Wireshark, Autopsy, FTK, mobile, SIEM adapters |
| Auth | Current user, list users |
| Cases | CRUD + case stats |
| Evidence | Upload, custody, verify hash, signed URL |
| Findings | CRUD |
| Suspects | CRUD per case |
| Reports | Create, download, 65B |
| Risk | Get/create/update/auto-update |
| Network / memory / browser / USB / event-log / CDR / financial / image-forensics | `analyze` + results |
| Correlations | List, graph, **run engine** |
| Enrichment | IOC enrich |
| Dashboard | stats, hotspots, alerts, news, syndicate |
| OSINT | search, CVE, domain, IP geo, nmap, whois, shodan, socmint, PDF report |
| Threat intel | ThreatFox, URLhaus, OTX, IOC enrich, correlated, timeline |
| Intelligence | complaint analyze, file, feedback, similar cases, ML stats |
| Image auth | analyze, compare |
| AI | chat, OSINT summary, case narrative, approve draft |
| Contact | POST ticket, GET list |
| Audit | log list |

---

## Machine learning (on disk)

| Path | Role |
|---|---|
| `backend/ml/complaint_classifier/` | Train/predict crime category |
| `backend/ml/priority_model/` | Priority label |
| `backend/ml/entities/` | Regex/entity extract (UPI, phones, emails, etc.) |
| `backend/ml/data/` | Synthetic + train CSVs, Hindi-capable generator |
| `backend/ml/image_auth/` | Face/GAN authenticity train/predict |
| `backend/ml/image_auth_ai/` | Alternate AI-vs-real trainer (optional Hugging Face download) |
| `backend/ml/artifacts/` | Saved metrics and `.pt` / sklearn models |

Optional: `sentence-transformers` for embeddings; TF-IDF cosine is the fallback.

---

## Database migrations

| File | Creates / changes |
|---|---|
| 001 | Users / profiles |
| 002 | Cases |
| 003 | Evidence |
| 004 | Findings |
| 005 | Timeline, reports, risk |
| 006 | SHA-1 on evidence |
| 007 | Network analysis |
| 008–009 | Memory analysis + error message |
| 010 | Timeline/findings extensions |
| 011 | Browser analysis |
| 012 | USB analysis |
| 013 | Correlations + attack chains |
| 014 | Event log analysis |
| 015 | Suspects |
| 016 | Network analysis error message |
| 017 | `ai_audit_log` |
| 018 | FIR / NCRP / police station / sections / funds frozen; suspect arrest status; `officer_audit_log` |
| 019 | Complaint intelligence tables |
| 020 | Contact submissions |

---

## Environment variables (backend)

**Required:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `SECRET_KEY`, `CORS_ORIGINS`.

**Email:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (App Password, not Gmail login), `NOTIFY_EMAIL`.

**Feeds:** `ALIENVAULT_OTX_KEY`, `SHODAN_API_KEY`, `GNEWS_API_KEY`, `THREATFOX_AUTH_KEY`, `URLHAUS_AUTH_KEY`.

**AI:** `AI_MODE` (`disabled` \| `local_only` \| `cloud_approved`), `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_NAME`, `CLOUD_APPROVED_FOR_REAL_DATA`.

Real case text to a cloud model only when both `AI_MODE=cloud_approved` and `CLOUD_APPROVED_FOR_REAL_DATA=true`. Prefer local Ollama for live investigations.

---

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, React Router 6, TanStack Query, Axios, Recharts, React Flow, i18next, Bootstrap 5, Lucide, Framer Motion, date-fns, Three.js (available).
- **Backend:** FastAPI, Uvicorn, Pydantic, Supabase Python, ReportLab, Pillow, pyshark, python-evtx, python-registry, LnkParse3, OpenCV, pandas, scikit-learn, XGBoost, SlowAPI, aiosmtplib, python-pptx, exifread.
- **Auth/storage:** Supabase PostgreSQL + Auth + Storage.

---

## Repo layout

```
backend/app/api/v1/endpoints/   REST routers listed above
backend/app/services/           parsers, OSINT, OTX, ThreatFox, URLhaus, email, AI, ML glue
backend/ml/                     train/predict artefacts
frontend/src/pages/              dashboard, cases, evidence, intel, auth, reports
frontend/src/components/         layout, copilot, contact, dashboard widgets
frontend/public/ccid-logo.png
supabase/migrations/
nginx/nginx.conf
docker-compose.yml
tools/acquire_evidence.ps1       local evidence acquisition helper
```

---

## Typical officer path

1. Register / sign in.
2. **New Case** with FIR and NCRP fields.
3. **Upload evidence** → **Analyze** on the evidence page.
4. Add **suspects** and **findings**.
5. **Run correlation engine** on the case.
6. Use **OSINT**, **Live Threat Intel**, **Complaint intelligence**, **Image authenticity** as needed.
7. Ask **Cyber Copilot** (if AI is enabled).
8. **Generate report** and close the case when done.

Built for DFIR and cybercrime investigation workflows in an Indian police / cyber-cell context.
