import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

// Public endpoint — a prospect clicking the unsubscribe link in an email is
// not logged into the app, so this relies on unsubscribe_prospect() (a
// security-definer RPC, see migration add_sending_dispatch_rpcs) rather
// than RLS, and on the token's HMAC signature rather than a session.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") || "";
  const prospectId = verifyUnsubscribeToken(token);

  if (!prospectId) {
    return new NextResponse(renderPage("That unsubscribe link isn't valid."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("unsubscribe_prospect", {
    p_prospect_id: prospectId,
    p_reason: "unsubscribe link clicked",
  });

  if (error) {
    return new NextResponse(renderPage("Something went wrong. Please try again later."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new NextResponse(
    renderPage("You've been unsubscribed. We won't email this address again."),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

function renderPage(message: string) {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Unsubscribe</title></head>
  <body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #001630;">
    <p style="font-size: 16px;">${message}</p>
  </body>
</html>`;
}
