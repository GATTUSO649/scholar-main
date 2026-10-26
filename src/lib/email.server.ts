import nodemailer from "nodemailer";

export type EmailConfig = {
  enabled: boolean;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  appUrl: string;
  reason?: "missing_smtp_configuration" | "invalid_recipient" | "send_failed";
};

export type DeliveryResult = {
  ok: boolean;
  accepted: boolean;
  provider: "smtp";
  messageId?: string | null;
  reason?: string;
  error?: string;
};

function normalizeEnvValue(value: string | undefined) {
  return value?.trim() || undefined;
}

export function buildAppUrl(environment: Record<string, string | undefined> = process.env) {
  const configured = normalizeEnvValue(environment["APP_URL"]);
  if (configured) return configured.replace(/\/+$/, "");
  if (environment["NODE_ENV"] === "production") return "https://localhost";
  return "http://localhost:8080";
}

export function getEmailConfig(
  environment: Record<string, string | undefined> = process.env,
): EmailConfig {
  const host = normalizeEnvValue(environment["SMTP_HOST"]) ?? normalizeEnvValue(environment["EMAIL_HOST"]);
  const port = Number(normalizeEnvValue(environment["SMTP_PORT"]) ?? "587");
  const secure = normalizeEnvValue(environment["SMTP_SECURE"]) === "true";
  const user = normalizeEnvValue(environment["SMTP_USER"]) ?? normalizeEnvValue(environment["EMAIL_USER"]);
  const pass =
    normalizeEnvValue(environment["SMTP_PASS"]) ??
    normalizeEnvValue(environment["SMTP_PASSWORD"]) ??
    normalizeEnvValue(environment["EMAIL_PASS"]);
  const explicitFrom =
    normalizeEnvValue(environment["EMAIL_FROM"]) ?? normalizeEnvValue(environment["SMTP_FROM"]);
  const fromName = normalizeEnvValue(environment["EMAIL_FROM_NAME"]) ?? normalizeEnvValue(environment["SMTP_FROM_NAME"]);
  const from = explicitFrom
    ? fromName && !explicitFrom.includes("<")
      ? `${fromName} <${explicitFrom}>`
      : explicitFrom
    : "";

  if (!host || !from || !user || !pass) {
    return {
      enabled: false,
      port: Number.isFinite(port) ? port : 587,
      secure,
      from,
      appUrl: buildAppUrl(environment),
      reason: "missing_smtp_configuration",
    };
  }

  return {
    enabled: true,
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user,
    pass,
    from,
    appUrl: buildAppUrl(environment),
  };
}

export function isEmailVerificationRequired(
  environment: Record<string, string | undefined> = process.env,
) {
  return (
    normalizeEnvValue(environment["REQUIRE_EMAIL_VERIFICATION"]) === "true" ||
    normalizeEnvValue(environment["EMAIL_VERIFICATION_REQUIRED"]) === "true"
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderEmailLayout({
  title,
  preheader,
  headline,
  body,
  ctaUrl,
  ctaLabel,
  appUrl,
}: {
  title: string;
  preheader: string;
  headline: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  appUrl: string;
}) {
  const cta = ctaUrl && ctaLabel ? `...` : "";
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="x-apple-disable-message-reformatting" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { margin: 0; padding: 0; background: #f5f7fb; font-family: Arial, sans-serif; color: #14213d; }
        table { border-spacing: 0; width: 100%; }
        .wrap { max-width: 600px; margin: 0 auto; }
        .card { background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e7eaf1; }
        .header { background: linear-gradient(135deg, #0f172a, #1d4ed8); padding: 24px 32px; color: #fff; }
        .body { padding: 32px 28px; }
        .button { display: inline-block; background: #2563eb; color: #fff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 700; }
        .muted { color: #475569; }
        .footer { padding: 18px 28px 28px; font-size: 12px; color: #64748b; }
        @media (max-width: 620px) { .body, .header, .footer { padding-left: 18px !important; padding-right: 18px !important; } }
      </style>
    </head>
    <body>
      <div style="padding: 24px 12px;">
        <table role="presentation" class="wrap">
          <tr><td>
            <div class="card">
              <div class="header">
                <strong style="font-size: 20px; letter-spacing: 0.04em;">ScholarDesk</strong>
              </div>
              <div class="body">
                <p class="muted" style="margin: 0 0 12px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(preheader)}</p>
                <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2;">${escapeHtml(headline)}</h1>
                <div style="font-size: 16px; line-height: 1.7; color: #1f2937;">${body}</div>
                ${ctaUrl && ctaLabel ? `<p style="margin: 24px 0 0;"><a class="button" href="${escapeHtml(ctaUrl)}">${escapeHtml(ctaLabel)}</a></p>` : ""}
                <p class="muted" style="margin-top: 18px; margin-bottom: 0; font-size: 13px;">Need help? Contact us at <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} ScholarDesk. This message was sent automatically.
              </div>
            </div>
          </td></tr>
        </table>
      </div>
    </body>
  </html>`;
}

export function buildVerificationEmail({ appUrl, code, name }: { appUrl: string; code: string; name?: string }) {
  const displayName = name || "there";
  const actionUrl = `${appUrl.replace(/\/+$/, "")}/verify-email?code=${encodeURIComponent(code)}`;
  const body = `
    <p>Hello ${escapeHtml(displayName)},</p>
    <p>Use the verification code below to confirm your email address and unlock your account:</p>
    <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.18em; margin: 18px 0;">${escapeHtml(code)}</p>
    <p>Alternatively, use the secure verification link below:</p>
  `;
  return {
    subject: "Verify your ScholarDesk email address",
    html: renderEmailLayout({
      title: "Verify your email",
      preheader: "Confirm your account",
      headline: "Verify your email address",
      body,
      ctaUrl: actionUrl,
      ctaLabel: "Verify email",
      appUrl,
    }),
    text: `Hello ${displayName},\n\nUse this verification code to confirm your email address: ${code}\n\nOpen: ${actionUrl}\n\nThis code expires soon.`,
  };
}

export function buildPasswordResetEmail({ appUrl, token, name }: { appUrl: string; token: string; name?: string }) {
  const displayName = name || "there";
  const actionUrl = `${appUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const body = `
    <p>Hello ${escapeHtml(displayName)},</p>
    <p>We received a request to reset your password. Use the link below to choose a new password:</p>
  `;
  return {
    subject: "Reset your ScholarDesk password",
    html: renderEmailLayout({
      title: "Reset your password",
      preheader: "Account recovery",
      headline: "Reset your password",
      body,
      ctaUrl: actionUrl,
      ctaLabel: "Reset password",
      appUrl,
    }),
    text: `Hello ${displayName},\n\nWe received a request to reset your password. Use this link to continue: ${actionUrl}\n\nIf you did not request this, you can ignore this email.`,
  };
}

export function buildPasswordChangedEmail({ appUrl, name }: { appUrl: string; name?: string }) {
  const displayName = name || "there";
  const body = `
    <p>Hello ${escapeHtml(displayName)},</p>
    <p>Your ScholarDesk password was changed successfully. If you did not make this change, contact support immediately.</p>
  `;
  return {
    subject: "Your ScholarDesk password was changed",
    html: renderEmailLayout({
      title: "Password changed",
      preheader: "Security update",
      headline: "Password updated",
      body,
      ctaUrl: appUrl,
      ctaLabel: "Open ScholarDesk",
      appUrl,
    }),
    text: `Hello ${displayName},\n\nYour ScholarDesk password was changed successfully. If you did not make this change, contact support immediately.\n\nOpen: ${appUrl}`,
  };
}

export function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<DeliveryResult> {
  const cleanTo = to.trim();
  if (!isValidEmailAddress(cleanTo)) {
    return { ok: false, accepted: false, provider: "smtp", reason: "invalid_recipient" };
  }

  const config = getEmailConfig();
  if (!config.enabled || !config.host || !config.from) {
    return {
      ok: false,
      accepted: false,
      provider: "smtp",
      reason: config.reason ?? "missing_smtp_configuration",
      error: "Email delivery is not configured.",
    };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: true },
  });

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: cleanTo,
      subject,
      text,
      html,
    });
    return {
      ok: true,
      accepted: !!info.accepted?.length,
      provider: "smtp",
      messageId: info.messageId ?? null,
    };
  } catch (error) {
    console.error("Email delivery failed.", {
      toDomain: cleanTo.split("@")[1] ?? "unknown",
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      accepted: false,
      provider: "smtp",
      reason: "send_failed",
      error: error instanceof Error ? error.message : "Unknown delivery error",
    };
  }
}
