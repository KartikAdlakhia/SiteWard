import React, { useState, useEffect } from 'react';
import { Globe, Activity, Settings, Trash2, RefreshCw } from 'lucide-react';
import { triggerScan } from '../api';
import '../styles/WebsiteCard.css';

interface WebsiteCardProps {
  website: {
    id: string;
    name: string;
    url: string;
    health_score: number;
    status: 'healthy' | 'warning' | 'critical';
    last_scan: string;
  };
  onSelect: (website: any) => void;
  onDelete: (id: string) => void;
}

export function WebsiteCard({ website, onSelect, onDelete }: WebsiteCardProps) {
  const [scanning, setScanning] = useState(false);

  const getStatusColor = () => {
    switch (website.status) {
      case 'healthy':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'critical':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getHealthScoreClass = () => {
    if (website.health_score >= 80) return 'score-excellent';
    if (website.health_score >= 60) return 'score-good';
    if (website.health_score >= 40) return 'score-fair';
    return 'score-poor';
  };

  const handleScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setScanning(true);
    try {
      await triggerScan(website.id);
      // Refetch or update UI
    } catch (error) {
      console.error('Error triggering scan:', error);
    } finally {
      setScanning(false);
    }
  };

  const lastScanTime = website.last_scan
    ? new Date(website.last_scan).toLocaleString()
    : 'Never';

  return (
    <div
      className="website-card"
      onClick={() => onSelect(website)}
      style={{ borderTopColor: getStatusColor() }}
    >
      <div className="website-card-header">
        <div className="website-info">
          <Globe size={28} color={getStatusColor()} />
          <div>
            <h3 className="website-name">{website.name}</h3>
            <p className="website-url">{website.url}</p>
          </div>
        </div>
        <div className={`health-badge ${getHealthScoreClass()}`}>
          {website.health_score}
        </div>
      </div>

      <div className="website-card-body">
        <div className="status-indicator">
          <Activity size={16} color={getStatusColor()} />
          <span className={`status-text ${website.status}`}>{website.status}</span>
        </div>

        <div className="scan-info">
          <p className="scan-time">Last scan: {lastScanTime}</p>
        </div>
      </div>

      <div className="website-card-footer">
        <button
          className={`btn-scan ${scanning ? 'loading' : ''}`}
          onClick={handleScan}
          disabled={scanning}
          title="Run scan now"
        >
          <RefreshCw size={16} />
          {scanning ? 'Scanning...' : 'Scan'}
        </button>
        <button
          className="btn-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(website.id);
          }}
          title="Delete website"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
