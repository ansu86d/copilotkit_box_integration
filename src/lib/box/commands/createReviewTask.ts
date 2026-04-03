import { runBoxCommand } from "@/lib/box/runBoxCommand";

export async function createReviewTask(fileId: string, message: string, dueAt?: string) {
  if (!/^\d+$/.test(fileId)) {
    throw new Error(
      "createReviewTask requires a verified Box file id. First inspect the review folder and use the numeric file id returned by Box.",
    );
  }

  const result = await runBoxCommand<{ id: string }>(
    [
      "tasks:create",
      fileId,
      "--message",
      message,
      ...(dueAt ? ["--due-at", dueAt] : []),
      "--completion-rule",
      "all_assignees",
    ],
    { id: `task-${fileId}` },
  );

  return {
    taskId: result.data?.id ?? `task-${fileId}`,
    message,
    dueAt,
    source: result.mock ? "demo" : "box",
  };
}
