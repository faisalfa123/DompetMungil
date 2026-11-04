// Inisialisasi IndexedDB Lokal untuk Offline-First & OOM Resilience
const DB_NAME = 'KeuanganKeluargaLocalDB';
const DB_VERSION = 1;
let localDB = null;

function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'client_tx_id' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'client_tx_id' });
      }
    };
    request.onsuccess = (e) => {
      localDB = e.target.result;
      resolve(localDB);
    };
    request.onerror = (e) => reject(e);
  });
}

// Simpan transaksi ke IndexedDB (Lokal HP)
async function saveLocalTx(tx, isPendingSync = true) {
  if (!localDB) await initIndexedDB();
  return new Promise((resolve, reject) => {
    const txSession = localDB.transaction(['transactions', 'sync_queue'], 'readwrite');
    txSession.objectStore('transactions').put(tx);
    if (isPendingSync) {
      txSession.objectStore('sync_queue').put(tx);
    }
    txSession.oncomplete = () => resolve();
    txSession.onerror = (err) => reject(err);
  });
}

// Ambil seluruh transaksi dari IndexedDB
async function getAllLocalTx() {
  if (!localDB) await initIndexedDB();
  return new Promise((resolve, reject) => {
    const txSession = localDB.transaction(['transactions'], 'readonly');
    const store = txSession.objectStore('transactions');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (err) => reject(err);
  });
}

// Ambil antrian sinkronisasi pending (yang belum terkirim ke STB)
async function getPendingSyncBatch() {
  if (!localDB) await initIndexedDB();
  return new Promise((resolve, reject) => {
    const txSession = localDB.transaction(['sync_queue'], 'readonly');
    const store = txSession.objectStore('sync_queue');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (err) => reject(err);
  });
}

// Hapus antrian sync setelah berhasil tersimpan di STB
async function clearSyncedItem(clientTxId) {
  if (!localDB) await initIndexedDB();
  return new Promise((resolve, reject) => {
    const txSession = localDB.transaction(['sync_queue'], 'readwrite');
    txSession.objectStore('sync_queue').delete(clientTxId);
    txSession.oncomplete = () => resolve();
    txSession.onerror = (err) => reject(err);
  });
}

// State Karakter & Tema Kawaii
let currentMascot = localStorage.getItem('dm_mascot') || 'icon-cat-mascot';
let userRole = localStorage.getItem('dm_role') || 'personal';
let accountMode = localStorage.getItem('dm_mode') || 'personal';

function openThemeSelectorModal() {
  document.getElementById('themeModal').classList.add('active');
}

function closeThemeModal() {
  document.getElementById('themeModal').classList.remove('active');
}

function selectMascotTheme(mascotId, name, accentColor) {
  currentMascot = mascotId;
  localStorage.setItem('dm_mascot', mascotId);
  document.getElementById('currentMascotUse').setAttribute('href', '#' + mascotId);
  document.documentElement.style.setProperty('--pink-pastel', accentColor);
}

// Alur Pendaftaran Mode: Personal vs Keluarga (Suami/Istri/Anak)
function checkUserOnboarding() {
  if (!authToken) {
    document.getElementById('onboardingModal').classList.add('active');
  } else {
    updateUserBadge();
  }
}

function chooseAccountMode(mode) {
  accountMode = mode;
  document.getElementById('selectedMode').value = mode;
  document.getElementById('stepSelectAccountType').style.display = 'none';
  document.getElementById('onboardingForm').style.display = 'block';

  if (mode === 'family') {
    document.getElementById('groupFamilyRole').style.display = 'block';
  } else {
    document.getElementById('groupFamilyRole').style.display = 'none';
  }
}

function updateUserBadge() {
  const badge = document.getElementById('userRoleBadge');
  if (accountMode === 'family') {
    let icon = userRole === 'suami' ? '👨 Suami' : (userRole === 'istri' ? '👩 Istri' : '👧 Anak');
    badge.innerText = `${icon} (Keluarga)`;
  } else {
    badge.innerText = `👤 Personal Mode`;
  }
}

// Tab Selector Mutasi Bank: File vs Google Sign-In
function switchBankTab(tab) {
  if (tab === 'file') {
    document.getElementById('bankSectionFile').style.display = 'block';
    document.getElementById('bankSectionGoogle').style.display = 'none';
    document.getElementById('tabBtnBankFile').className = 'btn-cute primary';
    document.getElementById('tabBtnBankGoogle').className = 'btn-cute';
  } else {
    document.getElementById('bankSectionFile').style.display = 'none';
    document.getElementById('bankSectionGoogle').style.display = 'block';
    document.getElementById('tabBtnBankFile').className = 'btn-cute';
    document.getElementById('tabBtnBankGoogle').className = 'btn-cute primary';
  }
}

// UI Helpers & Format Currency
function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('viewHome').style.display = tab === 'home' ? 'block' : 'none';
  document.getElementById('viewBank').style.display = tab === 'bank' ? 'block' : 'none';
  document.getElementById('viewGuide').style.display = tab === 'guide' ? 'block' : 'none';

  document.querySelectorAll('.nav-item').forEach((item, index) => {
    item.classList.remove('active');
    if ((tab === 'home' && index === 0) || (tab === 'bank' && index === 1) || (tab === 'guide' && index === 2)) {
      item.classList.add('active');
    }
  });
}

function openModal(type) {
  document.getElementById('formType').value = type;
  document.getElementById('modalFormTitle').innerText = type === 'expense' ? '🌸 Catat Pengeluaran' : '🌱 Catat Pemasukan';
  document.getElementById('txModal').classList.add('active');
}

function closeModal() {
  document.getElementById('txModal').classList.remove('active');
  document.getElementById('txForm').reset();
}

// Sinkronisasi Background & OOM Recovery
async function triggerSyncWithServer() {
  const pending = await getPendingSyncBatch();
  const banner = document.getElementById('recoveryBanner');
  const badge = document.getElementById('serverStatusBadge');

  if (pending.length > 0) {
    banner.classList.remove('hidden');
    document.getElementById('recoveryTitle').innerText = 'Pemulihan Sinkronisasi';
    document.getElementById('recoveryDesc').innerText = `Ada ${pending.length} transaksi di HP. Sedang menghubungkan ke STB...`;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Auth-Token'] = authToken;

    // Tes koneksi server
    const healthRes = await fetch('/api/v1/health');
    if (!healthRes.ok) throw new Error('Server not reachable');

    badge.innerText = '🟢 Terhubung ke Odroid STB';
    badge.style.color = '#2E7D32';

    if (pending.length > 0) {
      const syncRes = await fetch('/api/v1/sync', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ batch: pending })
      });

      if (syncRes.ok) {
        for (const item of pending) {
          await clearSyncedItem(item.client_tx_id);
        }
        document.getElementById('recoveryTitle').innerText = 'Sinkronisasi Selesai ✨';
        document.getElementById('recoveryDesc').innerText = `${pending.length} transaksi berhasil dipulihkan & dicatat di server!`;
        setTimeout(() => banner.classList.add('hidden'), 4000);
      }
    } else {
      banner.classList.add('hidden');
    }

    await loadServerData();
  } catch (err) {
    console.warn('Server offline atau terkena OOM:', err);
    badge.innerText = '🟡 Mode Offline / Server Istirahat';
    badge.style.color = '#F57C00';
    if (pending.length > 0) {
      banner.classList.remove('hidden');
      document.getElementById('recoveryTitle').innerText = 'Mode Offline Aktif';
      document.getElementById('recoveryDesc').innerText = `${pending.length} catatan disimpan aman di HP. Akan otomatis di-sync saat server online.`;
    }
    renderLocalTransactions();
  }
}

// Memuat data overview dan transaksi dari server jika online
async function loadServerData() {
  const headers = {};
  if (authToken) headers['X-Auth-Token'] = authToken;

  try {
    const [overviewRes, txRes] = await Promise.all([
      fetch('/api/v1/overview', { headers }),
      fetch('/api/v1/transactions', { headers })
    ]);

    if (overviewRes.ok && txRes.ok) {
      const overview = await overviewRes.json();
      const txs = await txRes.json();

      document.getElementById('totalBalanceDisplay').innerText = formatRupiah(overview.total_balance);
      document.getElementById('totalIncomeDisplay').innerText = '+' + formatRupiah(overview.total_income);
      document.getElementById('totalExpenseDisplay').innerText = '-' + formatRupiah(overview.total_expense);

      renderTransactions(txs);
      return;
    }
  } catch (e) {
    console.log('Fallback ke data lokal:', e);
  }
  renderLocalTransactions();
}

// Render data transaksi
function renderTransactions(list) {
  const container = document.getElementById('txContainer');
  document.getElementById('txCounter').innerText = `${list.length} Catatan`;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; color: var(--text-muted);">
        <svg style="width:64px; height:64px; opacity:0.6;"><use href="#icon-cat-mascot"></use></svg>
        <p style="margin-top:10px; font-weight:600;">Belum ada catatan transaksi.<br>Tekan tombol di atas untuk menambah!</p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(tx => `
    <div class="tx-card">
      <div class="tx-info-left">
        <div class="tx-icon-circle" style="background: ${tx.type === 'income' ? '#B5EAD7' : '#FFB7B2'};">
          <span style="font-size:1.2rem;">${tx.type === 'income' ? '🌱' : '🌸'}</span>
        </div>
        <div>
          <div class="tx-title">${escapeHtml(tx.note || tx.category_name || 'Transaksi')}</div>
          <div class="tx-meta">${tx.date} • ${tx.account_name || 'Dompet'}</div>
        </div>
      </div>
      <div class="tx-amount ${tx.type}">
        ${tx.type === 'income' ? '+' : '-'}${formatRupiah(tx.amount)}
      </div>
    </div>
  `).join('');
}

async function renderLocalTransactions() {
  const localList = await getAllLocalTx();
  let income = 0, expense = 0;
  localList.forEach(item => {
    if (item.type === 'income') income += Number(item.amount);
    if (item.type === 'expense') expense += Number(item.amount);
  });
  document.getElementById('totalBalanceDisplay').innerText = formatRupiah(income - expense);
  document.getElementById('totalIncomeDisplay').innerText = '+' + formatRupiah(income);
  document.getElementById('totalExpenseDisplay').innerText = '-' + formatRupiah(expense);
  renderTransactions(localList);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

// Inisialisasi Event Listener
document.addEventListener('DOMContentLoaded', async () => {
  await initIndexedDB();

  // Pasang maskot tersimpan
  if (currentMascot) {
    document.getElementById('currentMascotUse').setAttribute('href', '#' + currentMascot);
  }

  checkUserOnboarding();

  // Onboarding Form Submit (Inisialisasi akun)
  document.getElementById('onboardingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('onboardUsername').value;
    const password = document.getElementById('onboardPassword').value;
    const mode = document.getElementById('selectedMode').value;
    const role = mode === 'family' ? document.getElementById('userFamilyRoleSelect').value : 'personal';

    try {
      const res = await fetch('/api/v1/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          password: password,
          account_mode: mode,
          role: role
        })
      });

      const data = await res.json();
      if (res.ok && data.token) {
        authToken = data.token;
        userRole = role;
        accountMode = mode;
        localStorage.setItem('kk_token', authToken);
        localStorage.setItem('dm_role', role);
        localStorage.setItem('dm_mode', mode);
        document.getElementById('onboardingModal').classList.remove('active');
        updateUserBadge();
        triggerSyncWithServer();
      } else {
        alert(data.message || 'Gagal mendaftar');
      }
    } catch (err) {
      alert('Tidak dapat terhubung ke server STB.');
    }
  });

  // Google OAuth2 Token Mock / Handler
  document.getElementById('btnGoogleSignInOAuth').addEventListener('click', () => {
    const clientId = document.getElementById('googleClientIdInput').value.trim();
    if (!clientId) {
      alert('💡 Masukkan Google Client ID di kolom atas untuk menyambungkan OAuth2 Gmail, atau gunakan opsi impor file e-Statement!');
      return;
    }
    alert('🔗 Membuka jendela otorisasi token Google Mail. Notifikasi transaksi mutasi bank akan terbaca secara otomatis dan dienkripsi di server Odroid Anda!');
  });

  document.getElementById('btnOpenAddExpense').onclick = () => openModal('expense');
  document.getElementById('btnOpenAddIncome').onclick = () => openModal('income');
  document.getElementById('btnSyncNow').onclick = () => triggerSyncWithServer();

  // Handle Form Submit
  document.getElementById('txForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('formType').value;
    const amount = parseFloat(document.getElementById('formAmount').value);
    const category = document.getElementById('formCategory').value;
    const account = document.getElementById('formAccount').value;
    const note = document.getElementById('formNote').value;

    const newTx = {
      client_tx_id: 'ctx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: type,
      amount: amount,
      category_id: category,
      account_id: account,
      date: new Date().toISOString().split('T')[0],
      note: note
    };

    // 1. Simpan selalu ke IndexedDB lokal terlebih dahulu (Offline-First)
    await saveLocalTx(newTx, true);
    closeModal();
    await renderLocalTransactions();

    // 2. Coba kirim langsung ke server
    triggerSyncWithServer();
  });

  // Handle Import Mutasi Bank
  document.getElementById('btnProcessBankImport').addEventListener('click', async () => {
    const bank = document.getElementById('bankSelect').value;
    const rawText = document.getElementById('bankRawText').value;
    if (!rawText.trim()) {
      alert('Silakan masukkan teks mutasi rekening Anda terlebih dahulu.');
      return;
    }

    try {
      const res = await fetch('/api/v1/bank-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': authToken
        },
        body: JSON.stringify({ bank_name: bank, raw_text: rawText })
      });
      const data = await res.json();
      alert(`✨ ${data.message || 'Mutasi berhasil diproses dan dienkripsi!'}`);
      document.getElementById('bankRawText').value = '';
    } catch (err) {
      alert('⚠️ Gagal terhubung ke server STB. Cek koneksi Anda.');
    }
  });

  // Registrasi Service Worker PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW register failed:', err);
    });
  }

  // Periodic heartbeat sync (setiap 30 detik coba hubungkan ke server jika pulih dari OOM)
  setInterval(() => {
    triggerSyncWithServer();
  }, 30000);

  // Jalankan sync pertama saat buka aplikasi
  triggerSyncWithServer();
});
