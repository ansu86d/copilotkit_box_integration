import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { NextRequest } from "next/server";

import { assertRuntimeReady } from "@/lib/config/env";
import { vendorOnboardingAgent } from "@/lib/copilot/agent";

export const dynamic = "force-dynamic";

const runtime = new CopilotRuntime({
  agents: {
    default: vendorOnboardingAgent,
  },
});

export async function POST(req: NextRequest) {
  assertRuntimeReady();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
}
