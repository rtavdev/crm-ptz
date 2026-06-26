import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract ID with priority: Path (from rewrite) -> Query -> Body
  const id = req.query.id || req.body?.id;

  // IMPORTANT: For PUT and DELETE, ensure we have an ID
  if ((req.method === 'PUT' || req.method === 'DELETE') && !id) {
    return res.status(400).json({ error: "Missing required ID for this operation" });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ error: 'DATABASE_URL environment variable is missing.' });
    }
    
    const sql = neon(dbUrl);

    // 1. Ensure table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT,
          meta TEXT,
          note TEXT,
          "user" TEXT,
          username TEXT,
          created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      // Add missing columns safely
      await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS note TEXT`.catch(() => {});
      await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS "user" TEXT`.catch(() => {});
      await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS username TEXT`.catch(() => {});
      await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS created_by TEXT`.catch(() => {});
    } catch (err) {
      console.warn('Table creation warning:', err);
    }

    // 2. GET: Fetch all activities
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM activities ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        return res.status(200).json([]);
      }
    }

    // 3. POST: Create new activity
    if (req.method === 'POST') {
      try {
        const body = req.body || {};
        const { id, type, title, meta, note } = body;
        const user = body.user || body.created_by || null;
        const username = body.username || null;
        const created_at = body.created_at || null;
        
        if (!type) {
          return res.status(400).json({ error: 'type is required.' });
        }
        
        await sql`
          INSERT INTO activities (id, type, title, meta, note, "user", username, created_at)
          VALUES (${id || crypto.randomUUID()}, ${type}, ${title || null}, ${meta || null}, ${note || null}, ${user}, ${username}, ${created_at || new Date().toISOString()})
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
      }
    }

    // 4. PUT: Update activity
    if (req.method === 'PUT') {
      try {
        const { type, title, meta } = req.body || {};
        
        await sql`
          UPDATE activities 
          SET type = ${type}, title = ${title}, meta = ${meta}
          WHERE id = ${id}
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
      }
    }

    // 5. DELETE: Remove activity
    if (req.method === 'DELETE') {
      try {
        await sql`DELETE FROM activities WHERE id = ${id}`;
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
