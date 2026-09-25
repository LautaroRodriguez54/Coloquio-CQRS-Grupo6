const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 3001;
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'clientes-api' }));
app.post('/clientes', async (req, res) => {
  try {
    const { nombre, email } = req.body;
    if (!nombre || !email) return res.status(400).json({ error: 'nombre y email son obligatorios' });
    const { rows } = await pool.query('INSERT INTO clientes (nombre, email) VALUES ($1, $2) RETURNING *', [nombre, email]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'El email ya existe' });
    console.error(error); res.status(500).json({ error: 'Error interno' });
  }
});
app.get('/clientes', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id'); res.json(rows);
});
app.get('/clientes/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(rows[0]);
});
app.listen(PORT, () => console.log(`Clientes API escuchando en ${PORT}`));
