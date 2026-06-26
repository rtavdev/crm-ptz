import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

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

// Mock data for demo mode when database is not available
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

  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    if (req.method === 'GET') {
      return res.status(200).json(MOCK_LEADS);
    }
    return res.status(200).json({ success: true });
  }
  
  const sql = neon(dbUrl);

  try {
    // GET: Fetch all leads
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        console.error('GET error:', err);
        return res.status(200).json([]);
      }
    }

    // POST: Create or Upsert new lead
    if (req.method === 'POST') {
      try {
        const body = req.body || {};
        const { first_name, last_name, email, phone, source, status, industry, value, notes } = body;
        const company = body.company ?? body.companyName ?? body.name;
        if (!email) {
          return res.status(400).json({ error: 'email is required.' });
        }

        const finalId = (id && typeof id === 'string' && id.trim() !== '') ? id.trim() : crypto.randomUUID();

        await sql`
          INSERT INTO leads (id, first_name, last_name, company, email, phone, source, status, industry, value, notes)
          VALUES (
            ${finalId},
            ${toNullable(first_name)},
            ${toNullable(last_name)},
            ${toNullable(company)},
            ${email},
            ${toNullable(phone)},
            ${toNullable(source)},
            ${toNullable(status)},
            ${toNullable(industry)},
            ${toNullableNumeric(value)},
            ${toNullable(notes)}
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
            notes      = EXCLUDED.notes
        `;

        return res.status(200).json({ success: true, id: finalId });
      } catch (err) {
        console.error('POST error:', err);
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
              notes      = ${toNullable(notes)}
          WHERE id = ${id}
        `;

        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('PUT error:', err);
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
        console.error('DELETE error:', err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'DELETE failed' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Unknown database error' });
  }
}