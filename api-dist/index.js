// Vercel Serverless Backend with sql.js (SQLite WASM)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import initSqlJs from 'sql.js';
const JWT_SECRET = process.env.JWT_SECRET || 'tradereplay-jwt-secret-production';
const SALT_ROUNDS = 10;
let db = null;
async function initDb() {
    if (db)
        return db;
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      config TEXT NOT NULL DEFAULT '{}',
      is_public INTEGER DEFAULT 0,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS backtest_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT DEFAULT '1H',
      start_balance REAL DEFAULT 10000,
      end_balance REAL,
      total_pnl REAL,
      total_pnl_pct REAL,
      total_trades INTEGER DEFAULT 0,
      winning_trades INTEGER DEFAULT 0,
      losing_trades INTEGER DEFAULT 0,
      win_rate REAL,
      max_drawdown REAL,
      sharpe_ratio REAL,
      status TEXT DEFAULT 'draft',
      config TEXT,
      user_id TEXT NOT NULL REFERENCES users(id),
      strategy_id TEXT REFERENCES strategies(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES backtest_sessions(id),
      type TEXT NOT NULL CHECK(type IN ('long', 'short')),
      entry_price REAL NOT NULL,
      exit_price REAL,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      quantity REAL DEFAULT 1,
      stop_loss REAL,
      take_profit REAL,
      pnl REAL,
      pnl_pct REAL,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candles (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES backtest_sessions(id),
      time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL DEFAULT 0,
      UNIQUE(session_id, time)
    );
  `);
    // Seed if empty
    const count = db.exec('SELECT COUNT(*) FROM users');
    if (count.length === 0 || count[0].values[0][0] === 0) {
        const pw = bcrypt.hashSync('demo123', SALT_ROUNDS);
        db.run('INSERT INTO users (id, email, username, password, role) VALUES (?, ?, ?, ?, ?)', ['usr_admin_001', 'admin@tradereplay.com', 'admin', pw, 'admin']);
        db.run('INSERT INTO users (id, email, username, password, role) VALUES (?, ?, ?, ?, ?)', ['usr_trader_001', 'trader@tradereplay.com', 'trader', pw, 'user']);
        db.run('INSERT INTO users (id, email, username, password, role) VALUES (?, ?, ?, ?, ?)', ['usr_demo_001', 'demo@tradereplay.com', 'demo', pw, 'user']);
        db.run('INSERT INTO strategies (id, name, description, config, is_public, user_id) VALUES (?, ?, ?, ?, ?, ?)', ['str_001', 'Moving Average Crossover', 'Buy when fast MA crosses above slow MA', JSON.stringify({ indicators: [{ type: 'SMA', period: 20 }, { type: 'SMA', period: 50 }] }), 1, 'usr_admin_001']);
        db.run('INSERT INTO strategies (id, name, description, config, is_public, user_id) VALUES (?, ?, ?, ?, ?, ?)', ['str_002', 'RSI Reversal', 'Buy when RSI oversold (<30)', JSON.stringify({ indicators: [{ type: 'RSI', period: 14 }] }), 1, 'usr_admin_001']);
        // Generate demo sessions with candles
        const symbols = [{ s: 'EURUSD', b: 1.0850, v: 0.0020 }, { s: 'BTCUSD', b: 42000, v: 800 }, { s: 'AAPL', b: 178, v: 3 }];
        for (const sym of symbols) {
            const sid = `sess_${sym.s.toLowerCase()}_001`;
            db.run('INSERT INTO backtest_sessions (id, name, symbol, timeframe, start_balance, status, user_id, strategy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [sid, `${sym.s} Demo`, sym.s, '1H', 10000, 'completed', 'usr_trader_001', 'str_001']);
            let price = sym.b;
            const now = Math.floor(Date.now() / 1000);
            for (let i = 0; i < 500; i++) {
                const time = now - (500 - i) * 3600;
                const change = (Math.random() - 0.48) * sym.v;
                const open = price;
                const close = price + change;
                const high = Math.max(open, close) + Math.random() * sym.v * 0.5;
                const low = Math.min(open, close) - Math.random() * sym.v * 0.5;
                db.run('INSERT OR IGNORE INTO candles (id, session_id, time, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [`cand_${sid}_${i}`, sid, time, open, high, low, close, Math.floor(Math.random() * 10000) + 500]);
                price = close;
            }
        }
    }
    return db;
}
function generateId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}
function get(sql, params = []) {
    const results = all(sql, params);
    return results[0] || null;
}
function run(sql, params = []) {
    db.run(sql, params);
}
// Express app
const app = express();
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
// Initialize DB on first request
let dbReady = false;
app.use(async (_, __, next) => {
    if (!dbReady) {
        await initDb();
        dbReady = true;
    }
    next();
});
// Health check
app.get('/api/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'trade-replay-api' });
});
// Auth middleware
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    try {
        const token = authHeader.substring(7);
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    }
    catch {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}
// Zod schemas
const registerSchema = z.object({ email: z.string().email(), username: z.string().min(3).max(30), password: z.string().min(6) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const createSessionSchema = z.object({ name: z.string().min(1).max(100), symbol: z.string().min(1), timeframe: z.string().default('1H'), startBalance: z.number().positive().default(10000), strategyId: z.string().optional() });
const createTradeSchema = z.object({ type: z.enum(['long', 'short']), entryPrice: z.number().positive(), exitPrice: z.number().positive().optional(), entryTime: z.string(), exitTime: z.string().optional(), quantity: z.number().positive().default(1), stopLoss: z.number().positive().optional(), takeProfit: z.number().positive().optional(), notes: z.string().optional() });
// Auth routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);
        const existing = get('SELECT id FROM users WHERE email = ? OR username = ?', [data.email, data.username]);
        if (existing)
            return res.status(409).json({ success: false, error: 'Email or username already exists' });
        const id = generateId();
        const password = await bcrypt.hash(data.password, SALT_ROUNDS);
        run('INSERT INTO users (id, email, username, password) VALUES (?, ?, ?, ?)', [id, data.email, data.username, password]);
        const token = jwt.sign({ id, email: data.email, username: data.username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, data: { user: { id, email: data.email, username: data.username, role: 'user' }, token } });
    }
    catch (err) {
        if (err instanceof z.ZodError)
            return res.status(400).json({ success: false, error: 'Validation error', details: err.errors });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.post('/api/auth/login', async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);
        const user = get('SELECT * FROM users WHERE email = ?', [data.email]);
        if (!user || !await bcrypt.compare(data.password, user.password)) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, data: { user: { id: user.id, email: user.email, username: user.username, role: user.role }, token } });
    }
    catch (err) {
        if (err instanceof z.ZodError)
            return res.status(400).json({ success: false, error: 'Validation error', details: err.errors });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.get('/api/auth/profile', authenticate, (req, res) => {
    const user = get('SELECT id, email, username, role, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user)
        return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
});
// Sessions CRUD
app.get('/api/sessions', authenticate, (req, res) => {
    const sessions = all('SELECT s.*, COUNT(t.id) as trade_count FROM backtest_sessions s LEFT JOIN trades t ON t.session_id = s.id WHERE s.user_id = ? GROUP BY s.id ORDER BY s.created_at DESC', [req.user.id]);
    res.json({ success: true, data: sessions });
});
app.post('/api/sessions', authenticate, (req, res) => {
    try {
        const data = createSessionSchema.parse(req.body);
        const id = generateId();
        run('INSERT INTO backtest_sessions (id, name, symbol, timeframe, start_balance, user_id, strategy_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, data.name, data.symbol, data.timeframe, data.startBalance, req.user.id, data.strategyId || null]);
        res.status(201).json({ success: true, data: { id, ...data, status: 'draft', userId: req.user.id } });
    }
    catch (err) {
        if (err instanceof z.ZodError)
            return res.status(400).json({ success: false, error: 'Validation error', details: err.errors });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.get('/api/sessions/:id', authenticate, (req, res) => {
    const session = get('SELECT * FROM backtest_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!session)
        return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: session });
});
app.delete('/api/sessions/:id', authenticate, (req, res) => {
    const session = get('SELECT id FROM backtest_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!session)
        return res.status(404).json({ success: false, error: 'Session not found' });
    run('DELETE FROM candles WHERE session_id = ?', [req.params.id]);
    run('DELETE FROM trades WHERE session_id = ?', [req.params.id]);
    run('DELETE FROM backtest_sessions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Session deleted' });
});
// Candles
app.get('/api/sessions/:id/candles', authenticate, (req, res) => {
    const candles = all('SELECT time, open, high, low, close, volume FROM candles WHERE session_id = ? ORDER BY time ASC', [req.params.id]);
    res.json({ success: true, data: candles });
});
app.post('/api/sessions/:id/load-data', authenticate, (req, res) => {
    const session = get('SELECT * FROM backtest_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!session)
        return res.status(404).json({ success: false, error: 'Session not found' });
    const { symbol, count } = req.body;
    const sym = symbol || session.symbol;
    const cnt = count || 500;
    const symbols = { EURUSD: [1.0850, 0.0020], BTCUSD: [42000, 800], AAPL: [178, 3], GOLD: [2020, 20], GBPUSD: [1.2650, 0.0025], USDJPY: [150.50, 0.5], ETHUSD: [2250, 80], GOOGL: [140, 2.5], TSLA: [245, 8], SILVER: [24.5, 0.5] };
    const [basePrice, volatility] = symbols[sym] || [100, 1];
    run('DELETE FROM candles WHERE session_id = ?', [req.params.id]);
    let price = basePrice;
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < cnt; i++) {
        const time = now - (cnt - i) * 3600;
        const change = (Math.random() - 0.48) * volatility;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;
        run('INSERT OR IGNORE INTO candles (id, session_id, time, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [`cand_${req.params.id}_${i}`, req.params.id, time, open, high, low, close, Math.floor(Math.random() * 10000) + 500]);
        price = close;
    }
    res.json({ success: true, data: { loaded: cnt } });
});
// Trades
app.get('/api/sessions/:id/trades', authenticate, (req, res) => {
    const trades = all('SELECT * FROM trades WHERE session_id = ? ORDER BY entry_time ASC', [req.params.id]);
    res.json({ success: true, data: trades });
});
app.post('/api/sessions/:id/trades', authenticate, (req, res) => {
    try {
        const data = createTradeSchema.parse(req.body);
        const id = generateId();
        run('INSERT INTO trades (id, session_id, type, entry_price, exit_price, entry_time, exit_time, quantity, stop_loss, take_profit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, req.params.id, data.type, data.entryPrice, data.exitPrice || null, data.entryTime, data.exitTime || null, data.quantity, data.stopLoss || null, data.takeProfit || null, data.notes || null]);
        res.status(201).json({ success: true, data: { id, sessionId: req.params.id, status: 'open' } });
    }
    catch (err) {
        if (err instanceof z.ZodError)
            return res.status(400).json({ success: false, error: 'Validation error', details: err.errors });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.delete('/api/sessions/:id/trades/:tradeId', authenticate, (req, res) => {
    run('DELETE FROM trades WHERE id = ? AND session_id = ?', [req.params.tradeId, req.params.id]);
    res.json({ success: true, message: 'Trade deleted' });
});
// Run backtest
app.post('/api/sessions/:id/run', authenticate, (req, res) => {
    const session = get('SELECT * FROM backtest_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!session)
        return res.status(404).json({ success: false, error: 'Session not found' });
    const candles = all('SELECT * FROM candles WHERE session_id = ? ORDER BY time ASC', [req.params.id]);
    if (candles.length < 50)
        return res.status(400).json({ success: false, error: 'Need at least 50 candles' });
    run('DELETE FROM trades WHERE session_id = ?', [req.params.id]);
    let balance = session.start_balance;
    let position = null;
    const trades = [];
    const fastPeriod = 10, slowPeriod = 30;
    for (let i = slowPeriod; i < candles.length; i++) {
        const fastMA = candles.slice(i - fastPeriod, i).reduce((s, c) => s + c.close, 0) / fastPeriod;
        const slowMA = candles.slice(i - slowPeriod, i).reduce((s, c) => s + c.close, 0) / slowPeriod;
        const prevFastMA = candles.slice(i - fastPeriod - 1, i - 1).reduce((s, c) => s + c.close, 0) / fastPeriod;
        const prevSlowMA = candles.slice(i - slowPeriod - 1, i - 1).reduce((s, c) => s + c.close, 0) / slowPeriod;
        const candle = candles[i];
        if (position) {
            let exitPrice = null;
            if (position.type === 'long') {
                if (position.stopLoss && candle.low <= position.stopLoss)
                    exitPrice = position.stopLoss;
                else if (position.takeProfit && candle.high >= position.takeProfit)
                    exitPrice = position.takeProfit;
            }
            else {
                if (position.stopLoss && candle.high >= position.stopLoss)
                    exitPrice = position.stopLoss;
                else if (position.takeProfit && candle.low <= position.takeProfit)
                    exitPrice = position.takeProfit;
            }
            if (exitPrice) {
                const pnl = position.type === 'long' ? (exitPrice - position.entryPrice) * position.quantity : (position.entryPrice - exitPrice) * position.quantity;
                balance += pnl;
                trades.push({ type: position.type, entryPrice: position.entryPrice, exitPrice, pnl, quantity: position.quantity });
                position = null;
            }
        }
        if (!position) {
            if (prevFastMA <= prevSlowMA && fastMA > slowMA) {
                position = { type: 'long', entryPrice: candle.open, quantity: 1, stopLoss: candle.open * 0.98, takeProfit: candle.open * 1.04 };
            }
            else if (prevFastMA >= prevSlowMA && fastMA < slowMA) {
                position = { type: 'short', entryPrice: candle.open, quantity: 1, stopLoss: candle.open * 1.02, takeProfit: candle.open * 0.96 };
            }
        }
    }
    for (const t of trades) {
        run('INSERT INTO trades (id, session_id, type, entry_price, exit_price, entry_time, exit_time, quantity, pnl, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [generateId(), req.params.id, t.type, t.entryPrice, t.exitPrice, new Date().toISOString(), new Date().toISOString(), t.quantity, t.pnl, 'closed']);
    }
    const winningTrades = trades.filter((t) => t.pnl > 0).length;
    const losingTrades = trades.filter((t) => t.pnl < 0).length;
    const totalPnl = balance - session.start_balance;
    run('UPDATE backtest_sessions SET status = ?, end_balance = ?, total_pnl = ?, total_pnl_pct = ?, total_trades = ?, winning_trades = ?, losing_trades = ?, win_rate = ? WHERE id = ?', ['completed', balance, totalPnl, (totalPnl / session.start_balance) * 100, trades.length, winningTrades, losingTrades, trades.length > 0 ? (winningTrades / trades.length) * 100 : 0, req.params.id]);
    res.json({ success: true, data: { totalTrades: trades.length, winningTrades, losingTrades, totalPnl, winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0 } });
});
// Results
app.get('/api/sessions/:id/results', authenticate, (req, res) => {
    const session = get('SELECT * FROM backtest_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!session)
        return res.status(404).json({ success: false, error: 'Session not found' });
    const trades = all('SELECT * FROM trades WHERE session_id = ? ORDER BY entry_time ASC', [req.params.id]);
    res.json({ success: true, data: { session, trades, summary: { totalTrades: session.total_trades, winningTrades: session.winning_trades, losingTrades: session.losing_trades, winRate: session.win_rate, totalPnl: session.total_pnl, startBalance: session.start_balance, endBalance: session.end_balance } } });
});
// Market data
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
        ] });
});
app.get('/api/market/candles', (req, res) => {
    const symbol = req.query.symbol;
    const count = parseInt(req.query.count) || 500;
    if (!symbol)
        return res.status(400).json({ success: false, error: 'Symbol required' });
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
    const strategies = all('SELECT * FROM strategies WHERE is_public = 1');
    res.json({ success: true, data: strategies });
});
app.get('/api/strategies', authenticate, (req, res) => {
    const strategies = all('SELECT * FROM strategies WHERE user_id = ? OR is_public = 1', [req.user.id]);
    res.json({ success: true, data: strategies });
});
// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});
export default app;
