const express = require('express');
const { Pool } = require('pg');

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'clientes-api'
  });
});

// Crear cliente
app.post('/clientes', async (req, res) => {
  const { nombre, email } = req.body;

  console.log('\n[CLIENTES] POST /clientes');
  console.log(`[CLIENTES] Recibido: nombre="${nombre}", email="${email}"`);

  try {
    if (!nombre || !email) {
      console.log('[CLIENTES] Error: faltan datos obligatorios');

      return res.status(400).json({
        error: 'nombre y email son obligatorios'
      });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO clientes (nombre, email)
      VALUES ($1, $2)
      RETURNING *
      `,
      [nombre, email]
    );

    console.log(`[CLIENTES] Cliente creado en PostgreSQL con ID ${rows[0].id}`);

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      console.log('[CLIENTES] Error: el email ya existe');

      return res.status(409).json({
        error: 'El email ya existe'
      });
    }

    console.error('[CLIENTES] Error interno:', error.message);

    res.status(500).json({
      error: 'Error interno'
    });
  }
});

// Obtener todos los clientes
app.get('/clientes', async (_req, res) => {
  console.log('\n[CLIENTES] GET /clientes');
  console.log('[CLIENTES] Consultando PostgreSQL...');

  try {
    const { rows } = await pool.query(
      'SELECT * FROM clientes ORDER BY id'
    );

    console.log(`[CLIENTES] Clientes encontrados: ${rows.length}`);

    res.json(rows);
  } catch (error) {
    console.error('[CLIENTES] Error consultando clientes:', error.message);

    res.status(500).json({
      error: 'Error interno'
    });
  }
});

// Obtener un cliente por ID
app.get('/clientes/:id', async (req, res) => {
  const { id } = req.params;

  console.log(`\n[CLIENTES] GET /clientes/${id}`);
  console.log(`[CLIENTES] Buscando cliente ${id} en PostgreSQL...`);

  try {
    const { rows } = await pool.query(
      'SELECT * FROM clientes WHERE id = $1',
      [id]
    );

    if (!rows[0]) {
      console.log(`[CLIENTES] Cliente ${id} no encontrado`);

      return res.status(404).json({
        error: 'Cliente no encontrado'
      });
    }

    console.log(
      `[CLIENTES] Cliente ${id} encontrado: "${rows[0].nombre}"`
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('[CLIENTES] Error consultando cliente:', error.message);

    res.status(500).json({
      error: 'Error interno'
    });
  }
});

app.listen(PORT, () => {
  console.log(`[CLIENTES] Clientes API escuchando en puerto ${PORT}`);
});