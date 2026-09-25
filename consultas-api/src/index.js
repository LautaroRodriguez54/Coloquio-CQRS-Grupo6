const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();

const PORT = process.env.PORT || 3003;
const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB = process.env.MONGO_DB || 'consultas_db';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let collection;

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'consultas-api'
  });
});

// Consultar pedidos proyectados
app.get('/consultas/pedidos', async (_req, res) => {
  console.log('\n[CONSULTAS] GET /consultas/pedidos');
  console.log('[CONSULTAS] Consultando vista de lectura en MongoDB...');

  try {
    const pedidos = await collection
      .find(
        {},
        {
          projection: {
            _id: 0
          }
        }
      )
      .sort({
        pedidoId: 1
      })
      .toArray();

    console.log(
      `[CONSULTAS] Pedidos encontrados en la vista de lectura: ${pedidos.length}`
    );

    res.json(pedidos);
  } catch (error) {
    console.error(
      '[CONSULTAS] Error consultando MongoDB:',
      error.message
    );

    res.status(500).json({
      error: 'Error consultando la vista de lectura'
    });
  }
});

async function start() {
  const mongo = new MongoClient(MONGO_URL);

  while (true) {
    try {
      await mongo.connect();

      collection = mongo
        .db(MONGO_DB)
        .collection('pedidos_detalle');

      console.log('[CONSULTAS] MongoDB conectado para consultas.');

      break;
    } catch (error) {
      console.error(
        '[CONSULTAS] Esperando MongoDB...',
        error.message
      );

      await sleep(3000);
    }
  }

  app.listen(PORT, () => {
    console.log(
      `[CONSULTAS] Consultas API escuchando en puerto ${PORT}`
    );
  });
}

start().catch(error => {
  console.error('[CONSULTAS] Error al iniciar:', error);
  process.exit(1);
});