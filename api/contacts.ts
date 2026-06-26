import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function toNullable(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

// Mock data for demo mode when database is not available
const MOCK_CONTACTS = [
  { id: '1', first_name: 'Rahul', last_name: 'Sharma', company: 'TechCorp India', email: 'rahul@techcorp.in', phone: '+91 98765 43210', title: 'IT Manager', status: 'active', created_at: '2026-01-15T10:30:00Z' },
  { id: '2', first_name: 'Priya', last_name: 'Patel', company: 'MediaHouse Pvt Ltd', email: 'priya@mediahouse.in', phone: '+91 87654 32109', title: 'Marketing Director', status: 'active', created_at: '2026-01-20T14:00:00Z' },
  { id: '3', first_name: 'Amit', last_name: 'Kumar', company: 'Hotel Grand', email: 'amit@hotelgrand.in', phone: '+91 76543 21098', title: 'Operations Head', status: 'active', created_at: '2026-02-01T09:00:00Z' }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id || req.body?.id;

  if ((req.method === 'PUT' || req.method === 'DELETE') && !id) {
    return res.status(400).json({ error: "Missing required ID for this operation" });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      if (req.method === 'GET') {
        return res.status(200).json(MOCK_CONTACTS);
      }
      return res.status(200).json({ success: true });
    }
    
    const sql = neon(dbUrl);

    // GET: Fetch all contacts
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM contacts ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        console.error("GET Error:", err);
        return res.status(200).json([]);
      }
    }

    // POST: Create new contact
    if (req.method === 'POST') {
      try {
        const body = req.body || {};
        
        let { first_name, last_name, company, email, phone, title, status, contact_name, name } = body;
        
        let finalFirstName = first_name;
        let finalLastName = last_name;

        if (!finalFirstName) {
          const incomingName = contact_name || name;
          if (incomingName) {
            const parts = incomingName.trim().split(/\s+/);
            finalFirstName = parts[0];
            finalLastName  = parts.length > 1 ? parts.slice(1).join(' ') : "";
          }
        }
        
        if (!finalFirstName) {
          return res.status(400).json({ error: 'A name is required to save a contact.' });
        }
        
        finalLastName = finalLastName || "";
        const finalEmail = email || "";

        const safeId = id || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        
        await sql`
          INSERT INTO contacts (id, first_name, last_name, company, email, phone, title, status)
          VALUES (${safeId}, ${finalFirstName}, ${finalLastName}, ${toNullable(company)}, ${finalEmail}, ${toNullable(phone)}, ${toNullable(title)}, ${toNullable(status) || 'active'})
        `;
        return res.status(200).json({ success: true, id: safeId });
      } catch (err: any) {
        console.error("CRITICAL API ERROR (POST):", err);
        return res.status(500).json({ error: err.message || 'POST failed' });
      }
    }

    // PUT: Update contact
    if (req.method === 'PUT') {
      try {
        if (!id) {
          return res.status(400).json({ error: "Missing required ID for this operation" });
        }
        const body = req.body || {};
        
        let { first_name, last_name, company, email, phone, title, status, contact_name, name } = body;
        
        let finalFirstName = first_name;
        let finalLastName = last_name;

        if (!finalFirstName && !finalLastName) {
          const incomingName = contact_name || name;
          if (incomingName) {
            const parts = incomingName.trim().split(/\s+/);
            finalFirstName = parts[0];
            finalLastName  = parts.length > 1 ? parts.slice(1).join(' ') : "";
          }
        }

        const existingData = await sql`SELECT * FROM contacts WHERE id = ${id}`;
        if (!existingData || existingData.length === 0) return res.status(404).json({ error: 'Not found' });

        await sql`
          UPDATE contacts 
          SET 
            first_name = ${finalFirstName ?? existingData[0].first_name}, 
            last_name = ${finalLastName ?? existingData[0].last_name}, 
            company = ${company !== undefined ? toNullable(company) : existingData[0].company}, 
            email = ${email ?? existingData[0].email}, 
            phone = ${phone !== undefined ? toNullable(phone) : existingData[0].phone}, 
            title = ${title !== undefined ? toNullable(title) : existingData[0].title}, 
            status = ${status !== undefined ? toNullable(status) : existingData[0].status}
          WHERE id = ${id}
        `;
        return res.status(200).json({ success: true });
      } catch (err: any) {
        console.error("CRITICAL API ERROR (PUT):", err);
        return res.status(500).json({ error: err.message || 'PUT failed' });
      }
    }

    // DELETE: Remove contact
    if (req.method === 'DELETE') {
      try {
        if (!id) {
          return res.status(400).json({ error: "Missing required ID for this operation" });
        }
        await sql`DELETE FROM contacts WHERE id = ${id}`;
        return res.status(200).json({ success: true });
      } catch (err: any) {
        console.error("CRITICAL API ERROR (DELETE):", err);
        return res.status(500).json({ error: err.message || 'DELETE failed' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error("UNCAUGHT API EXCEPTION:", error);
    return res.status(500).json({ error: error.message || 'Unknown database error' });
  }
}