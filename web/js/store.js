/* DompetMungil State Store & Formatting Helpers */

import { api } from './api.js';

export const state = {
  route: 'dashboard',
  month: new Date().toISOString().slice(0, 7),
  privacyMode: localStorage.getItem('dm_privacy') === '1',
  sidebarCollapsed: localStorage.getItem('dm_sidebar_collapsed') === '1',
  loading: false,
  error: '',
  user: null,
  initialized: true,
  overview: {
    total_balance: 0,
    month_income: 0,
    month_expense: 0,
    month_net: 0,
    tx_count: 0,
    goals_total: 0,
    bills_due_count: 0,
  },
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  goals: [],
  bills: [],
  rules: [],
  settings: {
    family_title: 'DompetMungil',
    family_subtitle: 'Buku Catatan Keuangan Keluarga',
    theme: localStorage.getItem('dm_theme') || 'meadow',
    anim_mode: localStorage.getItem('dm_anim') || 'full',
  },
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn(state));
}

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatRupiah(value, forceVisible = false) {
  if (state.privacyMode && !forceVisible) return 'Rp ••••••';
  const n = Number(value) || 0;
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toLocaleString('id-ID');
  return `${n < 0 ? '-' : ''}Rp ${formatted}`;
}

export function formatDateId(isoDate) {
  if (!isoDate) return '-';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const m = parseInt(parts[1], 10) - 1;
  return `${parseInt(parts[2], 10)} ${months[m] || parts[1]} ${parts[0]}`;
}

export function formatMonthId(ym) {
  if (!ym || !ym.includes('-')) return ym || '';
  const [y, m] = ym.split('-');
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  return `${months[parseInt(m, 10) - 1] || m} ${y}`;
}

export function toast(message, type = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3600);
}

export function haptic(ms = 50) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(ms);
    } catch {
      // Ignore if blocked by browser policy
    }
  }
}

export function applyTheme(theme, animMode, scene) {
  const validTheme = ['meadow', 'bakery', 'lantern'].includes(theme) ? theme : 'meadow';
  const validAnim = ['full', 'light', 'off'].includes(animMode) ? animMode : 'full';
  document.documentElement.setAttribute('data-theme', validTheme);
  localStorage.setItem('dm_theme', validTheme);
  localStorage.setItem('dm_anim', validAnim);
  state.settings.theme = validTheme;
  state.settings.anim_mode = validAnim;
  if (scene) scene.configure(validTheme, validAnim);
}

export async function refreshAll(scene) {
  state.loading = true;
  state.error = '';
  notify();
  try {
    const [overview, accounts, categories, transactions, budgets, goals, bills, rules, settings] = await Promise.all([
      api.overview(state.month),
      api.getAccounts(),
      api.getCategories(),
      api.getTransactions(),
      api.getBudgets(state.month),
      api.getGoals(),
      api.getBills(),
      api.getRules(),
      api.getSettings(),
    ]);
    state.overview = overview || state.overview;
    state.accounts = accounts || [];
    state.categories = categories || [];
    state.transactions = transactions || [];
    state.budgets = budgets || [];
    state.goals = goals || [];
    state.bills = bills || [];
    state.rules = rules || [];
    state.settings = { ...state.settings, ...(settings || {}) };
    applyTheme(state.settings.theme, state.settings.anim_mode, scene);
  } catch (err) {
    state.error = err.message || 'Gagal memuat data dari server.';
  } finally {
    state.loading = false;
    notify();
  }
}
