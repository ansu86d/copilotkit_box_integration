import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getBoxMode } from "@/lib/box/auth";
import type { BoxCommandResult } from "@/types/box";

const execFileAsync = promisify(execFile);

type BoxRequestEnvelope<T> = {
  statusCode?: number;
  headers?: Record<string, unknown>;
  body?: T | { error?: string; message?: string; statusCode?: number };
};

function isBoxRequestEnvelope<T>(value: unknown): value is BoxRequestEnvelope<T> {
  return typeof value === "object" && value !== null && "statusCode" in value;
}

function extractBoxErrorMessage<T>(value: BoxRequestEnvelope<T>) {
  const body = value.body;

  if (typeof body === "object" && body !== null) {
    const maybeMessage = Reflect.get(body, "message");
    const maybeError = Reflect.get(body, "error");

    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }

    if (typeof maybeError === "string") {
      return maybeError;
    }
  }

  return `Box API request failed with status ${value.statusCode}.`;
}

export async function runBoxCommand<T>(command: string[], mockData?: T): Promise<BoxCommandResult<T>> {
  const boxMode = getBoxMode();

  // Treat demo placeholder IDs as mock — avoids sending fake IDs to the real Box API
  const hasDemoId = command.some((arg) => arg.startsWith("demo-"));

  if (boxMode.mock || hasDemoId) {
    return {
      ok: true,
      command,
      data: mockData,
      mock: true,
      stdout: JSON.stringify(mockData ?? null),
    };
  }

  const finalArgs = [...command, "--json", "--token", boxMode.token];
  const { stdout, stderr } = await execFileAsync("npx", ["box", ...finalArgs], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024,
    env: process.env,
  });

  const parsedOutput = stdout ? (JSON.parse(stdout) as T | BoxRequestEnvelope<T>) : undefined;

  if (parsedOutput && isBoxRequestEnvelope<T>(parsedOutput)) {
    if ((parsedOutput.statusCode ?? 200) >= 400) {
      throw new Error(extractBoxErrorMessage(parsedOutput));
    }

    return {
      ok: true,
      command: finalArgs,
      data: parsedOutput.body as T | undefined,
      stderr,
      stdout,
      mock: false,
    };
  }

  return {
    ok: true,
    command: finalArgs,
    data: parsedOutput as T | undefined,
    stderr,
    stdout,
    mock: false,
  };
}
