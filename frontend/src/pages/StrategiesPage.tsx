import { useEffect, useState } from 'react';
import { strategyApi } from '../services/strategy.service';
import type { Strategy } from '../types';
import { Plus, Edit3, Trash2 } from 'lucide-react';

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      const { data } = await strategyApi.getAll();
      if (data.success) setStrategies(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this strategy?')) return;
    await strategyApi.delete(id);
    loadStrategies();
  };

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Strategies</h1>
          <p className="text-gray-400 text-sm">Manage your trading strategies</p>
        </div>
        <button className="btn-dark-primary flex items-center gap-2">
          <Plus size={16} /> New Strategy
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {strategies.map((s) => (
          <div key={s.id} className="card-dark">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{s.name}</h3>
                {s.isPublic && <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">Public</span>}
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 text-gray-500 hover:text-blue-400 rounded"><Edit3 size={14} /></button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-3">{s.description || 'No description'}</p>
            <div className="text-xs text-gray-500">
              <span>Indicators: {s.config.indicators.map((i) => i.type).join(', ') || 'None'}</span>
            </div>
          </div>
        ))}
      </div>

      {strategies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No strategies yet. Create your first one.</p>
        </div>
      )}
    </div>
  );
}
