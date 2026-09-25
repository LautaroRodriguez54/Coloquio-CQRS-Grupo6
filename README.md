# Mini e-commerce — Base de datos por servicio + CQRS

Demo para el coloquio de los temas 12 y 13.

## Arquitectura

- `clientes-api` + PostgreSQL `clientes_db`: dueño de los clientes.
- `pedidos-api` + PostgreSQL `pedidos_db`: dueño de los pedidos.
- `rabbitmq`: transporte del evento `PedidoCreado`.
- `consultas-api`: consume eventos, consulta Clientes por API y actúa como proyector.
- `consultas-api` + MongoDB: expone la vista de lectura `pedidos_detalle` sin JOIN.

Cada servicio accede únicamente a su propia base. La información combinada se materializa en MongoDB mediante eventos. La arquitectura mantiene tres servicios de aplicación, como plantea la guía: Clientes, Pedidos y Consultas/Proyector.

## Levantar

```bash
docker compose up --build
```

Servicios:
- Clientes API: http://localhost:3001
- Pedidos API: http://localhost:3002
- Consultas/Proyector: http://localhost:3003
- RabbitMQ: http://localhost:15672 (usuario `demo`, contraseña `demo`)

## Demo rápida

### 1. Crear cliente
```bash
curl -X POST http://localhost:3001/clientes -H "Content-Type: application/json" -d '{"nombre":"Juan Perez","email":"juan@email.com"}'
```

### 2. Crear pedido
```bash
curl -X POST http://localhost:3002/pedidos -H "Content-Type: application/json" -d '{"clienteId":1,"producto":"Teclado mecanico","cantidad":1,"precio":75000}'
```

### 3. Ver vista CQRS
```bash
curl http://localhost:3003/consultas/pedidos
```

### 4. Mostrar consistencia eventual
Detener el servicio que proyecta la vista:
```bash
docker compose stop consultas-api
```
Crear otro pedido. `pedidos_db` lo tendrá, pero la vista de MongoDB todavía no.

Levantarlo:
```bash
docker compose start consultas-api
```
El mensaje pendiente será procesado y el pedido aparecerá en `/consultas/pedidos`.

## Evento `PedidoCreado`

```json
{
  "event": "PedidoCreado",
  "occurredAt": "2026-09-24T00:00:00.000Z",
  "data": {
    "pedidoId": 1,
    "clienteId": 1,
    "producto": "Teclado mecanico",
    "cantidad": 1,
    "precio": 75000
  }
}
```
