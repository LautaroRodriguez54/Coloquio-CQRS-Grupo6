const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3003;
const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB = process.env.MONGO_DB || 'consultas_db';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let collection;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'consultas-api' });
});

app.get('/consultas/pedidos', async (_req, res) => {
  try {
    const pedidos = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ pedidoId: 1 })
      .toArray();

    res.json(pedidos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error consultando la vista de lectura' });
  }
});

async function start() {
  const mongo = new MongoClient(MONGO_URL);

  while (true) {
    try {
      await mongo.connect();
      collection = mongo.db(MONGO_DB).collection('pedidos_detalle');
      console.log('MongoDB conectado para consultas.');
      break;
    } catch (error) {
      console.error('Esperando MongoDB...', error.message);
      await sleep(3000);
    }
  }

  app.listen(PORT, () => {
    console.log(`Consultas API escuchando en ${PORT}`);
  });
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
