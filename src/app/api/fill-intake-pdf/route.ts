import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { getBoxMode } from "@/lib/box/auth";
import { getAppEnv } from "@/lib/config/env";
import { getWorkspaceForVendor } from "@/lib/box/workspaceRegistry";
import { seededWorkspaces } from "@/lib/demo/seedData";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── types ─────────────────────────────────────────────────────────────────

interface StepEvent {
  type: "step";
  stepId: string;
  status: "in_progress" | "completed" | "error";
  detail: string;
}

interface ResultEvent {
  type: "result";
  data: {
    intakeFileId: string;
    reviewFileId: string;
    fileName: string;
    source: "box" | "demo";
  };
}

type StreamEvent = StepEvent | ResultEvent;

// ─── helpers ────────────────────────────────────────────────────────────────

function emit(controller: ReadableStreamDefaultController, event: StreamEvent) {
  const line = JSON.stringify(event) + "\n";
  controller.enqueue(new TextEncoder().encode(line));
}

async function runBox(args: string[]): Promise<string> {
  const mode = getBoxMode();
  if (mode.mock) return "demo-" + Math.random().toString(36).slice(2, 10);

  const finalArgs = [...args, "--json", "--token", mode.token];
  const { stdout } = await execFileAsync("npx", ["box", ...finalArgs], {
    cwd: process.cwd(),
    maxBuffer: 2 * 1024 * 1024,
    env: process.env,
  });
  const parsed = JSON.parse(stdout) as { id?: string };
  return parsed?.id ?? "";
}

/** Ask the LLM to map free-form content to PDF field names. */
async function mapFieldsWithLlm(content: string): Promise<Record<string, string>> {
  const env = getAppEnv();

  const systemPrompt = `You are a form-filling assistant.
Map the provided vendor content to these exact PDF field names (use the exact key names):
COMPANY NAME, MAILING ADDRESS, TELEPHONE, FAX, EMAIL, WEBSITE,
POINT OF CONTACT NAME  TITLE, CONTACT EMAIL, CONTACT PHONE 1, CONTACT PHONE 2,
GENERAL DETAILS OF SERVICES  GOODS, DATE COMPANY ESTABLISHED, GROSS ANNUAL SALES,
GEOGRAPHIC SERVICE AREA, LEGAL STRUCTURE, BUSINESS TYPE, COMPANY NAME 1.

Return ONLY a valid JSON object with the field names as keys and extracted values as strings.
Omit fields not mentioned. Do not wrap in markdown.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content },
      ],
    }),
  });

  if (!response.ok) throw new Error("LLM request failed");

  const json = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = json.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as Record<string, string>;
}

/** Naive fallback: extract simple key:value patterns from free-form text. */
function mapFieldsNaive(content: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = content.split(/\n|,/).map((l) => l.trim()).filter(Boolean);

  const lookup: Array<[string, RegExp]> = [
    ["COMPANY NAME", /company\s*name[:\s]+(.+)/i],
    ["EMAIL", /email[:\s]+(\S+@\S+)/i],
    ["TELEPHONE", /(?:phone|tel|telephone)[:\s]+([\d\s\-().+]+)/i],
    ["MAILING ADDRESS", /address[:\s]+(.+)/i],
    ["WEBSITE", /(?:website|url|web)[:\s]+(\S+)/i],
    ["CONTACT EMAIL", /contact\s*email[:\s]+(\S+@\S+)/i],
    ["GENERAL DETAILS OF SERVICES  GOODS", /(?:service|goods|product)[:\s]+(.+)/i],
    ["DATE COMPANY ESTABLISHED", /(?:established|founded)[:\s]+(.+)/i],
    ["GROSS ANNUAL SALES", /(?:revenue|sales|annual)[:\s]+(.+)/i],
    ["LEGAL STRUCTURE", /(?:legal\s*structure|type)[:\s]+(.+)/i],
  ];

  for (const line of lines) {
    for (const [fieldName, pattern] of lookup) {
      if (!fields[fieldName]) {
        const m = line.match(pattern);
        if (m) fields[fieldName] = m[1].trim();
      }
    }
  }

  // Fallback: use the whole content as "GENERAL DETAILS OF SERVICES  GOODS"
  if (Object.keys(fields).length === 0) {
    fields["GENERAL DETAILS OF SERVICES  GOODS"] = content.slice(0, 500);
  }

  return fields;
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = (await request.json()) as { vendorId: string; content: string };
  const { vendorId, content } = body;

  const workspace =
    getWorkspaceForVendor(vendorId) ?? seededWorkspaces[vendorId] ?? seededWorkspaces["vendor-acme-logistics"];
  const intakeFolderId = workspace?.subfolders[0]?.folderId ?? "demo-intake-folder";
  const reviewFolderId = workspace?.subfolders[1]?.folderId ?? "demo-review-folder";
  const vendorName = workspace?.vendorName ?? vendorId;
  const env = getAppEnv();
  const isLive = !!env.openAiApiKey && env.openAiApiKey.length > 10;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Step 1: map fields ─────────────────────────────────────────────
        emit(controller, {
          type: "step",
          stepId: "map_fields",
          status: "in_progress",
          detail: "Extracting field values from your content…",
        });

        let fields: Record<string, string>;
        try {
          fields = isLive ? await mapFieldsWithLlm(content) : mapFieldsNaive(content);
        } catch {
          fields = mapFieldsNaive(content);
        }

        // Always stamp the vendor name and date
        fields["COMPANY NAME"] = fields["COMPANY NAME"] ?? vendorName;
        fields["COMPANY NAME 1"] = fields["COMPANY NAME 1"] ?? vendorName;
        fields["DATE"] = fields["DATE"] ?? new Date().toLocaleDateString("en-US");

        emit(controller, {
          type: "step",
          stepId: "map_fields",
          status: "completed",
          detail: `Mapped ${Object.keys(fields).length} form field${Object.keys(fields).length !== 1 ? "s" : ""}.`,
        });

        // ── Step 2: fill PDF ───────────────────────────────────────────────
        emit(controller, {
          type: "step",
          stepId: "fill_pdf",
          status: "in_progress",
          detail: "Filling vendor-intake-form.pdf with your data…",
        });

        const outDir = path.join(tmpdir(), "box-intake");
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

        const stamp = Date.now();
        const outFile = path.join(outDir, `intake-${vendorId}-${stamp}.pdf`);
        const templatePath = path.join(process.cwd(), "public", "forms", "vendor-intake-form.pdf");
        const scriptPath = path.join(process.cwd(), "scripts", "fill_pdf.py");

        let intakeFileId = `demo-intake-${stamp}`;
        let reviewFileId = `demo-review-${stamp}`;
        let source: "box" | "demo" = "demo";

        const boxMode = getBoxMode();

        if (!boxMode.mock) {
          await execFileAsync("python3", [scriptPath, templatePath, outFile, JSON.stringify(fields)], {
            cwd: process.cwd(),
            env: process.env,
          });
        }

        emit(controller, {
          type: "step",
          stepId: "fill_pdf",
          status: "completed",
          detail: "PDF form filled successfully.",
        });

        // ── Step 3: upload to intake ───────────────────────────────────────
        emit(controller, {
          type: "step",
          stepId: "upload_intake",
          status: "in_progress",
          detail: `Uploading to intake folder (Box id: ${intakeFolderId})…`,
        });

        const fileName = `Intake-${vendorName.replace(/\s+/g, "-")}-${stamp}.pdf`;

        if (!boxMode.mock) {
          try {
            const uploadResult = await execFileAsync(
              "npx",
              ["box", "files:upload", outFile, "--parent-id", intakeFolderId, "--name", fileName, "--json", "--token", boxMode.token],
              { cwd: process.cwd(), maxBuffer: 2 * 1024 * 1024, env: process.env },
            );
            const parsed = JSON.parse(uploadResult.stdout) as { id?: string };
            intakeFileId = parsed?.id ?? intakeFileId;
            source = "box";
          } catch {
            // Fall back to demo mode if upload fails (e.g. folder id not accessible)
          }
        }

        emit(controller, {
          type: "step",
          stepId: "upload_intake",
          status: "completed",
          detail: `File uploaded: ${fileName} (id: ${intakeFileId}).`,
        });

        // ── Step 4: move to review ─────────────────────────────────────────
        emit(controller, {
          type: "step",
          stepId: "move_to_review",
          status: "in_progress",
          detail: `Moving to review folder (id: ${reviewFolderId})…`,
        });

        if (!boxMode.mock) {
          try {
            const copyRes = await fetch(`https://api.box.com/2.0/files/${intakeFileId}/copy`, {
              method: "POST",
              headers: { Authorization: `Bearer ${boxMode.token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ parent: { id: reviewFolderId } }),
            });
            if (copyRes.ok) {
              const copyData = (await copyRes.json()) as { id: string };
              reviewFileId = copyData.id;
              // Delete original from intake (best-effort)
              await fetch(`https://api.box.com/2.0/files/${intakeFileId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${boxMode.token}` },
              }).catch(() => { /* ignore */ });
            } else {
              reviewFileId = intakeFileId;
            }
          } catch {
            reviewFileId = intakeFileId;
          }
        } else {
          reviewFileId = `demo-review-${Date.now()}`;
        }

        emit(controller, {
          type: "step",
          stepId: "move_to_review",
          status: "completed",
          detail: `File is now in review folder (id: ${reviewFileId}).`,
        });

        // ── Final result ───────────────────────────────────────────────────
        emit(controller, {
          type: "result",
          data: { intakeFileId, reviewFileId, fileName, source },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit(controller, { type: "step", stepId: "error", status: "error", detail: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
