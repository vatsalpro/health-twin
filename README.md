# PregTwin — Maternal Digital Twin & Preeclampsia Risk Research Platform

> **Tagline:** Understand the journey. Visualize the change. Support earlier clinical review.

PregTwin is a maternal digital-twin platform focused initially on longitudinal preeclampsia risk research. It creates a longitudinal digital representation of a pregnancy by combining historical maternal factors, uploaded prenatal reports, laboratory measurements, blood-pressure records, and dynamic observations.

---

## 1. Product Identity & Research Scope

- **Primary Initial Outcome:** Risk of clinician-confirmed preeclampsia within a defined 14-day future window.
- **Initial Target Population:** Pregnant patients with gestational age $\ge 20.0$ weeks (minimum onset definition per ACOG / ISSHP clinical criteria).
- **Secondary Future Module:** Gestational diabetes (kept strictly separate with its own diagnostic criteria and model pipeline).
- **Non-Causal Disclaimer:** Research and clinician-support prototype; not an autonomous diagnostic or treatment device.

### Clear Evidence Distinctions Enforced:
1. **Observed Clinical Measurements:** Verified laboratory records and automated sphygmomanometer readings.
2. **Patient-Reported Information:** Ambulatory manual entries flagged as `patient_reported`.
3. **AI-Extracted Information:** Fields identified by PyMuPDF / OCR / LLM with exact source coordinates and confidence metrics.
4. **Human-Reviewed Information:** Clinician-audited fields with `ACCEPTED`, `MODIFIED`, or `REJECTED` review status.
5. **Model Estimates:** Platt-scaled calibrated probabilities with 95% confidence intervals and feature contribution waterfalls.
6. **Hypothetical Scenarios:** Counterfactual what-if simulations explicitly marked as non-causal.
7. **Synthetic Demonstration Records:** All seed subjects (Maya Lin, Sophia Reyes, Clara Novak) are explicitly flagged with `is_synthetic = True`.
8. **Missing / Uncertain Information:** Evaluated with explicit `INSUFFICIENT_DATA` guards (e.g. Clara Novak, GA 16.0w).

---

## 2. Technical Stack

### Backend (`/backend`)
- **Python 3.14+** with **FastAPI**
- **Persistence:** SQLite for zero-config local development, SQLAlchemy 2.0 ORM, easily configurable for PostgreSQL
- **Security:** PBKDF2-HMAC-SHA256 password hashing, JWT Bearer tokens, Role-Based Access Control (`patient`, `clinician`, `admin`), patient ownership enforcement
- **Document Processing:** PyMuPDF 2.0 (`pymupdf`), PDF text & vector coordinate block extraction, Tesseract OCR adapter
- **AI Adapters:** Multimodal OpenAI GPT-4o adapter, local Ollama adapter, and a deterministic clinical ontology rule engine with coordinate mapping
- **Prediction Pipeline:** Strict temporal cutoff indexing (zero data leakage), Platt scaling calibration, and SHAP-like feature contributions

### Frontend (`/frontend`)
- **React 19 + TypeScript + Vite 8**
- **Styling:** Tailwind CSS v4 + Custom Clinical Dark Palette (`--bg-primary: #070B14`, `--accent-cyan: #5BE7E8`, `--accent-blue: #628BFF`, `--accent-amber: #E9B96E`)
- **3D & Shaders:** Three.js with two custom GLSL shaders:
  - **Shader A (Ambient Physiological Field):** Multi-scale noise, procedural interference patterns, organic low-amplitude wave motion
  - **Shader B (Data-Reactive Signal Ring Field):** Pulse speed reacting to blood pressure velocity and gestational age progression
- **Charts:** Recharts time-series for longitudinal BP, MAP, Platelets, and Transaminases
- **Testing:** Pytest (Backend) + Vitest with React Testing Library (Frontend)

---

## 3. Repository Architecture & File Structure

```
D:\pregwomen
├── backend/
│   ├── app/
│   │   ├── api/                     # API Routers
│   │   │   ├── auth.py              # Login, current user
│   │   │   ├── patients.py          # Patient profiles & longitudinal timeline
│   │   │   ├── documents.py         # Upload, OCR, extraction, review
│   │   │   ├── observations.py      # Clinical observations & Recharts trends
│   │   │   ├── twin.py              # Versioned digital-twin snapshots
│   │   │   ├── predictions.py       # Preeclampsia risk engine & evaluation metrics
│   │   │   ├── simulation.py        # Counterfactual what-if simulation lab
│   │   │   ├── clinician.py         # Review queue & patient overview
│   │   │   ├── audit.py             # Audit trail & system diagnostics
│   │   │   └── deps.py              # Auth & RBAC dependencies
│   │   ├── core/
│   │   │   ├── config.py            # Environment configuration & settings
│   │   │   ├── security.py          # PBKDF2 hashing & JWT tokens
│   │   │   └── database.py          # SQLAlchemy engine & SQLite pragmas
│   │   ├── models/
│   │   │   └── entities.py          # SQLAlchemy models (User, Document, TwinState, etc.)
│   │   ├── schemas/
│   │   │   └── models.py            # Pydantic v2 validation models
│   │   ├── services/
│   │   │   ├── document_processor.py # PyMuPDF coordinate & text extraction, OCR
│   │   │   ├── ai_extractor.py      # OpenAI / Ollama / Deterministic parser
│   │   │   ├── twin_service.py      # State snapshot versioning & telemetry
│   │   │   ├── prediction_service.py# Research model, leakage guards, horizon logic
│   │   │   └── audit_service.py     # Auditing events
│   │   ├── seed/
│   │   │   └── seed_data.py         # Generates synthetic patients & real PDFs
│   │   └── main.py                  # FastAPI application entrypoint
│   ├── tests/
│   │   └── test_backend.py          # Pytest suite
│   ├── storage/documents/           # Private secure document storage
│   ├── .env.example                 # Environment template
│   └── .env                         # Active configuration
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts            # Strongly-typed API client
│   │   ├── components/
│   │   │   ├── Layout.tsx           # Refined navigation rail & top bar
│   │   │   └── MaternalTwin3D.tsx   # Three.js 3D Twin with GLSL custom shaders
│   │   ├── context/
│   │   │   └── AuthContext.tsx      # Auth session & active patient management
│   │   ├── views/
│   │   │   ├── LoginView.tsx        # Authentication & one-click demo logins
│   │   │   ├── DashboardView.tsx    # Maternal overview & 3D preview
│   │   │   ├── MaternalTwinView.tsx # Living twin 3D workstation & controls
│   │   │   ├── PregnancyTimelineView.tsx # Chronological event stream
│   │   │   ├── MedicalRecordsView.tsx    # Upload & document library
│   │   │   ├── DocumentDetailView.tsx    # Dual-panel PDF & extraction workspace
│   │   │   ├── ObservationsView.tsx      # Longitudinal Recharts time-series
│   │   │   ├── RiskForecastView.tsx      # 14-day preeclampsia risk & contributions
│   │   │   ├── SimulationLabView.tsx     # What-if scenario simulation
│   │   │   ├── ClinicianReviewQueueView.tsx # Clinician queue & approvals
│   │   │   ├── AuditHistoryView.tsx      # Audit trail
│   │   │   └── SettingsView.tsx          # System diagnostics & provider setup
│   │   ├── tests/
│   │   │   └── frontend.test.tsx    # Vitest suite
│   │   ├── App.tsx                  # React Router routes & guards
│   │   ├── index.css                # Tailwind CSS v4 & custom design tokens
│   │   └── main.tsx                 # React DOM root
│   ├── package.json
│   └── vite.config.ts
├── test_api.py                      # End-to-end integration test script
├── run_backend.bat                  # Backend launcher
├── run_frontend.bat                 # Frontend launcher
├── start_all.ps1                    # One-click launcher for both services
└── README.md
```

---

## 4. Quickstart & Installation

### Step 1: Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt # Or packages: fastapi uvicorn pydantic sqlalchemy pymupdf python-multipart pytest httpx python-jose[cryptography]
python -m app.seed.seed_data
python -m uvicorn app.main:app --port 8000 --reload
```
*The database (`pregtwin.db`) and synthetic demonstration PDFs are generated automatically.*

### Step 2: Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173` with proxy to the backend on `http://127.0.0.1:8000`.*

### Step 3: Or Use the All-in-One Launcher
```powershell
.\start_all.ps1
```

---

## 5. Demonstration Accounts

| Role | Email | Password | Description |
|---|---|---|---|
| **Clinician** | `dr.elena@pregtwin.org` | `Clinician2026!` | Attending Maternal-Fetal Medicine Specialist (access to review queue & audit log) |
| **Patient 1** | `maya.lin@pregtwin.org` | `Patient2026!` | Maya Lin, 31yo, G2P0, GA 31.4w, rising SBP trajectory (122 $\to$ 142 mmHg), 1+ protein |
| **Patient 2** | `sophia.reyes@pregtwin.org` | `Patient2026!` | Sophia Reyes, 36yo, chronic hypertension, prior preeclampsia |
| **Patient 3** | `clara.novak@pregtwin.org` | `Patient2026!` | Clara Novak, 26yo, GA 16.0w (triggers strict $<20.0$w insufficient data guard) |

---

## 6. Verification & Test Execution Results

### 1. Pytest Backend Suite
```bash
cd backend
python -m pytest tests/test_backend.py -v
```
**Result:**
- `test_unauthenticated_request_rejected`: **PASSED**
- `test_patient_cannot_access_other_patient_data`: **PASSED**
- `test_clinician_can_access_patients`: **PASSED**
- `test_insufficient_data_guard_under_20_weeks`: **PASSED**
- `test_leakage_prevention_temporal_cutoff`: **PASSED** (100% pass)

### 2. Vitest Frontend Suite
```bash
cd frontend
npm test
```
**Result:**
- `renders LoginView with branding and demo profile options`: **PASSED**
- `renders MaternalTwin3D without crashing and handles WebGL gracefully`: **PASSED**

### 3. End-to-End Workflow Verification Script
```bash
python test_api.py
```
**Result:**
- Authentication: **PASSED**
- Patient listing (3 synthetic subjects): **PASSED**
- Digital Twin state synchronization: **PASSED** (SBP=142, DBP=92, MAP=108.7, GA=31.4w)
- 14-Day Preeclampsia Risk Engine: **PASSED** (Score=0.594, Category=HIGH)
- Non-Causal Simulation: **PASSED** (Simulated=0.967, Delta=+0.373)
- Research Model Cohort Evaluation: **PASSED** (Status: `not_evaluated`, Truthful Provenance Guard)
- Clara Novak Guard Check: **PASSED** (`INSUFFICIENT_DATA` triggered)

### 4. Frontend Production Build
```bash
cd frontend
npm run build
```
**Result:**
- Vite + TypeScript compiled cleanly into `dist/` with 0 errors.

---

## 7. AI Provider Integration & Configuration

The application includes a provider abstraction:
1. **OpenAI GPT-4o**: Set `OPENAI_API_KEY=sk-...` and `AI_PROVIDER=openai` in `backend/.env`.
2. **Local Ollama**: Set `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`, and `OLLAMA_MODEL=llama3.2-vision`.
3. **Deterministic Clinical Ontology Rule Engine**: Default active fallback whenever external credentials are not supplied. Parses blood pressure, gestational age, UPCR, proteinuria, platelets, AST, ALT, and creatinine with exact page and coordinate mapping.

*The platform never silently claims external AI is running when unconfigured; see the live status in `/settings`.*

---

## 8. Research Model & Dataset Provenance

- **Outcome Definition:** Clinician-confirmed preeclampsia within 14 days per ACOG/ISSHP criteria (new-onset hypertension $\ge 140/90$ after 20 weeks with proteinuria $\ge 1+$ / UPCR $\ge 0.30$ or end-organ dysfunction).
- **Leakage Elimination:** Features are strictly indexed at or before $t_{\text{prediction}}$. Any measurement with timestamp $> t_{\text{prediction}}$ is discarded.
- **Evaluation Status:** Research prototype. Performance on external longitudinal clinical cohorts is `not_evaluated`.
- **Validation Criteria:** External multi-site longitudinal singleton pregnancy cohorts with verified ACOG/ISSHP outcomes and strict patient-level temporal cross-validation. Autonomous clinical deployment requires empirical validation against certified EHR datasets.
