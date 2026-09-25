const amqp = require('amqplib');
const { MongoClient } = require('mongodb');

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE = process.env.RABBITMQ_QUEUE || 'pedidos.events';
const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB = process.env.MONGO_DB || 'consultas_db';
const CLIENTES_API_URL = process.env.CLIENTES_API_URL;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let collection;

async function connectMongo() {
  while (true) {
    try {
      const mongo = new MongoClient(MONGO_URL);
      await mongo.connect();
      collection = mongo.db(MONGO_DB).collection('pedidos_detalle');
      console.log('MongoDB conectado. Coleccion: pedidos_detalle');
      return;
    } catch (error) {
      console.error('Esperando MongoDB...', error.message);
      await sleep(3000);
    }
  }
}

async function consume() {
  while (true) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      channel.prefetch(1);

      console.log(`Proyector escuchando ${QUEUE}`);

      channel.consume(QUEUE, async message => {
        if (!message) return;

        try {
          const evento = JSON.parse(message.content.toString());

          if (evento.event !== 'PedidoCreado') {
            channel.ack(message);
            return;
          }

          const { pedidoId, clienteId, producto, cantidad, precio } = evento.data;
          const response = await fetch(`${CLIENTES_API_URL}/clientes/${clienteId}`);

          if (!response.ok) {
            throw new Error(`Cliente ${clienteId} no encontrado`);
          }

          const cliente = await response.json();

          await collection.updateOne(
            { pedidoId },
            {
              $set: {
                pedidoId,
                clienteId,
                cliente: cliente.nombre,
                producto,
                cantidad,
                precio,
                proyectadoEn: new Date()
              }
            },
            { upsert: true }
          );

          console.log(`[Proyeccion] pedido #${pedidoId} -> ${cliente.nombre}`);
          channel.ack(message);
        } catch (error) {
          console.error('[Proyeccion] Error:', error.message);
          channel.nack(message, false, true);
        }
      });

      await new Promise(() => {});
    } catch (error) {
      console.error('RabbitMQ desconectado. Reintentando...', error.message);
      await sleep(3000);
    }
  }
}

async function start() {
  await connectMongo();
  await consume();
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
