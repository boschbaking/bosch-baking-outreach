// Builds the final outbound email (HTML + plain text) from an approved
// draft's subject/body, adding the CAN-SPAM required footer: a physical
// mailing address and a working unsubscribe link. This runs both in the
// Next.js app (for a "send test to myself" preview, if ever added) and in
// the standalone Netlify scheduled function, so it deliberately has zero
// dependencies beyond plain strings in/out.

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface BuiltMessage {
  html: string;
  text: string;
}

export function buildOutboundMessage(params: {
  body: string;
  unsubscribeUrl: string;
  mailingAddress: string;
  senderName: string;
}): BuiltMessage {
  const { body, unsubscribeUrl, mailingAddress, senderName } = params;

  const paragraphsHtml = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.55; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px 8px;">
    ${paragraphsHtml}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #8a8a8a; line-height: 1.5;">
      <p style="margin:0 0 6px 0;">${escapeHtml(senderName)} &middot; ${escapeHtml(mailingAddress)}</p>
      <p style="margin:0;">Don't want these emails? <a href="${unsubscribeUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>
    </div>
  </body>
</html>`;

  const text = `${body}\n\n---\n${senderName} · ${mailingAddress}\nUnsubscribe: ${unsubscribeUrl}`;

  return { html, text };
}
