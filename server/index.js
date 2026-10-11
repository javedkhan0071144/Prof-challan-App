import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
}) : null;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
async function ready() {
  if (!pool) return;
  await pool.query(schema);
}
function money(n) { return Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function normalize(body) {
  return {
    business_name: String(body.business_name || '').trim(),
    category: String(body.category || '').trim(),
    sub_category: String(body.sub_category || '').trim(),
    financial_from_to: String(body.financial_from_to || '').trim(),
    current_year_amount: Number(body.current_year_amount || 0),
    arrears_amount: Number(body.arrears_amount || 0),
    last_date: body.last_date || null
  };
}
function validate(row) {
  if (!row.business_name) return 'Business Name is required.';
  if (!Number.isFinite(row.current_year_amount) || row.current_year_amount < 0) return 'Current Year Amount must be a valid non-negative number.';
  if (!Number.isFinite(row.arrears_amount) || row.arrears_amount < 0) return 'Arrears Amount must be a valid non-negative number.';
  return null;
}
app.get('/api/health', async (_req, res) => {
  try { if (!pool) return res.status(503).json({ ok: false, message: 'DATABASE_URL is not configured.' }); await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (e) { res.status(503).json({ ok: false, message: e.message }); }
});
app.get('/api/taxpayers', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const result = await pool.query(
      `SELECT id, sr_no, business_name, category, sub_category, financial_from_to,
       current_year_amount::float AS current_year_amount, arrears_amount::float AS arrears_amount,
       (current_year_amount + arrears_amount)::float AS total_amount, last_date
       FROM taxpayers
       WHERE ($1 = '' OR business_name ILIKE '%' || $1 || '%' OR category ILIKE '%' || $1 || '%' OR CAST(sr_no AS TEXT) = $1)
       ORDER BY sr_no NULLS LAST, id DESC`, [q]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/taxpayers', async (req, res) => {
  try {
    const row = normalize(req.body); const error = validate(row);
    if (error) return res.status(400).json({ error });
    const result = await pool.query(
      `INSERT INTO taxpayers (sr_no,business_name,category,sub_category,financial_from_to,current_year_amount,arrears_amount,last_date)
       VALUES (COALESCE($1,(SELECT COALESCE(MAX(sr_no),0)+1 FROM taxpayers)),$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,sr_no,business_name,category,sub_category,financial_from_to,current_year_amount::float,arrears_amount::float,(current_year_amount+arrears_amount)::float AS total_amount,last_date`,
      [req.body.sr_no ? Number(req.body.sr_no) : null,row.business_name,row.category,row.sub_category,row.financial_from_to,row.current_year_amount,row.arrears_amount,row.last_date]);
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'That Serial Number already exists.' : e.message }); }
});
app.put('/api/taxpayers/:id', async (req, res) => {
  try {
    const row = normalize(req.body); const error = validate(row);
    if (error) return res.status(400).json({ error });
    const result = await pool.query(
      `UPDATE taxpayers SET business_name=$1,category=$2,sub_category=$3,financial_from_to=$4,current_year_amount=$5,arrears_amount=$6,last_date=$7,updated_at=NOW()
       WHERE id=$8 RETURNING id,sr_no,business_name,category,sub_category,financial_from_to,current_year_amount::float,arrears_amount::float,(current_year_amount+arrears_amount)::float AS total_amount,last_date`,
      [row.business_name,row.category,row.sub_category,row.financial_from_to,row.current_year_amount,row.arrears_amount,row.last_date,req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Record not found.' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/taxpayers/:id', async (req, res) => {
  try { const r = await pool.query('DELETE FROM taxpayers WHERE id=$1', [req.params.id]); if (!r.rowCount) return res.status(404).json({ error: 'Record not found.' }); res.status(204).end(); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/taxpayers/import', async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length > 5000) return res.status(400).json({ error: 'Import is limited to 5,000 rows at a time.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let count = 0;
    for (const item of rows) {
      const row = normalize({
        business_name: item.business_name ?? item['Business Name'],
        category: item.category ?? item.Category,
        sub_category: item.sub_category ?? item['Sub Category'],
        financial_from_to: item.financial_from_to ?? item['Financial From & To'],
        current_year_amount: item.current_year_amount ?? item['Current Year Amount'] ?? item['Cr Year Amount'],
        arrears_amount: item.arrears_amount ?? item['Arrears Amount'] ?? item['Ars Amount'],
        last_date: item.last_date ?? item['Last Date']
      });
      if (!row.business_name || validate(row)) continue;
      const sr = Number(item.sr_no ?? item['Sr No']) || null;
      await client.query(
        `INSERT INTO taxpayers (sr_no,business_name,category,sub_category,financial_from_to,current_year_amount,arrears_amount,last_date)
         VALUES (COALESCE($1,(SELECT COALESCE(MAX(sr_no),0)+1 FROM taxpayers)),$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (sr_no) DO UPDATE SET business_name=EXCLUDED.business_name,category=EXCLUDED.category,sub_category=EXCLUDED.sub_category,financial_from_to=EXCLUDED.financial_from_to,current_year_amount=EXCLUDED.current_year_amount,arrears_amount=EXCLUDED.arrears_amount,last_date=EXCLUDED.last_date,updated_at=NOW()`,
        [sr,row.business_name,row.category,row.sub_category,row.financial_from_to,row.current_year_amount,row.arrears_amount,row.last_date]);
      count++;
    }
    await client.query('COMMIT'); res.json({ imported: count });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});
app.get('/api/taxpayers/:id/challan', async (req, res) => {
  try {
    const result = await pool.query('SELECT *, (current_year_amount+arrears_amount)::float AS total_amount FROM taxpayers WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Record not found.' });
    const t = result.rows[0];
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const copies = ['BANK COPY', 'DEPARTMENT COPY', 'TAXPAYER COPY'];
    const pageW = 297, margin = 7, gap = 3, cardW = (pageW - margin*2 - gap*2) / 3;
    copies.forEach((copy, i) => {
      const x = margin + i * (cardW + gap);
      pdf.setDrawColor(35, 70, 61); pdf.rect(x, 7, cardW, 194);
      pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.text('PROFESSIONAL TAX CHALLAN', x+cardW/2, 16, {align:'center'});
      pdf.setFontSize(9); pdf.text(copy, x+cardW/2, 23, {align:'center'});
      pdf.setFont('helvetica','normal'); pdf.setFontSize(8);
      const fields = [
        ['Serial No', String(t.sr_no ?? '')], ['Business Name', t.business_name], ['Category', t.category || ''],
        ['Sub Category', t.sub_category || ''], ['Financial Year', t.financial_from_to || ''],
        ['Current Year Amount', 'Rs. ' + money(t.current_year_amount)], ['Arrears Amount', 'Rs. ' + money(t.arrears_amount)],
        ['Total Amount', 'Rs. ' + money(t.total_amount)], ['Last Date', t.last_date ? new Date(t.last_date).toLocaleDateString('en-GB') : '']
      ];
      let y = 35;
      fields.forEach(([label, value]) => {
        pdf.setFont('helvetica','bold'); pdf.text(label, x+4, y);
        pdf.setFont('helvetica','normal');
        const lines = pdf.splitTextToSize(String(value), cardW-8);
        pdf.text(lines, x+4, y+5);
        y += 15;
      });
      pdf.setFontSize(7); pdf.text('Bank stamp / signature: __________________', x+4, 183);
      pdf.text('This is a system-generated challan.', x+4, 192);
    });
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="challan-${t.sr_no || t.id}.pdf"`);
    res.send(Buffer.from(pdf.output('arraybuffer')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const dist = path.resolve(__dirname, '../dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('*', (_req,res) => res.sendFile(path.join(dist,'index.html'))); }
app.listen(port, async () => {
  console.log(`Professional Tax API listening on port ${port}`);
  if (!pool) console.warn('DATABASE_URL is missing. Configure .env before using database features.');
  else try { await ready(); console.log('PostgreSQL schema ready.'); } catch (e) { console.error('Database setup failed:', e.message); }
});
