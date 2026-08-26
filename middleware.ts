import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Passes every request through unchanged, just stamping a build marker
// header. Purely to force Netlify's per-deploy content-dedup to treat
// each deploy as genuinely new — see next.config.ts's generateBuildId
// comment for the full story. Safe to remove once deploys are reliable
// again; doesn't touch routing, auth, or redirects.
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Deploy-Build", "2026-08-26-0145");
  return response;
}
