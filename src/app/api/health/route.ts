import { getConfigHealth } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    config: getConfigHealth(),
  });
}
