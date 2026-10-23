import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Outbound email for Daily Roadmap.
 *
 * Configured entirely from the environment so the provider can be swapped
 * (Gmail app password today, a transactional API later) without code changes.
 * The transporter is created once and reused; nodemailer pools the sockets.
 *
 * Mail is sent from a background job or a request handler that has already
 * finished its work, so a delivery failure must never take the caller down:
 * every sender here can throw, and callers decide what that means.
 */

let transporter: Transporter | null = null

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function getTransporter(): Transporter {
  if (!isMailConfigured()) {
    throw new Error('Email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS')
  }

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }

  return transporter
}

/* ───────────────────────── Theme ─────────────────────────
   The palette is taken from the app's own design tokens
   (app/styles/02-tokens.css) so an email reads like the product rather than a
   generic notification. Everything is inlined and table-based on purpose:
   Gmail and Outlook strip <style> blocks and most modern CSS. */

const T = {
  background: '#cfe8e2',
  card: '#fef0ff',
  line: '#e7ebef',
  primary: '#763c6b',
  heading: '#5f2f57',
  body: '#3c4a56',
  muted: '#66727e',
  faint: '#8b98a3',
  code: '#f7f9fb',
} as const

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Apple Color Emoji',sans-serif"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A big, dash-bordered block for a one-time code. */
function codeBlock(code: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
      <tr>
        <td align="center" style="padding:18px;background:${T.code};border:1px dashed ${T.primary};border-radius:14px;">
          <span style="font-family:${FONT};font-size:30px;font-weight:700;letter-spacing:.28em;color:${T.primary};">${escapeHtml(code)}</span>
        </td>
      </tr>
    </table>`
}

/** Wraps body content in the branded card and pairs it with a plain-text twin. */
function renderEmail(options: {
  heading: string
  preview: string
  bodyHtml: string
  text: string
  footnote: string
}): { html: string; text: string } {
  const { heading, preview, bodyHtml, text, footnote } = options

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${T.background};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${T.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;background:${T.card};border:1px solid ${T.line};border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:22px 28px;background:${T.primary};">
              <span style="font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:.2px;color:#ffffff;">Daily Roadmap</span>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 8px;">
              <h1 style="margin:0 0 14px;font-family:${FONT};font-size:21px;line-height:1.3;font-weight:700;color:${T.heading};">${escapeHtml(heading)}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid ${T.line};">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${T.faint};">${escapeHtml(footnote)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { html, text }
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${T.body};">${html}</p>`
}

/* ───────────────────────── Senders ───────────────────────── */

/** Sends the 6-digit reset code. Throws if the SMTP server rejects the mail. */
export async function sendPinResetCode(to: string, code: string, minutes: number): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  const { html, text } = renderEmail({
    heading: 'Reset your PIN',
    preview: `Your code is ${code} — it expires in ${minutes} minutes.`,
    bodyHtml:
      paragraph('Enter this code to choose a new PIN:') +
      codeBlock(code) +
      paragraph(
        `<span style="color:${T.muted};">This code expires in ${minutes} minutes and can be used once.</span>`
      ),
    text: [
      `Your PIN reset code is ${code}.`,
      `It expires in ${minutes} minutes and can be used once.`,
      '',
      'If you did not ask to reset your PIN, you can ignore this email — your PIN stays the same.',
    ].join('\n'),
    footnote: 'You received this because a PIN reset was requested for this address.',
  })

  await getTransporter().sendMail({
    from,
    to,
    subject: 'Your Daily Roadmap PIN reset code',
    text,
    html,
  })
}

/** Sends a short hello after an account is created. Throws if delivery fails. */
export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  const name = escapeHtml(username)

  const { html, text } = renderEmail({
    heading: `Welcome, ${username}`,
    preview: 'Your Daily Roadmap account is ready.',
    bodyHtml:
      paragraph(
        `Hi <strong style="color:${T.heading};">${name}</strong> — your Daily Roadmap account is ready. ` +
          'It is a calm place to plan your day, keep your classes and study blocks in one view, and see your week at a glance.'
      ) +
      paragraph(
        `<span style="color:${T.muted};">Next step: a one-minute setup to set your wake and sleep times, your classes and your must-dos. After that the day plans itself around you.</span>`
      ),
    text: [
      `Welcome to Daily Roadmap, ${username}.`,
      '',
      'Your account is ready. It is a calm place to plan your day, keep your classes and',
      'study blocks in one view, and see your week at a glance.',
      '',
      'Next step: a one-minute setup to set your wake and sleep times, your classes and',
      'your must-dos. After that the day plans itself around you.',
    ].join('\n'),
    footnote: 'You received this because a Daily Roadmap account was created with this address.',
  })

  await getTransporter().sendMail({
    from,
    to,
    subject: 'Welcome to Daily Roadmap',
    text,
    html,
  })
}
