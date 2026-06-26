import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function toNullable(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

const MOCK_DEALS = [
  { id: '1', name: 'Conference Room AV Setup', company: 'TechCorp', contact: 'John Doe', value: 150000, stage: 'proposal', close_date: '2026-07-15', owner: 'Rohan', probability: 60, notes: 'Full conference room setup' },
  { id: '2', name: 'LED Wall Installation', company: 'MediaHouse', contact: 'Jane Smith', value: 300000, stage: 'negotiation', close_date: '2026-08-01', owner: 'Roshan', probability: 80, notes: 'Large LED video wall' },
  { id: '3', name: 'Sound System Upgrade', company: 'Hotel Grand', contact: 'Mike Johnson', value: 85000, stage: 'prospect', close_date: '2026-09-01', owner: 'Rohan', probability: 40, notes: 'Dolby Atmos setup' }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id || req.body?.id;

  if ((req.method === 'PUT' || req.method === 'DELETE') && !id) {
    return res.status(400).json({ error: "Missing required ID for this operation" });
  }

  // AUDIT TRAIL: Extract active user for created_by / modified_by
  const activeUser = (req.headers['x-user-username'] as string) || req.body?.activeUsername || 'System';

  try {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      if (req.method === 'GET') {
        return res.status(200).json(MOCK_DEALS);
      }
      return res.status(200).json({ success: true });
    }
    
    const sql = neon(dbUrl);

    // GET: Fetch all deals
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM deals ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        console.error("CRITICAL API ERROR (DEALS GET):", err);
        return res.status(200).json([]);
      }
    }

    // POST: Create new deal
    if (req.method === 'POST') {
      try {
        const body = req.body || {};
        const { name, company, contact, value, stage, close_date, owner, probability, notes } = body;
        
        if (!name || !company) {
          return res.status(400).json({ error: 'name and company are required.' });
        }

        // Universally supported safe ID fallback
        const safeId = id || req.body?.id || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

        await sql`
          INSERT INTO deals (id, name, company, contact, value, stage, close_date, owner, probability, notes, created_by, modified_by)
          VALUES (
            ${safeId},
            ${name || 'Untitled Deal'},
            ${company},
            ${toNullable(contact)},
            ${Number(value) || 0},
            ${toNullable(stage) || 'new deals'},
            ${toNullable(close_date)},
            ${toNullable(owner)},
            ${Number(probability) || 0},
            ${toNullable(notes)},
            ${activeUser},
            ${activeUser}
          )
        `;
        return res.status(200).json({ success: true, id: safeId });
      } catch (err) {
        console.error("CRITICAL API ERROR (DEALS POST):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
      }
    }

    // PUT: Update deal
    if (req.method === 'PUT') {
      try {
        if (!id) {
          return res.status(400).json({ error: "Missing required ID for this operation" });
        }

        const body = req.body || {};
        const { name, company, contact, value, stage, close_date, owner, probability, notes } = body;

        await sql`
          UPDATE deals 
          SET name = ${name || 'Untitled Deal'},
              company = ${company},
              contact = ${toNullable(contact)},
              value = ${Number(value) || 0},
              stage = ${toNullable(stage)},
              close_date = ${toNullable(close_date)},
              owner = ${toNullable(owner)},
              probability = ${Number(probability) || 0},
              notes = ${toNullable(notes)},
              modified_by = ${activeUser}
          WHERE id = ${id}
        `;

        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (DEALS PUT):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
      }
    }

    // DELETE: Remove deal
    if (req.method === 'DELETE') {
      try {
        if (!id) {
          return res.status(400).json({ error: "Missing required ID for this operation" });
        }
        await sql`DELETE FROM deals WHERE id = ${id}`;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (DEALS DELETE):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'DELETE failed' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error("CRITICAL API ERROR (DEALS UNCAUGHT):", error);
    return res.status(500).json({ error: error.message || 'Unknown database error' });
  }
}