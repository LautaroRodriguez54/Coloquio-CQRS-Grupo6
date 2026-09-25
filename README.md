# Mini e-commerce — Base de datos por servicio + CQRS

Demo para el coloquio de los temas 12 y 13.

## Arquitectura

- `clientes-api` + PostgreSQL `clientes_db`: dueño de los clientes.
- `pedidos-api` + PostgreSQL `pedidos_db`: dueño de los pedidos.
- `rabbitmq`: transporte del evento `PedidoCreado`.
- `proyector`: consume eventos, consulta Clientes por API y construye la vista de lectura.
- `consultas-api` + MongoDB: expone la vista de lectura `pedidos_detalle` sin JOIN.

Cada servicio accede únicamente a su propia base. La información combinada se materializa en MongoDB mediante eventos.
La consulta final obtiene los datos combinados desde MongoDB, sin realizar un `JOIN` entre las bases de los servicios.

## Levantar el proyecto

### Opción recomendada para una demo desde cero

Si se quieren eliminar los datos de pruebas anteriores y comenzar con las bases limpias:

> **Atención:** `docker compose down -v` elimina los volúmenes del proyecto, incluyendo los datos actuales de PostgreSQL y MongoDB.

```powershell
docker compose down -v --remove-orphans
docker compose up -d --build
docker compose ps
```

Si no se quieren borrar los datos existentes:

```powershell
docker compose up -d --build
docker compose ps
```

## Servicios

- Clientes API: http://localhost:3001
- Pedidos API: http://localhost:3002
- Consultas API: http://localhost:3003
- RabbitMQ Management: http://localhost:15672

RabbitMQ utiliza:

```text
Usuario: demo
Contraseña: demo
```

### Logs

Para la demo se recomienda usar Docker Desktop para observar los logs de:

- `clientes-api`
- `pedidos-api`
- `proyector`
- `consultas-api`

Los contenedores de PostgreSQL, MongoDB y RabbitMQ pueden dejarse sin visualizar para evitar ruido.

También se pueden consultar los logs desde PowerShell:

```powershell
docker compose logs -f
```

O solamente los de un servicio:

```powershell
docker compose logs -f clientes-api
docker compose logs -f pedidos-api
docker compose logs -f proyector
docker compose logs -f consultas-api
```

## Demo completa

Los siguientes comandos están pensados para **PowerShell** y utilizan `Invoke-RestMethod`.

### 1. Crear cliente

Con la base limpia, el primer cliente tendrá normalmente ID `1`.

```powershell
Invoke-RestMethod -Uri http://localhost:3001/clientes -Method Post -ContentType "application/json" -Body '{"nombre":"Juan Perez","email":"juan@email.com"}'
```

En los logs de `clientes-api` debería verse la creación del cliente en PostgreSQL.

### 2. Crear pedido

Usamos `clienteId: 1`.

```powershell
Invoke-RestMethod -Uri http://localhost:3002/pedidos -Method Post -ContentType "application/json" -Body '{"clienteId":1,"producto":"Teclado mecanico","cantidad":1,"precio":75000}'
```

### 3. Consultar la vista de lectura

```powershell
Invoke-RestMethod -Uri http://localhost:3003/consultas/pedidos -Method Get | ConvertTo-Json -Depth 10
```

El pedido debería aparecer con los datos combinados, por ejemplo:

```json
[
  {
    "pedidoId": 1,
    "clienteId": 1,
    "cliente": "Juan Perez",
    "producto": "Teclado mecanico",
    "cantidad": 1,
    "precio": 75000
  }
]
```

La información proviene de la vista de lectura en MongoDB, no de un `JOIN` entre PostgreSQL.

## Demostrar consistencia eventual

Esta es la parte principal de la demo de CQRS.

### 4. Detener el Proyector

```powershell
docker compose stop proyector
```

Los servicios de Clientes, Pedidos, RabbitMQ y Consultas continúan funcionando.

### 5. Crear otro pedido con el Proyector detenido

```powershell
Invoke-RestMethod -Uri http://localhost:3002/pedidos -Method Post -ContentType "application/json" -Body '{"clienteId":1,"producto":"Mouse gamer","cantidad":2,"precio":25000}'
```

El pedido se guarda en `pedidos_db`, pero el Proyector no está disponible para consumir el evento y actualizar MongoDB.

### 6. Comprobar RabbitMQ

Abrir:

http://localhost:15672

Entrar con:

```text
Usuario: demo
Contraseña: demo
```

Ir a:

```text
Queues and Streams → pedidos.events
```

Con el Proyector detenido debería aparecer un mensaje pendiente:

```text
Ready: 1
Unacked: 0
Total: 1
```

`Ready: 1` significa que hay un evento esperando ser consumido por un consumidor.

### 7. Consultar mientras el Proyector está detenido

```powershell
Invoke-RestMethod -Uri http://localhost:3003/consultas/pedidos -Method Get | ConvertTo-Json -Depth 10
```

El segundo pedido todavía **no debería aparecer**.

Esto demuestra la consistencia eventual

### 8. Levantar nuevamente el Proyector

```powershell
docker compose start proyector
```

Esperar unos segundos y observar los logs del Proyector y Clientes API.

RabbitMQ debería entregar el evento pendiente al Proyector.

En RabbitMQ, la cola debería volver a mostrar:

```text
Ready: 0
```

### 9. Consultar nuevamente

```powershell
Invoke-RestMethod -Uri http://localhost:3003/consultas/pedidos -Method Get | ConvertTo-Json -Depth 10
```

Ahora deberían aparecer los dos pedidos.

El segundo pedido pasó finalmente por:

```text
RabbitMQ → Proyector → MongoDB
```

## Evento `PedidoCreado`

El contrato utilizado para el evento es:

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

El evento contiene la información necesaria para que el Proyector pueda construir su vista de lectura.

## Qué conceptos demuestra la demo

### Tema 12 — Base de datos por servicio

Cada servicio es dueño de sus datos:

```text
Clientes API → clientes_db
Pedidos API  → pedidos_db
```

Ningún servicio realiza un `SELECT` directo sobre la base de otro servicio.

Si Pedidos necesita información del cliente, la obtiene mediante comunicación con `clientes-api` o mediante eventos.

### Tema 13 — CQRS

El modelo de escritura y el modelo de lectura están separados:

```text
Escritura:
Pedidos API → PostgreSQL

Lectura:
MongoDB → Consultas API
```

El Proyector recibe eventos y construye una vista de lectura desnormalizada que permite consultar pedidos junto con información del cliente sin realizar un `JOIN` entre bases de servicios diferentes.

### Consistencia eventual

La vista de lectura no necesariamente se actualiza en el mismo instante que el modelo de escritura.

La demostración con el Proyector detenido hace visible esta característica:

```text
PostgreSQL actualizado
        ↓
MongoDB todavía desactualizado
        ↓
Proyector vuelve
        ↓
Evento procesado
        ↓
MongoDB actualizado
```

## Notas

- CQRS no implica necesariamente Event Sourcing.
- Para operaciones que involucren varios servicios no existe una transacción ACID global en esta arquitectura. Saga es un patrón que puede utilizarse para coordinar este tipo de operaciones.
- Para mayor robustez en producción pueden utilizarse colas durables, reintentos y patrones como Outbox.
- Para un CRUD pequeño y simple, esta arquitectura puede ser innecesariamente compleja.
