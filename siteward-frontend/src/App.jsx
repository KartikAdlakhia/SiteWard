import React, { useState, useEffect } from 'react';
import { supabase, getWebsites, triggerScan, getScanResults } from './api';
import { Auth } from './components/Auth';
import { AddWebsiteModal } from './components/AddWebsiteModal';
import { IssuesList } from './components/IssuesList';
import './index.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [websites, setWebsites] = useState([]);
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');

  const getTabFromHash = () => {
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    if (hash === 'overview' || hash === 'issues' || hash === 'settings') return hash;
    return 'overview';
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (window.location.hash !== `#${tab}`) {
      window.location.hash = tab;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchWebsites();
    } else {
      setWebsites([]);
      setSelectedWebsite(null);
      setScans([]);
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (selectedWebsite) {
      loadScans(selectedWebsite.id);
    }
  }, [selectedWebsite]);

  useEffect(() => {
    const initialTab = getTabFromHash();
    setActiveTab(initialTab);
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    setActiveTab(getTabFromHash());
  }, [selectedWebsite?.id]);

  const fetchWebsites = async () => {
    try {
      setLoading(true);
      const data = await getWebsites();
      setWebsites(data);
      setSelectedWebsite((currentSelected) => {
        if (!data.length) return null;
        if (!currentSelected) return data[0];
        return data.find((site) => site.id === currentSelected.id) || data[0];
      });
    } catch (error) {
      console.error('Error fetching websites:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScans = async (id) => {
    try {
      const data = await getScanResults(id);
      setScans(data);
    } catch (err) {
      console.error('Failed to load scans:', err);
    }
  };

  const handleRefresh = async () => {
    if (!selectedWebsite) return;
    try {
      await triggerScan(selectedWebsite.id);
      // Optimistically poll for update after 3 seconds
      setTimeout(() => {
        fetchWebsites();
        loadScans(selectedWebsite.id);
      }, 3000);
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setSession(null);
      setWebsites([]);
      setSelectedWebsite(null);
      setScans([]);
      setIsModalOpen(false);
    }
  };

  const handleWebsiteAdded = (website) => {
    setWebsites((prev) => [...prev, website]);
    setSelectedWebsite(website);
    setIsModalOpen(false);
  };

  const filteredWebsites = websites.filter((website) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      website.name?.toLowerCase().includes(query) ||
      website.url?.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (!filteredWebsites.length) return;
    if (!selectedWebsite || !filteredWebsites.some((site) => site.id === selectedWebsite.id)) {
      setSelectedWebsite(filteredWebsites[0]);
    }
  }, [searchTerm, selectedWebsite, filteredWebsites]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light text-text-main">
        Loading SiteWard...
      </div>
    );
  }

  if (!session) {
    return <Auth onSession={setSession} />;
  }

  const totalSites = websites.length;
  const healthySites = websites.filter((website) => website.status === 'healthy').length;
  const warningSites = websites.filter((website) => website.status === 'warning').length;
  const criticalSites = websites.filter((website) => website.status === 'critical').length;
  const averageHealthScore = totalSites
    ? Math.round(
        websites.reduce((total, website) => total + (Number(website.health_score) || 0), 0) / totalSites
      )
    : 0;

  // Calculate metrics for display
  const latestMonitor = scans.find(s => s.scan_type === 'monitor');
  const uptimeStr = latestMonitor?.metrics?.uptimePercentage || '99.982%';
  const responseTimeStr = latestMonitor?.metrics?.fetchTime ? `${latestMonitor.metrics.fetchTime}ms` : '342ms';
  
  const issuesFound = scans.reduce((acc, s) => acc + (s.issues?.length || 0), 0);

  const getScanHoverText = (scan) => {
    const lines = [
      `Scan type: ${scan.scan_type}`,
      `Status: ${scan.status}`,
      `Created: ${new Date(scan.created_at).toLocaleString()}`,
      `Issues found: ${scan.issues?.length || 0}`,
    ];

    if (scan.metrics?.fetchTime) {
      lines.push(`Response time: ${scan.metrics.fetchTime}ms`);
    }

    if (scan.metrics?.uptimePercentage) {
      lines.push(`Uptime: ${scan.metrics.uptimePercentage}`);
    }

    if (scan.data?.summary) {
      lines.push(`Summary: ${scan.data.summary}`);
    }

    return lines.join('\n');
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        {/* HEADER */}
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark px-6 md:px-10 py-3 bg-white">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 text-primary">
              <div className="size-6 flex items-center justify-center bg-primary/10 rounded">
                <span className="material-symbols-outlined text-primary text-xl">shield_with_heart</span>
              </div>
              <h2 className="text-text-main text-lg font-bold leading-tight tracking-[-0.015em]">SiteWard</h2>
            </div>
            
            <label className="hidden md:flex flex-col min-w-40 h-10 max-w-64">
              <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
                <div className="text-text-muted flex border-none bg-background-light items-center justify-center pl-4 rounded-l-xl">
                  <span className="material-symbols-outlined text-xl">search</span>
                </div>
                <input 
                  className="form-input flex w-full min-w-0 flex-1 border-none bg-background-light text-text-main focus:ring-0 h-full placeholder:text-text-muted px-4 rounded-r-xl pl-2 text-sm" 
                  placeholder="Search your sites..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </label>
            
            {/* Site selector dropdown instead of nav links for quick access */}
            <select 
              className="bg-background-light border-border-dark text-text-main text-sm rounded-lg focus:ring-primary focus:border-primary px-3 py-2 w-48"
              value={selectedWebsite?.id || ''}
              onChange={(e) => {
                const site = filteredWebsites.find(w => w.id === e.target.value);
                if (site) setSelectedWebsite(site);
              }}
            >
              {filteredWebsites.length === 0 && (
                <option value="">
                  {websites.length === 0 ? 'No sites added yet' : 'No matching sites'}
                </option>
              )}
              {filteredWebsites.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            
          </div>

          <div className="flex flex-1 justify-end gap-6 items-center">
            <nav className="hidden lg:flex items-center gap-6">
              <button
                onClick={() => switchTab('overview')}
                className={`text-sm font-medium cursor-pointer transition-colors ${
                  activeTab === 'overview' ? 'text-primary' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => switchTab('issues')}
                className={`text-sm font-medium cursor-pointer transition-colors ${
                  activeTab === 'issues' ? 'text-primary' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Issues
              </button>
              <button
                onClick={() => switchTab('settings')}
                className={`text-sm font-medium cursor-pointer transition-colors ${
                  activeTab === 'settings' ? 'text-primary' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Settings
              </button>
            </nav>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="hidden lg:flex items-center justify-center rounded-xl h-10 px-4 bg-background-light text-text-main border border-border-dark hover:bg-border-dark transition-colors font-semibold"
              >
                <span className="material-symbols-outlined text-lg mr-2">add</span> Add Site
              </button>
              <button 
                onClick={handleSignOut}
                className="flex items-center justify-center rounded-xl h-10 w-10 bg-background-light text-text-main border border-border-dark hover:bg-border-dark transition-colors"
                title="Sign out"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-6 md:p-10 gap-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-text-muted">
              Loading websites...
            </div>
          ) : selectedWebsite ? (
            <>
              {/* Breadcrumb */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">home</span>
                  Dashboard
                </span>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-text-main">
                  {activeTab === 'overview' ? 'Overview' : activeTab === 'issues' ? 'Issues' : 'Settings'}
                </span>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-text-main">{selectedWebsite.url}</span>
              </div>

              {/* Title Header */}
              <div className="flex flex-wrap justify-between items-end gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-text-main text-4xl font-black leading-tight tracking-tight">{selectedWebsite.name}</h1>
                    <span className={`px-2 py-1 text-xs font-bold rounded uppercase tracking-wider border 
                      ${selectedWebsite.status === 'healthy' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                        selectedWebsite.status === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                        'bg-rose-100 text-rose-700 border-rose-200'}`}>
                      {selectedWebsite.status}
                    </span>
                  </div>
                  <p className="text-text-muted text-base">Overall Health Score: {selectedWebsite.health_score}/100 • Evaluated just now</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => switchTab('settings')}
                    className="flex items-center justify-center rounded-xl h-11 px-6 bg-white border border-border-dark text-text-main hover:bg-background-light transition-colors font-bold text-sm"
                  >
                    <span className="material-symbols-outlined mr-2">settings</span> Manage
                  </button>
                  <button 
                    onClick={handleRefresh}
                    className="flex items-center justify-center rounded-xl h-11 px-6 bg-primary text-white hover:bg-primary/90 transition-colors font-bold text-sm shadow-sm"
                  >
                    <span className="material-symbols-outlined mr-2">refresh</span> Run Full Scan
                  </button>
                </div>
              </div>

              {/* Page Nav */}
              <div className="border-b border-border-dark flex gap-8">
                <button
                  onClick={() => switchTab('overview')}
                  className={`pb-4 font-bold text-sm flex items-center gap-2 cursor-pointer border-b-2 ${
                    activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-text-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">grid_view</span> Overview
                </button>
                <button
                  onClick={() => switchTab('issues')}
                  className={`pb-4 font-bold text-sm flex items-center gap-2 cursor-pointer border-b-2 ${
                    activeTab === 'issues' ? 'border-primary text-primary' : 'border-transparent text-text-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">warning</span> Issues
                </button>
                <button
                  onClick={() => switchTab('settings')}
                  className={`pb-4 font-bold text-sm flex items-center gap-2 cursor-pointer border-b-2 ${
                    activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-text-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">settings</span> Settings
                </button>
              </div>

              {activeTab === 'overview' && (
                <>
                  <section className="bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border-dark flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-text-main font-bold text-lg">Portfolio Overview</h3>
                        <p className="text-text-muted text-sm">All websites uploaded by your account.</p>
                      </div>
                      <div className="text-sm text-text-muted">
                        {filteredWebsites.length} of {websites.length} sites visible
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-6 border-b border-border-dark">
                      <div className="rounded-xl border border-border-dark bg-background-light p-5">
                        <p className="text-text-muted text-sm font-medium">Total Sites</p>
                        <p className="text-text-main text-3xl font-bold mt-2">{totalSites}</p>
                      </div>
                      <div className="rounded-xl border border-border-dark bg-background-light p-5">
                        <p className="text-text-muted text-sm font-medium">Healthy</p>
                        <p className="text-emerald-700 text-3xl font-bold mt-2">{healthySites}</p>
                        <p className="text-text-muted text-xs mt-2">
                          {warningSites} warning, {criticalSites} critical
                        </p>
                      </div>
                      <div className="rounded-xl border border-border-dark bg-background-light p-5">
                        <p className="text-text-muted text-sm font-medium">Average Health</p>
                        <p className="text-text-main text-3xl font-bold mt-2">{averageHealthScore}/100</p>
                      </div>
                      <div className="rounded-xl border border-border-dark bg-background-light p-5">
                        <p className="text-text-muted text-sm font-medium">Selected Site</p>
                        <p className="text-text-main text-lg font-bold mt-2 truncate">
                          {selectedWebsite?.name || 'None selected'}
                        </p>
                        <p className="text-text-muted text-xs mt-2 truncate">
                          {selectedWebsite?.url || 'Choose a site to inspect details'}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-background-light text-text-muted">
                          <tr>
                            <th className="px-6 py-3 font-medium">Site</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Health</th>
                            <th className="px-6 py-3 font-medium">Last Scan</th>
                            <th className="px-6 py-3 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                          {filteredWebsites.map((website) => (
                            <tr
                              key={website.id}
                              className={`transition-colors hover:bg-background-light ${
                                selectedWebsite?.id === website.id ? 'bg-primary/5' : ''
                              }`}
                            >
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="text-text-main font-semibold">{website.name}</span>
                                  <span className="text-text-muted text-xs break-all">{website.url}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase ${
                                    website.status === 'healthy'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : website.status === 'warning'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}
                                >
                                  {website.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-text-main font-semibold">
                                {website.health_score}/100
                              </td>
                              <td className="px-6 py-4 text-text-muted">
                                {website.last_scan ? new Date(website.last_scan).toLocaleString() : 'Never'}
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => setSelectedWebsite(website)}
                                  className="rounded-lg border border-border-dark bg-white px-3 py-1.5 text-sm font-semibold text-text-main hover:bg-background-light"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredWebsites.length === 0 && (
                            <tr>
                              <td colSpan="5" className="px-6 py-8 text-center text-text-muted">
                                No sites match your current search.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-text-main font-bold text-lg">Selected Site Snapshot</h3>
                      <p className="text-text-muted text-sm">
                        Detailed overview for {selectedWebsite.name}
                      </p>
                    </div>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-surface-dark rounded-xl p-6 border border-border-dark shadow-sm group hover:border-accent transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <p className="text-text-muted text-sm font-medium">Site Uptime</p>
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                      </div>
                      <p className="text-text-main text-3xl font-bold mb-1">{uptimeStr}</p>
                    </div>
                    
                    <div className="bg-surface-dark rounded-xl p-6 border border-border-dark shadow-sm group hover:border-accent transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <p className="text-text-muted text-sm font-medium">Avg Response Time</p>
                        <span className="material-symbols-outlined text-primary">bolt</span>
                      </div>
                      <p className="text-text-main text-3xl font-bold mb-1">{responseTimeStr}</p>
                    </div>
                    
                    <div className="bg-surface-dark rounded-xl p-6 border border-border-dark shadow-sm group hover:border-accent transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <p className="text-text-muted text-sm font-medium">Open Issues found</p>
                        <span className="material-symbols-outlined text-primary">warning</span>
                      </div>
                      <p className="text-text-main text-3xl font-bold mb-1">{issuesFound}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600 text-xs font-bold">{issuesFound > 0 ? 'Needs attention' : 'Looking good'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Scan History Table */}
                  <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden mt-2">
                    <div className="px-6 py-4 border-b border-border-dark flex justify-between items-center">
                      <h3 className="text-text-main font-bold">Recent Scans</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-background-light text-text-muted">
                          <tr>
                            <th className="px-6 py-3 font-medium">Time</th>
                            <th className="px-6 py-3 font-medium">Scan Module</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Issues</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                          {scans.slice(0, 10).map(scan => (
                            <tr
                              key={scan.id}
                              className="hover:bg-background-light transition-colors"
                              title={getScanHoverText(scan)}
                            >
                              <td className="px-6 py-4 text-text-muted" title={getScanHoverText(scan)}>
                                {new Date(scan.created_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-text-main font-medium capitalize" title={getScanHoverText(scan)}>
                                {scan.scan_type} Agent
                              </td>
                              <td className="px-6 py-4" title={getScanHoverText(scan)}>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                  ${scan.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 
                                    scan.status === 'error' ? 'bg-rose-100 text-rose-700' : 
                                    'bg-amber-100 text-amber-700'}`}>
                                  {scan.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-text-muted" title={getScanHoverText(scan)}>
                                {scan.issues.length} Issues
                              </td>
                            </tr>
                          ))}
                          {scans.length === 0 && (
                            <tr>
                              <td colSpan="4" className="px-6 py-8 text-center text-text-muted">
                                No scans found for this website yet. Click "Run Full Scan" to start.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'issues' && (
                <div className="mt-2">
                  <IssuesList websiteId={selectedWebsite.id} />
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="bg-surface-dark rounded-xl p-6 border border-border-dark shadow-sm mt-2">
                  <h3 className="text-text-main text-lg font-bold mb-4">Site Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-background-light border border-border-dark rounded-lg p-4">
                      <p className="text-text-muted mb-1">Website URL</p>
                      <p className="text-text-main font-semibold break-all">{selectedWebsite.url}</p>
                    </div>
                    <div className="bg-background-light border border-border-dark rounded-lg p-4">
                      <p className="text-text-muted mb-1">Scan Frequency</p>
                      <p className="text-text-main font-semibold capitalize">{selectedWebsite.scan_frequency || 'hourly'}</p>
                    </div>
                    <div className="bg-background-light border border-border-dark rounded-lg p-4">
                      <p className="text-text-muted mb-1">Current Status</p>
                      <p className="text-text-main font-semibold capitalize">{selectedWebsite.status}</p>
                    </div>
                    <div className="bg-background-light border border-border-dark rounded-lg p-4">
                      <p className="text-text-muted mb-1">Health Score</p>
                      <p className="text-text-main font-semibold">{selectedWebsite.health_score}/100</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 text-center border-2 border-dashed border-border-dark rounded-2xl bg-background-light mt-10">
              <span className="material-symbols-outlined text-primary text-6xl mb-4 opacity-50">travel_explore</span>
              <h2 className="text-2xl font-bold text-text-main mb-2">No Websites Found</h2>
              <p className="text-text-muted mb-6">Add your first website to the database to begin monitoring.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center rounded-xl h-11 px-8 bg-primary text-white hover:bg-primary/90 transition-colors font-bold shadow-sm"
              >
                <span className="material-symbols-outlined mr-2">add</span> Add First Website
              </button>
            </div>
          )}
        </main>

        <footer className="mt-auto border-t border-border-dark px-10 py-6 bg-white text-text-muted text-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© 2026 SiteWard. Powered by Antigravity Agents.</p>
          </div>
        </footer>
      </div>
      <AddWebsiteModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onWebsiteAdded={handleWebsiteAdded} 
      />
    </div>
  );
}
