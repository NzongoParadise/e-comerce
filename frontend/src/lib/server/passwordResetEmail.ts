export function passwordResetEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && (process.env.FRONTEND_URL || process.env.APP_URL));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

export async function sendPasswordResetEmail(input: { email: string; name?: string | null; token: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = (process.env.FRONTEND_URL || process.env.APP_URL || "").replace(/\/$/, "");
  if (!apiKey || !from || !appUrl) throw new Error("Password reset email configuration is incomplete");

  const resetUrl = appUrl + "/reset-password?token=" + encodeURIComponent(input.token);
  const greeting = input.name?.trim() ? "Olá, " + escapeHtml(input.name.trim()) + "!" : "Olá!";
  const html = [
    "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#111827\">",
    "<strong style=\"color:#1d6ac4\">RUBRICA DILIGENTE (SU), LDA</strong>",
    "<h1>Recuperar palavra-passe</h1>",
    "<p>" + greeting + "</p>",
    "<p>Recebemos um pedido para redefinir a palavra-passe da sua conta.</p>",
    "<p>O link abaixo é válido durante <strong>1 hora</strong> e só pode ser utilizado uma vez.</p>",
    "<p><a href=\"" + resetUrl + "\" style=\"display:inline-block;background:#1d6ac4;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700\">Redefinir palavra-passe</a></p>",
    "<p style=\"color:#6b7280;font-size:13px\">Se não pediu esta alteração, ignore este e-mail. A sua palavra-passe atual não será alterada.</p>",
    "<p style=\"color:#9ca3af;font-size:12px;word-break:break-all\">" + escapeHtml(resetUrl) + "</p>",
    "</div>",
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: "Recuperação da sua palavra-passe",
      html,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error("Password reset email failed: " + response.status + " " + details.slice(0, 300));
  }
}
