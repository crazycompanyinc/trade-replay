# Trade Replay

Plataforma de backtesting de trading con gráficas estilo TradingView. Similar a FXReplay.

## Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, lightweight-charts
- **Backend:** Node.js, Express, TypeScript, Zod, JWT, bcrypt
- **Database:** PostgreSQL + Prisma ORM

## Características

- Registro y login de usuarios (JWT)
- Sesiones de backtesting por símbolo/timeframe
- Gráfica de velas estilo TradingView (lightweight-charts)
- Motor de backtesting con estrategias configurables
- Gestión manual de trades (añadir/editar/eliminar)
- Resultados: P&L, win rate, max drawdown, Sharpe ratio
- Datos de mercado procedurales (sin API externa)
- 10 símbolos: Forex, Crypto, Stocks, Commodities

## Quick Start

### Opción A: Docker (recomendado)

```bash
cd trade-replay
docker compose up --build
```

Abre http://localhost:5173

Demo: `trader@tradereplay.com` / `demo123`

### Opción B: Local

**1. Base de datos:**
```bash
# Instalar PostgreSQL y crear DB "tradereplay"
```

**2. Backend:**
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

**3. Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/register | Registro |
| POST | /api/auth/login | Login |
| GET | /api/auth/profile | Perfil |
| GET | /api/sessions | Listar sesiones |
| POST | /api/sessions | Crear sesión |
| GET | /api/sessions/:id | Ver sesión |
| PUT | /api/sessions/:id | Actualizar sesión |
| DELETE | /api/sessions/:id | Eliminar sesión |
| GET | /api/sessions/:id/candles | Obtener velas |
| POST | /api/sessions/:id/load-data | Cargar datos de mercado |
| GET | /api/sessions/:id/trades | Listar trades |
| POST | /api/sessions/:id/trades | Crear trade |
| PUT | /api/sessions/:id/trades/:tradeId | Actualizar trade |
| DELETE | /api/sessions/:id/trades/:tradeId | Eliminar trade |
| POST | /api/sessions/:id/run | Ejecutar backtest |
| GET | /api/sessions/:id/results | Resultados |
| GET | /api/market/symbols | Símbolos disponibles |
| GET | /api/market/candles | Datos OHLCV |
| GET | /api/strategies | Estrategias |
| GET | /api/strategies/public | Estrategias públicas |

## Estructura

```
trade-replay/
├── frontend/          # React + Vite + lightweight-charts
├── backend/           # Express + Prisma + JWT
│   ├── prisma/        # Schema + seed
│   └── src/
│       ├── routes/    # API routes
│       ├── services/  # Business logic
│       ├── models/    # Zod schemas
│       └── middleware/# Auth + error handling
└── docker-compose.yml
```

## Despliegue

- Frontend: Vercel
- Backend: Vercel Serverless o Railway
- Database: Supabase o Railway PostgreSQL
