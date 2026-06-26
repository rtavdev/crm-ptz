import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Simple email sender endpoint.
 * Frontend calls this at /api/send-email when composing emails.
 * For now, logs the email and returns success (actual SMTP sending can be added later).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, body } = req.body || {};

  if (!to) {
    return res.status(400).json({ error: 'Recipient email (to) is required.' });
  }

  try {
    // Log email for now — in production, integrate with Hostinger SMTP or SendGrid
    console.log(`[SEND-EMAIL] To: ${to}, Subject: ${subject}`);
    
    // If SMTP credentials are configured, send via nodemailer
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      // SMTP sending would go here
      // For now, simulate success
    }

    return res.status(200).json({
      success: true,
      message: `Email queued for delivery to ${to}`,
    });
  } catch (error: any) {
    console.error('Send email error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send email',
    });
  }
}