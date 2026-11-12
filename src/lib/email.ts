import nodemailer, { type Transporter } from "nodemailer";
import { CODE_TTL_MINUTES } from "./security";

// Works with any SMTP provider. Free options:
//   Gmail: SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=you@gmail.com  SMTP_PASS=<16-char app password>
//   Brevo: SMTP_HOST=smtp-relay.brevo.com  SMTP_PORT=587  SMTP_USER=<login>  SMTP_PASS=<SMTP key>
// While these are unset, email features switch off and sign-up works without a code.

export function emailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

const globalForMail = globalThis as unknown as { __syncflowMail?: Transporter };

function transport(): Transporter {
  if (!globalForMail.__syncflowMail) {
    const port = Number(process.env.SMTP_PORT) || 465;
    // A mail catcher on this machine (local testing only) may speak plain SMTP.
    const local = !process.env.VERCEL && ["127.0.0.1", "localhost"].includes(process.env.SMTP_HOST ?? "");
    globalForMail.__syncflowMail = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465 && !local,
      ignoreTLS: local && port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  return globalForMail.__syncflowMail;
}

/** Links in emails always point at our own site, never at the request's Host header. */
export function appUrl(): string {
  const configured =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return (configured || "http://localhost:3000").replace(/\/$/, "");
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Message = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  code?: string;
  buttonText: string;
  link: string;
  footnote: string;
};

function html(m: Message): string {
  const code = m.code
    ? `<tr><td style="padding-top:24px">
<div style="font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8a8a93">Your code</div>
<div style="margin-top:8px;display:inline-block;background:#000;border:1px solid #26262c;border-radius:12px;padding:14px 20px;font-family:Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:.3em;color:#f5f5f7">${escapeHtml(m.code)}</div>
<div style="margin-top:8px;font-size:13px;color:#8a8a93">Expires in ${CODE_TTL_MINUTES} minutes. Never share it with anyone.</div>
</td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#000;font-family:Inter,Arial,sans-serif;color:#f5f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0b0b0d;border:1px solid #26262c;border-radius:16px;padding:32px">
<tr><td style="height:4px;border-radius:4px;background:linear-gradient(90deg,#ff8a3d,#ff3d81,#8b5cff);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding-top:20px;font-size:14px;font-weight:600;color:#ff3d81">SyncFlow</td></tr>
<tr><td style="padding-top:14px;font-size:22px;font-weight:600">${escapeHtml(m.heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#b4b4bd">${escapeHtml(m.body)}</td></tr>
${code}
<tr><td style="padding-top:24px"><a href="${escapeHtml(m.link)}" style="display:inline-block;background:#f5f5f7;color:#000;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px">${escapeHtml(m.buttonText)}</a></td></tr>
<tr><td style="padding-top:28px;font-size:12px;line-height:1.6;color:#8a8a93">${escapeHtml(m.footnote)}</td></tr>
</table></td></tr></table></body></html>`;
}

async function send(m: Message): Promise<void> {
  const from = process.env.EMAIL_FROM || `SyncFlow <${process.env.SMTP_USER}>`;
  const text = [
    m.heading,
    "",
    m.body,
    ...(m.code ? ["", `Your code: ${m.code}`, `Expires in ${CODE_TTL_MINUTES} minutes. Never share it with anyone.`] : []),
    "",
    `${m.buttonText}: ${m.link}`,
    "",
    m.footnote,
  ].join("\n");
  await transport().sendMail({ from, to: m.to, subject: m.subject, text, html: html(m) });
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

// The code leads the subject so it shows in phone notifications without opening the email.
export function sendVerifyCode(user: { name: string; email: string }, code: string) {
  return send({
    to: user.email,
    subject: `${code} is your SyncFlow confirmation code`,
    heading: `Welcome, ${firstName(user.name)}`,
    body: "Enter this code on SyncFlow to confirm your email and open your pages.",
    code,
    buttonText: "Open SyncFlow",
    link: `${appUrl()}/verify`,
    footnote: "If you didn't create a SyncFlow account, you can ignore this email.",
  });
}

export function sendResetCode(user: { name: string; email: string }, code: string) {
  return send({
    to: user.email,
    subject: `${code} is your SyncFlow password reset code`,
    heading: "Reset your password",
    body: "Someone asked to reset the password for this account. If it was you, enter this code on the reset page. Resetting signs you out on every device.",
    code,
    buttonText: "Reset password",
    link: `${appUrl()}/forgot`,
    footnote: "If you didn't ask for this, ignore this email and your password stays the same.",
  });
}

export function sendPasswordChanged(user: { name: string; email: string }) {
  return send({
    to: user.email,
    subject: "Your SyncFlow password was changed",
    heading: "Your password was changed",
    body: "Your SyncFlow password was just changed and other devices were signed out. If this wasn't you, reset your password right away.",
    buttonText: "Reset password",
    link: `${appUrl()}/forgot`,
    footnote: "You get this email whenever your password changes.",
  });
}
