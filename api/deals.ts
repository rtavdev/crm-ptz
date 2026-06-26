import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock data for demo mode when database is not available
const MOCK_DEALS = [
  { id: '1', name: 'Conference Room AV Setup', company: 'TechCorp', contact: 'John Doe', value: 150000, stage: 'proposal', close_date: '2026-07-15', owner: 'Rohan', probability: 60, notes: 'Full conference room setup' },
  { id: '2', name: 'LED Wall Installation', company: 'MediaHouse', contact: 'Jane Smith', value: 300000, stage: 'negotiation', close_date: '2026-08-01', owner: 'Roshan', probability: 80, notes: 'Large LED video wall' },
  { id: '3', name: 'Sound System Upgrade', company: 'Hotel Grand', contact: 'Mike Johnson', value: 85000, stage: 'prospect', close_date: '2026-09-01', owner: 'Rohan', probability: 40, notes: 'Dolby Atmos setup' }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract ID with priority: Path (from rewrite) -> Query -> Body
  const id = req.query.id || req.body?.id;

  // IMPORTANT: For PUT and DELETE, ensure we have an ID
  if ((req.method === 'PUT' || req.method === 'DELETE') && !id) {
    return res.status(400).json({ error: "Missing required ID for this operation" });
  }

  const dbUrl = process.env.DATABASE_URL;
  
  // If no database, return mock data for GET requests
  if (!dbUrl) {
    if (req.method === 'GET') {
      return res.status(200).json(MOCK_DEALS);
    }
    return res.status(200).json({ success: true });
  }
  
  const sql = neon(dbUrl);

  try {

    // 1. Ensure table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS deals (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          company TEXT NOT NULL,
          contact TEXT,
          value NUMERIC,
          stage TEXT,
          close_date TEXT,
          owner TEXT,
          probability NUMERIC,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    } catch (err) {
      console.warn('Table creation warning:', err);
    }

    // 2. GET: Fetch all deals
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM deals ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        return res.status(200).json([]);
      }
    }

    // 3. POST: Create new deal
    if (req.method === 'POST') {
      try {
        const { id, name, company, contact, value, stage, close_date, owner, probability, notes } = req.body || {};
        if (!name || !company) {
          return res.status(400).json({ error: 'name and company are required.' });
        }
        
        await sql`
          INSERT INTO deals (id, name, company, contact, value, stage, close_date, owner, probability, notes)
          VALUES (${id || crypto.randomUUID()}, ${name}, ${company}, ${contact || null}, ${value || null}, ${stage || 'new deals'}, ${close_date || null}, ${owner || null}, ${probability || null}, ${notes || null})
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
      }
    }

    // 4. PUT: Update deal
    if (req.method === 'PUT') {
      try {
        const { name, company, contact, value, stage, close_date, owner, probability, notes } = req.body || {};

        await sql`
          UPDATE deals 
          SET name = ${name}, company = ${company}, contact = ${contact}, value = ${value}, 
              stage = ${stage}, close_date = ${close_date}, owner = ${owner}, 
              probability = ${probability}, notes = ${notes}
          WHERE id = ${id}
        `;

        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
      }
    }

    // 5. DELETE: Remove deal
    if (req.method === 'DELETE') {
      try {
        await sql`DELETE FROM deals WHERE id = ${id}`;

        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'DELETE failed' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Unknown database error' });
  }
}
