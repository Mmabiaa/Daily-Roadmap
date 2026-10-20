import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Outbound email for PIN reset codes.
 *
 * Configured entirely from the environment so the provider can be swapped
 * (Gmail app password today, a transactional API later) without code changes.
 * The transporter is created once and reused; nodemailer pools the sockets.
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

/** Sends the 6-digit reset code. Throws if the SMTP server rejects the mail. */
export async function sendPinResetCode(to: string, code: string, minutes: number): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  await getTransporter().sendMail({
    from,
    to,
    subject: 'Your Daily Roadmap PIN reset code',
    text: [
      `Your PIN reset code is ${code}.`,
      `It expires in ${minutes} minutes.`,
      '',
      'If you did not ask to reset your PIN, you can ignore this email — your PIN stays the same.',
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#111">
        <p>Your PIN reset code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:.3em;margin:8px 0">${code}</p>
        <p style="color:#555">It expires in ${minutes} minutes.</p>
        <p style="color:#555">If you did not ask to reset your PIN, you can ignore this email — your PIN stays the same.</p>
      </div>
    `,
  })
}
