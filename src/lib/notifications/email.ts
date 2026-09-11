import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export interface EmailOptions {
  to: string
  subject: string
  body: string
  recipientName?: string
  link?: string
}

/**
 * Send email notification via Resend.
 * 
 * @throws Error if RESEND_API_KEY is not configured or sending fails
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!resend) {
    throw new Error('RESEND_API_KEY not configured')
  }

  const { to, subject, body, recipientName, link } = options

  const html = generateEmailHTML({
    title: subject,
    message: body,
    recipientName,
    link,
  })

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'ElitPOS <notifications@elitjohnsdigital.co.ke>',
      to,
      subject,
      html,
    })
  } catch (error) {
    console.error('[sendEmail] Failed:', error)
    throw new Error('Failed to send email notification')
  }
}

/**
 * Generate responsive HTML email template.
 */
function generateEmailHTML(options: {
  title: string
  message: string
  recipientName?: string
  link?: string
}): string {
  const { title, message, recipientName, link } = options

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f4f4f7;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #00e67a 0%, #00cc6e 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 16px;
      color: #333333;
      margin-bottom: 16px;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      padding: 12px 32px;
      background: #00e67a;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 16px 0;
    }
    .footer {
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: #999999;
      border-top: 1px solid #eeeeee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ElitPOS</h1>
    </div>
    <div class="content">
      ${recipientName ? `<div class="greeting">Hi ${recipientName},</div>` : ''}
      <div class="message">${message.replace(/\n/g, '<br>')}</div>
      ${link ? `<a href="${link}" class="button">View Details</a>` : ''}
    </div>
    <div class="footer">
      <p>This is an automated notification from ElitPOS.</p>
      <p>© ${new Date().getFullYear()} ElitPOS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
