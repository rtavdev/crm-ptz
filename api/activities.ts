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

    // GET: Fetch all activities
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM activities ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        console.error("CRITICAL API ERROR (ACTIVITIES GET):", err);
        return res.status(200).json([]);
      }
    }

    // POST: Create new activity
    if (req.method === 'POST') {
      try {
        const body = req.body || {};
        const { type, title, meta, note } = body;
        const user = body.user || body.created_by || activeUser;
        const username = body.username || activeUser;
        const created_at = body.created_at || null;
        
        if (!type) {
          return res.status(400).json({ error: 'type is required.' });
        }

        // Universally supported safe ID fallback
        const safeId = id || req.body?.id || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

        await sql`
          INSERT INTO activities (id, type, title, meta, note, "user", username, created_by, created_at)
          VALUES (
            ${safeId},
            ${type || 'note'},
            ${toNullable(title)},
            ${toNullable(meta)},
            ${toNullable(note)},
            ${user},
            ${username},
            ${activeUser},
            ${created_at || new Date().toISOString()}
          )
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (ACTIVITIES POST):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
      }
    }

    // PUT: Update activity
    if (req.method === 'PUT') {
      try {
        const body = req.body || {};
        const { type, title, meta } = body;
        
        await sql`
          UPDATE activities 
          SET type = ${type || 'note'},
              title = ${toNullable(title)},
              meta = ${toNullable(meta)},
              modified_by = ${activeUser}
          WHERE id = ${id}
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (ACTIVITIES PUT):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
      }
    }

    // DELETE: Remove activity
    if (req.method === 'DELETE') {
      try {
        await sql`DELETE FROM activities WHERE id = ${id}`;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (ACTIVITIES DELETE):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'DELETE failed' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error("CRITICAL API ERROR (ACTIVITIES UNCAUGHT):", error);
    return res.status(500).json({ error: error.message || 'Unknown database error' });
  }
}