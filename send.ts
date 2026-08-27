// Thin wrapper around Resend's HTTP API — plain fetch, no SDK dependency,
// so this same file works unmodified from both the Next.js app (relative
// import) and the standalone Netlify scheduled function bundle.

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

export async function sendViaResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const { apiKey, from, to, subject, html, text } = params;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        (json && (json.message || json.error)) || `Resend API error (status ${res.status})`;
      return { ok: false, errorMessage: String(message) };
    }

    return { ok: true, providerMessageId: json?.id };
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
