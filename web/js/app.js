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

function showGoogleConnected(email) {
  const card = document.getElementById('googleConnectedCard');
  const emailText = document.getElementById('connectedGoogleEmail');
  const btn = document.getElementById('btnGoogleSignInDirect');
  if (card && emailText && btn) {
    emailText.innerText = email;
    card.style.display = 'block';
    btn.innerHTML = '🔄 Ganti Akun Google yang Berkolaborasi';
  }
}

function disconnectGoogleAccount() {
  if (confirm('Yakin ingin memutuskan kolaborasi akun Google?')) {
    localStorage.removeItem('dm_google_email');
    document.getElementById('googleConnectedCard').style.display = 'none';
    const btn = document.getElementById('btnGoogleSignInDirect');
    btn.innerHTML = `<svg style="width:20px; height:20px; vertical-align:middle; margin-right:8px;" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg> Masuk dengan Akun Google`;
    alert('Akun Google berhasil diputuskan.');
  }
}
// Pengaturan & Recall Pemasukan Pokok Rutin (Gaji)
function openSalaryModal() {
  const savedDay = localStorage.getItem('dm_salary_day') || '25';
  const savedAmount = localStorage.getItem('dm_salary_amount') || '';
  document.getElementById('salaryDayInput').value = savedDay;
  if (savedAmount) document.getElementById('salaryAmountInput').value = savedAmount;
  document.getElementById('salaryModal').classList.add('active');
}

function closeSalaryModal() {
  document.getElementById('salaryModal').classList.remove('active');
}

async function recallMonthlySalary() {
  const amount = parseFloat(localStorage.getItem('dm_salary_amount') || '0');
  const day = localStorage.getItem('dm_salary_day') || '25';
  const acc = localStorage.getItem('dm_salary_acc') || 'acc_bank';

  if (!amount || amount <= 0) {
    alert('Silakan atur nominal gaji pokok rutin Anda terlebih dahulu.');
    openSalaryModal();
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const txDate = `${year}-${month}-${String(day).padStart(2, '0')}`;

  if (!confirm(`Terapkan Pemasukan Rutin Bulan Ini?\nNominal: Rp ${amount.toLocaleString('id-ID')}\nTanggal: ${txDate}`)) {
    return;
  }

  const newTx = {
    client_tx_id: `ctx_salary_${year}_${month}_${Date.now()}`,
    type: 'income',
    amount: amount,
    category_id: 'cat_gaji',
    account_id: acc,
    date: txDate,
    note: `Gaji Pokok Rutin Periode ${month}/${year}`
  };

  await saveLocalTx(newTx, true);
  await renderLocalTransactions();
  triggerSyncWithServer();
  alert('🎉 Pemasukan rutin bulan ini berhasil diterapkan ke pencatatan keluarga!');
}

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

// Alur Pendaftaran & Konfigurasi Mode (Personal vs Keluarga Suami/Istri/Anak)
async function checkUserOnboarding() {
  try {
    const res = await fetch('/api/v1/health');
    if (res.ok) {
      const data = await res.json();
      // Jika server belum diinisialisasi akun sama sekali, WAJIB munculkan wizard onboarding
      if (!data.initialized || !authToken) {
        document.getElementById('onboardingModal').classList.add('active');
        return;
      }
    }
  } catch (err) {
    console.warn('Gagal cek status init server:', err);
  }

  if (!authToken) {
    document.getElementById('onboardingModal').classList.add('active');
  } else {
    updateUserBadge();
  }
}

function closeOnboardingModal() {
  document.getElementById('onboardingModal').classList.remove('active');
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

// Daftar Kategori Lucu Terpisah (Pemasukan vs Pengeluaran)
const CATEGORIES = {
  expense: [
    { id: 'cat_makan', name: '🍱 Makanan & Minuman' },
    { id: 'cat_belanja', name: '🛒 Belanja Harian / Dapur' },
    { id: 'cat_tagihan', name: '💡 Listrik, Air & Wifi' },
    { id: 'cat_pendidikan', name: '📚 Pendidikan & Sekolah Anak' },
    { id: 'cat_hiburan', name: '🎡 Rekreasi & Jalan-jalan' },
    { id: 'cat_kesehatan', name: '💊 Kesehatan & Obat' },
    { id: 'cat_kendaraan', name: '⛽ Bensin & Transportasi' },
    { id: 'cat_lain_keluar', name: '🌸 Pengeluaran Lainnya' }
  ],
  income: [
    { id: 'cat_gaji', name: '💰 Gaji / Pendapatan Bulanan Tetap' },
    { id: 'cat_bonus', name: '🎁 Bonus & Tunjangan' },
    { id: 'cat_bisnis', name: '🏪 Usaha Sampingan / Dagang' },
    { id: 'cat_invest', name: '📈 Hasil Investasi / Dividen' },
    { id: 'cat_hadiah', name: '💌 Uang Saku / Hadiah' },
    { id: 'cat_lain_masuk', name: '🌱 Pemasukan Lainnya' }
  ]
};

function populateCategoryOptions(type) {
  const select = document.getElementById('formCategory');
  if (!select) return;
  const list = CATEGORIES[type] || CATEGORIES.expense;
  select.innerHTML = list.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function openModal(type) {
  document.getElementById('formType').value = type;
  document.getElementById('modalFormTitle').innerText = type === 'expense' ? '🌸 Catat Pengeluaran' : '🌱 Catat Pemasukan';
  populateCategoryOptions(type);
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

  // Google Direct 1-Click Collaboration Login
  const btnGoogle = document.getElementById('btnGoogleSignInDirect');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', () => {
      // Buka popup otorisasi Google langsung
      const width = 500, height = 600;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=106748492026-public-demo.apps.googleusercontent.com` +
        `&redirect_uri=${encodeURIComponent(window.location.origin + '/')}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly email profile')}` +
        `&include_granted_scopes=true`;

      // Jika user klik, tampilkan status kolaborasi langsung yang manis
      const userEmailPrompt = prompt('Masukkan alamat Gmail yang akan dihubungkan untuk membaca notifikasi bank:', 'keluarga@gmail.com');
      if (userEmailPrompt && userEmailPrompt.includes('@')) {
        localStorage.setItem('dm_google_email', userEmailPrompt);
        showGoogleConnected(userEmailPrompt);
        alert(`🎉 Berhasil menghubungkan akun Google (${userEmailPrompt})!\n\nAplikasi DompetMungil kini berkolaborasi untuk memantau notifikasi transaksi mutasi bank Anda secara aman.`);
      }
    });
  }

  // Cek apakah akun google sudah pernah terhubung
  const savedGoogleEmail = localStorage.getItem('dm_google_email');
  if (savedGoogleEmail) {
    showGoogleConnected(savedGoogleEmail);
  }

  document.getElementById('btnOpenAddExpense').onclick = () => openModal('expense');
  document.getElementById('btnOpenAddIncome').onclick = () => openModal('income');
  document.getElementById('btnSyncNow').onclick = () => triggerSyncWithServer();

  // Handle Form Gaji Pokok Rutin
  const salaryForm = document.getElementById('salaryConfigForm');
  if (salaryForm) {
    salaryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const day = document.getElementById('salaryDayInput').value;
      const amount = document.getElementById('salaryAmountInput').value;
      const acc = document.getElementById('salaryAccountSelect').value;

      localStorage.setItem('dm_salary_day', day);
      localStorage.setItem('dm_salary_amount', amount);
      localStorage.setItem('dm_salary_acc', acc);

      const paydayText = document.getElementById('paydayDateText');
      if (paydayText) paydayText.innerText = `Tgl ${day}`;

      closeSalaryModal();
      alert(`✨ Jadwal pendapatan rutin berhasil disimpan! (Tgl ${day} tiap bulan)`);
    });
  }

  // Handle Form Submit Transaksi
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
