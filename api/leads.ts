import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function toNullable(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

// Foolproof numeric sanitizer protecting your NUMERIC database column
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
      return res.status(200).json(MOCK_LEADS);
    }
    return res.status(200).json({ success: true });
  }
  
  const sql = neon(dbUrl);

  try {

    // 1. Ensure table exists with a native UUID fallback generator
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
          first_name TEXT,
          last_name TEXT,
          company TEXT,
          email TEXT NOT NULL,
          phone TEXT,
          source TEXT,
          status TEXT,
          industry TEXT,
          value NUMERIC,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // Defensive: add missing columns in case production schema drifts
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry TEXT`;
    } catch (tableErr) {
      console.warn('Table creation warning:', tableErr);
    }

    // 2. GET: Fetch all leads
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        console.error('GET error:', err);
        return res.status(200).json([]);
      }
    }

    // 3. POST: Create or Upsert new lead
    if (req.method === 'POST') {
      try {
        const body = req.body || {};
        const { id, first_name, last_name, email, phone, source, status, industry, value, notes } = body;
        const company = body.company ?? body.companyName ?? body.name;
        if (!email) {
          return res.status(400).json({ error: 'email is required.' });
        }

        // FOOLPROOF GUARD: If the client didn't supply an ID string, create a fresh one immediately
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

        // --- CRUD SYNC: Sync lead data to companies and contacts tables ---
        try {
          // Split the lead's contact name into first_name and last_name for sync
          const syncFirstName = toNullable(first_name);
          const syncLastName  = toNullable(last_name);
          const syncCompany   = toNullable(company);
          const syncEmail     = email;
          const syncPhone     = toNullable(phone);

          // Sync to companies table (use company name as the company record name)
          if (syncCompany) {
            const companyId = crypto.randomUUID();
            await sql`
                INSERT INTO companies (id, name, first_name, last_name, phone, email)
                VALUES (${companyId}, ${syncCompany}, ${syncFirstName}, ${syncLastName}, ${syncPhone}, ${syncEmail})
                ON CONFLICT (name) 
                  DO UPDATE SET 
                    email      = EXCLUDED.email,
                    phone      = EXCLUDED.phone,
                    first_name = EXCLUDED.first_name,
                    last_name  = EXCLUDED.last_name
                `;
          }

          // Sync to contacts table
          if (syncFirstName || syncLastName) {
            const contactId = crypto.randomUUID();
            await sql`
              INSERT INTO contacts (id, first_name, last_name, company, email, phone)
              VALUES (${contactId}, ${syncFirstName}, ${syncLastName}, ${syncCompany}, ${syncEmail}, ${syncPhone})
              ON CONFLICT (email) DO NOTHING
            `;
          }
        } catch (syncErr) {
          console.error('CRUD sync error (non-fatal):', syncErr);
        }

        return res.status(200).json({ success: true, id: finalId });
      } catch (err) {
        console.error('POST error:', err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
      }
    }

    // 4. PUT: Update lead
    if (req.method === 'PUT') {
      try {
        if (!id) {
          return res.status(400).json({ error: "Missing required ID for this operation" });
        }

        // Normalize company name: frontend may send 'company', 'companyName', or 'name'
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

        // --- CRUD SYNC: Upsert lead data to companies and contacts tables ---
        try {
          const syncFirstName = toNullable(first_name);
          const syncLastName  = toNullable(last_name);
          const syncCompany   = toNullable(company);
          const syncEmail     = toNullable(email);
          const syncPhone     = toNullable(phone);

          // Upsert to companies table — update existing company record on name conflict
          if (syncCompany) {
            await sql`
              INSERT INTO companies (id, name, first_name, last_name, phone, email)
              VALUES (${crypto.randomUUID()}, ${syncCompany}, ${syncFirstName}, ${syncLastName}, ${syncPhone}, ${syncEmail})
              ON CONFLICT (name) 
              DO UPDATE SET 
                email      = EXCLUDED.email,
                phone      = EXCLUDED.phone,
                first_name = EXCLUDED.first_name,
                last_name  = EXCLUDED.last_name
            `;
          }

          // Upsert to contacts table — update existing contact record on email conflict
          if (syncEmail) {
            await sql`
              INSERT INTO contacts (id, first_name, last_name, company, email, phone)
              VALUES (${crypto.randomUUID()}, ${syncFirstName}, ${syncLastName}, ${syncCompany}, ${syncEmail}, ${syncPhone})
              ON CONFLICT (email) 
              DO UPDATE SET 
                first_name = EXCLUDED.first_name,
                last_name  = EXCLUDED.last_name,
                company    = EXCLUDED.company,
                phone      = EXCLUDED.phone
            `;
          }
        } catch (syncErr) {
          console.error('CRUD sync error (non-fatal):', syncErr);
        }

        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('PUT error:', err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
      }
    }

    // 5. DELETE: Remove lead
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
