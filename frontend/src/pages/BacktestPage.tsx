import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type Time, ColorType } from 'lightweight-charts';
import { backtestApi } from '../services/backtest.service';
import type { BacktestSession, Candle, Trade, BacktestResults } from '../types';
import { ArrowLeft, Play, RotateCcw, TrendingUp, TrendingDown, Target, Activity, BarChart3, Plus, Trash2 , DollarSign } from 'lucide-react';

export default function BacktestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [session, setSession] = useState<BacktestSession | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [results, setResults] = useState<BacktestResults['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'trades' | 'results'>('chart');
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [newTrade, setNewTrade] = useState({ type: 'long' as 'long' | 'short', entryPrice: '', quantity: '1', stopLoss: '', takeProfit: '' });

  useEffect(() => {
    if (id) loadData();
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [id]);

  useEffect(() => {
    if (candles.length > 0 && chartContainerRef.current && !chartRef.current) {
      initChart();
    }
    if (candleSeriesRef.current && candles.length > 0) {
      const chartData: CandlestickData<Time>[] = candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candleSeriesRef.current.setData(chartData);

      if (volumeSeriesRef.current) {
        const volData = candles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
        }));
        volumeSeriesRef.current.setData(volData);
      }

      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  const initChart = () => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#758696', width: 1, style: 0 },
        horzLine: { color: '#758696', width: 1, style: 0 },
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [sessRes, candlesRes, tradesRes] = await Promise.all([
        backtestApi.getById(id),
        backtestApi.getCandles(id),
        backtestApi.getTrades(id),
      ]);

      if (sessRes.data.success) setSession(sessRes.data.data);
      if (candlesRes.data.success) setCandles(candlesRes.data.data);
      if (tradesRes.data.success) setTrades(tradesRes.data.data);

      if (sessRes.data.data.status === 'completed') {
        const resRes = await backtestApi.getResults(id);
        if (resRes.data.success) setResults(resRes.data.data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBacktest = async () => {
    if (!id) return;
    setRunning(true);
    try {
      await backtestApi.runBacktest(id);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const handleAddTrade = async () => {
    if (!id || !newTrade.entryPrice) return;
    try {
      await backtestApi.createTrade(id, {
        type: newTrade.type,
        entryPrice: parseFloat(newTrade.entryPrice),
        quantity: parseFloat(newTrade.quantity),
        stopLoss: newTrade.stopLoss ? parseFloat(newTrade.stopLoss) : null,
        takeProfit: newTrade.takeProfit ? parseFloat(newTrade.takeProfit) : null,
        entryTime: new Date().toISOString(),
        status: 'open',
      });
      setShowAddTrade(false);
      setNewTrade({ type: 'long', entryPrice: '', quantity: '1', stopLoss: '', takeProfit: '' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!id) return;
    await backtestApi.deleteTrade(id, tradeId);
    loadData();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return <div className="p-6 text-red-400">Session not found</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">{session.name}</h1>
            <p className="text-sm text-gray-400">{session.symbol} - {session.timeframe} - ${session.startBalance.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${session.status === 'completed' ? 'bg-green-500/20 text-green-400' : session.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {session.status}
          </span>
          <button onClick={handleRunBacktest} disabled={running} className="btn-dark-primary flex items-center gap-2 text-sm">
            {running ? <><RotateCcw size={14} className="animate-spin" /> Running...</> : <><Play size={14} /> Run Backtest</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(['chart', 'trades', 'results'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Chart Tab */}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          <div className="card-dark p-0 overflow-hidden">
            <div ref={chartContainerRef} className="w-full" style={{ minHeight: 500 }} />
            {candles.length === 0 && (
              <div className="flex items-center justify-center h-[500px] text-gray-500">
                <div className="text-center">
                  <BarChart3 className="mx-auto mb-2 text-gray-600" size={48} />
                  <p>No candle data loaded</p>
                  <button onClick={async () => {
                    if (id) {
                      await backtestApi.loadData(id, session.symbol, session.timeframe, 500);
                      loadData();
                    }
                  }} className="btn-dark-primary mt-3 text-sm">Load Market Data</button>
                </div>
              </div>
            )}
          </div>

          {/* Trade markers legend */}
          {trades.length > 0 && (
            <div className="card-dark">
              <h3 className="text-sm font-medium mb-2">Trade Markers</h3>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Long Entry</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> Short Entry</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500" /> Exit</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trades Tab */}
      {activeTab === 'trades' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Trades ({trades.length})</h2>
            <button onClick={() => setShowAddTrade(!showAddTrade)} className="btn-dark-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Add Trade
            </button>
          </div>

          {showAddTrade && (
            <div className="card-dark space-y-3">
              <h3 className="text-sm font-medium">New Trade</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <select value={newTrade.type} onChange={(e) => setNewTrade({ ...newTrade, type: e.target.value as 'long' | 'short' })} className="input-dark text-sm">
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
                <input value={newTrade.entryPrice} onChange={(e) => setNewTrade({ ...newTrade, entryPrice: e.target.value })} type="number" step="0.00001" placeholder="Entry Price" className="input-dark text-sm" />
                <input value={newTrade.quantity} onChange={(e) => setNewTrade({ ...newTrade, quantity: e.target.value })} type="number" step="0.01" placeholder="Quantity" className="input-dark text-sm" />
                <input value={newTrade.stopLoss} onChange={(e) => setNewTrade({ ...newTrade, stopLoss: e.target.value })} type="number" step="0.00001" placeholder="Stop Loss" className="input-dark text-sm" />
                <input value={newTrade.takeProfit} onChange={(e) => setNewTrade({ ...newTrade, takeProfit: e.target.value })} type="number" step="0.00001" placeholder="Take Profit" className="input-dark text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddTrade} className="btn-dark-primary text-sm">Save Trade</button>
                <button onClick={() => setShowAddTrade(false)} className="btn-dark-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}

          <div className="card-dark overflow-x-auto">
            {trades.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No trades yet. Run a backtest or add trades manually.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-800">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Entry</th>
                    <th className="pb-2 font-medium">Exit</th>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 font-medium">P&L</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.type === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                          {t.type === 'long' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {t.type}
                        </span>
                      </td>
                      <td className="py-2">{t.entryPrice.toFixed(5)}</td>
                      <td className="py-2">{t.exitPrice?.toFixed(5) || '-'}</td>
                      <td className="py-2">{t.quantity}</td>
                      <td className={`py-2 font-medium ${(t.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {t.pnl !== null ? `$${t.pnl.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${t.status === 'closed' ? 'bg-green-500/20 text-green-400' : t.status === 'open' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500 text-xs">{new Date(t.entryTime).toLocaleDateString()}</td>
                      <td className="py-2">
                        <button onClick={() => handleDeleteTrade(t.id)} className="text-gray-500 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          {!results || session.status !== 'completed' ? (
            <div className="card-dark text-center py-12">
              <BarChart3 className="mx-auto mb-3 text-gray-600" size={48} />
              <p className="text-gray-400 mb-2">No results yet</p>
              <p className="text-sm text-gray-500">Run the backtest to see results here</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ResultCard label="Total Trades" value={results.totalTrades.toString()} icon={BarChart3} />
                <ResultCard label="Win Rate" value={`${(results.winRate ?? 0).toFixed(1)}%`} icon={Target} color="green" />
                <ResultCard label="Total P&L" value={`$${(results.totalPnl ?? 0).toFixed(2)}`} icon={DollarSign} color={(results.totalPnl ?? 0) >= 0 ? 'green' : 'red'} />
                <ResultCard label="Max Drawdown" value={`${(results.maxDrawdown ?? 0).toFixed(2)}%`} icon={Activity} color="red" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card-dark">
                  <h3 className="text-sm font-medium mb-3">Performance Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Starting Balance</span><span>${results.startBalance.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Ending Balance</span><span>${(results.endBalance ?? 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Net Profit</span><span className={(results.totalPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>{(results.totalPnl ?? 0) >= 0 ? '+' : ''}${(results.totalPnl ?? 0).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Return</span><span className={(results.totalPnlPct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>{(results.totalPnlPct ?? 0) >= 0 ? '+' : ''}{(results.totalPnlPct ?? 0).toFixed(2)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Sharpe Ratio</span><span>{(results.sharpeRatio ?? 0).toFixed(2)}</span></div>
                  </div>
                </div>

                <div className="card-dark">
                  <h3 className="text-sm font-medium mb-3">Trade Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Winning Trades</span><span className="text-green-400">{results.winningTrades}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Losing Trades</span><span className="text-red-400">{results.losingTrades}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Win Rate</span><span>{(results.winRate ?? 0).toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Profit Factor</span><span>{results.winningTrades > 0 ? (results.winningTrades / Math.max(1, results.losingTrades)).toFixed(2) : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Max Drawdown</span><span className="text-red-400">{(results.maxDrawdown ?? 0).toFixed(2)}%</span></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ label, value, icon: Icon, color = 'blue' }: { label: string; value: string; icon: React.ElementType; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };
  return (
    <div className="card-dark">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={colors[color] || colors.blue} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={`text-xl font-bold ${colors[color] || colors.blue}`}>{value}</p>
    </div>
  );
}
