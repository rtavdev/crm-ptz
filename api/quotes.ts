import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id || req.body?.id;

  if ((req.method === 'PUT' || req.method === 'DELETE') && !id) {
    return res.status(400).json({ error: "Missing required ID for this operation" });
  }

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
        return res.status(200).json([]);
      }
    }

    // POST
    if (req.method === 'POST') {
      try {
        const { number, customer, email, amount, status, description, valid_until } = req.body || {};
        if (!number || !customer) {
          return res.status(400).json({ error: 'number and customer are required.' });
        }
        
        await sql`
          INSERT INTO quotes (id, number, customer, email, amount, status, description, valid_until)
          VALUES (${id}, ${number}, ${customer}, ${email || null}, ${amount || null}, ${status || 'draft'}, ${description || null}, ${valid_until || null})
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
      }
    }

    // PUT
    if (req.method === 'PUT') {
      try {
        const { number, customer, email, amount, status, description, valid_until } = req.body || {};
        
        await sql`
          UPDATE quotes 
          SET number = ${number}, customer = ${customer}, email = ${email || null},
              amount = ${amount}, status = ${status}, description = ${description},
              valid_until = ${valid_until}
          WHERE id = ${id}
        `;
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
      }
    }

    // DELETE
    if (req.method === 'DELETE') {
      try {
        await sql`DELETE FROM quotes WHERE id = ${id}`;
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'DELETE failed' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Quotes endpoint error:', error);
    return res.status(500).json({ error: error.message || 'Unknown database error' });
  }
}