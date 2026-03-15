import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Zap, Code, Eye, Lock } from 'lucide-react';
import { getIssues, updateIssueStatus, applyFix } from '../api';
import '../styles/IssuesList.css';

interface IssuesListProps {
  websiteId: string;
}

interface Issue {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
}

export function IssuesList({ websiteId }: IssuesListProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'critical'>('open');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const data = await getIssues(websiteId);
        setIssues(data);
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [websiteId]);

  const filteredIssues = issues.filter((issue) => {
    if (filter === 'all') return true;
    if (filter === 'open') return issue.status === 'open';
    if (filter === 'critical') return issue.severity === 'critical';
    return true;
  });

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'broken_link':
        return <Code size={20} />;
      case 'performance':
        return <Zap size={20} />;
      case 'security':
        return <Lock size={20} />;
      case 'seo':
        return <Eye size={20} />;
      default:
        return <AlertTriangle size={20} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#ef4444';
      case 'high':
        return '#f97316';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const handleResolve = async (issueId: string) => {
    try {
      await updateIssueStatus(issueId, 'resolved');
      setIssues((prev) => 
        prev.map((issue) => 
          issue.id === issueId ? { ...issue, status: 'resolved' } : issue
        )
      );
    } catch (error) {
      console.error('Error resolving issue:', error);
    }
  };

  const handleApplyFix = async (issueId: string) => {
    try {
      const result = await applyFix(issueId);
      console.log('Fix applied:', result);
      await updateIssueStatus(issueId, 'in_progress');
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId ? { ...issue, status: 'in_progress' } : issue
        )
      );
    } catch (error) {
      console.error('Error applying fix:', error);
    }
  };

  if (loading) return <div className="issues-loading">Loading issues...</div>;

  return (
    <div className="issues-container">
      <div className="issues-header">
        <h2>Issues & Alerts</h2>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'open' ? 'active' : ''}`}
            onClick={() => setFilter('open')}
          >
            Open ({issues.filter((i) => i.status === 'open').length})
          </button>
          <button
            className={`filter-btn ${filter === 'critical' ? 'active' : ''}`}
            onClick={() => setFilter('critical')}
          >
            Critical ({issues.filter((i) => i.severity === 'critical').length})
          </button>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({issues.length})
          </button>
        </div>
      </div>

      <div className="issues-list">
        {filteredIssues.length === 0 ? (
          <div className="no-issues">
            <CheckCircle size={48} color="#10b981" />
            <p>No issues found! Your website is looking good.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div key={issue.id} className="issue-card" style={{ borderLeftColor: getSeverityColor(issue.severity) }}>
              <div className="issue-header">
                <div className="issue-title-section">
                  <span className="issue-icon">{getIssueIcon(issue.type)}</span>
                  <div>
                    <h3 className="issue-title">{issue.title}</h3>
                    <p className="issue-description">{issue.description}</p>
                  </div>
                </div>
                <span className={`issue-severity ${issue.severity}`}>{issue.severity}</span>
              </div>

              <div className="issue-meta">
                <span className="issue-type">{issue.type}</span>
                <span className={`issue-status ${issue.status}`}>{issue.status}</span>
              </div>

              <div className="issue-actions">
                {issue.status === 'open' && (
                  <>
                    <button
                      className="btn-fix"
                      onClick={() => handleApplyFix(issue.id)}
                    >
                      Apply Fix
                    </button>
                    <button
                      className="btn-ignore"
                      onClick={() => handleResolve(issue.id)}
                    >
                      Mark Resolved
                    </button>
                  </>
                )}
                {issue.status === 'in_progress' && (
                  <span className="status-badge">Fixing...</span>
                )}
                {issue.status === 'resolved' && (
                  <span className="status-badge success">Resolved</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
