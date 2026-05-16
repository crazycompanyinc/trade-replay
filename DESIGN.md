# TradeSim — Backtest Platform Design Document

## Vision
A professional-grade backtesting platform with TradingView-style charts, indicator support, trade replay, and real-time strategy evaluation. Built for traders who need to validate strategies before going live.

## Stack
- **Framework:** Next.js 14 (App Router, SSR mode — NOT static export)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + custom CSS for chart dark theme
- **Charts:** `lightweight-charts` v4+ (TradingView official)
- **Auth:** JWT (stateless, httpOnly cookie via API route)
- **Data:** Procedural OHLCV generation (no external API dependency)
- **Deploy:** Vercel (SSR required for lightweight-charts interactivity)

## Architecture

```
/app
  /page.tsx              — Landing page (public)
  /layout.tsx            — Root layout
  /globals.css           — Tailwind + custom theme
  /(auth)
    /login/page.tsx      — Login
    /register/page.tsx   — Register
  /dashboard
    /page.tsx            — Session list + stats
  /backtest
    /new/page.tsx        — Create new session
    /[id]/page.tsx       — Full backtest workspace
  /api
    /auth/login/route.ts
    /auth/register/route.ts
    /auth/me/route.ts
    /sessions/route.ts
    /sessions/[id]/route.ts
    /sessions/[id]/candles/route.ts
    /sessions/[id]/trades/route.ts
    /sessions/[id]/run/route.ts
    /sessions/[id]/results/route.ts
    /market/symbols/route.ts
    /market/candles/route.ts
/lib
  /auth.ts               — JWT create/verify
  /db.ts                 — In-memory store (Vercel serverless compatible)
  /indicators.ts         — SMA, EMA, RSI, Bollinger Bands calculations
  /backtest-engine.ts    — Strategy simulation engine
  /ohlcv.ts              — Procedural candle generation
/components
  /chart/
    /TradingChart.tsx    — Main lightweight-charts wrapper
    /ChartIndicators.tsx — Indicator overlay management
    /ChartTrades.tsx     — Trade markers on chart
    /ReplayControls.tsx  — Play/pause/speed controls
  /dashboard/
    /SessionCard.tsx     — Session summary card
    /StatsOverview.tsx   — Dashboard stats
  /backtest/
    /TradePanel.tsx      — Trade entry/exit form
    /ResultsPanel.tsx    — Backtest results display
    /EquityChart.tsx     — Equity curve mini-chart
  /ui/
    /Button.tsx
    /Input.tsx
    /Select.tsx
    /Modal.tsx
```

## Chart Features (lightweight-charts)

### Core
- Candlestick series (green up, red down — TradingView colors)
- Volume histogram (green/red based on close vs open)
- Crosshair with price/time tooltip
- Zoom (scroll) + pan (drag)
- Time scale with proper formatting

### Indicators (overlay on price chart)
- SMA (Simple Moving Average) — configurable period
- EMA (Exponential Moving Average) — configurable period
- Bollinger Bands (20, 2σ default)

### Indicators (separate pane below)
- RSI (14 period) with 30/70 lines
- MACD (12, 26, 9)

### Replay Mode
- `setData()` for first 2 bars only
- `update()` for each subsequent bar (real-time feel)
- Play/pause/stop controls
- Speed: 1x, 2x, 5x, 10x
- Progress bar showing replay position
- NEVER use `setVisibleRange()` during replay (resets zoom)
- NEVER use `scrollToPosition()` (causes jumps)
- NEVER `setData()` with all data at replay start (shows future)

### Trade Visualization
- Entry markers (green triangle up for long, red triangle down for short)
- Exit markers (opposite)
- SL/TP horizontal lines
- P&L labels on close
- Trade connecting lines (entry → exit)

## Backtest Engine
- Moving Average Crossover strategy (default)
- RSI Reversal strategy
- Configurable: fast MA, slow MA, RSI period, SL %, TP %
- Calculates: total P&L, win rate, max drawdown, Sharpe ratio, profit factor

## Data
- 10 symbols: EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, AAPL, GOOGL, TSLA, GOLD, SILVER
- Procedural generation with realistic base prices and volatility
- 500 candles default per session, configurable up to 2000
- Timeframes: 1H (default), 4H, 1D

## Design System
- Dark theme (#131722 background — TradingView style)
- Accent: #2962ff (blue), #26a69a (green), #ef5350 (red)
- Font: Inter / system-ui
- Border-radius: 0.375rem (subtle, not rounded)
- Glow effects on interactive elements
- Grid lines: #1e222d
- Text: #d1d4dc primary, #787b86 secondary

## Critical Rules
1. lightweight-charts MUST be in a `'use client'` component
2. Chart container MUST have explicit width/height
3. Chart initialization ONLY in useEffect with ref check
4. Cleanup: `chart.remove()` on unmount
5. SSR: dynamic import with `ssr: false` for chart components
6. Vercel serverless: use in-memory store (no filesystem, no PostgreSQL)
7. Auth: JWT in httpOnly cookie set by API route, read from request headers
