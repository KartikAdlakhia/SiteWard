import React, { useState } from 'react';
import { Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { addWebsite } from '../api';
import '../styles/Modal.css';

interface AddWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWebsiteAdded: (website: any) => void;
}

export function AddWebsiteModal({ isOpen, onClose, onWebsiteAdded }: AddWebsiteModalProps) {
  const [formData, setFormData] = useState({
    url: '',
    name: '',
    frequency: 'hourly',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.url.startsWith('http')) {
        formData.url = 'https://' + formData.url;
      }
      
      const website = await addWebsite(formData.url, formData.name, formData.frequency);
      onWebsiteAdded(website);
      setFormData({ url: '', name: '', frequency: 'hourly' });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add Website for Monitoring</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Website URL *</label>
            <input
              type="url"
              placeholder="example.com or https://example.com"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Website Name *</label>
            <input
              type="text"
              placeholder="My Awesome Website"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Scan Frequency</label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Adding...' : 'Add Website'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
