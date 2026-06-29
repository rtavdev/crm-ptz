"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const nodemailer_1 = __importDefault(require("nodemailer"));
async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { to, subject, body, cc, bcc } = req.body || {};
    if (!to) {
        return res.status(400).json({ error: 'Recipient email (to) is required.' });
    }
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;
    const port = Number(process.env.SMTP_PORT) || 587;
    if (!host || !user || !pass) {
        console.error('[send-email] SMTP env vars missing:', { host: !!host, user: !!user, pass: !!pass });
        return res.status(500).json({ error: 'SMTP not configured on server. Check environment variables.' });
    }
    try {
        const transporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
        });
        await transporter.sendMail({
            from: `"PTZOptics CRM" <${from}>`,
            to,
            cc: cc || undefined,
            bcc: bcc || undefined,
            subject: subject || '(no subject)',
            text: body || '',
        });
        console.log(`[send-email] Sent to ${to} — "${subject}"`);
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[send-email] SMTP error:', error.message);
        return res.status(500).json({ error: error.message || 'Failed to send email' });
    }
}
//# sourceMappingURL=send-email.js.map