import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Zap, Link2, Eye, Lock, Wrench } from 'lucide-react';
import { getIssues, updateIssueStatus, applyFix } from '../api';

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
  created_at?: string;
}

export function IssuesList({ websiteId }: IssuesListProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('open');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'immediate' | 'important' | 'monitor'>('all');
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const data = await getIssues(websiteId);
      setIssues(data || []);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [websiteId]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  const getUrgency = (severity: string) => {
    if (severity === 'critical' || severity === 'high') return 'immediate';
    if (severity === 'medium') return 'important';
    return 'monitor';
  };

  const filteredIssues = issues.filter((issue) => {
    const statusMatch = statusFilter === 'all' ? true : issue.status === statusFilter;
    const urgencyMatch = urgencyFilter === 'all' ? true : getUrgency(issue.severity) === urgencyFilter;
    return statusMatch && urgencyMatch;
  });

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'broken_link':
        return <Link2 size={18} />;
      case 'performance':
        return <Zap size={18} />;
      case 'security':
        return <Lock size={18} />;
      case 'seo':
        return <Eye size={18} />;
      default:
        return <AlertTriangle size={18} />;
    }
  };

  const getSeverityClasses = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-rose-100 text-rose-700';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700';
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-zinc-100 text-zinc-700';
    }
  };

  const handleStatusChange = async (issueId: string, status: string) => {
    try {
      setBusyIssueId(issueId);
      const updated = await updateIssueStatus(issueId, status);
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId ? { ...issue, status: updated?.status || status } : issue
        )
      );
      setMessage(`Issue marked as ${status.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating issue:', error);
      setMessage('Could not update issue status');
    } finally {
      setBusyIssueId(null);
    }
  };

  const handleApplyFix = async (issueId: string) => {
    try {
      setBusyIssueId(issueId);
      await applyFix(issueId);
      await handleStatusChange(issueId, 'in_progress');
      setMessage('Fix process started');
    } catch (error) {
      console.error('Error applying fix:', error);
      setMessage('Could not apply fix');
    } finally {
      setBusyIssueId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm p-8 text-center text-text-muted">
        Loading issues...
      </div>
    );
  }

  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border-dark flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-text-main font-bold text-lg">Issues & Alerts</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
              statusFilter === 'open' ? 'bg-primary text-white border-primary' : 'bg-white text-text-main border-border-dark'
            }`}
            onClick={() => setStatusFilter('open')}
          >
            Open ({issues.filter((i) => i.status === 'open').length})
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
              urgencyFilter === 'immediate' ? 'bg-primary text-white border-primary' : 'bg-white text-text-main border-border-dark'
            }`}
            onClick={() => setUrgencyFilter('immediate')}
          >
            Very Important ({issues.filter((i) => getUrgency(i.severity) === 'immediate').length})
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
              urgencyFilter === 'important' ? 'bg-primary text-white border-primary' : 'bg-white text-text-main border-border-dark'
            }`}
            onClick={() => setUrgencyFilter('important')}
          >
            Important ({issues.filter((i) => getUrgency(i.severity) === 'important').length})
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
              urgencyFilter === 'monitor' ? 'bg-primary text-white border-primary' : 'bg-white text-text-main border-border-dark'
            }`}
            onClick={() => setUrgencyFilter('monitor')}
          >
            Monitor ({issues.filter((i) => getUrgency(i.severity) === 'monitor').length})
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
              statusFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-text-main border-border-dark'
            }`}
            onClick={() => {
              setStatusFilter('all');
              setUrgencyFilter('all');
            }}
          >
            All ({issues.length})
          </button>
        </div>
      </div>

      {message && (
        <div className="px-6 py-3 bg-background-light border-b border-border-dark text-sm text-text-main">
          {message}
        </div>
      )}

      <div className="divide-y divide-border-dark">
        {filteredIssues.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle size={40} className="mx-auto text-emerald-600 mb-3" />
            <p className="text-text-main font-semibold">No issues found for this filter.</p>
            <p className="text-text-muted text-sm mt-1">Try switching filters, or run a fresh scan.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div key={issue.id} className="p-5 md:p-6 hover:bg-background-light transition-colors">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-1 text-primary">{getIssueIcon(issue.type)}</span>
                  <div>
                    <h3 className="text-text-main font-semibold">{issue.title}</h3>
                    <p className="text-text-muted text-sm mt-1">{issue.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                      <span className={`px-2 py-1 rounded border font-semibold uppercase ${getSeverityClasses(issue.severity)}`}>
                        {issue.severity}
                      </span>
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 font-semibold uppercase">
                        {getUrgency(issue.severity)}
                      </span>
                      <span className={`px-2 py-1 rounded font-semibold ${getStatusClasses(issue.status)}`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-1 rounded bg-background-light text-text-muted border border-border-dark capitalize">
                        {issue.type.replace('_', ' ')}
                      </span>
                      {issue.created_at && (
                        <span className="text-text-muted">
                          {new Date(issue.created_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {issue.status === 'open' && (
                    <button
                      className="inline-flex items-center gap-1 rounded-lg bg-primary text-white px-3 py-1.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
                      onClick={() => handleApplyFix(issue.id)}
                      disabled={busyIssueId === issue.id}
                    >
                      <Wrench size={14} />
                      Apply Fix
                    </button>
                  )}
                  {issue.status !== 'resolved' && (
                    <button
                      className="rounded-lg border border-border-dark bg-white text-text-main px-3 py-1.5 text-sm font-semibold hover:bg-background-light disabled:opacity-60"
                      onClick={() => handleStatusChange(issue.id, 'resolved')}
                      disabled={busyIssueId === issue.id}
                    >
                      Mark Resolved
                    </button>
                  )}
                  {issue.status === 'resolved' && (
                    <button
                      className="rounded-lg border border-border-dark bg-white text-text-main px-3 py-1.5 text-sm font-semibold hover:bg-background-light disabled:opacity-60"
                      onClick={() => handleStatusChange(issue.id, 'open')}
                      disabled={busyIssueId === issue.id}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
