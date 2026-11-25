/* DompetMungil API Client */

const TOKEN_KEY = 'dm_auth_token';
const USER_KEY = 'dm_auth_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setSession(data) {
  if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify({
    user_id: data.user_id || '',
    username: data.username || '',
    account_mode: data.account_mode || 'personal',
    role: data.role || 'personal',
  }));
}

export function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if (token) headers['X-Auth-Token'] = token;

  const res = await fetch(path, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';

  if (res.status === 401 && path !== '/api/v1/auth/login') {
    clearSession();
    window.dispatchEvent(new CustomEvent('dm:unauthorized'));
  }

  if (contentType.includes('application/json')) {
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || `Kesalahan server (${res.status})`);
    }
    return json;
  }

  if (!res.ok) {
    throw new Error(`Kesalahan server (${res.status})`);
  }
  return res;
}

export const api = {
  health: () => request('/api/v1/health'),
  initAdmin: (body) => request('/api/v1/auth/init', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/api/v1/auth/logout', { method: 'POST' }),

  overview: (month) => request(`/api/v1/overview${month ? `?month=${encodeURIComponent(month)}` : ''}`),

  getTransactions: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const q = qs.toString();
    return request(`/api/v1/transactions${q ? `?${q}` : ''}`);
  },
  createTransaction: (body) => request('/api/v1/transactions', { method: 'POST', body: JSON.stringify(body) }),
  updateTransaction: (body) => request('/api/v1/transactions', { method: 'PUT', body: JSON.stringify(body) }),
  deleteTransaction: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/v1/transactions?${qs}`, { method: 'DELETE' });
  },
  syncBatch: (batch) => request('/api/v1/sync', { method: 'POST', body: JSON.stringify({ batch }) }),

  getCategories: () => request('/api/v1/categories'),
  createCategory: (body) => request('/api/v1/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (body) => request('/api/v1/categories', { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id) => request(`/api/v1/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getAccounts: () => request('/api/v1/accounts'),
  createAccount: (body) => request('/api/v1/accounts', { method: 'POST', body: JSON.stringify(body) }),
  updateAccount: (body) => request('/api/v1/accounts', { method: 'PUT', body: JSON.stringify(body) }),
  deleteAccount: (id) => request(`/api/v1/accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getBudgets: (month) => request(`/api/v1/budgets${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  saveBudget: (category_id, amount) => request('/api/v1/budgets', { method: 'POST', body: JSON.stringify({ category_id, amount }) }),

  getGoals: () => request('/api/v1/savings-goals'),
  createGoal: (body) => request('/api/v1/savings-goals', { method: 'POST', body: JSON.stringify(body) }),
  addGoalFunds: (id, add_amount) => request('/api/v1/savings-goals', { method: 'POST', body: JSON.stringify({ action: 'add', id, add_amount }) }),
  updateGoal: (body) => request('/api/v1/savings-goals', { method: 'PUT', body: JSON.stringify(body) }),
  deleteGoal: (id) => request(`/api/v1/savings-goals?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getBills: () => request('/api/v1/recurring-bills'),
  createBill: (body) => request('/api/v1/recurring-bills', { method: 'POST', body: JSON.stringify(body) }),
  payBill: (id) => request('/api/v1/recurring-bills', { method: 'POST', body: JSON.stringify({ action: 'pay', id }) }),
  updateBill: (body) => request('/api/v1/recurring-bills', { method: 'PUT', body: JSON.stringify(body) }),
  deleteBill: (id) => request(`/api/v1/recurring-bills?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getRules: () => request('/api/v1/category-rules'),
  createRule: (body) => request('/api/v1/category-rules', { method: 'POST', body: JSON.stringify(body) }),
  updateRule: (body) => request('/api/v1/category-rules', { method: 'PUT', body: JSON.stringify(body) }),
  deleteRule: (id) => request(`/api/v1/category-rules?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getSettings: () => request('/api/v1/settings'),
  saveSettings: (body) => request('/api/v1/settings', { method: 'PUT', body: JSON.stringify(body) }),

  exportBackupJson: () => request('/api/v1/backup/export'),
  restoreBackupJson: (payload) => request('/api/v1/backup/restore', { method: 'POST', body: JSON.stringify(payload) }),
  downloadCsv: async () => {
    const res = await request('/api/v1/export', { headers: {} });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dompetmungil_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
