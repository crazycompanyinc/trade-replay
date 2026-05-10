import { useAuth } from '../hooks/useAuth.tsx';
import { User, Mail, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm">Manage your account</p>
      </div>

      <div className="card-dark space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{user?.username}</h2>
            <p className="text-gray-400 text-sm">{user?.email}</p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <User size={16} className="text-gray-500" />
            <span className="text-gray-400">Username:</span>
            <span>{user?.username}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail size={16} className="text-gray-500" />
            <span className="text-gray-400">Email:</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield size={16} className="text-gray-500" />
            <span className="text-gray-400">Role:</span>
            <span className="capitalize">{user?.role}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
