// Vercel Serverless Backend - Pure JS
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tradereplay-jwt-secret-production';
const SALT_ROUNDS = 10;

// In-memory data store (resets on each cold start, but works for demo)
let db = { users: [], sessions: [], trades: [], candles: [], strategies: [] };

function initDb() {
  if (db.users.length > 0) return;
  const pw = bcrypt.hashSync('demo123', SALT_ROUNDS);
  db.users = [
    { id: 'usr_admin', email: 'admin@tradereplay.com', username: 'admin', password: pw, role: 'admin', created_at: new Date().toISOString() },
    { id: 'usr_trader', email: 'trader@tradereplay.com', username: 'trader', password: pw, role: 'user', created_at: new Date().toISOString() },
    { id: 'usr_demo', email: 'demo@tradereplay.com', username: 'demo', password: pw, role: 'user', created_at: new Date().toISOString() },
  ];
  db.strategies = [
    { id: 'str_001', name: 'Moving Average Crossover', description: 'Buy when fast MA crosses above slow MA', config: '{}', is_public: 1, user_id: 'usr_admin' },
    { id: 'str_002', name: 'RSI Reversal', description: 'Buy when RSI oversold (<30)', config: '{}', is_public: 1, user_id: 'usr_admin' },
  ];
  generateDemoData();
}

function generateDemoData() {
  const symbols = [{ s: 'EURUSD', b: 1.0850, v: 0.0020 }, { s: 'BTCUSD', b: 42000, v: 800 }, { s: 'AAPL', b: 178, v: 3 }];
  for (const sym of symbols) {
    const sid = `sess_${sym.s.toLowerCase()}`;
    db.sessions.push({ id: sid, name: `${sym.s} Demo`, symbol: sym.s, timeframe: '1H', start_balance: 10000, end_balance: 10000 + Math.random() * 500, total_pnl: Math.random() * 200, total_pnl_pct: Math.random() * 5, total_trades: 20 + Math.floor(Math.random() * 30), winning_trades: 10 + Math.floor(Math.random() * 15), losing_trades: 5 + Math.floor(Math.random() * 10), win_rate: 45 + Math.random() * 20, status: 'completed', user_id: 'usr_trader', strategy_id: 'str_001', created_at: new Date().toISOString() });
    let price = sym.b;
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 500; i++) {
      const time = now - (500 - i) * 3600;
      const change = (Math.random() - 0.48) * sym.v;
      const open = price;
      const close = price + change;
      db.candles.push({ id: `cand_${sid}_${i}`, session_id: sid, time, open, high: Math.max(open, close) + Math.random() * sym.v * 0.5, low: Math.min(open, close) - Math.random() * sym.v * 0.5, close, volume: Math.floor(Math.random() * 10000) + 500 });
      price = close;
    }
  }
}

function generateId() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => { initDb(); next(); });

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Auth required' });
  try { req.user = jwt.verify(authHeader.substring(7), JWT_SECRET); next(); } catch { res.status(401).json({ success: false, error: 'Invalid token' }); }
}

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ success: false, error: 'Missing fields' });
  if (db.users.find(u => u.email === email || u.username === username)) return res.status(409).json({ success: false, error: 'Already exists' });
  const id = generateId();
  db.users.push({ id, email, username, password: await bcrypt.hash(password, SALT_ROUNDS), role: 'user', created_at: new Date().toISOString() });
  const token = jwt.sign({ id, email, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ success: true, data: { user: { id, email, username, role: 'user' }, token } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email);
  if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ success: false, error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, data: { user: { id: user.id, email: user.email, username: user.username, role: user.role }, token } });
});

app.get('/api/auth/profile', authenticate, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: { id: user.id, email: user.email, username: user.username, role: user.role } });
});

// Sessions
app.get('/api/sessions', authenticate, (req, res) => {
  const sessions = db.sessions.filter(s => s.user_id === req.user.id).map(s => ({ ...s, trade_count: db.trades.filter(t => t.session_id === s.id).length }));
  res.json({ success: true, data: sessions });
});

app.post('/api/sessions', authenticate, (req, res) => {
  const { name, symbol, timeframe, startBalance } = req.body;
  const id = generateId();
  db.sessions.push({ id, name, symbol, timeframe: timeframe || '1H', start_balance: startBalance || 10000, status: 'draft', user_id: req.user.id, created_at: new Date().toISOString() });
  res.status(201).json({ success: true, data: { id, name, symbol, timeframe: timeframe || '1H', startBalance: startBalance || 10000, status: 'draft' } });
});

app.get('/api/sessions/:id', authenticate, (req, res) => {
  const session = db.sessions.find(s => s.id === req.params.id && s.user_id === req.user.id);
  if (!session) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: session });
});

app.delete('/api/sessions/:id', authenticate, (req, res) => {
  db.sessions = db.sessions.filter(s => !(s.id === req.params.id && s.user_id === req.user.id));
  db.candles = db.candles.filter(c => c.session_id !== req.params.id);
  db.trades = db.trades.filter(t => t.session_id !== req.params.id);
  res.json({ success: true, message: 'Deleted' });
});

// Candles
app.get('/api/sessions/:id/candles', authenticate, (req, res) => {
  const candles = db.candles.filter(c => c.session_id === req.params.id).sort((a, b) => a.time - b.time);
  res.json({ success: true, data: candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })) });
});

app.post('/api/sessions/:id/load-data', authenticate, (req, res) => {
  const session = db.sessions.find(s => s.id === req.params.id && s.user_id === req.user.id);
  if (!session) return res.status(404).json({ success: false, error: 'Not found' });
  const sym = req.body.symbol || session.symbol;
  const cnt = req.body.count || 500;
  const symbols = { EURUSD: [1.0850, 0.0020], BTCUSD: [42000, 800], AAPL: [178, 3], GOLD: [2020, 20], GBPUSD: [1.2650, 0.0025], USDJPY: [150.50, 0.5], ETHUSD: [2250, 80], GOOGL: [140, 2.5], TSLA: [245, 8], SILVER: [24.5, 0.5] };
  const [basePrice, volatility] = symbols[sym] || [100, 1];
  db.candles = db.candles.filter(c => c.session_id !== req.params.id);
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < cnt; i++) {
    const time = now - (cnt - i) * 3600;
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = price + change;
    db.candles.push({ id: `cand_${req.params.id}_${i}`, session_id: req.params.id, time, open, high: Math.max(open, close) + Math.random() * volatility * 0.5, low: Math.min(open, close) - Math.random() * volatility * 0.5, close, volume: Math.floor(Math.random() * 10000) + 500 });
    price = close;
  }
  res.json({ success: true, data: { loaded: cnt } });
});

// Trades
app.get('/api/sessions/:id/trades', authenticate, (req, res) => {
  const trades = db.trades.filter(t => t.session_id === req.params.id);
  res.json({ success: true, data: trades });
});

app.post('/api/sessions/:id/trades', authenticate, (req, res) => {
  const id = generateId();
  db.trades.push({ id, session_id: req.params.id, type: req.body.type, entry_price: req.body.entryPrice, exit_price: null, entry_time: req.body.entryTime || new Date().toISOString(), exit_time: null, quantity: req.body.quantity || 1, stop_loss: req.body.stopLoss || null, take_profit: req.body.takeProfit || null, pnl: null, status: 'open', notes: req.body.notes || null });
  res.status(201).json({ success: true, data: { id, status: 'open' } });
});

app.delete('/api/sessions/:id/trades/:tradeId', authenticate, (req, res) => {
  db.trades = db.trades.filter(t => !(t.id === req.params.tradeId && t.session_id === req.params.id));
  res.json({ success: true, message: 'Deleted' });
});

// Run backtest
app.post('/api/sessions/:id/run', authenticate, (req, res) => {
  const session = db.sessions.find(s => s.id === req.params.id && s.user_id === req.user.id);
  if (!session) return res.status(404).json({ success: false, error: 'Not found' });
  const candles = db.candles.filter(c => c.session_id === req.params.id).sort((a, b) => a.time - b.time);
  if (candles.length < 50) return res.status(400).json({ success: false, error: 'Need 50+ candles' });
  db.trades = db.trades.filter(t => t.session_id !== req.params.id);

  let balance = session.start_balance;
  let position = null;
  const trades = [];
  for (let i = 30; i < candles.length; i++) {
    const fastMA = candles.slice(i - 10, i).reduce((s, c) => s + c.close, 0) / 10;
    const slowMA = candles.slice(i - 30, i).reduce((s, c) => s + c.close, 0) / 30;
    const prevFast = candles.slice(i - 11, i - 1).reduce((s, c) => s + c.close, 0) / 10;
    const prevSlow = candles.slice(i - 31, i - 1).reduce((s, c) => s + c.close, 0) / 30;
    const candle = candles[i];

    if (position) {
      let exit = null;
      if (position.type === 'long') {
        if (position.stopLoss && candle.low <= position.stopLoss) exit = position.stopLoss;
        else if (position.takeProfit && candle.high >= position.takeProfit) exit = position.takeProfit;
      } else {
        if (position.stopLoss && candle.high >= position.stopLoss) exit = position.stopLoss;
        else if (position.takeProfit && candle.low <= position.takeProfit) exit = position.takeProfit;
      }
      if (exit) {
        const pnl = position.type === 'long' ? (exit - position.entryPrice) * position.quantity : (position.entryPrice - exit) * position.quantity;
        balance += pnl;
        trades.push({ type: position.type, entryPrice: position.entryPrice, exitPrice: exit, pnl, quantity: position.quantity });
        position = null;
      }
    }
    if (!position) {
      if (prevFast <= prevSlow && fastMA > slowMA) position = { type: 'long', entryPrice: candle.open, quantity: 1, stopLoss: candle.open * 0.98, takeProfit: candle.open * 1.04 };
      else if (prevFast >= prevSlow && fastMA < slowMA) position = { type: 'short', entryPrice: candle.open, quantity: 1, stopLoss: candle.open * 1.02, takeProfit: candle.open * 0.96 };
    }
  }

  for (const t of trades) {
    db.trades.push({ id: generateId(), session_id: req.params.id, type: t.type, entry_price: t.entryPrice, exit_price: t.exitPrice, entry_time: new Date().toISOString(), exit_time: new Date().toISOString(), quantity: t.quantity, pnl: t.pnl, status: 'closed' });
  }

  const winning = trades.filter(t => t.pnl > 0).length;
  const losing = trades.filter(t => t.pnl < 0).length;
  const totalPnl = balance - session.start_balance;

  session.status = 'completed';
  session.end_balance = balance;
  session.total_pnl = totalPnl;
  session.total_pnl_pct = (totalPnl / session.start_balance) * 100;
  session.total_trades = trades.length;
  session.winning_trades = winning;
  session.losing_trades = losing;
  session.win_rate = trades.length > 0 ? (winning / trades.length) * 100 : 0;

  res.json({ success: true, data: { totalTrades: trades.length, winningTrades: winning, losingTrades: losing, totalPnl, winRate: session.win_rate } });
});

// Results
app.get('/api/sessions/:id/results', authenticate, (req, res) => {
  const session = db.sessions.find(s => s.id === req.params.id && s.user_id === req.user.id);
  if (!session) return res.status(404).json({ success: false, error: 'Not found' });
  const trades = db.trades.filter(t => t.session_id === req.params.id);
  res.json({ success: true, data: { session, trades, summary: { totalTrades: session.total_trades, winningTrades: session.winning_trades, losingTrades: session.losing_trades, winRate: session.win_rate, totalPnl: session.total_pnl, startBalance: session.start_balance, endBalance: session.end_balance } } });
});

// Market
app.get('/api/market/symbols', (_, res) => {
  res.json({ success: true, data: [
    { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex' },
    { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'Forex' },
    { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'Forex' },
    { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', category: 'Crypto' },
    { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', category: 'Crypto' },
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'Stocks' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'Stocks' },
    { symbol: 'TSLA', name: 'Tesla Inc.', category: 'Stocks' },
    { symbol: 'GOLD', name: 'Gold Futures', category: 'Commodities' },
    { symbol: 'SILVER', name: 'Silver Futures', category: 'Commodities' },
  ]});
});

app.get('/api/market/candles', (req, res) => {
  const symbol = req.query.symbol;
  const count = parseInt(req.query.count) || 500;
  if (!symbol) return res.status(400).json({ success: false, error: 'Symbol required' });
  const symbols = { EURUSD: [1.0850, 0.0020], BTCUSD: [42000, 800], AAPL: [178, 3], GOLD: [2020, 20], GBPUSD: [1.2650, 0.0025], USDJPY: [150.50, 0.5], ETHUSD: [2250, 80], GOOGL: [140, 2.5], TSLA: [245, 8], SILVER: [24.5, 0.5] };
  const [basePrice, volatility] = symbols[symbol] || [100, 1];
  const candles = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * 3600;
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = price + change;
    candles.push({ time, open, high: Math.max(open, close) + Math.random() * volatility * 0.5, low: Math.min(open, close) - Math.random() * volatility * 0.5, close, volume: Math.floor(Math.random() * 10000) + 500 });
    price = close;
  }
  res.json({ success: true, data: candles });
});

// Strategies
app.get('/api/strategies/public', (_, res) => {
  res.json({ success: true, data: db.strategies.filter(s => s.is_public) });
});

app.get('/api/strategies', authenticate, (req, res) => {
  res.json({ success: true, data: db.strategies.filter(s => s.user_id === req.user.id || s.is_public) });
});

module.exports = app;
