# Architecture — Box Vendor Onboarding Platform

A Next.js 16 (App Router, Turbopack) application that exposes **two parallel approaches** to vendor document onboarding, both backed by the same Box API layer.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│                                                                 │
│  ┌──────────────────────┐    ┌───────────────────────────────┐  │
│  │   Wizard (Step-flow) │    │   Copilot Chat (CopilotKit)  │  │
│  │   DocumentWizard.tsx │    │   CopilotPanel.tsx            │  │
│  └──────────┬───────────┘    └──────────────┬────────────────┘  │
│             │                               │                   │
└─────────────┼───────────────────────────────┼───────────────────┘
              │  REST / SSE                   │  /api/copilotkit
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Next.js API Routes                        │
│                                                                 │
│  /api/box-setup       /api/box-action      /api/copilotkit      │
│  /api/fill-intake-pdf /api/box-live        /api/health          │
│  /api/box-upload      /api/box-folder-items                     │
│  /api/sign-status     /api/webhooks/box                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
              ┌───────────┴────────────┐
              │                        │
              ▼                        ▼
   ┌────────────────────┐   ┌────────────────────┐
   │  Box CLI (npx box) │   │  Box REST API      │
   │  collaborations    │   │  Sign API          │
   │  folders:create    │   │  Folders/Items API │
   │  file-requests     │   │  Upload API        │
   └────────────────────┘   └────────────────────┘
```

---

## Approach 1 — Guided Wizard (Structured Step-Flow)

**Entry point:** `src/components/wizard/DocumentWizard.tsx`

The wizard enforces a strict 6-step funnel. Each step has a single responsibility and the operator cannot skip forward without completing the previous step.

### Step Map

| Step | Name | What Happens | Box API Used |
|------|------|-------------|--------------|
| 0 | **Upload** | Drag-and-drop or browse a PDF. Folders auto-created. | `POST /api/box-setup` → Box Upload API (`/2.0/files/content`) |
| 1 | **Fill PDF** | LLM extracts fields from free-form vendor text, `pypdf` fills the form PDF, result uploaded & moved. | `POST /api/fill-intake-pdf` → Box Upload API → Box Move |
| 2 | **In Review** | Confirmation screen; file is now in `02 Review` subfolder. | `GET /api/box-live` (webhook poll) |
| 3 | **Sign** | Operator enters reviewer email; sign request sent via Box Sign. | `POST /api/box-action` action=`signWizard` → Box Sign API |
| 4 | **Signing** | Live poll for signature status. Shows sign/review links. | `GET /api/sign-status` every 2 s |
| 5 | **Done** | Signed document available with download links from `03 Signed`. | `GET /api/box-folder-items?folderId=<id>` |

### Key Wizard Files

```
src/
  components/wizard/
    DocumentWizard.tsx        # Full wizard state machine, step renderer
  app/api/
    box-setup/route.ts        # SSE stream: folder provisioning + file upload
    fill-intake-pdf/          # SSE stream: LLM field extraction + pypdf fill
    box-action/route.ts       # sign, move, fill, collaborate actions
    box-folder-items/route.ts # GET folder contents for Done step
    sign-status/route.ts      # GET/POST sign request status
    box-live/route.ts         # Webhook poll (recent 5 events)
    webhooks/box/route.ts     # Box webhook receiver (HMAC-SHA256 verified)
```

### Folder Flow

```
Upload → 01 Intake ──(fill)──► 02 Review ──(sign)──► 03 Signed
```

All folder IDs are resolved dynamically from the Box API at provision time and stored in `workspaceRegistry.ts` in-memory for the session.

---

## Approach 2 — Copilot Chat (Conversational Agent)

**Entry point:** `src/components/copilot/CopilotPanel.tsx`

The chat panel exposes the same Box operations as **tool calls** on a CopilotKit `BuiltInAgent`. The operator drives onboarding through natural language; the agent decides which tools to call and in what order.

### Agent Tools (registered in CopilotPanel.tsx)

| Tool | Description | Box API Used |
|------|-------------|--------------|
| `createVendorWorkspace` | Create root folder + subfolders | Box Folders CLI (`folders:create`) |
| `createDocumentRequest` | Generate upload link | Box File Requests CLI / API |
| `findMissingDocuments` | Check required doc checklist | In-memory, compares against required docs |
| `addReviewer` | Add collaborator to review folder | Box Collaborations CLI (`collaborations:create`) |
| `listVendorDocuments` | List files in intake/review/signed folder | Box Folders API (`/2.0/folders/<id>/items`) |
| `createReviewTask` | Create a review task on a file | Box Tasks CLI |
| `sendSignatureRequest` | Send Box Sign request | Box Sign API (`/2.0/sign_requests`) |
| `getVendorOnboardingStatus` | Summarise vendor phase + doc status | Seed data + live folder lookup |
| `getVendorActivity` | Recent webhook/activity events | `webhookStore.ts` in-memory log |
| `fillAndMoveIntakePdf` | LLM-fill intake PDF and move to review | `POST /api/fill-intake-pdf` SSE stream |

### Tool-Call Flow

```
User prompt
    │
    ▼
CopilotKit BuiltInAgent (GPT-4.1)
    │  decides tool(s) to call
    ▼
useCopilotAction handler
    │  POST /api/box-action  { action, input }
    ▼
executeBoxAction() router (box-action/route.ts)
    │  dispatches to the right command
    ▼
lib/box/commands/*.ts
    │  runBoxCommand() or direct Box REST call
    ▼
Box API / Box CLI
```

### UI Cards

Each tool result renders a purpose-built React card:

| Card | Triggered By |
|------|-------------|
| `PlanCard` | `createVendorWorkspace` |
| `FileRequestCard` | `createDocumentRequest` |
| `ChecklistCard` | `findMissingDocuments` |
| `ApprovalCard` | `addReviewer` |
| `FolderItemsCard` | `listVendorDocuments` |
| `SignRequestCard` | `sendSignatureRequest` |
| `StatusSummaryCard` | `getVendorOnboardingStatus` |
| `ActivityTimeline` | `getVendorActivity` |
| `FillPdfCard` | `fillAndMoveIntakePdf` |

---

## Shared Box Integration Layer

Both approaches share the same underlying Box abstraction.

### Authentication (`src/lib/box/auth.ts`)

- Reads `BOX_DEVELOPER_TOKEN` from `.env.local`
- If missing/placeholder → falls back to **mock/demo mode** (all commands return seeded data, no real API calls)
- To use live Box: set `BOX_DEVELOPER_TOKEN` to a valid short-lived developer token

---

### Box CLI Usage (`runBoxCommand.ts`)

The Box CLI is invoked via `execFile("npx", ["box", ...args, "--json", "--token", token])`. It is used for **management operations** where the CLI provides idiomatic wrappers:

| Source File | CLI Command | What It Does |
|-------------|------------|--------------|
| `commands/createVendorWorkspace.ts` | `folders:create <parentId> <name>` | Create root folder and subfolders (01 Intake, 02 Review, 03 Signed) |
| `commands/addReviewer.ts` | `folders:collaborations <folderId>` | Preflight check — list existing collaborators to avoid duplicates |
| `commands/addReviewer.ts` | `collaborations:create <folderId> folder --role editor --login <email>` | Add a reviewer as a Box collaborator |
| `commands/listVendorDocuments.ts` | `folders:items <folderId>` | List files in a vendor subfolder |
| `commands/createReviewTask.ts` | `tasks:create <fileId> --message <msg>` | Create a review/approval task on a file |
| `commands/updateDocumentMetadata.ts` | `metadata:set <fileId> --scope <scope> --template-key <key>` | Write vendor metadata onto a file |

All CLI calls are routed through [`runBoxCommand.ts`](src/lib/box/runBoxCommand.ts), which:
- Appends `--json` and `--token <token>` automatically
- Parses the JSON envelope and normalises error responses
- Returns mock data instantly when running in demo mode (no subprocess spawned)

---

### Box REST API Usage (direct `fetch`)

The Box REST API is called directly with `Authorization: Bearer <token>` for operations that require **full API capabilities** (multipart upload, Box Sign, webhook management) or where the CLI has no equivalent:

| Source File | HTTP Call | What It Does |
|-------------|-----------|--------------|
| `api/box-setup/route.ts` | `POST /2.0/folders` | Create root and sub-folders during wizard setup |
| `api/box-setup/route.ts` | `GET /2.0/folders/<id>/items` | Check if subfolders already exist before creating |
| `api/box-setup/route.ts` | `DELETE /2.0/folders/<id>?recursive=true` | Remove a duplicate folder if one already exists |
| `api/box-setup/route.ts` | `POST /2.0/webhooks` | Register a Box webhook on the root folder |
| `api/box-setup/route.ts` | `GET /2.0/webhooks?limit=100` + `DELETE /2.0/webhooks/<id>` | Deregister stale webhooks before re-registering |
| `api/box-setup/route.ts` | `POST /2.0/files/content` (multipart) | Upload the original file to the intake folder |
| `api/fill-intake-pdf/route.ts` | `POST /2.0/files/content` (multipart) | Upload the LLM-filled PDF to intake |
| `api/fill-intake-pdf/route.ts` | `POST /2.0/files/<id>/copy` | Copy the filled PDF into the review folder |
| `api/fill-intake-pdf/route.ts` | `DELETE /2.0/files/<id>` | Delete the intake copy after moving to review |
| `api/box-action/route.ts` | `GET /2.0/files/<id>` | Verify a file exists before signing |
| `api/box-action/route.ts` | `POST /2.0/sign_requests` | Create a Box Sign request (wizard path) |
| `api/box-action/route.ts` | `POST /2.0/sign_requests/<id>/resend` | Resend a sign request notification |
| `commands/sendSignatureRequest.ts` | `GET /2.0/folders/<id>/items` | Resolve the real file ID from the review folder |
| `commands/sendSignatureRequest.ts` | `POST /2.0/sign_requests` | Create a Box Sign request (chat agent path) |
| `api/sign-status/route.ts` | `GET /2.0/sign_requests/<id>` | Poll signature status and retrieve signing URLs |
| `api/box-download/route.ts` | `GET /2.0/files/<id>/content` | Stream a file download through the app |
| `api/box-folder-items/route.ts` | `GET /2.0/folders/<id>/items` | List signed folder contents for the Done step |
| `lib/box/getFolderItems.ts` | `GET /2.0/folders/<id>/items` | Shared helper for folder listing |

---

### Decision Rule: CLI vs REST

| Criterion | Use Box CLI | Use Box REST API |
|-----------|------------|-----------------|
| Operation type | Folder/collaboration/task management | File upload, Box Sign, webhooks, download |
| Data format | JSON via `--json` flag | JSON via `fetch` |
| Error handling | stdout/stderr parse via `runBoxCommand` | HTTP status codes + JSON body |
| Streaming needed | No | Yes (SSE progress, file download) |
| Multipart body needed | No | Yes (file upload) |
| Mock support | ✅ `runBoxCommand` returns mock data | ✅ skipped in mock mode |

### Webhook Integration (`src/app/api/webhooks/box/route.ts`)

- Receives Box webhook events via `POST /api/webhooks/box`
- Verifies HMAC-SHA256 signature with `BOX_WEBHOOK_SIGNATURE_KEY`
- Pushes events into an in-memory store (`webhookStore.ts`) — surfaced in the Live Status panel and `getVendorActivity` tool

### Workspace Registry (`src/lib/box/workspaceRegistry.ts`)

In-memory map of `vendorId → VendorWorkspace` (root + subfolder IDs) built during `createVendorWorkspace` or `box-setup`. Allows both approaches to resolve live folder IDs for a vendor within the same server process lifetime.

---

## Directory Structure

```
src/
  app/
    api/
      box-action/       Central tool dispatch (chat agent calls this)
      box-setup/        Wizard step 0 — provision folders + upload
      box-live/         Webhook event feed for Live Status panel
      box-upload/       Direct file upload endpoint
      box-folder-items/ List files in a folder (Done step)
      sign-status/      Poll / simulate Box Sign status
      copilotkit/       CopilotKit runtime endpoint
      webhooks/box/     Box webhook receiver
      health/           Config health check
  components/
    copilot/            Chat card UI components
    wizard/             DocumentWizard step-flow
    vendor/             Vendor overview / live status panels
    landing/            Use-case selector
    layout/             App shell, header
  lib/
    box/
      auth.ts           Token mode detection
      runBoxCommand.ts  Box CLI wrapper
      normalize.ts      API response normalisation
      workspaceRegistry.ts  In-memory vendor workspace map
      webhookStore.ts   In-memory webhook event log
      commands/         One file per Box operation
    config/env.ts       Environment variable loading
    copilot/
      agent.ts          BuiltInAgent prompt + model config
      state.ts          CopilotKit provider state
    demo/               Seed data and demo prompts
    vendors/
      requiredDocuments.ts  Required doc types
      schema.ts             Zod input schemas for all actions
      status.ts             Status derivation helpers
  types/                Shared TypeScript interfaces
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `BOX_DEVELOPER_TOKEN` | Box short-lived token (60 min expiry, renew at developer.box.com) |
| `OPENAI_API_KEY` | LLM for agent + PDF field extraction |
| `COPILOTKIT_MODEL` | Model string, default `openai:gpt-4.1` |
| `BOX_FILE_REQUEST_TEMPLATE_ID` | Box file request template (optional) |
| `BOX_WEBHOOK_SIGNATURE_KEY` | HMAC key for webhook verification (optional) |
| `BOX_WEBHOOK_URL` | Public URL for Box to deliver webhooks |

Copy `.env.example` → `.env.local` and fill in values before running.

---

## Demo / Mock Mode

If `BOX_DEVELOPER_TOKEN` is missing or a placeholder, the app runs entirely in **mock mode**:
- All `runBoxCommand` calls return seeded JSON immediately
- Seed vendor workspace (Acme Logistics) is pre-loaded with folder IDs and documents
- The wizard upload step is disabled (requires a real token)
- The chat agent still functions and demonstrates the full conversation flow using demo data
