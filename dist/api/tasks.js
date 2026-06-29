"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const serverless_1 = require("@neondatabase/serverless");
// Mock data for demo mode
const MOCK_TASKS = [
    { id: '1', title: 'Follow up with Rahul Sharma', related: 'TechCorp India', due_date: '2026-07-01', priority: 'high', status: 'pending', created_at: '2026-06-20T10:00:00Z' },
    { id: '2', title: 'Prepare proposal for LED Wall', related: 'MediaHouse Pvt Ltd', due_date: '2026-07-05', priority: 'medium', status: 'in progress', created_at: '2026-06-21T14:00:00Z' },
    { id: '3', title: 'Send quotation to Hotel Grand', related: 'Hotel Grand', due_date: '2026-06-28', priority: 'high', status: 'pending', created_at: '2026-06-22T09:00:00Z' },
];
async function handler(req, res) {
    const id = req.query.id || req.body?.id;
    if ((req.method === 'PUT' || req.method === 'DELETE') && !id) {
        return res.status(400).json({ error: "Missing required ID for this operation" });
    }
    try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            if (req.method === 'GET') {
                return res.status(200).json(MOCK_TASKS);
            }
            return res.status(200).json({ success: true });
        }
        const sql = (0, serverless_1.neon)(dbUrl);
        // 1. Ensure table exists
        try {
            await sql `
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          related TEXT,
          due_date TEXT,
          priority TEXT,
          status TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
        }
        catch (err) {
            console.warn('Table creation warning:', err);
        }
        // 2. GET
        if (req.method === 'GET') {
            try {
                const data = await sql `SELECT * FROM tasks ORDER BY created_at DESC`;
                return res.status(200).json(data || []);
            }
            catch (err) {
                return res.status(200).json([]);
            }
        }
        // 3. POST
        if (req.method === 'POST') {
            try {
                const { id, title, related, due_date, priority, status } = req.body || {};
                if (!title) {
                    return res.status(400).json({ error: 'title is required.' });
                }
                await sql `
          INSERT INTO tasks (id, title, related, due_date, priority, status)
          VALUES (${id}, ${title}, ${related || null}, ${due_date || null}, ${priority || 'medium'}, ${status || 'pending'})
        `;
                return res.status(200).json({ success: true });
            }
            catch (err) {
                return res.status(500).json({ error: err instanceof Error ? err.message : 'POST failed' });
            }
        }
        // 4. PUT
        if (req.method === 'PUT') {
            try {
                const { title, related, due_date, priority, status } = req.body || {};
                await sql `
          UPDATE tasks 
          SET title = ${title}, related = ${related}, due_date = ${due_date},
              priority = ${priority}, status = ${status}
          WHERE id = ${id}
        `;
                return res.status(200).json({ success: true });
            }
            catch (err) {
                return res.status(500).json({ error: err instanceof Error ? err.message : 'PUT failed' });
            }
        }
        // 5. DELETE
        if (req.method === 'DELETE') {
            try {
                await sql `DELETE FROM tasks WHERE id = ${id}`;
                return res.status(200).json({ success: true });
            }
            catch (err) {
                return res.status(500).json({ error: err instanceof Error ? err.message : 'DELETE failed' });
            }
        }
        return res.status(405).json({ error: 'Method not allowed' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Unknown database error' });
    }
}
//# sourceMappingURL=tasks.js.map