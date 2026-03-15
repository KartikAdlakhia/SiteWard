import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getWebsites() {
  const response = await api.get('/websites');
  return response.data;
}

export async function getWebsite(id: string) {
  const response = await api.get(`/websites/${id}`);
  return response.data;
}

export async function addWebsite(url: string, name: string, frequency: string) {
  const response = await api.post('/websites', { url, name, frequency });
  return response.data;
}

export async function getScanResults(websiteId: string) {
  const response = await api.get(`/websites/${websiteId}/scans`);
  return response.data;
}

export async function getIssues(websiteId: string) {
  const response = await api.get(`/websites/${websiteId}/issues`);
  return response.data;
}

export async function triggerScan(websiteId: string) {
  const response = await api.post(`/websites/${websiteId}/scan`);
  return response.data;
}

export async function updateIssueStatus(issueId: string, status: string) {
  const response = await api.patch(`/issues/${issueId}`, { status });
  return response.data;
}

export async function applyFix(issueId: string) {
  const response = await api.post(`/issues/${issueId}/fix`);
  return response.data;
}
