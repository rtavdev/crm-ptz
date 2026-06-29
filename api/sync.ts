import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Stub to prevent 404s from the frontend sync calls
    return res.status(200).json({ message: "Sync endpoint stubbed successfully", status: "ok" });
}