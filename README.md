# Box Vendor Onboarding Platform

A Next.js 16 application that demonstrates **two complementary ways** to run enterprise vendor onboarding — a structured wizard and a free-form chat agent — both powered by the same Box API layer.

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full technical deep-dive.

---

## What It Does

Enterprises onboard dozens of vendors per year. Each vendor must submit a document package (W-9, Certificate of Insurance, Security Questionnaire, NDA), have it reviewed internally, then execute a signature. This platform automates that entire lifecycle against real Box folders, Box File Requests, and Box Sign — with an AI copilot to handle exceptions and answer status questions in natural language.

---

## Two Approaches to Vendor Onboarding

### Approach 1 — Guided Wizard (Structured Step-Flow)

A 6-step funnel that walks an operator through the exact document lifecycle. Each step calls Box APIs and blocks progress until the current step is complete.

```
Step 0 — Upload       Drop a PDF → auto-provision Box folders (01 Intake / 02 Review / 03 Signed)
Step 1 — Fill PDF     Paste vendor details → LLM extracts fields → pypdf fills the intake form
Step 2 — In Review    Filled PDF moves to the 02 Review folder automatically
Step 3 — Sign         Enter reviewer email → Box Sign request created
Step 4 — Signing      Live status polling → sign / review links shown to operator
Step 5 — Done         Signed document listed with download links from 03 Signed
```

**Box APIs used in the Wizard:**

| Step | Box API |
|------|---------|
| Upload | `POST /2.0/files/content` (multipart upload) |
| Fill + Move | Upload API + `POST /2.0/files/<id>/copy` |
| In Review | Webhook event feed (`webhookStore`) |
| Sign | `POST /2.0/sign_requests` (Box Sign API) |
| Signing | `GET /2.0/sign_requests/<id>` (status poll) |
| Done | `GET /2.0/folders/<id>/items` |

**How to use:**
1. Open `http://localhost:3000`
2. Open the **Wizard** tab
3. Drag a PDF onto the upload zone (requires a live `BOX_DEVELOPER_TOKEN`)
4. Follow the steps — the platform handles all Box operations automatically

---

### Approach 2 — Copilot Chat (Conversational Agent)

A CopilotKit `BuiltInAgent` (GPT-4.1) that exposes the same Box operations as AI tool calls. The operator describes their intent in natural language; the agent decides which tools to call and in what order.

```
"Create a vendor workspace for Acme Logistics"
    ↓ agent calls createVendorWorkspace
    ↓ Box CLI: folders:create (root + 3 subfolders)
    ↓ renders PlanCard in UI

"Create an intake upload link"
    ↓ agent calls createDocumentRequest
    ↓ Box API: POST /2.0/file_requests
    ↓ renders FileRequestCard with shareable URL

"What documents are missing?"
    ↓ agent calls findMissingDocuments
    ↓ compares received docs against required list
    ↓ renders ChecklistCard with gaps highlighted

"Assign ansatapathy@deloitte.com as reviewer"
    ↓ agent calls addReviewer
    ↓ Box CLI: collaborations:create (with duplicate guard)
    ↓ renders ApprovalCard

"Send the NDA for signature"
    ↓ agent calls listVendorDocuments (resolves real file ID)
    ↓ agent calls sendSignatureRequest with verified fileId
    ↓ Box Sign API: POST /2.0/sign_requests
    ↓ renders SignRequestCard with links
```

**Box APIs used in the Chat Agent:**

| Tool | Box API / CLI |
|------|--------------|
| `createVendorWorkspace` | `box folders:create` (CLI) |
| `createDocumentRequest` | `box file-requests:create` + `/2.0/file_requests` |
| `addReviewer` | `box collaborations:create` (CLI) |
| `listVendorDocuments` | `GET /2.0/folders/<id>/items` |
| `createReviewTask` | `box tasks:create` (CLI) |
| `sendSignatureRequest` | `POST /2.0/sign_requests` (Box Sign) |
| `fillAndMoveIntakePdf` | Upload API + pypdf (Python script) |

**Demo prompts to try:**
- `"Create onboarding workspace for Acme Logistics"` — provisions Box folder tree
- `"Create an intake upload link for Acme Logistics"` — returns a shareable Box File Request URL
- `"What documents are still missing for Acme?"` — checklist of received vs required
- `"Assign john.doe@acme.com as reviewer"` — adds Box collaboration
- `"Send the signed NDA for signature"` — full Box Sign flow

---

## Box API Integration Architecture

```
Next.js API Routes
       │
       ├── Box CLI wrapper (runBoxCommand.ts)
       │     └── npx box <command> --json --token <token>
       │         • folders:create / folders:collaborations
       │         • collaborations:create
       │         • file-requests:create
       │         • tasks:create
       │
       └── Direct REST (fetch with Bearer token)
             • POST /2.0/files/content          (upload)
             • POST /2.0/sign_requests          (Box Sign)
             • GET  /2.0/sign_requests/<id>     (status)
             • GET  /2.0/folders/<id>/items     (list files)
             • POST /2.0/files/<id>/copy        (move to review)
```

### Authentication

Box uses short-lived **Developer Tokens** (60-minute expiry) for local development. When the token is absent or a placeholder the app runs in **mock/demo mode** — all commands return seeded data and the UI is fully functional for demonstration purposes.

### Webhook Integration

Box webhooks are received at `POST /api/webhooks/box`. Each event is HMAC-SHA256 verified and pushed into an in-memory event log. The Live Status panel and `getVendorActivity` agent tool both read from this store.

---

## Setup

### Prerequisites

- Node.js 20+
- Python 3 + `pypdf` (`pip install pypdf`) — only needed for the Fill PDF step
- Box developer account at [developer.box.com](https://developer.box.com)
- OpenAI API key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
OPENAI_API_KEY=sk-...
COPILOTKIT_MODEL=openai:gpt-4.1

BOX_AUTH_MODE=developer-token
BOX_DEVELOPER_TOKEN=<your token from developer.box.com>
```

> **Token expiry:** Box developer tokens expire every 60 minutes. Regenerate at developer.box.com → your app → Generate Developer Token → update `.env.local` → restart the server.

### 3. Run

```bash
npm run dev
```

App runs at `http://localhost:3000`.

Health check:
```bash
curl http://localhost:3000/api/health
```

---

## Project Structure

```
src/
  app/api/               Next.js API routes (Box proxy, CopilotKit runtime, webhooks)
  components/
    wizard/              6-step DocumentWizard (Approach 1)
    copilot/             Chat panel + UI cards (Approach 2)
    vendor/              Live status + folder panels
  lib/
    box/                 Box CLI wrapper, auth, workspace registry, webhook store
    copilot/             Agent prompt and model config
    vendors/             Zod schemas, required doc list, status helpers
    config/env.ts        Environment variable loader
  types/                 Shared TypeScript interfaces
```

---

## Mock Mode (No Box Token Required)

Without a `BOX_DEVELOPER_TOKEN` the platform runs in full demo mode:
- All Box CLI calls return seeded JSON instantly
- Acme Logistics demo workspace is pre-loaded with folder IDs and documents
- The chat agent demonstrates the complete conversation flow
- The wizard upload step shows an appropriate message but the rest of the UI is explorable

This makes the app safe to demo without credentials configured.

