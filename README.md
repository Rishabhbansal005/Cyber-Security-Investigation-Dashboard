# 🔍 Cyber Crime Investigation Dashboard (CCID)

A modern, enterprise-grade digital forensics and cybercrime investigation platform designed for investigators to efficiently manage cases, analyze digital evidence, and generate comprehensive intelligence reports.

## 🌟 Project Overview

The Cyber Crime Investigation Dashboard (CCID) streamlines the Digital Forensics and Incident Response (DFIR) workflow. It bridges the gap between raw forensic artifacts and actionable intelligence by providing automated parsers, a multi-source correlation engine, and a unified timeline to reconstruct cyberattacks.

### Core Capabilities

* **Evidence Management**: Secure uploading of forensic artifacts (PCAP, EVTX, SQLite, LNK, memory dumps) directly to cloud storage with built-in chain of custody tracking.
* **Automated Forensic Analysis**: 
  * **Network Forensics**: Parses `.pcap` files using Wireshark/tshark to extract conversations, DNS queries, and suspicious indicators.
  * **Event Log Forensics**: Parses Windows `.evtx` files to extract logon events, PowerShell execution, and security anomalies.
  * **Browser Forensics**: Parses Chrome/Edge `History` (SQLite) to extract search terms, downloads, and malicious URLs.
  * **USB Forensics**: Parses `SYSTEM.hive` and `.lnk` files to reconstruct physical drive connection histories.
* **Correlation Engine**: Automatically cross-references Indicators of Compromise (IOCs) such as IPs, Domains, and Hashes across multiple evidence sources to build Attack Chains and automatically generate high-confidence findings.
* **Investigation Intelligence**: Visualizes complex attacks using interactive graph networks and chronological timelines.
* **Automated Reporting**: Generates downloadable, executive-ready PDF reports containing case summaries, risk assessments, and chain-of-custody logs.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, React Router v6, Vanilla CSS |
| **Backend** | FastAPI (Python 3.11), Uvicorn, Pydantic |
| **Forensic Parsers** | `pyshark` (Network), `Evtx` (Event Logs), `python-registry` (USB) |
| **Database & Auth** | Supabase (PostgreSQL + Authentication + Storage) |

---

## 🚀 Getting Started

Follow these steps to run the CCID platform locally.

### Prerequisites
* Node.js 18+
* Python 3.11+
* Wireshark / `tshark` installed on your host machine (required for network analysis)
* A [Supabase](https://supabase.com) account and project

### 1. Supabase Setup
1. Create a new Supabase project.
2. In the Supabase SQL Editor, run all the migration files found in the `supabase/migrations/` directory in numerical order (from `001_` to `014_`).
3. Create a Storage Bucket named `forensic_uploads` and ensure it is set to "Public" (or configure your RLS policies accordingly).

### 2. Backend Setup
The FastAPI backend handles all forensic parsing and heavy data processing.

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
```

**Configure `backend/.env`:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SECRET_KEY=your-jwt-secret
CORS_ORIGINS=http://localhost:5173
```

**Run the backend:**
```bash
uvicorn app.main:app --reload --port 8000
```
> *API documentation (Swagger UI) is automatically available at `http://localhost:8000/docs`.*

### 3. Frontend Setup
The Vite + React frontend provides the interactive investigator dashboard.

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

**Configure `frontend/.env.local`:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

**Run the frontend:**
```bash
npm run dev
```
> *The dashboard will be available at `http://localhost:5173`.*

---

## 📖 Quick Usage Guide

1. **Create a Case**: Log into the dashboard and click `+ New Case`. Fill out the investigation details.
2. **Upload Evidence**: Navigate to the case, go to the **Evidence** tab, and upload a raw artifact (e.g., `sample_logon.evtx` or `network_capture.pcap`).
3. **Analyze**: Click the **Analyze** button next to your uploaded evidence. The FastAPI backend will parse the file in the background and extract timelines and findings.
4. **Run Correlation Engine**: Go to the **Correlations** tab and click `▶ Run Engine`. The system will map overlapping IOCs across all your analyzed evidence to build an Attack Chain graph.
5. **Generate Report**: Once the investigation is complete, go to the **Reports** tab and generate an end-to-end PDF report of the case.

---

*Designed and built for Digital Forensics and Incident Response (DFIR) professionals.*

---

## 🔒 AI Integration — Data Handling Notes & Compliance

The CCID Platform features an integrated **Cyber Copilot** and **AI Threat Intelligence Summarizer** built with strict law-enforcement compliance, chain of custody, and data privacy guardrails:

* **Default-Disabled Posture (`AI_MODE=disabled`)**: Out of the box, AI capabilities are disabled (`AI_MODE=disabled`) to prevent unauthorized data transmission until explicitly configured by system administrators.
* **Local/Self-Hosted Recommendation for Sensitive Data**: For real, active law-enforcement case evidence (`real_case_data`), a self-hosted local LLM endpoint (such as an internal **Ollama** server running `AI_PROVIDER=local`) is the recommended deployment path to maintain absolute data sovereignty.
* **Strict Cloud Gating**: Transmission of real case data (`real_case_data`) over cloud AI providers requires explicit written authorization from the department, set via `AI_MODE=cloud_approved` AND `CLOUD_APPROVED_FOR_REAL_DATA=true`. All cloud transmissions trigger high-priority warning logs.
* **Human-in-the-Loop Officer Verification**: All AI outputs carry a persistent `ai_draft` status (`"AI-Generated Draft — Not Verified. Requires officer review."`). AI outputs cannot be attached to official case files or included in court PDF exports until an authenticated officer explicitly reviews and approves the content (`officer_approved`).
* **Immutable Audit Trail**: All AI requests, classifications, provider selections, and officer review actions are recorded in an append-only database audit log (`ai_audit_log`) for chain-of-custody compliance.
