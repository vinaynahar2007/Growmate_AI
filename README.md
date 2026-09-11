# GrowMate AI — AI Shopkeeper Copilot

GrowMate AI is an AI copilot for small Indian businesses. A shopkeeper can manage
**Customer Khata, Customers, Sales, Inventory, Payments, Business insights** and talk to an
**AI assistant** in **English, Hindi or English** — by typing or by voice.

```
"Ramesh ka khata dikhao."
"Pichle 10 din se kaunse regular customers nahi aaye?"
"Kin customers ka ₹1,000 se zyada baki hai?"
"Milk ka stock kitna hai?"
"Aaj kitni sale hui?"
"Rahul ne 500 ka saman udhaar liya."
"Rahul ka naya khata banao, father name Vikash hai."
```

## Tech stack

| Layer    | Stack                                                            |
| -------- | ---------------------------------------------------------------- |
| Frontend | React 19, Vite, JavaScript (JSX), lucide-react, CSS (+Tailwind utilities) |
| Backend  | Python 3.11+, FastAPI, Uvicorn, Pydantic, python-dotenv, OpenAI SDK, Supabase SDK |
| Database | In-memory demo repository (default) → Supabase/PostgreSQL (`supabase/schema.sql`) |

> The backend is **Python/FastAPI only** — no Node/Express server.

## Project structure

```
growmate-ai/
├── src/
│   ├── main.jsx                 # React entry
│   ├── App.jsx                  # Landing ⇄ Dashboard routing
│   ├── index.css                # Dark premium design system
│   ├── lib/api.js               # FastAPI client (+ browser fallback when backend is offline)
│   ├── lib/localDemo.js         # In-browser demo store (no secrets)
│   ├── lib/voiceService.js      # Speech service: backend Whisper STT + TTS w/ browser fallback
│   ├── hooks/useVoice.js        # Voice input + spoken replies (backend-first, browser fallback)
│   └── components/
│       ├── landing/Landing.jsx  # Navbar, Hero, Features, Under the hood, Live demo, How it works
│       └── app/                 # Shell, Dashboard, Customers, Khata, Inventory, Sales, Analytics, Copilot
├── backend/
│   ├── main.py                  # FastAPI app + routes + CORS + speech endpoints
│   ├── config.py                # .env settings (API keys stay server-side)
│   ├── agent.py                 # GROQ/OpenAI tool-calling agent (Responses API) + Demo intent agent
│   ├── speech.py                # Whisper STT + OpenAI TTS service (never crashes)
│   ├── tools.py                 # get_customer_khata, add_transaction, … (7 tools)
│   ├── repository.py            # Repository interface, InMemoryRepository (demo data), SupabaseRepository
│   ├── models.py                # Pydantic schemas
│   └── requirements.txt
├── supabase/schema.sql          # shops, customers, products, transactions, transaction_items
├── .env.example
├── index.html
├── package.json
└── README.md
```

## Running the project (Windows PowerShell)

### 1. Frontend (port 5173)

```powershell
cd growmate-ai
npm install
npm run dev
```

Optional: create `.env` in the project root with `VITE_API_URL=http://localhost:8000` (this is the default).

### 2. Backend (port 8000)

Open a **second** PowerShell window:

```powershell
cd growmate-ai\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item ..\.env.example .env      # optional – edit to add OPENAI_API_KEY
uvicorn main:app --reload --port 8000
```

If PowerShell blocks the activation script:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\activate
```

### 3. Test the backend

```powershell
Invoke-RestMethod http://localhost:8000/api/health
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/chat -ContentType "application/json" -Body '{"message":"Ramesh ka khata dikhao"}'
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/chat -ContentType "application/json" -Body '{"message":"Milk ka stock kitna hai?"}'
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/chat -ContentType "application/json" -Body '{"message":"Rahul ne 500 ka saman udhaar liya"}'
```

Then open <http://localhost:5173> and click **Try GrowMate**.

### 4. Production build

```powershell
npm run build
npm run preview
```

> **Security headers.** `vite dev` and `vite preview` send the full security header set from
> `vite.config.ts` — including the `Content-Security-Policy` header with `frame-ancestors 'none'`.
> Headers are the *only* way to deliver `frame-ancestors` / `upgrade-insecure-requests` (browsers
> ignore them in a `<meta>` tag). If you deploy `dist/index.html` behind a different web server,
> mirror the headers from `vite.config.ts`; the in-file `<meta>` CSP in `index.html` still applies
> as a fallback for Google Fonts (`style-src`/`font-src`) and general resource restrictions.

## Demo mode vs OpenAI mode

- **No `OPENAI_API_KEY`** → the backend runs a rule-based **Demo AI mode** that understands the
  example prompts (khata, sales, stock, high-credit, inactive, udhaar, payments, new khata) using the
  *same tools and real shop data*. The UI shows a **"Demo AI mode"** badge.
- **`OPENAI_API_KEY` set** (in `backend/.env`) → the backend switches to the real **OpenAI agent**
  with function calling over the 7 tools. If the OpenAI call fails (bad key, network) the request
  automatically falls back to demo mode and reports the error.

The API key is only ever read in `backend/config.py`. It is never sent to or bundled in the React app.

## API

| Method | Route                                | Description                          |
| ------ | ------------------------------------ | ------------------------------------ |
| GET    | `/api/health`                        | Status, ai_mode, repository          |
| POST   | `/api/chat`                          | `{ message, history[] }` → AI reply  |
| POST   | `/api/audio/transcribe`            | Multipart audio file → `{ text }` (Whisper STT) |
| POST   | `/api/audio/speak`                 | `{ text }` → `audio/mpeg` bytes (TTS) |
| GET    | `/api/customers?search=`             | List / search customers              |
| POST   | `/api/customers`                     | Create customer                      |
| GET    | `/api/customers/{id}`                | Customer details                     |
| PUT    | `/api/customers/{id}`                | Update customer                      |
| GET    | `/api/customers/{id}/khata`          | Outstanding + full history           |
| GET    | `/api/inventory?product=`            | Inventory / single product           |
| GET    | `/api/sales/today`                   | Today's sales summary                |
| GET    | `/api/transactions?limit=&customer_id=` | Recent transactions               |
| POST   | `/api/transactions`                  | Record credit / cash / payment       |
| GET    | `/api/analytics`                     | High credit, inactive, low stock, sales |
| GET    | `/api/dashboard`                     | Dashboard summary                    |

## AI tools

`get_customer_khata`, `create_or_update_customer_khata`, `find_high_credit_customers`,
`find_inactive_customers`, `get_inventory`, `get_today_sales`, `add_transaction`.

Business rules: credit → `outstanding += amount`; payment → `outstanding -= amount`;
sales reduce inventory; quantities are recorded even if no price is given; **prices are never invented**
(catalogue price is used when known, otherwise the entry is stored with `payment_status = amount_missing`).

## Switching to Supabase

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Set `SUPABASE_URL` and `SUPABASE_KEY` in `backend/.env`.
3. Restart the backend — `get_repository()` returns `SupabaseRepository`; tools and agent are unchanged.

## Voice

Two tiers, chosen automatically on every request:

1. **Backend speech service** — when `OPENAI_API_KEY` is set, the Copilot records through
   `MediaRecorder` and sends the clip to `POST /api/audio/transcribe` (OpenAI Whisper,
   `gpt-4o-mini-transcribe`) for accurate **Hindi / Hinglish** understanding, and replies are
   spoken with neural TTS (`gpt-4o-mini-tts`, configurable voice via `OPENAI_TTS_VOICE`).
   (The chat agent itself runs on GROQ — `GROQ_API_KEY` — via its OpenAI-compatible
   Responses API; speech intentionally stays on OpenAI.)
2. **Browser fallback** — when the key is missing or the backend is unreachable, the app falls
   back to the browser **Web Speech API** (`hi-IN` recognition) and **SpeechSynthesis**, so the
   demo keeps working offline. Best supported in Chrome / Edge.

The Copilot input shows which tier is live ("AI voice" vs "browser mode"). The speech service is
mounted in `src/lib/voiceService.js`; the AI never sees raw audio or leaks it to other services.
