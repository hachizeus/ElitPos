/**
 * Admin & user email notifications for billing events.
 * Uses sendSystemEmail (Resend) — falls back to console.log in dev.
 */
import { sendSystemEmail } from './system-email'
import { db } from '@/lib/db'
import { superAdmins, accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'
import { sendNotification } from '@/lib/notifications/sender'

const APP = process.env.NEXT_PUBLIC_APP_NAME || 'ElitPOS'
const BASE = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Get all active super-admin emails */
async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await db.select({ email: superAdmins.email })
      .from(superAdmins)
      .where(eq(superAdmins.isActive, true))
    return admins.map(a => a.email)
  } catch {
    const fallback = process.env.ADMIN_NOTIFICATION_EMAIL
    return fallback ? [fallback] : []
  }
}

/** Get account email by accountId */
async function getAccountEmail(accountId: string): Promise<string | null> {
  try {
    const acc = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { email: true, fullName: true },
    })
    return acc?.email || null
  } catch {
    return null
  }
}

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#161b22;border-radius:12px;overflow:hidden;border:1px solid #30363d">
    <div style="padding:20px 28px;background:#00FF88;text-align:center">
      <h1 style="margin:0;font-size:18px;font-weight:700;color:#0d1117">${esc(APP)}</h1>
    </div>
    <div style="padding:28px">
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #30363d;text-align:center">
      <p style="margin:0;font-size:11px;color:#6e7681">This is an automated notification from ${esc(APP)}.</p>
    </div>
  </div>
</body>
</html>`
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:6px 0;color:#8b949e;font-size:13px;width:40%">${esc(label)}</td>
    <td style="padding:6px 0;color:#e6edf3;font-size:13px;font-weight:500">${esc(value)}</td>
  </tr>`
}

function button(href: string, label: string) {
  return `<div style="margin-top:20px;text-align:center">
    <a href="${href}" style="display:inline-block;padding:12px 28px;background:#00FF88;color:#0d1117;
      font-weight:700;font-size:14px;border-radius:8px;text-decoration:none">${esc(label)}</a>
  </div>`
}

// ── Admin notifications ───────────────────────────────────────────────────────

/**
 * Notify admin: a new bank deposit / payment has been submitted and is awaiting review.
 */
export async function notifyAdminNewPayment(opts: {
  accountEmail: string
  accountName: string
  amount: string
  currency: string
  isWalletDeposit: boolean
  pendingCompanyName?: string | null
  bankReference?: string | null
}) {
  const emails = await getAdminEmails()
  if (emails.length === 0) return

  const type = opts.isWalletDeposit
    ? 'Wallet Top-up'
    : opts.pendingCompanyName
      ? `New Company: ${opts.pendingCompanyName}`
      : 'Subscription Renewal'

  const html = baseTemplate('New Payment Awaiting Review', `
    <h2 style="margin:0 0 16px;font-size:16px;color:#e6edf3">💳 New Payment Awaiting Review</h2>
    <table style="width:100%;border-collapse:collapse">
      ${row('From', `${opts.accountName} (${opts.accountEmail})`)}
      ${row('Amount', `${opts.currency} ${Number(opts.amount).toLocaleString()}`)}
      ${row('Type', type)}
      ${opts.bankReference ? row('Reference', opts.bankReference) : ''}
    </table>
    ${button(`${BASE}/sys-control/payments`, 'Review Payment')}
  `)

  for (const email of emails) {
    await sendSystemEmail({
      to: email,
      subject: `[${APP}] New payment awaiting review — ${opts.currency} ${Number(opts.amount).toLocaleString()}`,
      html,
      text: `New payment from ${opts.accountEmail}: ${opts.currency} ${opts.amount} (${type}). Review at ${BASE}/sys-control/payments`,
    }).catch(e => logError('email:admin-new-payment', e))
  }
}

/**
 * Notify admin: a pending company has submitted payment and is ready for approval.
 */
export async function notifyAdminPendingCompanyPayment(opts: {
  companyName: string
  businessType: string
  planName: string
  billingCycle: string
  accountEmail: string
  amount: string
  currency: string
}) {
  const emails = await getAdminEmails()
  if (emails.length === 0) return

  const html = baseTemplate('New Company Payment — Ready for Activation', `
    <h2 style="margin:0 0 16px;font-size:16px;color:#e6edf3">🏢 Company Ready for Activation</h2>
    <table style="width:100%;border-collapse:collapse">
      ${row('Company', opts.companyName)}
      ${row('Business Type', opts.businessType)}
      ${row('Plan', `${opts.planName} (${opts.billingCycle})`)}
      ${row('Amount Paid', `${opts.currency} ${Number(opts.amount).toLocaleString()}`)}
      ${row('Account', opts.accountEmail)}
    </table>
    ${button(`${BASE}/sys-control/payments`, 'Activate Company')}
  `)

  for (const email of emails) {
    await sendSystemEmail({
      to: email,
      subject: `[${APP}] Company "${opts.companyName}" payment received — activate now`,
      html,
      text: `"${opts.companyName}" has paid ${opts.currency} ${opts.amount}. Review at ${BASE}/sys-control/payments`,
    }).catch(e => logError('email:admin-pending-company-payment', e))
  }
}

// ── User notifications ────────────────────────────────────────────────────────

/**
 * Notify user: their company has been approved and activated.
 */
export async function notifyUserCompanyApproved(opts: {
  accountId: string
  companyName: string
  companySlug: string
  planName: string
}) {
  const email = await getAccountEmail(opts.accountId)
  if (!email) return

  const loginUrl = `${BASE}/c/${opts.companySlug}/login`

  const html = baseTemplate('Your Company is Live! 🎉', `
    <h2 style="margin:0 0 8px;font-size:18px;color:#00FF88">🎉 Welcome to ${esc(APP)}!</h2>
    <p style="margin:0 0 16px;color:#8b949e;font-size:14px">
      Your company <strong style="color:#e6edf3">${esc(opts.companyName)}</strong> has been activated
      on the <strong style="color:#e6edf3">${esc(opts.planName)}</strong> plan.
    </p>
    <table style="width:100%;border-collapse:collapse">
      ${row('Company', opts.companyName)}
      ${row('Plan', opts.planName)}
      ${row('Login URL', loginUrl)}
    </table>
    ${button(loginUrl, 'Go to Dashboard')}
  `)

  // Send email
  await sendSystemEmail({
    to: email,
    subject: `[${APP}] Your company "${opts.companyName}" is now live!`,
    html,
    text: `Great news! Your company "${opts.companyName}" is now active on ${APP}. Log in at: ${loginUrl}`,
  }).catch(e => logError('email:user-company-approved', e))

  // Send multi-channel notification (in-app, email, SMS)
  await sendNotification({
    accountId: opts.accountId,
    type: 'new_company',
    title: `🎉 ${opts.companyName} is Live!`,
    message: `Your company has been activated on the ${opts.planName} plan. You can now access your dashboard and start using ${APP}.`,
    link: `/c/${opts.companySlug}`,
    sendInApp: true,
    sendEmail: false, // Already sent via sendSystemEmail above
    sendSMS: true,
  }).catch(e => logError('notification:user-company-approved', e))
}

/**
 * Notify user: their company payment was rejected.
 */
export async function notifyUserCompanyRejected(opts: {
  accountId: string
  companyName: string
  reason: string
}) {
  const email = await getAccountEmail(opts.accountId)
  if (!email) return

  const html = baseTemplate('Company Application Update', `
    <h2 style="margin:0 0 8px;font-size:16px;color:#e6edf3">Payment Review Update</h2>
    <p style="margin:0 0 16px;color:#8b949e;font-size:14px">
      Unfortunately your application for <strong style="color:#e6edf3">${esc(opts.companyName)}</strong>
      could not be processed at this time.
    </p>
    <div style="padding:12px 16px;background:#1c1c1c;border-left:3px solid #f85149;border-radius:4px;margin-bottom:16px">
      <p style="margin:0;color:#f85149;font-size:13px"><strong>Reason:</strong> ${esc(opts.reason)}</p>
    </div>
    <p style="margin:0 0 16px;color:#8b949e;font-size:14px">
      Please contact us if you believe this is an error or to resubmit your payment.
    </p>
    ${button(`${BASE}/account/payments`, 'Go to Payments')}
  `)

  // Send email
  await sendSystemEmail({
    to: email,
    subject: `[${APP}] Update on your company "${opts.companyName}" application`,
    html,
    text: `Your application for "${opts.companyName}" could not be processed. Reason: ${opts.reason}. Contact support if you need help.`,
  }).catch(e => logError('email:user-company-rejected', e))

  // Send multi-channel notification
  await sendNotification({
    accountId: opts.accountId,
    type: 'payment',
    title: `Company Application Update`,
    message: `Your application for "${opts.companyName}" could not be processed. Reason: ${opts.reason}. Please contact support if you need assistance.`,
    link: `/account/payments`,
    sendInApp: true,
    sendEmail: false,
    sendSMS: true,
  }).catch(e => logError('notification:user-company-rejected', e))
}

/**
 * Notify user: their bank deposit payment was approved.
 */
export async function notifyUserPaymentApproved(opts: {
  accountId: string
  amount: string
  currency: string
  periodMonths: number
}) {
  const email = await getAccountEmail(opts.accountId)
  if (!email) return

  const html = baseTemplate('Payment Approved ✓', `
    <h2 style="margin:0 0 16px;font-size:16px;color:#00FF88">✓ Payment Approved</h2>
    <p style="margin:0 0 16px;color:#8b949e;font-size:14px">
      Your payment has been reviewed and approved.
    </p>
    <table style="width:100%;border-collapse:collapse">
      ${row('Amount', `${opts.currency} ${Number(opts.amount).toLocaleString()}`)}
      ${row('Period', `${opts.periodMonths} month${opts.periodMonths !== 1 ? 's' : ''}`)}
    </table>
    ${button(`${BASE}/account`, 'View Account')}
  `)

  // Send email
  await sendSystemEmail({
    to: email,
    subject: `[${APP}] Payment of ${opts.currency} ${Number(opts.amount).toLocaleString()} approved`,
    html,
    text: `Your payment of ${opts.currency} ${opts.amount} has been approved and applied to your account.`,
  }).catch(e => logError('email:user-payment-approved', e))

  // Send multi-channel notification
  await sendNotification({
    accountId: opts.accountId,
    type: 'payment',
    title: `✓ Payment Approved`,
    message: `Your payment of ${opts.currency} ${Number(opts.amount).toLocaleString()} for ${opts.periodMonths} month${opts.periodMonths !== 1 ? 's' : ''} has been approved and applied to your account.`,
    link: `/account/billing`,
    sendInApp: true,
    sendEmail: false,
    sendSMS: true,
  }).catch(e => logError('notification:user-payment-approved', e))
}
