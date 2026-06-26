import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock data for demo mode when database is not available
const MOCK_COMPANIES = [
  { id: '1', name: 'TechCorp India', industry: 'Technology', city: 'Mumbai', contact_name: 'Rahul Sharma', phone: '+91 98765 43210', email: 'contact@techcorp.in', employees: 150, website: 'https://techcorp.in' },
  { id: '2', name: 'MediaHouse Pvt Ltd', industry: 'Media', city: 'Delhi', contact_name: 'Priya Patel', phone: '+91 87654 32109', email: 'info@mediahouse.in', employees: 80, website: 'https://mediahouse.in' },
  { id: '3', name: 'Hotel Grand', industry: 'Hospitality', city: 'Bangalore', contact_name: 'Amit Kumar', phone: '+91 76543 21098', email: 'reservations@hotelgrand.in', employees: 200, website: 'https://hotelgrand.in' }
];

// Helper: Convert empty strings to null so PostgreSQL columns don't panic
const cleanDbValue = (value: any) => {
  if (value === "" || value === undefined) return null;
  return value;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract ID with priority: Path (from rewrite) -> Query -> Body
  const id = req.query.id || req.body?.id;

  // IMPORTANT: For PUT and DELETE, ensure we have an ID
  if ((req.method === 'PUT' || req.method === 'DELETE') && !id) {
    return res.status(400).json({ error: "Missing required ID for this operation" });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    
    // If no database, return mock data for GET requests
    if (!dbUrl) {
      if (req.method === 'GET') {
        return res.status(200).json(MOCK_COMPANIES);
      }
      return res.status(200).json({ success: true });
    }
    
    const sql = neon(dbUrl);

    // 1. Ensure table and columns exist cleanly with contact_name
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS companies (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          industry TEXT,
          city TEXT,
          contact_name TEXT,
          phone TEXT,
          email TEXT,
          employees NUMERIC,
          website TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      // Create index for performance
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS companies_name_idx ON companies (name)`.catch(() => {});
    } catch (err) {
      console.warn('Table creation warning:', err);
    }

    // 2. GET: Fetch all companies
    if (req.method === 'GET') {
      try {
        const data = await sql`SELECT * FROM companies ORDER BY created_at DESC`;
        return res.status(200).json(data || []);
      } catch (err) {
        console.error("GET Error:", err);
        return res.status(200).json([]);
      }
    }

    // 3. POST: Create new company
    if (req.method === 'POST') {
      try {
        const { id: bodyId, name, industry, city, contact_name, phone, email, employees, website } = req.body || {};
        
        if (!name) return res.status(400).json({ error: 'name is required.' });
        
        // FIX: Universally supported unique ID fallback generation
        const safeId = bodyId || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

        // FIX: Clean database values to handle empty strings
        const cleanEmployees = cleanDbValue(employees);
        const cleanWebsite = cleanDbValue(website);
        const cleanPhone = cleanDbValue(phone);
        const cleanEmail = cleanDbValue(email);
        const cleanIndustry = cleanDbValue(industry);
        const cleanCity = cleanDbValue(city);
        const cleanContactName = cleanDbValue(contact_name);

        await sql`
          INSERT INTO companies (id, name, industry, city, contact_name, phone, email, employees, website)
          VALUES (${safeId}, ${name}, ${cleanIndustry}, ${cleanCity}, ${cleanContactName}, ${cleanPhone}, ${cleanEmail}, ${cleanEmployees}, ${cleanWebsite})
          ON CONFLICT (name) DO UPDATE SET
            contact_name = EXCLUDED.contact_name,
            industry     = EXCLUDED.industry,
            city         = EXCLUDED.city,
            phone        = EXCLUDED.phone,
            email        = EXCLUDED.email,
            employees    = EXCLUDED.employees,
            website      = EXCLUDED.website
        `;
        return res.status(200).json({ success: true, id: safeId });
      } catch (err: any) {
        console.error("CRITICAL API ERROR (POST):", err);
        return res.status(500).json({ error: err.message || 'POST failed' });
      }
    }

    // 4. PUT: Update company (only update fields that are explicitly provided)
    if (req.method === 'PUT') {
      try {
        const { id: bodyId, ...updates } = req.body;
        const targetId = id || bodyId;
        
        // Fetch current record
        const existingData = await sql`SELECT * FROM companies WHERE id = ${targetId}`;
        if (!existingData || existingData.length === 0) return res.status(404).json({ error: 'Not found' });

        const safeEmployees = updates.employees !== undefined ? cleanDbValue(updates.employees) : existingData[0].employees;

        await sql`
          UPDATE companies 
          SET 
            name         = ${updates.name ?? existingData[0].name},
            industry     = ${updates.industry !== undefined ? cleanDbValue(updates.industry) : existingData[0].industry},
            city         = ${updates.city !== undefined ? cleanDbValue(updates.city) : existingData[0].city},
            contact_name = ${updates.contact_name !== undefined ? cleanDbValue(updates.contact_name) : existingData[0].contact_name},
            phone        = ${updates.phone !== undefined ? cleanDbValue(updates.phone) : existingData[0].phone},
            email        = ${updates.email !== undefined ? cleanDbValue(updates.email) : existingData[0].email},
            employees    = ${safeEmployees},
            website      = ${updates.website !== undefined ? cleanDbValue(updates.website) : existingData[0].website}
          WHERE id = ${targetId}
        `;
        return res.status(200).json({ success: true });
      } catch (err: any) {
        console.error("CRITICAL API ERROR (PUT):", err);
        return res.status(500).json({ error: err.message || 'PUT failed' });
      }
    }

    // 5. DELETE: Remove company
    if (req.method === 'DELETE') {
      try {
        await sql`DELETE FROM companies WHERE id = ${id}`;
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