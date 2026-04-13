import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Users,
  DollarSign,
  Activity,
  BarChart3,
  Check,
  X,
  Edit2,
  Trash2,
  Plus,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useAPI } from '../../hooks';
import api from '../../lib/api';

const AGENT_LIST = [
  { name: 'Evidence Analysis', id: 'evidence' },
  { name: 'Timeline Reconstruction', id: 'timeline' },
  { name: 'Witness Analysis', id: 'witness' },
  { name: 'Legal Knowledge', id: 'legal' },
  { name: 'Fact Reconstruction', id: 'fact' },
  { name: 'Argument Construction', id: 'argument' },
  { name: 'Complexity Routing', id: 'complexity' },
  { name: 'Case Processing', id: 'case' },
  { name: 'Deliberation', id: 'deliberation' },
];

export default function AdminPanel() {
  const { showError, showNotification } = useAPI();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'judge' });
  const [editingUser, setEditingUser] = useState(null);
  const [costConfig, setCostConfig] = useState({
    perUserQuota: 1000,
    monthlyCap: 50000,
  });

  // Fetch initial data
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const healthRes = await api.getAdminHealth();
        setHealth(healthRes.data);
        setLastRefresh(new Date());
      } catch (err) {
        const msg = err.response?.data?.detail || 'failed to fetch health';
        showError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [showError]);

  // Refresh vector stores
  const handleRefreshVectorStore = async () => {
    try {
      setRefreshing(true);
      await api.refreshVectorStore('all');
      setLastRefresh(new Date());
      showNotification('Vector stores refreshed successfully', 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || 'failed to refresh vector stores';
      showError(msg);
    } finally {
      setRefreshing(false);
    }
  };

  // User management
  const addUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      showError('Please fill in all fields');
      return;
    }

    try {
      await api.manageUser('new', 'create', newUser);
      setUsers((prev) => [...prev, { id: Math.random(), ...newUser }]);
      setNewUser({ name: '', email: '', role: 'judge' });
      setShowAddUser(false);
      showNotification(`User "${newUser.name}" created successfully`, 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || 'failed to create user';
      showError(msg);
    }
  };

  const deactivateUser = async (userId) => {
    try {
      await api.manageUser(userId, 'deactivate');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showNotification('User deactivated successfully', 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || 'failed to deactivate user';
      showError(msg);
    }
  };

  // Cost configuration
  const updateCostConfig = async () => {
    try {
      await api.setConfig(costConfig);
      showNotification('Cost configuration updated', 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || 'failed to update cost config';
      showError(msg);
    }
  };

  if (loading) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-lg">
        <h1 className="text-3xl font-bold text-navy-900 mb-2">System Administration</h1>
        <p className="text-gray-600">Manage system health, users, costs, and configurations</p>
      </div>

      {/* Vector Store Management */}
      <div className="card-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-navy-900">Vector Store Management</h2>
              <p className="text-sm text-gray-600">Update knowledge base embeddings</p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <button
            onClick={handleRefreshVectorStore}
            disabled={refreshing}
            className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {refreshing ? (
              <>
                <div className="spinner w-4 h-4" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Refresh All Vector Stores
              </>
            )}
          </button>

          {lastRefresh && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              Last refreshed: {lastRefresh.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Agent Health */}
      <div className="card-lg">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-emerald-600" />
          <div>
            <h2 className="text-xl font-bold text-navy-900">Agent Health Status</h2>
            <p className="text-sm text-gray-600">Real-time performance metrics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {health?.agents && AGENT_LIST.map((agent) => {
            const agentData = health.agents.find((a) => a.id === agent.id) || {
              latency: 0,
              success_rate: 0,
              queue_depth: 0,
            };

            return (
              <div key={agent.id} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-navy-900 mb-3 text-sm">
                  {agent.name}
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Latency</span>
                    <span
                      className={`font-bold ${
                        agentData.latency < 1000
                          ? 'text-emerald-600'
                          : agentData.latency < 2000
                            ? 'text-amber-600'
                            : 'text-rose-600'
                      }`}
                    >
                      {agentData.latency}ms
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Success Rate</span>
                    <span
                      className={`font-bold ${
                        agentData.success_rate > 95
                          ? 'text-emerald-600'
                          : agentData.success_rate > 80
                            ? 'text-amber-600'
                            : 'text-rose-600'
                      }`}
                    >
                      {agentData.success_rate}%
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Queue Depth</span>
                    <span
                      className={`font-bold ${
                        agentData.queue_depth < 5
                          ? 'text-emerald-600'
                          : agentData.queue_depth < 15
                            ? 'text-amber-600'
                            : 'text-rose-600'
                      }`}
                    >
                      {agentData.queue_depth}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics */}
      <div className="card-lg">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-navy-900">System Analytics</h2>
            <p className="text-sm text-gray-600">Key performance indicators</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Total Cases Processed</p>
            <p className="text-3xl font-bold text-blue-700">
              {health?.analytics?.case_volume || 0}
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Avg Processing Time</p>
            <p className="text-3xl font-bold text-purple-700">
              {health?.analytics?.avg_processing_time || 0}s
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Avg Confidence</p>
            <p className="text-3xl font-bold text-emerald-700">
              {health?.analytics?.confidence_distribution || 0}%
            </p>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="card-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-xl font-bold text-navy-900">User Management</h2>
              <p className="text-sm text-gray-600">Add, edit, or deactivate users</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Add User Form */}
        {showAddUser && (
          <div className="border-t pt-4 mb-4 space-y-3">
            <input
              type="text"
              value={newUser.name}
              onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
              className="input-field"
            />
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email address"
              className="input-field"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
              className="input-field"
            >
              <option value="judge">Judge</option>
              <option value="senior_judge">Senior Judge</option>
              <option value="admin">Admin</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={addUser}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Create User
              </button>
              <button
                onClick={() => setShowAddUser(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="border-t pt-4 space-y-2">
          {users.length === 0 ? (
            <p className="text-gray-600 italic">No users added yet</p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-navy-900">{user.name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>

                <div className="flex gap-2">
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                    {user.role}
                  </span>
                  <button
                    onClick={() => deactivateUser(user.id)}
                    className="p-2 hover:bg-rose-100 rounded"
                    title="Deactivate"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cost Configuration */}
      <div className="card-lg">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="w-6 h-6 text-amber-600" />
          <div>
            <h2 className="text-xl font-bold text-navy-900">Cost Configuration</h2>
            <p className="text-sm text-gray-600">Set usage quotas and cost limits</p>
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Per-User Quota (tokens)
            </label>
            <input
              type="number"
              value={costConfig.perUserQuota}
              onChange={(e) =>
                setCostConfig((prev) => ({
                  ...prev,
                  perUserQuota: parseInt(e.target.value),
                }))
              }
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Monthly System Cap (tokens)
            </label>
            <input
              type="number"
              value={costConfig.monthlyCap}
              onChange={(e) =>
                setCostConfig((prev) => ({
                  ...prev,
                  monthlyCap: parseInt(e.target.value),
                }))
              }
              className="input-field"
            />
          </div>

          <button
            onClick={updateCostConfig}
            className="w-full px-6 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Save Cost Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
