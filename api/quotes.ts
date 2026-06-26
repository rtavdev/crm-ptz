import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function toNullable(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

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
      return res.status(500).json({ error: 'DATABASE_URL environment variable is missing.' });
    }
    
    const sql = neon(dbUrl);

    // GET
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM quotes ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        console.error("CRITICAL API ERROR (QUOTES GET):", err);
        return res.status(200).json([]);
      }
    }

    // POST
    if (req.method === 'POST') {
      try {
        const body = req.body || {};
        const { number, customer, email, amount, status, description, valid_until } = body;
        
        if (!number || !customer) {
          return res.status(400).json({ error: 'number and customer are required.' });
        }

        // Universally supported safe ID fallback
        const safeId = id || req.body?.id || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

        await sql`
          INSERT INTO quotes (id, number, customer, email, amount, status, description, valid_until, created_by, modified_by)
          VALUES (
            ${safeId},
            ${number || 'QT-0000'},
            ${customer},
            ${toNullable(email)},
            ${Number(amount) || 0},
            ${toNullable(status) || 'draft'},
            ${toNullable(description)},
            ${toNullable(valid_until)},
            ${activeUser},
            ${activeUser}
          )
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (QUOTES POST):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
      }
    }

    // PUT
    if (req.method === 'PUT') {
      try {
        const body = req.body || {};
        const { number, customer, email, amount, status, description, valid_until } = body;
        
        await sql`
          UPDATE quotes 
          SET number = ${number || 'QT-0000'},
              customer = ${customer},
              email = ${toNullable(email)},
              amount = ${Number(amount) || 0},
              status = ${toNullable(status) || 'draft'},
              description = ${toNullable(description)},
              valid_until = ${toNullable(valid_until)},
              modified_by = ${activeUser}
          WHERE id = ${id}
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (QUOTES PUT):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
      }
    }

    // DELETE
    if (req.method === 'DELETE') {
      try {
        await sql`DELETE FROM quotes WHERE id = ${id}`;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (QUOTES DELETE):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'DELETE failed' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Quotes endpoint error:', error);
    return res.status(500).json({ error: error.message || 'Unknown database error' });
  }
}