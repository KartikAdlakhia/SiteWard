import React, { useState, useEffect } from 'react';
import { Plus, Settings, LogOut, Menu, X } from 'lucide-react';
import { WebsiteCard } from './components/WebsiteCard';
import { AddWebsiteModal } from './components/AddWebsiteModal';
import { Dashboard } from './components/Dashboard';
import { IssuesList } from './components/IssuesList';
import { getWebsites } from './api';
import './App.css';

function App() {
  const [websites, setWebsites] = useState([]);
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const fetchWebsites = async () => {
      try {
        const data = await getWebsites();
        setWebsites(data);
        if (data.length > 0 && !selectedWebsite) {
          setSelectedWebsite(data[0]);
        }
      } catch (error) {
        console.error('Error fetching websites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWebsites();
    const interval = setInterval(fetchWebsites, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleWebsiteAdded = (website) => {
    setWebsites((prev) => [...prev, website]);
    setSelectedWebsite(website);
  };

  const handleDeleteWebsite = (id) => {
    setWebsites((prev) => prev.filter((w) => w.id !== id));
    if (selectedWebsite?.id === id) {
      setSelectedWebsite(websites[0] || null);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-container">
          <div className="header-left">
            <div className="logo">SiteWard</div>
            <span className="tagline">AI Website Maintenance</span>
          </div>

          <button
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className={`header-right ${isMobileMenuOpen ? 'mobile-visible' : ''}`}>
            <button
              className="btn-add"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={20} />
              Add Website
            </button>
            <button className="btn-settings">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="app-content">
        <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-visible' : ''}`}>
          <div className="sidebar-header">
            <h3>Your Websites</h3>
            <span className="website-count">{websites.length}</span>
          </div>

          <div className="website-list">
            {loading ? (
              <div className="loading-message">Loading websites...</div>
            ) : websites.length === 0 ? (
              <div className="empty-state">
                <p>No websites added yet.</p>
                <button
                  className="btn-primary"
                  onClick={() => setIsModalOpen(true)}
                  style={{ width: '100%' }}
                >
                  <Plus size={16} /> Add First Website
                </button>
              </div>
            ) : (
              websites.map((website) => (
                <button
                  key={website.id}
                  className={`website-item ${
                    selectedWebsite?.id === website.id ? 'active' : ''
                  }`}
                  onClick={() => {
                    setSelectedWebsite(website);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <span className="website-item-name">{website.name}</span>
                  <span
                    className={`website-item-status ${website.status}`}
                  ></span>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="main-content">
          {selectedWebsite ? (
            <div className="website-detail">
              <div className="website-header">
                <div>
                  <h2>{selectedWebsite.name}</h2>
                  <p className="website-url">{selectedWebsite.url}</p>
                </div>
                <div className="health-score-large">
                  <div className="score-circle">{selectedWebsite.health_score}</div>
                  <span>Health Score</span>
                </div>
              </div>

              <div className="tabs">
                <button
                  className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  Dashboard
                </button>
                <button
                  className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
                  onClick={() => setActiveTab('issues')}
                >
                  Issues
                </button>
              </div>

              <div className="tab-content">
                {activeTab === 'dashboard' && (
                  <Dashboard websiteId={selectedWebsite.id} />
                )}
                {activeTab === 'issues' && (
                  <IssuesList websiteId={selectedWebsite.id} />
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state-large">
              <h2>Welcome to SiteWard</h2>
              <p>Add a website to get started with AI-powered maintenance.</p>
              <button
                className="btn-primary btn-large"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus size={24} /> Add Your First Website
              </button>
            </div>
          )}
        </main>
      </div>

      <AddWebsiteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWebsiteAdded={handleWebsiteAdded}
      />
    </div>
  );
}

export default App;
