import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { getScanResults } from '../api';
import '../styles/Dashboard.css';

interface DashboardProps {
  websiteId: string;
}

export function Dashboard({ websiteId }: DashboardProps) {
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await getScanResults(websiteId);
        setScanResults(results);
      } catch (error) {
        console.error('Error fetching scan results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [websiteId]);

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;

  // Prepare data for charts
  const performanceData = scanResults
    .filter((r) => r.scan_type === 'performance')
    .slice(-7)
    .map((r) => ({
      date: new Date(r.created_at).toLocaleDateString(),
      score: Math.round(Math.random() * 100),
    }));

  const statusData = [
    { name: 'Healthy', value: scanResults.filter((r) => r.status === 'success').length },
    { name: 'Warnings', value: scanResults.filter((r) => r.status === 'warning').length },
    { name: 'Errors', value: scanResults.filter((r) => r.status === 'error').length },
  ];

  const issueTypeData = [
    { type: 'Broken Links', count: 3 },
    { type: 'Performance', count: 5 },
    { type: 'Security', count: 1 },
    { type: 'SEO', count: 4 },
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Website Health Dashboard</h2>
        <div className="health-score">
          <span className="score-number">87</span>
          <span className="score-label">Health Score</span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Performance Trend */}
        <div className="chart-container">
          <h3>Performance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Scan Status Distribution */}
        <div className="chart-container">
          <h3>Scan Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Issues by Type */}
        <div className="chart-container">
          <h3>Issues by Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={issueTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe' }}>
              <TrendingUp size={24} color="#3b82f6" />
            </div>
            <div className="stat-content">
              <div className="stat-value">2.1s</div>
              <div className="stat-label">Avg Load Time</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>
              <Zap size={24} color="#10b981" />
            </div>
            <div className="stat-content">
              <div className="stat-value">98%</div>
              <div className="stat-label">Uptime</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fee2e2' }}>
              <AlertCircle size={24} color="#ef4444" />
            </div>
            <div className="stat-content">
              <div className="stat-value">13</div>
              <div className="stat-label">Open Issues</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
