"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const serverless_1 = require("@neondatabase/serverless");
const MOCK_COMPANIES = [
    { id: '1', name: 'TechCorp India', industry: 'Technology', city: 'Mumbai', contact_name: 'Rahul Sharma', phone: '+91 98765 43210', email: 'contact@techcorp.in', employees: 150, website: 'https://techcorp.in' },
    { id: '2', name: 'MediaHouse Pvt Ltd', industry: 'Media', city: 'Delhi', contact_name: 'Priya Patel', phone: '+91 87654 32109', email: 'info@mediahouse.in', employees: 80, website: 'https://mediahouse.in' },
    { id: '3', name: 'Hotel Grand', industry: 'Hospitality', city: 'Bangalore', contact_name: 'Amit Kumar', phone: '+91 76543 21098', email: 'reservations@hotelgrand.in', employees: 200, website: 'https://hotelgrand.in' }
];
const cleanDbValue = (value) => {
    if (value === "" || value === undefined)
        return null;
    return value;
};
async function handler(req, res) {
    const id = req.query.id || req.body?.id;
    if ((req.method === 'PUT' || req.method === 'DELETE') && !id) {
        return res.status(400).json({ error: "Missing required ID for this operation" });
    }
    try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            if (req.method === 'GET') {
                return res.status(200).json(MOCK_COMPANIES);
            }
            return res.status(200).json({ success: true });
        }
        const sql = (0, serverless_1.neon)(dbUrl);
        // GET: Fetch all companies
        if (req.method === 'GET') {
            try {
                const data = await sql `SELECT * FROM companies ORDER BY created_at DESC`;
                return res.status(200).json(data || []);
            }
            catch (err) {
                console.error("GET Error:", err);
                return res.status(200).json([]);
            }
        }
        // POST: Create new company
        if (req.method === 'POST') {
            try {
                const { name, industry, city, contact_name, phone, email, employees, website } = req.body || {};
                if (!name)
                    return res.status(400).json({ error: 'name is required.' });
                const safeId = id || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
                await sql `
          INSERT INTO companies (id, name, industry, city, contact_name, phone, email, employees, website)
          VALUES (${safeId}, ${name}, ${cleanDbValue(industry)}, ${cleanDbValue(city)}, ${cleanDbValue(contact_name)}, ${cleanDbValue(phone)}, ${cleanDbValue(email)}, ${cleanDbValue(employees)}, ${cleanDbValue(website)})
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
            }
            catch (err) {
                console.error("CRITICAL API ERROR (POST):", err);
                return res.status(500).json({ error: err.message || 'POST failed' });
            }
        }
        // PUT: Update company
        if (req.method === 'PUT') {
            try {
                const { ...updates } = req.body;
                const targetId = id;
                const existingData = await sql `SELECT * FROM companies WHERE id = ${targetId}`;
                if (!existingData || existingData.length === 0)
                    return res.status(404).json({ error: 'Not found' });
                await sql `
          UPDATE companies 
          SET 
            name         = ${updates.name ?? existingData[0].name},
            industry     = ${updates.industry !== undefined ? cleanDbValue(updates.industry) : existingData[0].industry},
            city         = ${updates.city !== undefined ? cleanDbValue(updates.city) : existingData[0].city},
            contact_name = ${updates.contact_name !== undefined ? cleanDbValue(updates.contact_name) : existingData[0].contact_name},
            phone        = ${updates.phone !== undefined ? cleanDbValue(updates.phone) : existingData[0].phone},
            email        = ${updates.email !== undefined ? cleanDbValue(updates.email) : existingData[0].email},
            employees    = ${updates.employees !== undefined ? cleanDbValue(updates.employees) : existingData[0].employees},
            website      = ${updates.website !== undefined ? cleanDbValue(updates.website) : existingData[0].website}
          WHERE id = ${targetId}
        `;
                return res.status(200).json({ success: true });
            }
            catch (err) {
                console.error("CRITICAL API ERROR (PUT):", err);
                return res.status(500).json({ error: err.message || 'PUT failed' });
            }
        }
        // DELETE: Remove company
        if (req.method === 'DELETE') {
            try {
                await sql `DELETE FROM companies WHERE id = ${id}`;
                return res.status(200).json({ success: true });
            }
            catch (err) {
                console.error("CRITICAL API ERROR (DELETE):", err);
                return res.status(500).json({ error: err.message || 'DELETE failed' });
            }
        }
        return res.status(405).json({ error: 'Method not allowed' });
    }
    catch (error) {
        console.error("UNCAUGHT API EXCEPTION:", error);
        return res.status(500).json({ error: error.message || 'Unknown database error' });
    }
}
//# sourceMappingURL=companies.js.map