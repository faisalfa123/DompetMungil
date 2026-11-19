/* DompetMungil App Bootstrap & Router */

import { api, getToken, getSavedUser, clearSession } from './api.js';
import { state, subscribe, esc, applyTheme, refreshAll, toast } from './store.js';
import { GhibliScene } from './ghibli-scene.js';
import { icon, ghibliMascot } from './icons.js';

import { renderAuth } from './views/auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderTransactions } from './views/transactions.js';
import { renderBankImport } from './views/bank-import.js';
import { renderPlanning } from './views/planning.js';
import { renderPrintStudio } from './views/print-view.js';
import { renderSettings } from './views/settings.js';
import { openTransactionModal } from './views/tx-modal.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Beranda', icon: 'home', title: 'Beranda Keuangan' },
  { id: 'transactions', label: 'Transaksi', icon: 'list', title: 'Riwayat Transaksi' },
  { id: 'import', label: 'Impor Bank', icon: 'import', title: 'Pembaca Mutasi Bank' },
  { id: 'planning', label: 'Rencana', icon: 'piggy', title: 'Anggaran, Celengan & Tagihan' },
  { id: 'print', label: 'Cetak', icon: 'printer', title: 'Studio Cetak Cantik' },
  { id: 'settings', label: 'Pengaturan', icon: 'settings', title: 'Pengaturan & Tema' },
];

const scene = new GhibliScene(document.getElementById('ghibli-canvas'));
applyTheme(state.settings.theme, state.settings.anim_mode, scene);

function navigate(routeId) {
  state.route = NAV_ITEMS.some((n) => n.id === routeId) ? routeId : 'dashboard';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function openTxModal() {
  openTransactionModal(scene);
}

function renderApp() {
  const root = document.getElementById('app-root');
  if (!root) return;

  if (!getToken()) {
    renderAuth(root, {
      onSuccess: async () => {
        await refreshAll(scene);
        renderApp();
      },
    });
    return;
  }

  const activeNav = NAV_ITEMS.find((n) => n.id === state.route) || NAV_ITEMS[0];
  const bookTitle = state.settings.family_title || 'DompetMungil';
  const bookSub = state.settings.family_subtitle || 'Catatan Keuangan Keluarga';

  root.innerHTML = `
    <div class="shell ${state.sidebarCollapsed ? 'sidebar-collapsed' : ''}">
      <aside class="sidebar" aria-label="Navigasi Utama">
        <div class="brand-row">
          <div class="brand-badge">${icon('sprout', 22)}</div>
          <div class="brand-text">
            <div class="brand-title">${esc(bookTitle)}</div>
            <div class="brand-sub">${esc(bookSub)}</div>
          </div>
        </div>

        <nav class="nav-list" aria-label="Menu Utama">
          ${NAV_ITEMS.map((item) => `
            <button type="button" class="nav-item ${state.route === item.id ? 'active' : ''}" data-nav="${item.id}" aria-current="${state.route === item.id ? 'page' : 'false'}">
              ${icon(item.icon, 20)}
              <span class="nav-label">${esc(item.label)}</span>
            </button>
          `).join('')}
        </nav>

        <div class="sidebar-mascot">
          ${ghibliMascot(state.settings.theme, 'calm', 40)}
          <div class="mascot-caption">
            <strong>Mode Lokal Aman</strong><br/>
            Terenkripsi AES-256
          </div>
        </div>

        <div class="sidebar-footer">
          <button type="button" class="btn btn-sm btn-ghost" id="btn-toggle-sidebar" aria-label="Ubah lebar sidebar" title="Ciutkan atau lebarkan sidebar">
            ${icon('panel', 18)}
            <span class="sidebar-footer-text">${state.sidebarCollapsed ? '' : 'Ciutkan'}</span>
          </button>
          <button type="button" class="btn btn-sm btn-ghost text-expense" id="btn-logout" aria-label="Keluar dari akun" title="Keluar">
            ${icon('logout', 18)}
          </button>
        </div>
      </aside>

      <div class="main-wrap">
        <header class="topbar">
          <div class="topbar-left">
            <h1 class="page-title">${esc(activeNav.title)}</h1>
          </div>
          <div class="topbar-actions">
            <label for="global-month" class="sr-only">Pilih Bulan</label>
            <input id="global-month" type="month" class="input" style="width:auto;min-height:40px;padding:6px 10px;" value="${esc(state.month)}" />
            <button type="button" class="btn btn-sm btn-icon" id="btn-privacy" aria-label="${state.privacyMode ? 'Tampilkan nominal saldo' : 'Sembunyikan nominal saldo'}" title="${state.privacyMode ? 'Tampilkan saldo' : 'Sembunyikan saldo'}">
              ${icon(state.privacyMode ? 'eyeOff' : 'eye', 18)}
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="btn-top-add">
              ${icon('plus', 16)} Catat
            </button>
          </div>
        </header>

        <main id="main-content" class="main-content" tabindex="-1"></main>
      </div>
    </div>

    <nav class="mobile-nav" aria-label="Navigasi Bawah">
      ${NAV_ITEMS.map((item) => `
        <button type="button" class="${state.route === item.id ? 'active' : ''}" data-nav="${item.id}" aria-current="${state.route === item.id ? 'page' : 'false'}">
          ${icon(item.icon, 20)}
          <span>${esc(item.label)}</span>
        </button>
      `).join('')}
    </nav>

    <button type="button" class="fab" id="btn-fab-add" aria-label="Catat transaksi baru">
      ${icon('plus', 20)} Catat
    </button>
  `;

  // Bind shell actions
  root.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.getAttribute('data-nav')));
  });

  root.querySelector('#btn-toggle-sidebar')?.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem('dm_sidebar_collapsed', state.sidebarCollapsed ? '1' : '0');
    renderApp();
  });

  root.querySelector('#btn-privacy')?.addEventListener('click', () => {
    state.privacyMode = !state.privacyMode;
    localStorage.setItem('dm_privacy', state.privacyMode ? '1' : '0');
    renderApp();
  });

  root.querySelector('#global-month')?.addEventListener('change', async (e) => {
    state.month = e.target.value || new Date().toISOString().slice(0, 7);
    await refreshAll(scene);
  });

  root.querySelector('#btn-top-add')?.addEventListener('click', openTxModal);
  root.querySelector('#btn-fab-add')?.addEventListener('click', openTxModal);

  root.querySelector('#btn-logout')?.addEventListener('click', async () => {
    try { await api.logout(); } catch { /* ignore */ }
    clearSession();
    toast('Anda telah keluar.');
    renderApp();
  });

  // Render active view inside main-content
  const main = root.querySelector('#main-content');
  if (state.loading && state.accounts.length === 0) {
    main.innerHTML = `
      <div class="card stack-16" aria-busy="true">
        <div class="skeleton" style="width:45%;height:26px;"></div>
        <div class="skeleton" style="width:100%;height:72px;"></div>
        <div class="skeleton" style="width:80%;height:20px;"></div>
      </div>
    `;
    return;
  }

  if (state.error && state.accounts.length === 0) {
    main.innerHTML = `
      <div class="state-box" role="alert">
        <p><strong>Gagal memuat data</strong></p>
        <p class="card-sub">${esc(state.error)}</p>
        <button type="button" class="btn btn-primary" id="btn-retry-load">Coba Lagi</button>
      </div>
    `;
    main.querySelector('#btn-retry-load')?.addEventListener('click', () => refreshAll(scene));
    return;
  }

  const ctx = { openTxModal, navigate, scene };
  switch (state.route) {
    case 'transactions':
      renderTransactions(main, ctx);
      break;
    case 'import':
      renderBankImport(main, ctx);
      break;
    case 'planning':
      renderPlanning(main, ctx);
      break;
    case 'print':
      renderPrintStudio(main, ctx);
      break;
    case 'settings':
      renderSettings(main, ctx);
      break;
    default:
      renderDashboard(main, ctx);
  }
}

// Escape closes any open modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot && modalRoot.innerHTML) {
      modalRoot.innerHTML = '';
    }
  }
});

window.addEventListener('dm:unauthorized', () => {
  renderApp();
});

subscribe(() => {
  if (getToken()) renderApp();
});

async function boot() {
  state.user = getSavedUser();
  try {
    const h = await api.health();
    state.initialized = Boolean(h.initialized);
  } catch {
    state.initialized = true;
  }

  if (getToken()) {
    renderApp();
    await refreshAll(scene);
  } else {
    renderApp();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
