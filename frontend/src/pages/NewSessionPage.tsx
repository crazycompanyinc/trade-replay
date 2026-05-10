import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { backtestApi } from '../services/backtest.service';
import { marketApi } from '../services/market.service';
import { strategyApi } from '../services/strategy.service';
import type { MarketSymbol, Strategy } from '../types';
import { ArrowLeft } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.string().default('1h'),
  startBalance: z.number().positive().default(10000),
  strategyId: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function NewSessionPage() {
  const navigate = useNavigate();
  const [symbols, setSymbols] = useState<MarketSymbol[]>([]);
  const [timeframes, setTimeframes] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [creating, setCreating] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { timeframe: '1h', startBalance: 10000 },
  });

  useEffect(() => {
    Promise.all([
      marketApi.getSymbols(),
      marketApi.getTimeframes(),
      strategyApi.getPublic(),
    ]).then(([sym, tf, strat]) => {
      if (sym.data.success) setSymbols(sym.data.data);
      if (tf.data.success) setTimeframes(tf.data.data);
      if (strat.data.success) setStrategies(strat.data.data);
    });
  }, []);

  const onSubmit = async (data: Form) => {
    setCreating(true);
    try {
      const { data: res } = await backtestApi.create(data);
      if (res.success) {
        // Load market data
        await backtestApi.loadData(res.data.id, data.symbol, data.timeframe, 500);
        navigate(`/backtest/${res.data.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <h1 className="text-2xl font-bold mb-6">New Backtest Session</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="card-dark space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Session Name</label>
          <input {...register('name')} className="input-dark" placeholder="My EURUSD Strategy" />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Symbol</label>
            <select {...register('symbol')} className="input-dark">
              <option value="">Select symbol</option>
              {symbols.map((s) => (
                <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>
              ))}
            </select>
            {errors.symbol && <p className="text-red-400 text-xs mt-1">{errors.symbol.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Timeframe</label>
            <select {...register('timeframe')} className="input-dark">
              {timeframes.map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Starting Balance ($)</label>
            <input {...register('startBalance', { valueAsNumber: true })} type="number" className="input-dark" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Strategy (optional)</label>
            <select {...register('strategyId')} className="input-dark">
              <option value="">No strategy</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" disabled={creating} className="btn-dark-primary w-full">
          {creating ? 'Creating...' : 'Create Session'}
        </button>
      </form>
    </div>
  );
}
