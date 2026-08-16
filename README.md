# CCID — Cyber Crime Intelligence & Detection

A digital forensics and cybercrime investigation platform for officers to run cases, analyse evidence, enrich IOCs, and produce reports from one dashboard.

Sign-in is email and password through Supabase. The UI is English/Hindi and uses the CCID brand mark on login, register, and the sidebar.

---

## What it does

### Investigation
- **Cases** — Create and manage FIRs / cases, suspects, and case status (including closing a case).
- **Evidence** — Upload artefacts to Supabase Storage with hash / chain-of-custody fields.
- **Parsers** — Network (PCAP / tshark), Windows event logs (EVTX), browser history, USB (registry / LNK), memory dumps, CDR, financial records, and image EXIF/forensics.
- **Findings & correlation** — Cross-reference IPs, domains, and hashes across evidence; build attack-chain views.
- **Risk & reports** — Risk assessments and downloadable PDF / PPT case reports.

### Intelligence
- **Command Center dashboard** — Live case volume, priority mix, Delhi-NCR heatmap, syndicate graph, and cyber news ticker (optional GNews key).
- **OSINT** — Lookup tools with inline PDF viewing (not forced download).
- **Live threat intel** — AlienVault OTX, ThreatFox, and URLhaus feeds plus investigate view.
- **Complaint intelligence** — Classify and triage complaint text (Hindi + English training data).
- **Image authenticity** — ML assist to flag likely AI-generated vs real photos.
- **Cyber Copilot** — Optional local or cloud LLM with officer-review and audit logging. Default is `AI_MODE=disabled`.

### Operations
- **Contact & Support** — In-app tickets saved locally and optionally emailed (SMTP / Gmail App Password).
- **Auth** — Supabase session; register to request access.

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, TanStack Query, Recharts, React Flow, i18next |
| Backend | FastAPI, Uvicorn, Pydantic, SlowAPI |
| Forensics / ML | pyshark, python-evtx, python-registry, LnkParse3, OpenCV, scikit-learn, XGBoost |
| Data & auth | Supabase (PostgreSQL, Auth, Storage) |
| Optional deploy | Docker Compose + nginx (TLS certs are local-only; not in git) |

---

## Local setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- [Wireshark / tshark](https://www.wireshark.org/) on the host (network analysis)
- A [Supabase](https://supabase.com) project

### 1. Supabase
1. Create a project.
2. In the SQL Editor, run `supabase/migrations/` in order from `001_` through `020_`. You can also run `supabase/combined_migrations.sql` if you prefer one file.
3. Create a Storage bucket named `forensic_uploads` and set RLS / public access to match your policy.

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

Minimum `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
SECRET_KEY=change-me-to-a-long-random-string
CORS_ORIGINS=http://localhost:5173
```

Optional (leave blank if unused):

```env
# Contact form email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-gmail-app-password
NOTIFY_EMAIL=you@gmail.com

# OSINT / news / threat feeds
ALIENVAULT_OTX_KEY=
SHODAN_API_KEY=
GNEWS_API_KEY=
THREATFOX_AUTH_KEY=
URLHAUS_AUTH_KEY=

# Copilot — keep disabled until you choose local or approved cloud
AI_MODE=disabled
AI_PROVIDER=local
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL_NAME=llama3
CLOUD_APPROVED_FOR_REAL_DATA=false
```

Never commit `.env` or TLS private keys.

Start the API (from `backend/`):

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On Windows, avoid `--reload` if the watcher restarts in a loop. Swagger: `http://127.0.0.1:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
copy .env.example .env.local   # Windows
```

`frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

```bash
npm run dev
```

App: `http://localhost:5173`.

### Docker (optional)

```bash
docker compose up --build
```

Place `nginx/server.crt` and `nginx/server.key` locally; they are gitignored.

---

## Usage

1. Register or sign in at `/login`.
2. Open **Cases** → create an FIR → upload **Evidence** → **Analyze**.
3. Use **Correlations** on the case to link IOCs.
4. Check **OSINT**, **Live Threat Intel**, **Complaint intelligence**, and **Image Authenticity** as needed.
5. Generate a **Report** from the case when the investigation is ready.

Close a case from case edit: set status to **Closed** (or use **Close this case** on the case page). Dashboard closed-case counts follow that status.

---

## AI data handling

- Default: `AI_MODE=disabled` — no model calls.
- Sensitive / real case text: prefer a local OpenAI-compatible server (`AI_PROVIDER=local`, e.g. Ollama).
- Cloud on real case data requires `AI_MODE=cloud_approved` and `CLOUD_APPROVED_FOR_REAL_DATA=true`.
- Copilot answers are drafts until an officer reviews them. Requests are written to `ai_audit_log`.

---

## Repository layout

```
backend/app/          FastAPI API, parsers, OSINT, ML, email
backend/ml/           Complaint classifier and image-auth training/predict
frontend/src/         Dashboard, cases, evidence, intel, login
supabase/migrations/  Schema 001–020
nginx/                Reverse proxy config for Docker
```

Built for DFIR and cybercrime investigation workflows.
