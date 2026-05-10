import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

import { errorHandler, notFound } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import backtestRoutes from './routes/backtest.routes';
import strategyRoutes from './routes/strategy.routes';
import marketRoutes from './routes/market.routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'trade-replay-api' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', backtestRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/market', marketRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Trade Replay API running on http://localhost:${PORT}`);
});

export default app;
