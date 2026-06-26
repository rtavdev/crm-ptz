import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function toNullable(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

function toNullableNumeric(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const parsed = Number(v);
  return isNaN(parsed) ? null : parsed;
}

const MOCK_LEADS = [
  { id: '1', first_name: 'Rahul', last_name: 'Sharma', company: 'TechCorp India', email: 'rahul@techcorp.in', phone: '+91 98765 43210', source: 'Website', status: 'Hot', industry: 'Technology', value: 250000, notes: 'Interested in conference room AV', created_at: '2026-01-15T10:30:00Z' },
  { id: '2', first_name: 'Priya', last_name: 'Patel', company: 'MediaHouse Pvt Ltd', email: 'priya@mediahouse.in', phone: '+91 87654 32109', source: 'Referral', status: 'Qualified', industry: 'Media', value: 500000, notes: 'LED wall project', created_at: '2026-01-20T14:00:00Z' },
  { id: '3', first_name: 'Amit', last_name: 'Kumar', company: 'Hotel Grand', email: 'amit@hotelgrand.in', phone: '+91 76543 21098', source: 'Trade Show', status: 'New', industry: 'Hospitality', value: 180000, notes: 'Sound system upgrade', created_at: '2026-02-01T09:00:00Z' }
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
        return res.status(200).json(MOCK_LEADS);
      }
      return res.status(200).json({ success: true });
    }
    
    const sql = neon(dbUrl);

    // GET: Fetch all leads
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        console.error("CRITICAL API ERROR (LEADS GET):", err);
        return res.status(200).json([]);
      }
    }

    // POST: Create or Upsert new lead
    if (req.method === 'POST') {
      try {
        const body = req.body || {};
        const { id: bodyId, first_name, last_name, email, phone, source, status, industry, value, notes } = body;
        const company = body.company ?? body.companyName ?? body.name;
        
        if (!email) {
          return res.status(400).json({ error: 'email is required.' });
        }

        // Universally supported safe ID fallback
        const safeId = id || bodyId || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

        await sql`
          INSERT INTO leads (id, first_name, last_name, company, email, phone, source, status, industry, value, notes, created_by, modified_by)
          VALUES (
            ${safeId},
            ${toNullable(first_name)},
            ${toNullable(last_name)},
            ${toNullable(company)},
            ${email},
            ${toNullable(phone)},
            ${toNullable(source) || 'Other'},
            ${toNullable(status) || 'New'},
            ${toNullable(industry)},
            ${toNullableNumeric(value)},
            ${toNullable(notes)},
            ${activeUser},
            ${activeUser}
          )
          ON CONFLICT (id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name  = EXCLUDED.last_name,
            company    = EXCLUDED.company,
            email      = EXCLUDED.email,
            phone      = EXCLUDED.phone,
            source     = EXCLUDED.source,
            status     = EXCLUDED.status,
            industry   = EXCLUDED.industry,
            value      = EXCLUDED.value,
            notes      = EXCLUDED.notes,
            modified_by = ${activeUser}
        `;

        return res.status(200).json({ success: true, id: safeId });
      } catch (err) {
        console.error("CRITICAL API ERROR (LEADS POST):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
      }
    }

    // PUT: Update lead
    if (req.method === 'PUT') {
      try {
        if (!id) {
          return res.status(400).json({ error: "Missing required ID for this operation" });
        }

        const body = req.body || {};
        const company   = body.company ?? body.companyName ?? body.name;
        const first_name = body.first_name;
        const last_name  = body.last_name;
        const email     = body.email;
        const phone     = body.phone;
        const source    = body.source;
        const status    = body.status;
        const industry  = body.industry;
        const value     = body.value;
        const notes     = body.notes;

        await sql`
          UPDATE leads 
          SET first_name = ${toNullable(first_name)},
              last_name  = ${toNullable(last_name)},
              company    = ${toNullable(company)},
              email      = ${toNullable(email)},
              phone      = ${toNullable(phone)},
              source     = ${toNullable(source)},
              status     = ${toNullable(status)},
              industry   = ${toNullable(industry)},
              value      = ${toNullableNumeric(value)},
              notes      = ${toNullable(notes)},
              modified_by = ${activeUser}
          WHERE id = ${id}
        `;

        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (LEADS PUT):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
      }
    }

    // DELETE: Remove lead
    if (req.method === 'DELETE') {
      try {
        if (!id) {
          return res.status(400).json({ error: "Missing required ID for this operation" });
        }
        await sql`DELETE FROM leads WHERE id = ${id}`;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("CRITICAL API ERROR (LEADS DELETE):", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'DELETE failed' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error("CRITICAL API ERROR (LEADS UNCAUGHT):", error);
    return res.status(500).json({ error: error.message || 'Unknown database error' });
  }
}