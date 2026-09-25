const express = require('express');
const { Pool } = require('pg');
const amqp = require('amqplib');
const app = express(); app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 3002;
const RABBITMQ_URL = process.env.RABBITMQ_URL; const QUEUE = process.env.RABBITMQ_QUEUE || 'pedidos.events';
let channel;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function connectRabbit() {
  while (!channel) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      console.log(`RabbitMQ conectado. Cola: ${QUEUE}`);
    } catch (error) { console.error('Esperando RabbitMQ...', error.message); await sleep(3000); }
  }
}
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'pedidos-api' }));
app.post('/pedidos', async (req, res) => {
  try {
    const { clienteId, producto, cantidad, precio } = req.body;
    if (!clienteId || !producto || !cantidad || precio === undefined) return res.status(400).json({ error: 'clienteId, producto, cantidad y precio son obligatorios' });
    const { rows } = await pool.query('INSERT INTO pedidos (cliente_id, producto, cantidad, precio) VALUES ($1, $2, $3, $4) RETURNING *', [clienteId, producto, cantidad, precio]);
    const pedido = rows[0];
    const evento = { event: 'PedidoCreado', occurredAt: new Date().toISOString(), data: { pedidoId: pedido.id, clienteId: pedido.cliente_id, producto: pedido.producto, cantidad: pedido.cantidad, precio: Number(pedido.precio) } };
    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(evento)), { persistent: true });
    console.log(`[PedidoCreado] publicado para pedido #${pedido.id}`);
    res.status(201).json(pedido);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error interno' }); }
});
app.get('/pedidos', async (_req, res) => { const { rows } = await pool.query('SELECT * FROM pedidos ORDER BY id'); res.json(rows); });
app.get('/pedidos/:id', async (req, res) => { const { rows } = await pool.query('SELECT * FROM pedidos WHERE id = $1', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' }); res.json(rows[0]); });
app.listen(PORT, () => console.log(`Pedidos API escuchando en ${PORT}`));
connectRabbit();
