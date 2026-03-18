import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the current user's JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Websites ────────────────────────────────────────────────────────────────

export async function getWebsites() {
  const res = await api.get('/websites');
  return res.data;
}

export async function getWebsite(id: string) {
  const res = await api.get(`/websites/${id}`);
  return res.data;
}

export async function addWebsite(url: string, name: string, frequency: string) {
  const res = await api.post('/websites', { url, name, frequency });
  return res.data;
}

export async function deleteWebsite(id: string) {
  const res = await api.delete(`/websites/${id}`);
  return res.data;
}

// ── Scans ────────────────────────────────────────────────────────────────────

export async function getScanResults(websiteId: string) {
  const res = await api.get(`/websites/${websiteId}/scans`);
  return res.data;
}

export async function triggerScan(websiteId: string) {
  const res = await api.post(`/websites/${websiteId}/scan`);
  return res.data;
}

// ── Issues ────────────────────────────────────────────────────────────────────

export async function getIssues(websiteId: string, filters?: { status?: string; severity?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.severity) params.set('severity', filters.severity);
  const res = await api.get(`/websites/${websiteId}/issues?${params.toString()}`);
  return res.data;
}

export async function updateIssueStatus(issueId: string, status: string) {
  const res = await api.patch(`/issues/${issueId}`, { status });
  return res.data;
}

export async function getIssueFix(issueId: string) {
  const res = await api.get(`/issues/${issueId}/fix`);
  return res.data;
}

export async function applyFix(issueId: string) {
  const res = await api.post(`/issues/${issueId}/fix`);
  return res.data;
}

// ── Auth (Supabase client-side) ───────────────────────────────────────────────

export { supabase };
