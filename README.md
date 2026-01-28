# Truco Argentino - Web App

Proyecto full-stack para Truco argentino con lobby, salas, juego en tiempo real, fichas y ranking.

## Requisitos
- Node.js 20+
- npm

## Cómo correr

### Backend + Frontend (servido por Express)

```bash
cd /Users/valentindoroszuk/truco_nuevo
npm install
npm run build
node dist/server.js
```

Abrí: `http://localhost:4000`

### Modo dev (backend)

```bash
cd /Users/valentindoroszuk/truco_nuevo
npm run dev
```

## Variables de entorno

- `PORT` (default: `4000`)
- `CORS_ORIGIN` (default: `*`)
- `INITIAL_CHIPS` (default: `10000`)
- `DB_PATH` (default: `./data/truco.sqlite`)

## Rutas frontend

- `/` → landing
- `/lobby`
- `/crear-mesa`
- `/unirse`
- `/mesa/:id`
- `/fichas`
- `/tienda`
- `/ranking`
- `/comunidad`
- `/soporte`

## Endpoints principales

- `POST /api/users` → crea usuario
- `GET /api/users/me` → user actual
- `GET /api/rooms` → lista de salas
- `POST /api/rooms` → crear sala
- `GET /api/chips/balance` → saldo
- `POST /api/chips/add` → sumar fichas
- `GET /api/ranking` → ranking

## WebSocket

Eventos principales:
- `rooms:list`
- `rooms:create`
- `rooms:join`
- `rooms:leave`
- `room:state`
- `rooms:update`
- `game:action`
- `game:state`

## Checklist de pruebas manuales

1. Abrir `http://localhost:4000/`
2. Click en **Jugar ahora** → debe ir a `/lobby`
3. En lobby, **Crear mesa** → `/crear-mesa`
4. Crear mesa → navega a `/mesa/:id` con juego en vivo
5. Abrir otra ventana con `/lobby` y unirse a la misma mesa
6. Jugar una mano (tirar carta, envido, truco, aceptar/rechazar)
7. Ver que la partida termina al llegar a 15/30
8. Ir a `/fichas` → saldo real
9. Ir a `/tienda` y comprar fichas → vuelve a `/fichas` con saldo actualizado
10. Ir a `/ranking` → ranking real

