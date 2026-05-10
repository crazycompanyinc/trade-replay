import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { backtestApi } from '../services/backtest.service';
import type { BacktestSession } from '../types';
import { Plus, TrendingUp, TrendingDown, BarChart3, Target, Activity } from 'lucide-react';

export default function DashboardPage() {
  const [sessions, setSessions] = useState<BacktestSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const { data } = await backtestApi.getAll();
      if (data.success) setSessions(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: sessions.length,
    completed: sessions.filter((s) => s.status === 'completed').length,
    totalPnl: sessions.reduce((sum, s) => sum + (s.totalPnl || 0), 0),
    avgWinRate: sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.winRate || 0), 0) / sessions.filter(s => s.winRate).length
      : 0,
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm">Manage your backtest sessions</p>
        </div>
        <Link to="/backtest/new" className="btn-dark-primary flex items-center gap-2">
          <Plus size={16} /> New Session
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={stats.total.toString()} icon={BarChart3} color="blue" />
        <StatCard label="Completed" value={stats.completed.toString()} icon={Target} color="green" />
        <StatCard label="Total P&L" value={`$${stats.totalPnl.toFixed(2)}`} icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown} color={stats.totalPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Avg Win Rate" value={`${stats.avgWinRate.toFixed(1)}%`} icon={Activity} color="purple" />
      </div>

      {/* Sessions Table */}
      <div className="card-dark">
        <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="mx-auto mb-3 text-gray-600" size={48} />
            <p className="mb-2">No backtest sessions yet</p>
            <Link to="/backtest/new" className="text-blue-400 hover:text-blue-300 text-sm">Create your first session</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Symbol</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Trades</th>
                  <th className="pb-3 font-medium">P&L</th>
                  <th className="pb-3 font-medium">Win Rate</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3">
                      <Link to={`/backtest/${s.id}`} className="text-blue-400 hover:text-blue-300 font-medium">
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-3">{s.symbol}</td>
                    <td className="py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3">{s._count?.trades ?? s.totalTrades}</td>
                    <td className={`py-3 font-medium ${(s.totalPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {s.totalPnl !== null ? `$${s.totalPnl.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-3">{s.winRate !== null ? `${s.winRate.toFixed(1)}%` : '-'}</td>
                    <td className="py-3 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    red: 'bg-red-500/10 text-red-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };
  return (
    <div className="card-dark">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs">{label}</p>
          <p className="text-xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    running: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    aborted: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}
