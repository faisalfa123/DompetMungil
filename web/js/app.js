// Inisialisasi IndexedDB Lokal untuk Offline-First & OOM Resilience
const DB_NAME = 'KeuanganKeluargaLocalDB';
const DB_VERSION = 1;
let localDB = null;

// 🌸 Sistem Popup Alert & Konfirmasi Custom Kawaii (Pengganti Bawaan Browser)
function showCuteAlert(message, title = 'Pemberitahuan 🌸') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('customDialogOverlay');
    const titleEl = document.getElementById('customDialogTitle');
    const msgEl = document.getElementById('customDialogMessage');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const mascotSvg = document.querySelector('#customDialogMascotSvg use');

    if (!overlay || !msgEl || !confirmBtn) {
      console.log(message);
      resolve();
      return;
    }

    if (mascotSvg && typeof currentMascot !== 'undefined') {
      mascotSvg.setAttribute('href', '#' + currentMascot);
    }

    if (titleEl) titleEl.innerText = title;
    msgEl.innerText = message;
    if (cancelBtn) cancelBtn.style.display = 'none';
    confirmBtn.innerText = 'Oke, Mengerti ✨';

    const closeHandler = () => {
      overlay.classList.remove('active');
      confirmBtn.removeEventListener('click', closeHandler);
      resolve();
    };

    confirmBtn.onclick = closeHandler;
    overlay.classList.add('active');
  });
}

function showCuteConfirm(message, title = 'Konfirmasi 🐾', confirmText = 'Ya, Lanjutkan ✨', cancelText = 'Batal') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('customDialogOverlay');
    const titleEl = document.getElementById('customDialogTitle');
    const msgEl = document.getElementById('customDialogMessage');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const mascotSvg = document.querySelector('#customDialogMascotSvg use');

    if (!overlay || !msgEl || !confirmBtn || !cancelBtn) {
      resolve(true);
      return;
    }

    if (mascotSvg && typeof currentMascot !== 'undefined') {
      mascotSvg.setAttribute('href', '#' + currentMascot);
    }

    if (titleEl) titleEl.innerText = title;
    msgEl.innerText = message;
    cancelBtn.style.display = 'inline-flex';
    cancelBtn.innerText = cancelText;
    confirmBtn.innerText = confirmText;

    confirmBtn.onclick = () => {
      overlay.classList.remove('active');
      resolve(true);
    };

    cancelBtn.onclick = () => {
      overlay.classList.remove('active');
      resolve(false);
    };

    overlay.classList.add('active');
  });
}

// Ganti window.alert bawaan browser agar otomatis memakai popup custom kawaii
window.alert = function(msg) {
  let title = 'Pemberitahuan 🌸';
  const str = String(msg || '');
  if (str.includes('🎉') || str.includes('🎊') || str.includes('✅') || str.includes('✨') || str.includes('🪙')) {
    title = 'Berhasil! 🎉';
  } else if (str.includes('⚠️') || str.includes('❌') || str.includes('Gagal')) {
    title = 'Perhatian 🐾';
  }
  return showCuteAlert(str, title);
};


// Deteksi lingkungan GitHub Pages / Static Hosting (tanpa backend Go aktif)
const IS_STATIC_DEMO_HOST = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

if (IS_STATIC_DEMO_HOST) {
  // Aktifkan sesi demo otomatis di browser
  if (!localStorage.getItem('kk_token')) {
    localStorage.setItem('kk_token', 'demo_token_gh_pages');
    localStorage.setItem('dm_role', 'suami');
    localStorage.setItem('dm_mode', 'family');
  }

  // Intersep fetch agar demo di GitHub Pages berfungsi penuh layaknya terhubung ke server Go
  (function() {
    const originalFetch = window.fetch;
    let mockBudgets = JSON.parse(localStorage.getItem('dm_mock_budgets') || 'null') || [
      { category_id: 'cat_makan', name: '🍱 Makanan & Minuman', icon: 'cute-cat-food', color: '#FFB7B2', budget: 2500000, spent: 1100000 },
      { category_id: 'cat_belanja', name: '🛒 Belanja Harian', icon: 'cute-shopping-basket', color: '#B5EAD7', budget: 1500000, spent: 450000 },
      { category_id: 'cat_tagihan', name: '💡 Listrik & Wifi', icon: 'cute-bill-light', color: '#E2F0CB', budget: 1000000, spent: 850000 },
      { category_id: 'cat_pendidikan', name: '📚 Pendidikan Anak', icon: 'cute-book-pencil', color: '#C7CEEA', budget: 2500000, spent: 1200000 },
      { category_id: 'cat_hiburan', name: '🎡 Rekreasi & Liburan', icon: 'cute-ticket-star', color: '#FFDAC1', budget: 1000000, spent: 1150000 }
    ];

    window.fetch = async function(url, options = {}) {
      const urlStr = String(url);
      const method = (options.method || 'GET').toUpperCase();

      if (urlStr.includes('/api/v1/health')) {
        return new Response(JSON.stringify({
          status: 'operational (GitHub Pages Demo)',
          version: '1.0.0-ghpages',
          uptime_seconds: 7200,
          memory_footprint: '< 20MB',
          oom_recovered: true,
          initialized: true
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/v1/overview')) {
        const localList = await getAllLocalTx();
        let income = 18000000, expense = 4750000;
        localList.forEach(t => {
          if (t.type === 'income') income += Number(t.amount);
          if (t.type === 'expense') expense += Number(t.amount);
        });
        return new Response(JSON.stringify({
          total_balance: income - expense,
          total_income: income,
          total_expense: expense,
          net_savings: income - expense,
          updated_at: new Date().toISOString()
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/v1/budgets')) {
        if (method === 'POST') {
          const body = JSON.parse(options.body || '{}');
          const existing = mockBudgets.find(b => b.category_id === body.category_id);
          if (existing) {
            existing.budget = Number(body.amount);
          } else {
            mockBudgets.push({ category_id: body.category_id, name: body.category_id, icon: '', color: '#FFB7B2', budget: Number(body.amount), spent: 0 });
          }
          localStorage.setItem('dm_mock_budgets', JSON.stringify(mockBudgets));
          return new Response(JSON.stringify({ status: 'ok', message: 'Anggaran kategori berhasil diperbarui ✨' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(mockBudgets), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/v1/auth/login')) {
        const body = JSON.parse(options.body || '{}');
        return new Response(JSON.stringify({
          token: 'demo_token_' + Date.now(),
          user_id: 'usr_demo',
          username: body.username || 'demo_user',
          account_mode: 'family',
          role: 'suami'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/v1/auth/init')) {
        const body = JSON.parse(options.body || '{}');
        return new Response(JSON.stringify({
          message: 'Akun demo berhasil diaktifkan!',
          token: 'demo_token_' + Date.now(),
          user_id: 'usr_demo',
          username: body.username,
          account_mode: body.account_mode || 'personal',
          role: body.role || 'personal'
        }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/v1/transactions')) {
        if (method === 'POST') {
          const body = JSON.parse(options.body || '{}');
          return new Response(JSON.stringify({
            id: 'tx_demo_' + Date.now(),
            client_tx_id: body.client_tx_id,
            status: 'saved'
          }), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        // Ambil transaksi lokal ditambah sampel demo jika masih baru
        const localList = await getAllLocalTx();
        if (localList.length === 0) {
          const sampleTxs = [
            { client_tx_id: 'ctx_init_1', type: 'income', amount: 15000000, date: '2026-11-01', note: 'Gaji Pokok Bulanan Ayah', account_name: 'Rekening Bank', category_name: 'Gaji Bulanan', author: 'ayah' },
            { client_tx_id: 'ctx_init_2', type: 'expense', amount: 750000, date: '2026-11-02', note: 'Belanja Mingguan Sayur & Buah Segar', account_name: 'Dompet Tunai', category_name: 'Belanja Harian', author: 'ibu' },
            { client_tx_id: 'ctx_init_3', type: 'expense', amount: 850000, date: '2026-11-03', note: 'Token Listrik PLN & Tagihan Wifi Rumah', account_name: 'Rekening Bank', category_name: 'Listrik, Air & Wifi', author: 'ayah' },
            { client_tx_id: 'ctx_init_4', type: 'expense', amount: 1200000, date: '2026-11-04', note: 'Buku Pelajaran & Les Kursus Anak', account_name: 'Rekening Bank', category_name: 'Pendidikan Anak', author: 'ibu' },
            { client_tx_id: 'ctx_init_5', type: 'expense', amount: 350000, date: '2026-11-05', note: 'Uang Saku & Jajan Anak', account_name: 'E-Wallet', category_name: 'Makanan & Minuman', author: 'anak' },
            { client_tx_id: 'ctx_init_6', type: 'income', amount: 3000000, date: '2026-11-05', note: 'Hasil Penjualan Toko Online Sampingan', account_name: 'Rekening Bank', category_name: 'Bonus & Hadiah', author: 'ibu' }
          ];
          for (const s of sampleTxs) {
            await saveLocalTx(s, false);
          }
          return new Response(JSON.stringify(sampleTxs), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(localList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/v1/sync')) {
        return new Response(JSON.stringify({
          status: 'synced',
          synced_count: 1,
          message: 'Transaksi berhasil disinkronisasi ke memori demo!'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        return await originalFetch(url, options);
      } catch (err) {
        return new Response(JSON.stringify({ status: 'offline', message: 'Demo offline' }), { status: 200 });
      }
    };
  })();
}

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

// Hapus transaksi dari IndexedDB (Lokal HP)
async function deleteLocalTx(clientTxId) {
  if (!localDB) await initIndexedDB();
  return new Promise((resolve, reject) => {
    const txSession = localDB.transaction(['transactions', 'sync_queue'], 'readwrite');
    txSession.objectStore('transactions').delete(clientTxId);
    txSession.objectStore('sync_queue').delete(clientTxId);
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

// Konfigurasi Google Client ID (Desktop App)
function getGoogleClientId() {
  return localStorage.getItem('dm_google_client_id') || '';
}

function switchGmailMethod(method) {
  const tabAppPass = document.getElementById('tabBtnGmailAppPass');
  const tabOAuth = document.getElementById('tabBtnGmailOAuth');
  const secAppPass = document.getElementById('gmailMethodAppPass');
  const secOAuth = document.getElementById('gmailMethodOAuth');

  if (method === 'app_pass') {
    if (tabAppPass) tabAppPass.className = 'btn-cute primary';
    if (tabOAuth) tabOAuth.className = 'btn-cute';
    if (secAppPass) secAppPass.style.display = 'block';
    if (secOAuth) secOAuth.style.display = 'none';
  } else {
    if (tabAppPass) tabAppPass.className = 'btn-cute';
    if (tabOAuth) tabOAuth.className = 'btn-cute primary';
    if (secAppPass) secAppPass.style.display = 'none';
    if (secOAuth) secOAuth.style.display = 'block';
  }
}

function openGmailAppPassGuide() {
  const details = document.getElementById('gmailAppPassDetails');
  if (details) {
    details.open = true;
    details.scrollIntoView({ behavior: 'smooth' });
  }
}

async function saveAndTestGmailAppPass() {
  const emailInput = document.getElementById('gmailUserEmail');
  const passInput = document.getElementById('gmailAppPassword');
  if (!emailInput || !passInput) return;

  const email = emailInput.value.trim();
  const rawPass = passInput.value.replace(/\s+/g, '').trim();

  if (!email || !email.includes('@')) {
    await showCuteAlert('Harap masukkan alamat Gmail yang valid!', 'Alamat Email Salah 💌');
    emailInput.focus();
    return;
  }

  if (!rawPass || rawPass.length < 16) {
    await showCuteAlert('Sandi aplikasi Google terdiri dari 16 karakter huruf.\n\nContoh: abcd efgh ijkl mnop\n\nBuka tombol "Cara Buat" jika belum memiliki sandi aplikasi.', 'Sandi Aplikasi Belum Lengkap 🔑');
    passInput.focus();
    return;
  }

  localStorage.setItem('dm_gmail_method', 'app_pass');
  localStorage.setItem('dm_gmail_email', email);
  localStorage.setItem('dm_gmail_app_password', rawPass);

  showGoogleConnected(email, 'Sandi Aplikasi (16 Digit Aktif)');
  await showCuteAlert(`Hore! Akun Gmail ${email} berhasil disimpan secara aman di memori lokal STB.\n\nNotifikasi transaksi bank & e-wallet akan disinkronkan otomatis!`, 'Gmail Berhasil Terhubung! 🎉');
}

function saveGoogleClientId() {
  const input = document.getElementById('customGoogleClientId');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    showCuteAlert('Silakan masukkan Google Client ID Anda terlebih dahulu.', 'Client ID Kosong ⚠️');
    return;
  }
  localStorage.setItem('dm_google_client_id', val);
  showCuteAlert('Google Client ID berhasil disimpan!', 'Sukses Simpan 🔑');
}

// Periksa URL callback kembalian dari Google OAuth2
function checkGoogleAuthRedirectCallback() {
  const hash = window.location.hash;
  const search = window.location.search;

  if (hash) {
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      localStorage.setItem('dm_gmail_method', 'oauth');
      localStorage.setItem('dm_google_oauth_token', token);
      localStorage.setItem('dm_google_email', 'Akun Google Tertaut');
      window.location.hash = '';
      showCuteAlert('Hore! DompetMungil sekarang resmi tertaut dengan Akun Google Anda!', 'Google OAuth Terhubung! 🎉');
      showGoogleConnected('Akun Google Tertaut', 'Google OAuth2 (Resmi)');
    }
  } else if (search) {
    const params = new URLSearchParams(search);
    const code = params.get('code');
    if (code) {
      localStorage.setItem('dm_gmail_method', 'oauth');
      localStorage.setItem('dm_google_oauth_code', code);
      localStorage.setItem('dm_google_email', 'Akun Google Tertaut');
      showCuteAlert('Hore! DompetMungil sekarang resmi tertaut dengan Akun Google Anda!', 'Google OAuth Terhubung! 🎉');
      showGoogleConnected('Akun Google Tertaut', 'Google OAuth2 (Resmi)');
    }
  }
}

function showGoogleConnected(email, methodTitle = 'Terhubung & Aktif') {
  const card = document.getElementById('googleConnectedCard');
  const emailText = document.getElementById('connectedGoogleEmail');
  const methodText = document.getElementById('connectedGoogleMethod');
  const btn = document.getElementById('btnRedirectGoogleOAuth');
  if (card && emailText) {
    emailText.innerText = email;
    if (methodText) methodText.innerText = `Status: ${methodTitle}`;
    card.style.display = 'block';
  }
  if (btn) {
    btn.innerHTML = '🔄 Tautkan Ulang / Ganti Akun Google';
  }
}

async function disconnectGoogleAccount() {
  const ok = await showCuteConfirm('Yakin ingin memutuskan koneksi akun Gmail?', 'Putuskan Akun Gmail 💌', 'Ya, Putuskan', 'Batal');
  if (ok) {
    localStorage.removeItem('dm_gmail_method');
    localStorage.removeItem('dm_gmail_email');
    localStorage.removeItem('dm_gmail_app_password');
    localStorage.removeItem('dm_google_email');
    localStorage.removeItem('dm_google_oauth_token');
    localStorage.removeItem('dm_google_oauth_code');

    const emailInput = document.getElementById('gmailUserEmail');
    const passInput = document.getElementById('gmailAppPassword');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';

    document.getElementById('googleConnectedCard').style.display = 'none';
    const btn = document.getElementById('btnRedirectGoogleOAuth');
    if (btn) {
      btn.innerHTML = `<svg style="width:20px; height:20px; vertical-align:middle; margin-right:8px;" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg> Tautkan Akun Google Sekarang (Redirect Resmi)`;
    }
    alert('Tautan akun Google berhasil diputuskan.');
  }
}
let authToken = localStorage.getItem('kk_token') || '';
let userRole = localStorage.getItem('dm_role') || 'personal';
let accountMode = localStorage.getItem('dm_mode') || 'personal';
let currentMascot = localStorage.getItem('dm_mascot') || 'icon-cat-mascot';
let currentTab = 'home';

// Tema & Karakter Maskot Kawaii dengan Palet Warna Lengkap
const MASCOT_THEMES = {
  'icon-cat-mascot': {
    name: 'Kucing Kawaii (Neko)',
    primary: '#FFB7B2',
    hover: '#FFAAA6',
    bg: '#FFF8FA',
    cardGradient: 'linear-gradient(135deg, #FFB7B2 0%, #FFDAC1 100%)'
  },
  'icon-dog-mascot': {
    name: 'Shiba Inu Lucu',
    primary: '#F4A261',
    hover: '#E76F51',
    bg: '#FFFDF9',
    cardGradient: 'linear-gradient(135deg, #F4A261 0%, #E9C46A 100%)'
  },
  'icon-capybara-mascot': {
    name: 'Capybara Santai',
    primary: '#B08968',
    hover: '#7F5539',
    bg: '#FAF7F2',
    cardGradient: 'linear-gradient(135deg, #B08968 0%, #DDB892 100%)'
  },
  'icon-bunny-mascot': {
    name: 'Usagi (Kelinci Imut)',
    primary: '#FFCAD4',
    hover: '#F4ACB7',
    bg: '#FFFBFD',
    cardGradient: 'linear-gradient(135deg, #FFCAD4 0%, #D8E2DC 100%)'
  },
  'icon-panda-mascot': {
    name: 'Panda Menggemaskan',
    primary: '#52B788',
    hover: '#40916C',
    bg: '#F8FCF9',
    cardGradient: 'linear-gradient(135deg, #74C69D 0%, #B7E4C7 100%)'
  }
};

function selectMascotTheme(mascotId) {
  const theme = MASCOT_THEMES[mascotId] || MASCOT_THEMES['icon-cat-mascot'];
  currentMascot = mascotId;
  localStorage.setItem('dm_mascot', mascotId);

  // Ubah ikon maskot
  const mascotUse = document.getElementById('currentMascotUse');
  if (mascotUse) mascotUse.setAttribute('href', '#' + mascotId);

  // Ubah palet warna CSS dinamis root variable
  document.documentElement.style.setProperty('--pink-pastel', theme.primary);
  document.documentElement.style.setProperty('--pink-hover', theme.hover);
  document.documentElement.style.setProperty('--bg-primary', theme.bg);
  document.documentElement.style.setProperty('--wallet-gradient', theme.cardGradient);

  // Paksa update langsung ke kartu dompet
  const cardWallet = document.querySelector('.card-wallet');
  if (cardWallet) {
    cardWallet.style.setProperty('background', theme.cardGradient, 'important');
  }

  // Update avatar background
  const avatar = document.querySelector('.mascot-avatar');
  if (avatar) {
    avatar.style.background = theme.primary;
  }
}

// Render Mini Kalender Picker Gajian
function renderSalaryCalendarPicker(selectedDay) {
  const container = document.getElementById('salaryCalendarPicker');
  if (!container) return;
  const day = parseInt(selectedDay || '25', 10);

  let html = '';
  for (let i = 1; i <= 31; i++) {
    const isSel = i === day ? 'selected' : '';
    html += `<div class="calendar-day-cell ${isSel}" onclick="selectSalaryDay(${i})">${i}</div>`;
  }
  container.innerHTML = html;
}

function selectSalaryDay(day) {
  document.getElementById('salaryDayInput').value = day;
  const preview = document.getElementById('selectedDayPreview');
  if (preview) preview.innerText = day;
  renderSalaryCalendarPicker(day);
}

// Pengaturan & Recall Pemasukan Pokok Rutin (Gaji)
function openSalaryModal() {
  const savedDay = localStorage.getItem('dm_salary_day') || '25';
  const savedAmount = localStorage.getItem('dm_salary_amount') || '';
  document.getElementById('salaryDayInput').value = savedDay;
  const preview = document.getElementById('selectedDayPreview');
  if (preview) preview.innerText = savedDay;
  renderSalaryCalendarPicker(savedDay);

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

  const ok = await showCuteConfirm(`Terapkan Pemasukan Rutin Bulan Ini?\nNominal: Rp ${amount.toLocaleString('id-ID')}\nTanggal: ${txDate}`, 'Terapkan Gaji Rutin 💰', 'Ya, Terapkan ✨', 'Batal');
  if (!ok) {
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

// 🌸 Sistem Ghost Typing & Auto-Format Nominal Rupiah (Otomatis: 1000 RB -> 1.000 RB / 1.000.000)
function parseNominalToNumber(rawStr) {
  if (!rawStr) return 0;
  let s = String(rawStr).trim().toLowerCase();

  // Bersihkan karakter awalan Rp, spasi
  s = s.replace(/^rp\s*/i, '').trim();

  // Cek pengali ribuan/jutaan khas ketikan cepat Indonesia
  let multiplier = 1;
  if (/(\d+[\.,]?\d*)\s*(jt|juta)\b/i.test(s)) {
    multiplier = 1000000;
    s = s.replace(/(jt|juta)/gi, '').trim();
  } else if (/(\d+[\.,]?\d*)\s*(rb|ribu|k)\b/i.test(s)) {
    multiplier = 1000;
    s = s.replace(/(rb|ribu|k)/gi, '').trim();
  }

  // Jika ada multiplier (rb/jt)
  if (multiplier > 1) {
    // Jika formatnya ribuan bertitik sebelum kata 'rb' (misal: "1.000 rb" => 1000 * 1000 = 1.000.000)
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    } else {
      // Jika formatnya desimal (misal: "2.5 jt" atau "2,5 jt")
      s = s.replace(/,/g, '.');
    }
    const num = parseFloat(s) || 0;
    return Math.round(num * multiplier);
  }

  // Untuk angka murni biasa (misal: 1.000.000)
  s = s.replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(s) || 0;
  return Math.round(num);
}

function formatGhostTypingString(num) {
  if (!num || isNaN(num) || num <= 0) return '';
  return num.toLocaleString('id-ID');
}

function spellIndonesianRupiah(num) {
  if (!num || isNaN(num) || num <= 0) return '';
  if (num >= 1000000000) {
    const m = (num / 1000000000).toFixed(1).replace('.0', '');
    return `Rp ${num.toLocaleString('id-ID')} (${m} Miliar Rupiah ✨)`;
  }
  if (num >= 1000000) {
    const jt = (num / 1000000).toFixed(1).replace('.0', '');
    return `Rp ${num.toLocaleString('id-ID')} (${jt} Juta Rupiah ✨)`;
  }
  if (num >= 1000) {
    const rb = (num / 1000).toFixed(0);
    return `Rp ${num.toLocaleString('id-ID')} (${rb} Ribu Rupiah ✨)`;
  }
  return `Rp ${num.toLocaleString('id-ID')} Rupiah`;
}

// Event handler saat user mengetik di input nominal
function onNominalInput(inputEl, previewId) {
  if (!inputEl) return;
  const raw = inputEl.value;
  const previewEl = document.getElementById(previewId);

  // Jika user mengetik angka murni tanpa suffix, kita auto format titik ribuan di posisi kursor
  const hasSuffix = /(rb|ribu|k|jt|juta)/i.test(raw);
  const parsed = parseNominalToNumber(raw);

  if (!hasSuffix && parsed > 0 && /^\d[\d\.]*$/.test(raw)) {
    const formatted = formatGhostTypingString(parsed);
    if (formatted !== raw && !raw.endsWith('.')) {
      inputEl.value = formatted;
    }
  } else if (hasSuffix && parsed > 0) {
    // Jika ketik "1000 rb" -> rapikan angka sebelum suffix jadi "1.000 RB"
    const match = raw.match(/^([0-9\.\,]+)\s*(rb|ribu|k|jt|juta)$/i);
    if (match) {
      const numPart = match[1].replace(/\./g, '');
      const suffixPart = match[2].toUpperCase();
      if (/^\d+$/.test(numPart)) {
        const formattedNum = Number(numPart).toLocaleString('id-ID');
        const candidate = `${formattedNum} ${suffixPart}`;
        if (candidate !== raw && inputEl.value !== candidate) {
          inputEl.value = candidate;
        }
      }
    }
  }

  if (previewEl) {
    if (parsed > 0) {
      previewEl.innerText = `💡 Terbaca: ${spellIndonesianRupiah(parsed)}`;
      previewEl.style.display = 'block';
    } else {
      previewEl.innerText = '';
    }
  }
}

// Logika Panduan Game Spotlight di Seluruh Dashboard & Tab Fitur (14 Langkah Menyeluruh)
const TOUR_STEPS = [
  {
    tab: 'home',
    target: '#mascotAvatarContainer',
    title: '1. Maskot & Tema Lucu 🐾',
    desc: 'Sentuh avatar ini kapan saja untuk memilih 5 maskot imut (Kucing, Shiba Inu, Capybara, Kelinci Usagi, Panda). Warna tema seluruh aplikasi akan otomatis ikut berganti!'
  },
  {
    tab: 'home',
    target: '.card-wallet',
    title: '2. Kartu Dompet & 3 Saldo Keluarga 💰',
    desc: 'Mencakup 3 saldo transparan: Total Saldo Bersama (Suami + Istri), Saldo Saya, dan Saldo Pasangan. Lengkap dengan jadwal tanggal gajian rutin.'
  },
  {
    tab: 'home',
    target: '.quick-actions-bar',
    title: '3. Tombol Catat Cepat (Keluar & Masuk) 🌸',
    desc: 'Catat pengeluaran atau pemasukan dalam 5 detik! Dilengkapi ghost-typing otomatis: ketik "1000 rb" langsung terformat Rp 1.000.000 dengan aman.'
  },
  {
    tab: 'home',
    target: '#smartShortcutsGrid',
    title: '4. Shortcut Tagihan & Hutang Pintar 📌',
    desc: 'Akses cepat ke checklist Tagihan Bulanan (listrik, wifi, PDAM) dan pencatatan Hutang/Piutang keluarga agar tidak ada cicilan yang terlupakan.'
  },
  {
    tab: 'home',
    target: '#pieChartSection',
    title: '5. Grafik Komposisi Pengeluaran 📊',
    desc: 'Pie chart SVG interaktif yang menampilkan persentase alokasi uang belanja bulan ini berdasarkan kategori (makan, belanja, tagihan, dll).'
  },
  {
    tab: 'home',
    target: '#authorTabAll',
    title: '6. Filter Riwayat Suami & Istri 👨‍👩‍👧‍👦',
    desc: 'Lihat catatan belanja bersama, catatan suami saja, atau catatan istri saja. Mutasi dari Gmail bersifat permanen dan tidak dapat dihapus demi kejujuran finansial.'
  },
  {
    tab: 'budget',
    target: '#viewBudget',
    title: '7. Tab Anggaran Bulanan Bersama 🎯',
    desc: 'Atur batas maksimal pengeluaran per kategori. Di DompetMungil, penambahan atau perubahan batas kategori wajib disetujui bersama oleh akun Suami & Istri.'
  },
  {
    tab: 'budget',
    target: '#budgetProposalContainer',
    title: '8. Sistem Izin & Persetujuan Pasangan 💌',
    desc: 'Jika Suami mengusulkan perubahan anggaran, notifikasi persetujuan muncul di akun Istri untuk disetujui atau ditolak bersama.'
  },
  {
    tab: 'savings',
    target: '#viewSavings',
    title: '9. Tab Celengan Ayam Impian 🐔',
    desc: 'Wujudkan cita-cita masa depan (liburan, kurban, beli motor, laptop anak) dengan celengan ayam jago khas budaya Indonesia!'
  },
  {
    tab: 'savings',
    target: '#savingsGoalsListContainer',
    title: '10. Isi & Pantau Celengan Ayam 🪙',
    desc: 'Setiap kali ada sisa uang belanja, klik "Isi Celengan" untuk memasukkan koin tabungan hingga persentase impian tercapai 100%!'
  },
  {
    tab: 'bills',
    target: '#viewBills',
    title: '11. Tagihan Rutin & Pengingat Bulanan 💡',
    desc: 'Daftar checklist tagihan rutin rumah tangga (PLN, WiFi, SPP). Sekali klik "Bayar", nominal otomatis tercatat rapi ke pengeluaran dompet.'
  },
  {
    tab: 'debts',
    target: '#viewDebts',
    title: '12. Catatan Hutang & Piutang 🤝',
    desc: 'Pantau siapa yang meminjam uang atau pinjaman yang harus dikembalikan lengkap dengan nominal dan status pelunasan.'
  },
  {
    tab: 'bank',
    target: '#viewBank',
    title: '13. Integrasi Mutasi Bank & Gmail 🏦',
    desc: 'Koneksikan notifikasi mutasi m-Banking via Google OAuth resmi atau paste teks SMS mutasi. Data langsung diproses dan dienkripsi AES-256.'
  },
  {
    tab: 'guide',
    target: '#viewGuide',
    title: '14. Panduan & Kunci Layar PIN 📖',
    desc: 'Temukan tips pengelolaan uang, aktifkan kunci PIN 4 digit untuk privasi HP, atau ulangi tur aplikasi ini kapan saja!'
  }
];

let currentTourIndex = 0;

function startDashboardTour() {
  currentTourIndex = 0;
  const overlay = document.getElementById('spotlightOverlay');
  if (overlay) overlay.classList.add('active');
  renderTourStep();
}

function stopDashboardTour() {
  const overlay = document.getElementById('spotlightOverlay');
  if (overlay) overlay.classList.remove('active');
  window.switchTab('home');
  localStorage.setItem('dm_tour_completed', 'true');
}

function nextTourStep() {
  if (currentTourIndex < TOUR_STEPS.length - 1) {
    currentTourIndex++;
    renderTourStep();
  } else {
    stopDashboardTour();
    alert('🎉 Hore! Anda sudah siap menjelajahi seluruh fitur DompetMungil!');
  }
}

function prevTourStep() {
  if (currentTourIndex > 0) {
    currentTourIndex--;
    renderTourStep();
  }
}

function renderTourStep() {
  const step = TOUR_STEPS[currentTourIndex];
  if (step.tab) {
    window.switchTab(step.tab);
  }

  const highlight = document.getElementById('spotlightHighlight');
  const tooltip = document.getElementById('spotlightTooltip');
  const title = document.getElementById('tourTooltipTitle');
  const desc = document.getElementById('tourTooltipDesc');
  const indicator = document.getElementById('tourStepIndicator');
  const btnNext = document.getElementById('btnTourNext');
  const btnPrev = document.getElementById('btnTourPrev');

  if (!highlight || !tooltip) return;

  setTimeout(() => {
    let targetEl = document.querySelector(step.target);
    if (!targetEl || targetEl.offsetParent === null) {
      // Fallback ke kontainer view tab jika elemen kecil belum ter-render
      targetEl = document.querySelector('.app-container') || document.body;
    }

    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      const padding = 8;

      // Gunakan viewport coordinate murni (fixed position)
      highlight.style.position = 'fixed';
      highlight.style.top = `${Math.max(4, rect.top - padding)}px`;
      highlight.style.left = `${Math.max(4, rect.left - padding)}px`;
      highlight.style.width = `${Math.min(window.innerWidth - 8, rect.width + padding * 2)}px`;
      highlight.style.height = `${Math.min(window.innerHeight - 8, rect.height + padding * 2)}px`;

      tooltip.style.position = 'fixed';
      const tooltipWidth = Math.min(320, window.innerWidth - 32);
      let tooltipLeft = Math.max(16, (window.innerWidth - tooltipWidth) / 2);

      // Cek apakah diletakkan di bawah atau di atas
      let tooltipTop = rect.bottom + 14;
      if (tooltipTop + 190 > window.innerHeight) {
        tooltipTop = Math.max(16, rect.top - 200);
      }
      // Batas aman dalam layar
      tooltipTop = Math.max(16, Math.min(window.innerHeight - 220, tooltipTop));

      tooltip.style.top = `${tooltipTop}px`;
      tooltip.style.left = `${tooltipLeft}px`;
      tooltip.style.width = `${tooltipWidth}px`;

      title.innerHTML = `<span>🐾</span> ${step.title}`;
      desc.innerText = step.desc;
      indicator.innerText = `${currentTourIndex + 1} / ${TOUR_STEPS.length}`;
      btnNext.innerText = currentTourIndex === TOUR_STEPS.length - 1 ? 'Selesai ✨' : 'Lanjut ➡️';
      if (btnPrev) {
        btnPrev.style.display = currentTourIndex > 0 ? 'inline-flex' : 'none';
      }
    }, 120);
  }, 100);
}



// Logika Panduan Interaktif Langkah Demi Langkah (Step-by-Step Guide Lengkap dari Awal Sampai Akhir)
const GUIDE_STEPS = [
  {
    title: '1. Pemasangan & Registrasi Akun Pertama 🌸',
    desc: 'Buka alamat <code>http://IP-Odroid:1234</code> di browser HP Anda. Pilih antara <strong>Mode Keluarga</strong> (Suami & Istri) atau <strong>Mode Personal</strong>. Buat username & password admin pertama untuk mengamankan data keuangan.'
  },
  {
    title: '2. Personalisasi Karakter Maskot Cute 🐾',
    desc: 'Sentuh avatar hewan di pojok kiri atas kapan saja untuk memilih maskot favorit: 🐱 Kucing (Neko), 🐶 Shiba Inu, 🦫 Capybara, 🐰 Kelinci (Usagi), atau 🐼 Panda. Warna kartu dan tema aplikasi akan ikut berganti otomatis!'
  },
  {
    title: '3. Atur Tanggal Gajian & Saldo Awal 🗓️',
    desc: 'Sentuh tombol <strong>"🗓️ Gajian: Tgl 25"</strong> di kartu dompet untuk memilih tanggal gajian rutin tiap bulan. Begitu tanggal gajian tiba, cukup klik <strong>"⚡ Terapkan Gaji Bulan Ini"</strong> untuk pencatatan instan tanpa ketik ulang.'
  },
  {
    title: '4. Pencatatan Pengeluaran & Pemasukan Cepat ➖➕',
    desc: 'Tekan tombol <strong>➖ Catat Keluar</strong> atau tombol melayang bulat <strong>"+"</strong> di pojok kanan bawah. Fitur <em>Ghost-Typing</em> otomatis mengubah ketikan seperti "1000 rb" menjadi Rp 1.000.000 rapi.'
  },
  {
    title: '5. Batas Anggaran Bulanan & Izin Pasangan 🎯',
    desc: 'Buka tab <strong>Anggaran</strong> untuk menentukan jatah belanja bulanan per kategori. Di DompetMungil, penambahan atau perubahan batas wajib mendapat persetujuan bersama antara Suami dan Istri demi transparansi harmonis.'
  },
  {
    title: '6. Menabung di Celengan Ayam Impian 🐔',
    desc: 'Buka tab <strong>Celengan</strong> untuk membuat target impian keluarga (liburan, kurban, beli motor, laptop anak). Setiap kali ada uang lebih, masukkan koin tabungan hingga persentase progres mencapai 100%!'
  },
  {
    title: '7. Koneksi Google Mail (Gmail) 16-Digit 💌',
    desc: 'Buka tab <strong>Bank Mutasi &raquo; Tautkan Akun Google</strong>. Masukkan alamat Gmail dan 16-digit Sandi Aplikasi dari Google untuk membaca notifikasi bank/e-wallet secara otomatis ke STB tanpa perlu Cloud Console yang rumit.'
  },
  {
    title: '8. Keamanan Kunci PIN Layar & Backup Otomatis 🔐',
    desc: 'Aktifkan <strong>Kunci PIN Layar</strong> (ikon gembok 🔐 di header) agar privasi catatan keuangan terlindungi saat HP dipinjam. Database & enkripsi AES-256 Anda dicadangkan otomatis tiap hari ke Cloud!'
  }
];

let currentGuideStepIndex = 0;

function openStepGuideModal() {
  currentGuideStepIndex = 0;
  renderGuideStep();
  document.getElementById('stepGuideModal').classList.add('active');
}

function copyInstallCmd() {
  const cmd = 'sudo curl -sSL https://raw.githubusercontent.com/faisalfa123/DompetMungil/main/install.sh | sudo bash';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd).then(() => {
      showCuteAlert('Perintah instalasi berhasil disalin ke clipboard! 📋\n\nTempelkan (Paste) di terminal SSH Odroid C2 / DietPi Anda.', 'Berhasil Disalin ✨');
    }).catch(() => {
      prompt('Salin perintah instalasi di bawah ini:', cmd);
    });
  } else {
    prompt('Salin perintah instalasi di bawah ini:', cmd);
  }
}

function closeStepGuideModal() {
  document.getElementById('stepGuideModal').classList.remove('active');
}

function renderGuideStep() {
  const step = GUIDE_STEPS[currentGuideStepIndex];
  const container = document.getElementById('guideStepContent');
  const indicator = document.getElementById('guideStepIndicator');
  const btnPrev = document.getElementById('btnGuidePrev');
  const btnNext = document.getElementById('btnGuideNext');

  if (container) {
    container.innerHTML = `
      <div style="background:#FFF9FB; border-radius:18px; padding:20px; border:1px solid #FFE4E8; text-align:center;">
        <h4 style="font-size:1.05rem; font-weight:800; color:var(--pink-pastel); margin-bottom:10px;">${step.title}</h4>
        <p style="font-size:0.85rem; color:#555; line-height:1.5;">${step.desc}</p>
      </div>
    `;
  }

  if (indicator) indicator.innerText = `${currentGuideStepIndex + 1} dari ${GUIDE_STEPS.length}`;
  if (btnPrev) btnPrev.style.visibility = currentGuideStepIndex === 0 ? 'hidden' : 'visible';
  if (btnNext) btnNext.innerText = currentGuideStepIndex === GUIDE_STEPS.length - 1 ? 'Selesai ✨' : 'Lanjut ➡️';
}

function nextGuideStep() {
  if (currentGuideStepIndex < GUIDE_STEPS.length - 1) {
    currentGuideStepIndex++;
    renderGuideStep();
  } else {
    closeStepGuideModal();
    localStorage.setItem('dm_guide_seen', 'true');
  }
}

function prevGuideStep() {
  if (currentGuideStepIndex > 0) {
    currentGuideStepIndex--;
    renderGuideStep();
  }
}
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

function showLoginForm() {
  document.getElementById('stepSelectAccountType').style.display = 'none';
  document.getElementById('onboardingForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
}

function showSelectAccountType() {
  document.getElementById('stepSelectAccountType').style.display = 'block';
  document.getElementById('onboardingForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'none';
}

function chooseAccountMode(mode) {
  accountMode = mode;
  document.getElementById('selectedMode').value = mode;
  document.getElementById('stepSelectAccountType').style.display = 'none';
  document.getElementById('loginForm').style.display = 'none';
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

window.switchTab = function(tab) {
  const viewHome = document.getElementById('viewHome');
  const viewBudget = document.getElementById('viewBudget');
  const viewSavings = document.getElementById('viewSavings');
  const viewBills = document.getElementById('viewBills');
  const viewDebts = document.getElementById('viewDebts');
  const viewBank = document.getElementById('viewBank');
  const viewGuide = document.getElementById('viewGuide');

  if (!viewHome || !viewBank || !viewGuide) {
    console.error('View panel tidak ditemukan');
    return;
  }

  currentTab = tab;

  // Sembunyikan semua tab secara tegas
  viewHome.style.display = 'none';
  if (viewBudget) viewBudget.style.display = 'none';
  if (viewSavings) viewSavings.style.display = 'none';
  if (viewBills) viewBills.style.display = 'none';
  if (viewDebts) viewDebts.style.display = 'none';
  viewBank.style.display = 'none';
  viewGuide.style.display = 'none';

  // Tampilkan tab target
  if (tab === 'home') viewHome.style.display = 'block';
  if (tab === 'budget') {
    if (viewBudget) viewBudget.style.display = 'block';
    loadBudgets();
  }
  if (tab === 'savings') {
    if (viewSavings) viewSavings.style.display = 'block';
    renderSavingsGoals();
  }
  if (tab === 'bills') {
    if (viewBills) viewBills.style.display = 'block';
    renderBillsList();
  }
  if (tab === 'debts') {
    if (viewDebts) viewDebts.style.display = 'block';
    renderDebtsList();
  }
  if (tab === 'bank') viewBank.style.display = 'block';
  if (tab === 'guide') viewGuide.style.display = 'block';

  // Update status tombol aktif di navbar (Home, Budget, Savings, Bank, Guide)
  const tabKeys = ['home', 'budget', 'savings', 'bank', 'guide'];
  document.querySelectorAll('.bottom-nav .nav-item').forEach((item, index) => {
    item.classList.remove('active');
    if (tabKeys[index] === tab) {
      item.classList.add('active');
    }
  });
};

// Daftar Kategori Lucu Terpisah (Pemasukan vs Pengeluaran)
const DEFAULT_CATEGORIES = {
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

function getStoredCategories() {
  const custom = localStorage.getItem('dm_custom_categories');
  if (custom) {
    try {
      return JSON.parse(custom);
    } catch (e) {}
  }
  return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
}

function saveStoredCategories(cats) {
  localStorage.setItem('dm_custom_categories', JSON.stringify(cats));
}

let CATEGORIES = getStoredCategories();

function populateCategoryOptions(type) {
  const select = document.getElementById('formCategory');
  if (!select) return;
  CATEGORIES = getStoredCategories();
  const list = CATEGORIES[type] || CATEGORIES.expense;
  select.innerHTML = list.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function openCategoryManagerModal() {
  renderCategoryManagerList();
  document.getElementById('categoryManagerModal').classList.add('active');
}

function closeCategoryManagerModal() {
  document.getElementById('categoryManagerModal').classList.remove('active');
  const type = document.getElementById('formType') ? document.getElementById('formType').value : 'expense';
  populateCategoryOptions(type);
}

function renderCategoryManagerList() {
  const container = document.getElementById('customCatListContainer');
  if (!container) return;
  CATEGORIES = getStoredCategories();
  const allCats = [...CATEGORIES.expense, ...CATEGORIES.income];
  container.innerHTML = allCats.map(c => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#FFF; border-radius:10px; padding:6px 10px; border:1px solid #F0F0F5; font-size:0.8rem;">
      <span>${escapeHtml(c.name)}</span>
      ${c.id.startsWith('cat_custom_') ? `<button onclick="deleteCustomCategory('${c.id}')" style="background:none; border:none; color:#FF9AA2; cursor:pointer; font-weight:700;">Hapus</button>` : '<small style="color:#CCC;">Bawaan</small>'}
    </div>
  `).join('');
}

async function deleteCustomCategory(id) {
  const ok = await showCuteConfirm('Yakin ingin menghapus kategori kustom ini?', 'Hapus Kategori 🎨', 'Ya, Hapus', 'Batal');
  if (!ok) return;
  CATEGORIES = getStoredCategories();
  CATEGORIES.expense = CATEGORIES.expense.filter(c => c.id !== id);
  CATEGORIES.income = CATEGORIES.income.filter(c => c.id !== id);
  saveStoredCategories(CATEGORIES);
  renderCategoryManagerList();
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

// Update tampilan visual progress sinkronisasi di dalam kartu dompet
function updateWalletSyncProgress(status, percent, text, pulseColor = '#7BDCB5') {
  const container = document.getElementById('walletSyncProgressContainer');
  const bar = document.getElementById('syncProgressBar');
  const percentEl = document.getElementById('syncProgressPercent');
  const textEl = document.getElementById('syncStatusText');
  const pulseEl = document.getElementById('syncStatusPulse');

  if (container) container.style.display = 'block';
  if (bar) {
    bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (pulseColor === '#FF9AA2') {
      bar.style.background = '#FF9AA2';
    } else if (pulseColor === '#FFA000') {
      bar.style.background = 'linear-gradient(90deg, #FFB74D, #FFA726)';
    } else {
      bar.style.background = 'linear-gradient(90deg, #7BDCB5, #B5EAD7)';
    }
  }
  if (percentEl) percentEl.innerText = `${Math.round(percent)}%`;
  if (textEl) textEl.innerText = text;
  if (pulseEl) {
    pulseEl.style.background = pulseColor;
    pulseEl.style.boxShadow = `0 0 10px ${pulseColor}`;
  }
}

// Sinkronisasi Background & OOM Recovery Realtime
async function triggerSyncWithServer() {
  const pending = await getPendingSyncBatch();
  const banner = document.getElementById('recoveryBanner');
  const badge = document.getElementById('serverStatusBadge');
  const totalItems = pending.length;

  if (totalItems > 0) {
    banner.classList.remove('hidden');
    document.getElementById('recoveryTitle').innerText = 'Pemulihan Sinkronisasi';
    document.getElementById('recoveryDesc').innerText = `Ada ${totalItems} transaksi di HP. Sedang menghubungkan ke STB...`;
    updateWalletSyncProgress('syncing', 15, `Menghubungkan ke STB (${totalItems} antrian)...`, '#FFA000');
  } else {
    updateWalletSyncProgress('syncing', 35, 'Memeriksa pembaruan mutasi...', '#FFF');
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Auth-Token'] = authToken;

    // Tes koneksi server
    const healthRes = await fetch('/api/v1/health');
    if (!healthRes.ok) throw new Error('Server not reachable');

    if (badge) {
      badge.innerText = '🟢 Terhubung ke Odroid STB';
      badge.style.color = '#2E7D32';
    }

    if (totalItems > 0) {
      updateWalletSyncProgress('syncing', 60, `Mengirim ${totalItems} data ke STB...`, '#FFF');
      const syncRes = await fetch('/api/v1/sync', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ batch: pending })
      });

      if (syncRes.ok) {
        let count = 0;
        for (const item of pending) {
          await clearSyncedItem(item.client_tx_id);
          count++;
          const p = 60 + Math.round((count / totalItems) * 35);
          updateWalletSyncProgress('syncing', p, `Menyimpan data ${count}/${totalItems}...`, '#7BDCB5');
        }
        document.getElementById('recoveryTitle').innerText = 'Sinkronisasi Selesai ✨';
        document.getElementById('recoveryDesc').innerText = `${totalItems} transaksi berhasil dipulihkan & dicatat di server!`;
        updateWalletSyncProgress('synced', 100, `Hore! ${totalItems} transaksi tersimpan di server`, '#7BDCB5');
        setTimeout(() => {
          if (banner) banner.classList.add('hidden');
          updateWalletSyncProgress('idle', 100, 'Data Tersinkronisasi Otomatis', '#7BDCB5');
        }, 3500);
      }
    } else {
      if (banner) banner.classList.add('hidden');
      updateWalletSyncProgress('idle', 100, 'Data Tersinkronisasi Otomatis', '#7BDCB5');
    }

    // Segera muat langsung perubahan data ke dalam dompet
    await loadServerData();
  } catch (err) {
    console.warn('Server offline atau terkena OOM:', err);
    if (badge) {
      badge.innerText = '🟡 Mode Offline / Server Istirahat';
      badge.style.color = '#F57C00';
    }
    if (totalItems > 0) {
      if (banner) banner.classList.remove('hidden');
      document.getElementById('recoveryTitle').innerText = 'Mode Offline Aktif';
      document.getElementById('recoveryDesc').innerText = `${totalItems} catatan disimpan aman di HP. Akan otomatis di-sync saat server online.`;
      updateWalletSyncProgress('offline', 100, `${totalItems} data aman di HP (Mode Offline)`, '#FFA000');
    } else {
      updateWalletSyncProgress('offline', 100, 'Mode Offline (Data Lokal Tersedia)', '#FFA000');
    }
    // Langsung muat data lokal ke kartu dompet
    await renderLocalTransactions();
  }
}

let currentTxList = [];
let currentFilter = 'all';
let currentAuthorFilter = 'all';

function filterByAuthor(authorFilter) {
  currentAuthorFilter = authorFilter;
  document.querySelectorAll('.author-filter-btn').forEach(btn => btn.classList.remove('active'));
  const btnMap = { all: 'authorTabAll', me: 'authorTabMe', spouse: 'authorTabSpouse' };
  const targetBtn = document.getElementById(btnMap[authorFilter]);
  if (targetBtn) targetBtn.classList.add('active');
  applyTransactionFilter();
}

function updateFamilyBalances(txList) {
  const myRole = (localStorage.getItem('dm_role') || userRole || 'suami').toLowerCase();
  const isSuami = myRole === 'suami' || myRole === 'ayah';

  // Label UI
  const myLabel = document.getElementById('myBalanceLabel');
  const spouseLabel = document.getElementById('spouseBalanceLabel');
  if (myLabel) myLabel.innerText = isSuami ? '👨 Saldo Saya (Suami)' : '👩 Saldo Saya (Istri)';
  if (spouseLabel) spouseLabel.innerText = isSuami ? '👩 Saldo Istri' : '👨 Saldo Suami';

  const authorTabMe = document.getElementById('authorTabMe');
  const authorTabSpouse = document.getElementById('authorTabSpouse');
  if (authorTabMe) authorTabMe.innerText = isSuami ? 'Catatan Suami' : 'Catatan Istri';
  if (authorTabSpouse) authorTabSpouse.innerText = isSuami ? 'Catatan Istri' : 'Catatan Suami';

  let totalIncome = 0, totalExpense = 0;
  let myIncome = 0, myExpense = 0;
  let spouseIncome = 0, spouseExpense = 0;

  txList.forEach(t => {
    const amt = Number(t.amount || 0);
    const author = (t.author || '').toLowerCase();
    const isMe = author === myRole || (!author && !isSuami);
    const isSpouse = isSuami ? (author === 'istri' || author === 'ibu') : (author === 'suami' || author === 'ayah');

    if (t.type === 'income') {
      totalIncome += amt;
      if (isSpouse) spouseIncome += amt;
      else myIncome += amt;
    } else if (t.type === 'expense') {
      totalExpense += amt;
      if (isSpouse) spouseExpense += amt;
      else myExpense += amt;
    }
  });

  const totalBalance = totalIncome - totalExpense;
  const myBalance = myIncome - myExpense;
  const spouseBalance = spouseIncome - spouseExpense;

  const totalBalEl = document.getElementById('totalBalanceDisplay');
  const myBalEl = document.getElementById('myBalanceDisplay');
  const spouseBalEl = document.getElementById('spouseBalanceDisplay');
  const incEl = document.getElementById('totalIncomeDisplay');
  const expEl = document.getElementById('totalExpenseDisplay');

  if (totalBalEl) totalBalEl.innerText = formatRupiah(totalBalance);
  if (myBalEl) myBalEl.innerText = formatRupiah(myBalance);
  if (spouseBalEl) spouseBalEl.innerText = formatRupiah(spouseBalance);
  if (incEl) incEl.innerText = '+' + formatRupiah(totalIncome);
  if (expEl) expEl.innerText = '-' + formatRupiah(totalExpense);
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
      const txs = await txRes.json();
      currentTxList = txs;
      updateFamilyBalances(currentTxList);
      applyTransactionFilter();
      return;
    }
  } catch (e) {
    console.log('Fallback ke data lokal:', e);
  }
  renderLocalTransactions();
}

function filterTransactions(range) {
  currentFilter = range;
  document.querySelectorAll('.date-filter-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.date-filter-btn')).find(b => b.getAttribute('onclick')?.includes(`'${range}'`));
  if (activeBtn) activeBtn.classList.add('active');
  applyTransactionFilter();
}

let currentTxSearchQuery = '';

function onSearchTxInput() {
  const input = document.getElementById('txSearchInput');
  const btnClear = document.getElementById('btnClearSearch');
  currentTxSearchQuery = (input ? input.value : '').trim().toLowerCase();
  if (btnClear) btnClear.style.display = currentTxSearchQuery ? 'block' : 'none';
  applyTransactionFilter();
}

function clearTxSearch() {
  const input = document.getElementById('txSearchInput');
  const btnClear = document.getElementById('btnClearSearch');
  if (input) input.value = '';
  if (btnClear) btnClear.style.display = 'none';
  currentTxSearchQuery = '';
  applyTransactionFilter();
}

function applyTransactionFilter() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const myRole = (localStorage.getItem('dm_role') || userRole || 'suami').toLowerCase();
  const isSuami = myRole === 'suami' || myRole === 'ayah';

  let filtered = currentTxList.filter(tx => {
    // 1. Filter Penulis Suami vs Istri
    if (currentAuthorFilter !== 'all') {
      const author = (tx.author || '').toLowerCase();
      const isMe = author === myRole || (!author && isSuami);
      const isSpouse = isSuami ? (author === 'istri' || author === 'ibu') : (author === 'suami' || author === 'ayah');
      if (currentAuthorFilter === 'me' && !isMe) return false;
      if (currentAuthorFilter === 'spouse' && !isSpouse) return false;
    }

    // 2. Filter Tanggal
    let matchesDate = true;
    if (currentFilter !== 'all') {
      if (!tx.date) return false;
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return false;

      if (currentFilter === 'this_month') {
        matchesDate = d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      } else if (currentFilter === 'last_month') {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        matchesDate = d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth();
      } else if (currentFilter === 'this_year') {
        matchesDate = d.getFullYear() === currentYear;
      }
    }
    if (!matchesDate) return false;

    // 3. Filter Pencarian Teks (Catatan, Kategori, Akun, Penulis)
    if (currentTxSearchQuery) {
      const q = currentTxSearchQuery;
      const note = String(tx.note || '').toLowerCase();
      const cat = String(tx.category_name || tx.category_id || '').toLowerCase();
      const acc = String(tx.account_name || tx.account_id || '').toLowerCase();
      const author = String(tx.author || '').toLowerCase();
      const amt = String(tx.amount || '');
      if (!note.includes(q) && !cat.includes(q) && !acc.includes(q) && !author.includes(q) && !amt.includes(q)) {
        return false;
      }
    }
    return true;
  });

  renderTransactions(filtered);
  renderExpensePieChart(filtered);
}

// Render Pie Chart SVG Murni untuk Komposisi Pengeluaran
function renderExpensePieChart(list) {
  const svg = document.getElementById('pieChartSvg');
  const legend = document.getElementById('pieChartLegend');
  const totalExpenseLabel = document.getElementById('chartTotalExpense');
  if (!svg || !legend) return;

  const expenses = list.filter(t => t.type === 'expense');
  const catTotals = {};
  let totalExpense = 0;

  expenses.forEach(t => {
    const catName = t.category_name || 'Lainnya';
    catTotals[catName] = (catTotals[catName] || 0) + Number(t.amount);
    totalExpense += Number(t.amount);
  });

  if (totalExpenseLabel) {
    totalExpenseLabel.innerText = formatRupiah(totalExpense);
  }

  if (totalExpense === 0) {
    svg.innerHTML = `<circle cx="21" cy="21" r="15.91549430918954" fill="#F8F8FC" stroke="#ECECF0" stroke-width="4"></circle>`;
    legend.innerHTML = `<span style="color:var(--text-muted);">Belum ada data pengeluaran pada rentang waktu ini.</span>`;
    return;
  }

  const PALETTE = ['#FFB7B2', '#B5EAD7', '#C7CEEA', '#FFDAC1', '#E2F0CB', '#FF9AA2', '#52B788', '#F4A261'];
  let accumulatedPercent = 0;
  let circlesHtml = '';
  let legendHtml = '';
  let colorIdx = 0;

  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  sortedCats.forEach(([cat, amt]) => {
    const percent = (amt / totalExpense) * 100;
    const color = PALETTE[colorIdx % PALETTE.length];
    colorIdx++;

    const strokeDasharray = `${percent.toFixed(2)} ${(100 - percent).toFixed(2)}`;
    const strokeDashoffset = (-accumulatedPercent).toFixed(2);
    accumulatedPercent += percent;

    circlesHtml += `<circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="${color}" stroke-width="4" stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}"></circle>`;

    legendHtml += `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="display:flex; align-items:center; gap:5px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color};"></span>
          <span style="color:var(--text-primary); font-weight:600;">${escapeHtml(cat)}</span>
        </span>
        <span style="color:var(--text-muted); font-size:0.7rem;">${percent.toFixed(0)}% (${formatRupiah(amt)})</span>
      </div>
    `;
  });

  svg.innerHTML = circlesHtml;
  legend.innerHTML = legendHtml;
}

// Ekspor Transaksi ke CSV via browser
async function exportTransactionsCSV() {
  if (authToken) {
    try {
      const res = await fetch('/api/v1/export', {
        headers: { 'X-Auth-Token': authToken }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dompetmungil_export_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
    } catch (e) {
      console.warn('Ekspor server gagal, fallback ke ekspor lokal IndexedDB:', e);
    }
  }

  // Fallback ekspor client-side dari data IndexedDB lokal
  const txs = currentTxList.length > 0 ? currentTxList : (await getAllLocalTx());
  if (txs.length === 0) {
    alert('Belum ada transaksi untuk diekspor!');
    return;
  }

  let csv = '\uFEFFTanggal,Jenis,Nominal,Kategori,Catatan\n';
  txs.forEach(t => {
    const jenis = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    const note = (t.note || '').replace(/"/g, '""');
    csv += `"${t.date}","${jenis}",${t.amount},"${t.category_name || t.category_id || ''}","${note}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dompetmungil_lokal_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Manajemen Anggaran Bulanan Bersama & Sistem Persetujuan Pasangan (Suami/Istri)
function getStoredBudgetProposals() {
  const p = localStorage.getItem('dm_budget_proposals');
  if (p) {
    try { return JSON.parse(p); } catch (e) {}
  }
  return [];
}

function saveStoredBudgetProposals(proposals) {
  localStorage.setItem('dm_budget_proposals', JSON.stringify(proposals));
}

function renderBudgetProposals() {
  const container = document.getElementById('budgetProposalContainer');
  if (!container) return;

  const proposals = getStoredBudgetProposals().filter(p => p.status === 'pending');
  const myRole = (localStorage.getItem('dm_role') || userRole || 'suami').toLowerCase();
  const isSuami = myRole === 'suami' || myRole === 'ayah';

  if (proposals.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = proposals.map(p => {
    const isFromMe = p.proposed_by === myRole;
    const catName = p.category_name || p.category_id;

    if (isFromMe) {
      return `
        <div style="background:#FFF3E0; border:1.5px dashed #FF9800; border-radius:16px; padding:12px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="font-size:0.85rem; color:#E65100;">⏳ Menunggu Izin ${isSuami ? 'Istri' : 'Suami'}</strong>
              <div style="font-size:0.75rem; color:#6D4C41; margin-top:2px;">
                Usulan batas kategori <b>${escapeHtml(catName)}</b> menjadi <b>${formatRupiah(p.amount)}</b>.
              </div>
            </div>
            <button onclick="cancelBudgetProposal('${p.id}')" class="btn-cute" style="padding:4px 8px; font-size:0.72rem; color:#C62828;">Batalkan</button>
          </div>
        </div>
      `;
    } else {
      return `
        <div style="background:#E8F5E9; border:1.5px solid #81C784; border-radius:16px; padding:12px 14px; box-shadow:0 4px 12px rgba(46,125,50,0.1);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <strong style="font-size:0.88rem; color:#1B5E20;">💌 Usulan Anggaran dari Pasangan (${p.proposed_by})</strong>
              <div style="font-size:0.78rem; color:#2E7D32; margin-top:2px;">
                Mengusulkan batas anggaran kategori <b>${escapeHtml(catName)}</b> menjadi <b>${formatRupiah(p.amount)}</b>.
              </div>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="approveBudgetProposal('${p.id}')" class="btn-cute mint" style="flex:1; padding:6px 10px; font-size:0.75rem; justify-content:center;">
              ✅ Setujui (Keputusan Bersama)
            </button>
            <button onclick="rejectBudgetProposal('${p.id}')" class="btn-cute" style="flex:1; padding:6px 10px; font-size:0.75rem; justify-content:center; color:#C62828;">
              ❌ Tolak
            </button>
          </div>
        </div>
      `;
    }
  }).join('');
}

async function approveBudgetProposal(proposalId) {
  const proposals = getStoredBudgetProposals();
  const prop = proposals.find(p => p.id === proposalId);
  if (!prop) return;

  try {
    const res = await fetch('/api/v1/budgets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': authToken
      },
      body: JSON.stringify({ category_id: prop.category_id, amount: prop.amount })
    });

    prop.status = 'approved';
    saveStoredBudgetProposals(proposals);
    renderBudgetProposals();
    await loadBudgets();
    alert(`🎉 Usulan anggaran kategori "${prop.category_name}" berhasil disetujui bersama!`);
  } catch (e) {
    alert('Gagal menyetujui anggaran.');
  }
}

async function rejectBudgetProposal(proposalId) {
  const ok = await showCuteConfirm('Tolak usulan batas anggaran dari pasangan ini?', 'Tolak Usulan Anggaran 🎯', 'Ya, Tolak', 'Batal');
  if (!ok) return;

  let proposals = getStoredBudgetProposals();
  proposals = proposals.filter(p => p.id !== proposalId);
  saveStoredBudgetProposals(proposals);
  renderBudgetProposals();
  alert('Usulan batas anggaran telah ditolak.');
}

async function cancelBudgetProposal(proposalId) {
  let proposals = getStoredBudgetProposals();
  proposals = proposals.filter(p => p.id !== proposalId);
  saveStoredBudgetProposals(proposals);
  renderBudgetProposals();
}

async function loadBudgets() {
  renderBudgetProposals();
  const container = document.getElementById('budgetListContainer');
  if (!container) return;

  const headers = {};
  if (authToken) headers['X-Auth-Token'] = authToken;

  try {
    const res = await fetch('/api/v1/budgets', { headers });
    if (res.ok) {
      const budgets = await res.json();
      let totalBudget = 0;
      let totalSpent = 0;

      container.innerHTML = budgets.map(b => {
        totalBudget += b.budget;
        totalSpent += b.spent;
        const percent = b.budget > 0 ? Math.min(100, (b.spent / b.budget) * 100) : 0;
        const isOver = b.budget > 0 && b.spent > b.budget;
        const barColor = isOver ? '#FF9AA2' : (percent > 80 ? '#FFDAC1' : '#B5EAD7');

        return `
          <div style="background:#fff; border-radius:16px; padding:14px; box-shadow:var(--shadow-soft);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <strong style="font-size:0.9rem; color:var(--text-primary);">${escapeHtml(b.name)}</strong>
              <span style="font-size:0.75rem; color:${isOver ? '#C62828' : 'var(--text-muted)'}; font-weight:700;">
                ${isOver ? '⚠️ Overbudget!' : percent.toFixed(0) + '%'}
              </span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">
              <span>Terpakai: ${formatRupiah(b.spent)}</span>
              <span>Batas: ${b.budget > 0 ? formatRupiah(b.budget) : 'Belum diatur'}</span>
            </div>
            <div style="width:100%; height:8px; background:#F0F0F5; border-radius:10px; overflow:hidden;">
              <div style="width:${percent}%; height:100%; background:${barColor}; border-radius:10px; transition:width 0.4s ease;"></div>
            </div>
          </div>
        `;
      }).join('');

      const overallPercent = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
      document.getElementById('budgetOverallText').innerText = `${formatRupiah(totalSpent)} / ${formatRupiah(totalBudget)}`;
      const overallBar = document.getElementById('budgetOverallBar');
      if (overallBar) {
        overallBar.style.width = overallPercent + '%';
        overallBar.style.background = totalSpent > totalBudget && totalBudget > 0 ? '#FF9AA2' : '#84C5B0';
      }
    }
  } catch (err) {
    console.warn('Gagal memuat anggaran:', err);
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">Fitur anggaran memerlukan koneksi ke server STB.</p>`;
  }
}

function openSetBudgetModal() {
  const select = document.getElementById('budgetCategorySelect');
  if (select) {
    select.innerHTML = (CATEGORIES.expense || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  document.getElementById('budgetModal').classList.add('active');
}

function closeBudgetModal() {
  document.getElementById('budgetModal').classList.remove('active');
}

// 🖨️ Cetak Struk / Laporan Keuangan Bulanan (Bisa Cetak Langsung / Save to PDF di HP & Komputer)
async function printFinancialReport() {
  const txs = currentTxList.length > 0 ? currentTxList : (await getAllLocalTx());
  let totalIncome = 0;
  let totalExpense = 0;
  txs.forEach(t => {
    if (t.type === 'income') totalIncome += Number(t.amount);
    if (t.type === 'expense') totalExpense += Number(t.amount);
  });

  const section = document.getElementById('printableReportSection');
  if (!section) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  let itemsHtml = txs.map(t => `
    <tr>
      <td style="padding:4px 8px; border-bottom:1px dashed #DDD;">${t.date}</td>
      <td style="padding:4px 8px; border-bottom:1px dashed #DDD;">${escapeHtml(t.category_name || t.category_id || '-')}</td>
      <td style="padding:4px 8px; border-bottom:1px dashed #DDD;">${escapeHtml(t.note || '-')}</td>
      <td style="padding:4px 8px; border-bottom:1px dashed #DDD; text-align:right; color:${t.type === 'income' ? '#2E7D32' : '#C62828'};">
        ${t.type === 'income' ? '+' : '-'}${formatRupiah(t.amount)}
      </td>
    </tr>
  `).join('');

  section.innerHTML = `
    <div style="max-width:600px; margin:0 auto; padding:20px; font-family:'Courier New', monospace; border:1px solid #CCC;">
      <div style="text-align:center; margin-bottom:16px;">
        <h2 style="margin:0; font-size:1.3rem;">🌸 DOMPET MUNGIL 🌸</h2>
        <p style="margin:4px 0; font-size:0.9rem;">Laporan Keuangan Keluarga Mandiri</p>
        <p style="margin:2px 0; font-size:0.8rem; color:#666;">Dicetak: ${dateStr}</p>
        <div style="border-bottom:2px dashed #000; margin:12px 0;"></div>
      </div>

      <div style="margin-bottom:16px;">
        <table style="width:100%; font-size:0.9rem; line-height:1.6;">
          <tr>
            <td>Total Pemasukan:</td>
            <td style="text-align:right; font-weight:bold; color:#2E7D32;">+${formatRupiah(totalIncome)}</td>
          </tr>
          <tr>
            <td>Total Pengeluaran:</td>
            <td style="text-align:right; font-weight:bold; color:#C62828;">-${formatRupiah(totalExpense)}</td>
          </tr>
          <tr style="border-top:1px solid #000;">
            <td style="font-weight:bold;">Sisa Saldo Bersih:</td>
            <td style="text-align:right; font-weight:bold;">${formatRupiah(totalIncome - totalExpense)}</td>
          </tr>
        </table>
      </div>

      <div style="border-bottom:1px dashed #000; margin:10px 0;"></div>

      <h4 style="margin:10px 0 6px; font-size:0.95rem;">Rincian Transaksi:</h4>
      <table style="width:100%; font-size:0.8rem; border-collapse:collapse;">
        <thead>
          <tr style="background:#F2F2F2;">
            <th style="padding:4px 8px; text-align:left;">Tanggal</th>
            <th style="padding:4px 8px; text-align:left;">Kategori</th>
            <th style="padding:4px 8px; text-align:left;">Catatan</th>
            <th style="padding:4px 8px; text-align:right;">Nominal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="4" style="text-align:center; padding:10px;">Tidak ada transaksi.</td></tr>'}
        </tbody>
      </table>

      <div style="border-bottom:2px dashed #000; margin:18px 0 10px;"></div>
      <p style="text-align:center; font-size:0.75rem; margin:0;">*** Terima kasih telah bijak mengelola keuangan keluarga! ***</p>
    </div>
  `;

  window.print();
}

// 🐷 Celengan Impian / Target Menabung
const DEFAULT_SAVINGS_GOALS = [
  { id: 'goal_1', title: 'Liburan Santai ke Pantai', icon: '🏖️', target: 3500000, current: 1750000 },
  { id: 'goal_2', title: 'Dana Darurat 3 Bulan', icon: '🏠', target: 10000000, current: 4200000 },
  { id: 'goal_3', title: 'Upgrade Gadget / Laptop Edukasi', icon: '💻', target: 6000000, current: 5400000 }
];

function getStoredSavingsGoals() {
  const g = localStorage.getItem('dm_savings_goals');
  if (g) {
    try { return JSON.parse(g); } catch (e) {}
  }
  return JSON.parse(JSON.stringify(DEFAULT_SAVINGS_GOALS));
}

function saveStoredSavingsGoals(goals) {
  localStorage.setItem('dm_savings_goals', JSON.stringify(goals));
}

function renderSavingsGoals() {
  const container = document.getElementById('savingsGoalsListContainer');
  if (!container) return;

  const goals = getStoredSavingsGoals();
  let totalSaved = 0;
  let totalTarget = 0;

  if (goals.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--text-muted); background:#FFF; border-radius:18px;">
        <span style="font-size:2.5rem; display:block; margin-bottom:8px;">🐔</span>
        <strong>Belum ada target celengan ayam</strong>
        <p style="font-size:0.8rem; margin-top:4px;">Klik "+ Target Baru" untuk mulai menabung impianmu!</p>
      </div>
    `;
    document.getElementById('totalSavingsSavedDisplay').innerText = 'Rp 0';
    document.getElementById('totalSavingsTargetDisplay').innerText = 'Rp 0';
    document.getElementById('totalSavingsPercentDisplay').innerText = '0%';
    return;
  }

  container.innerHTML = goals.map(g => {
    totalSaved += Number(g.current);
    totalTarget += Number(g.target);
    const percent = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    const isCompleted = g.current >= g.target;

    return `
      <div class="goal-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="goal-icon-bubble">${g.icon || '🐔'}</div>
            <div>
              <strong style="font-size:0.95rem; color:#4A4A58;">${escapeHtml(g.title)}</strong>
              <div style="font-size:0.75rem; color:#8E8E9F;">Target: ${formatRupiah(g.target)}</div>
            </div>
          </div>
          <span style="font-size:0.85rem; font-weight:800; color:${isCompleted ? '#2E7D32' : '#E76F51'};">
            ${isCompleted ? '🎉 Tercapai!' : percent + '%'}
          </span>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:700; margin-bottom:6px;">
            <span>Terkumpul: ${formatRupiah(g.current)}</span>
            <span style="color:#8E8E9F; font-size:0.72rem;">Kurang: ${formatRupiah(Math.max(0, g.target - g.current))}</span>
          </div>
          <div style="width:100%; height:12px; background:#F0F0F5; border-radius:10px; overflow:hidden;">
            <div style="width:${percent}%; height:100%; background:${isCompleted ? 'var(--mint-dark)' : 'linear-gradient(90deg, #FFAAA6, #FFB7B2)'}; border-radius:10px; transition:width 0.4s ease;"></div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; padding-top:8px; border-top:1px dashed #F0F0F5;">
          <button onclick="deleteSavingsGoal('${g.id}')" style="background:none; border:none; color:#FF9AA2; font-size:0.75rem; cursor:pointer;">
            🗑️ Hapus Target
          </button>
          <button onclick="openDepositGoalModal('${g.id}')" class="btn-cute mint" style="padding:4px 10px; font-size:0.75rem;">
            🪙 Isi Celengan
          </button>
        </div>
      </div>
    `;
  }).join('');

  const overallPercent = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
  document.getElementById('totalSavingsSavedDisplay').innerText = formatRupiah(totalSaved);
  document.getElementById('totalSavingsTargetDisplay').innerText = formatRupiah(totalTarget);
  document.getElementById('totalSavingsPercentDisplay').innerText = `${overallPercent}%`;
}

function openAddGoalModal() {
  document.getElementById('goalForm').reset();
  document.getElementById('goalModal').classList.add('active');
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('active');
}

function openDepositGoalModal(goalId) {
  const goals = getStoredSavingsGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;

  document.getElementById('depositGoalId').value = goal.id;
  document.getElementById('depositGoalTitle').innerText = `${goal.icon || '🐔'} ${goal.title}`;
  document.getElementById('depositGoalProgress').innerText = `Terkumpul ${formatRupiah(goal.current)} dari target ${formatRupiah(goal.target)}`;
  document.getElementById('depositAmountInput').value = '';
  document.getElementById('depositGoalModal').classList.add('active');
}

function closeDepositGoalModal() {
  document.getElementById('depositGoalModal').classList.remove('active');
}

async function deleteSavingsGoal(goalId) {
  const ok = await showCuteConfirm('Yakin ingin menghapus target celengan ini?', 'Hapus Celengan 🐔', 'Ya, Hapus', 'Batal');
  if (!ok) return;
  let goals = getStoredSavingsGoals();
  goals = goals.filter(g => g.id !== goalId);
  saveStoredSavingsGoals(goals);
  renderSavingsGoals();
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

  container.innerHTML = list.map(tx => {
    const isGmailTx = tx.source === 'gmail' || tx.is_gmail || (tx.client_tx_id && tx.client_tx_id.startsWith('gmail_'));

    return `
      <div class="tx-card" style="position:relative;">
        <div class="tx-info-left" style="flex:1;">
          <div class="tx-icon-circle" style="background: ${tx.type === 'income' ? '#B5EAD7' : '#FFB7B2'};">
            <span style="font-size:1.2rem;">${isGmailTx ? '📧' : (tx.type === 'income' ? '🌱' : '🌸')}</span>
          </div>
          <div>
            <div class="tx-title">
              ${escapeHtml(tx.note || tx.category_name || 'Transaksi')}
              ${isGmailTx ? '<span style="font-size:0.65rem; background:#E3F2FD; color:#1976D2; padding:2px 6px; border-radius:8px; margin-left:4px; font-weight:700;">Mutasi Gmail (Permanen)</span>' : ''}
            </div>
            <div class="tx-meta">${tx.date} • ${tx.account_name || 'Dompet'} ${tx.author ? '• 👤 ' + escapeHtml(tx.author) : ''}</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
          <div class="tx-amount ${tx.type}">
            ${tx.type === 'income' ? '+' : '-'}${formatRupiah(tx.amount)}
          </div>
          <div style="display:flex; gap:6px;">
            <button onclick="editTransactionItem('${tx.client_tx_id}')" style="background:none; border:none; cursor:pointer; font-size:0.75rem; color:#4A4A58; font-weight:700;" title="Edit Kategori & Catatan">
              ✏️ ${isGmailTx ? 'Beri Kategori' : 'Edit'}
            </button>
            ${!isGmailTx ? `
              <button onclick="deleteTransactionItem('${tx.client_tx_id}')" style="background:none; border:none; cursor:pointer; font-size:0.75rem; color:#FF9AA2;" title="Hapus Transaksi">
                🗑️ Hapus
              </button>
            ` : `
              <span style="font-size:0.72rem; color:#8E8E9F;" title="Transaksi dari mutasi Gmail bersifat permanen dan tidak dapat dihapus">🔒 Terkunci</span>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function editTransactionItem(clientTxId) {
  const localList = await getAllLocalTx();
  const tx = localList.find(t => t.client_tx_id === clientTxId);
  if (!tx) {
    alert('Transaksi tidak ditemukan.');
    return;
  }

  const isGmailTx = tx.source === 'gmail' || tx.is_gmail || (tx.client_tx_id && tx.client_tx_id.startsWith('gmail_'));

  // Isi modal transaksi dengan data lama
  document.getElementById('txEditClientTxId').value = tx.client_tx_id;
  document.getElementById('formType').value = tx.type;
  document.getElementById('formAmount').value = tx.amount;
  // Jika mutasi Gmail, nominal terkunci permanen agar tidak bisa dipalsukan
  document.getElementById('formAmount').readOnly = isGmailTx;
  document.getElementById('formNote').value = tx.note || '';
  if (document.getElementById('formAccount')) {
    document.getElementById('formAccount').value = tx.account_id || 'acc_dompet';
  }
  document.getElementById('modalFormTitle').innerText = isGmailTx ? '✏️ Beri Kategori & Catatan Mutasi' : (tx.type === 'expense' ? '✏️ Edit Pengeluaran' : '✏️ Edit Pemasukan');
  populateCategoryOptions(tx.type);
  if (document.getElementById('formCategory')) {
    document.getElementById('formCategory').value = tx.category_id || '';
  }
  document.getElementById('txModal').classList.add('active');
}

async function deleteTransactionItem(clientTxId) {
  const localList = await getAllLocalTx();
  const tx = localList.find(t => t.client_tx_id === clientTxId);
  if (tx && (tx.source === 'gmail' || tx.is_gmail || (tx.client_tx_id && tx.client_tx_id.startsWith('gmail_')))) {
    alert('⚠️ Transaksi ini berasal dari sinkronisasi mutasi Gmail resmi dan bersifat permanen (tidak dapat dihapus). Anda tetap bisa mengubah kategori atau catatannya.');
    return;
  }

  const ok = await showCuteConfirm('Yakin ingin menghapus catatan transaksi ini?', 'Hapus Transaksi 🗑️', 'Ya, Hapus', 'Batal');
  if (!ok) return;

  await deleteLocalTx(clientTxId);
  await renderLocalTransactions();
  alert('✨ Catatan transaksi berhasil dihapus!');
}

async function renderLocalTransactions() {
  const localList = await getAllLocalTx();
  currentTxList = localList;
  updateFamilyBalances(localList);
  applyTransactionFilter();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text || '';
  return div.innerHTML;
}

// Inisialisasi Event Listener
document.addEventListener('DOMContentLoaded', async () => {
  await initIndexedDB();

  // Pasang tema tersimpan saat load
  if (currentMascot) {
    selectMascotTheme(currentMascot);
  }

  checkGoogleAuthRedirectCallback();

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

        // Mulai tour aplikasi otomatis setelah registrasi akun
        setTimeout(() => {
          showCuteAlert(`Selamat datang di DompetMungil, ${username}! 🌸\n\nMari kita mulai tur interaktif pengenalan seluruh fitur aplikasi agar Anda dan pasangan dapat mengelola keuangan dengan nyaman!`, 'Akun Berhasil Dibuat ✨')
            .then(() => {
              startDashboardTour();
            });
        }, 500);
      } else {
        alert(data.message || 'Gagal mendaftar');
      }
    } catch (err) {
      alert('Tidak dapat terhubung ke server STB.');
    }
  });

  // Login Form Submit (Masuk akun yang sudah ada)
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('loginUsername').value.trim();
      const p = document.getElementById('loginPassword').value;

      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        if (res.ok && data.token) {
          authToken = data.token;
          userRole = data.role || 'personal';
          accountMode = data.account_mode || 'personal';
          localStorage.setItem('kk_token', authToken);
          localStorage.setItem('dm_role', userRole);
          localStorage.setItem('dm_mode', accountMode);
          document.getElementById('onboardingModal').classList.remove('active');
          updateUserBadge();
          triggerSyncWithServer();

          // Jika tur belum pernah diselesaikan, jalankan tur
          const tourCompleted = localStorage.getItem('dm_tour_completed');
          if (!tourCompleted) {
            setTimeout(() => {
              startDashboardTour();
            }, 600);
          } else {
            alert(`🎉 Selamat datang kembali, ${data.username}!`);
          }
        } else {
          alert('❌ ' + (data.message || 'Username atau password salah'));
        }
      } catch (err) {
        alert('⚠️ Gagal terhubung ke server STB.');
      }
    });
  }

  // Budget Form Submit (Simpan / Usulkan batas anggaran kategori bersama)
  const budgetForm = document.getElementById('budgetForm');
  if (budgetForm) {
    budgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const catSelect = document.getElementById('budgetCategorySelect');
      const cat = catSelect ? catSelect.value : '';
      const catName = catSelect && catSelect.selectedOptions && catSelect.selectedOptions[0] ? catSelect.selectedOptions[0].innerText : cat;
      const rawAmt = document.getElementById('budgetAmountInput').value;
      const amt = parseNominalToNumber(rawAmt);

      if (!authToken) {
        alert('Harap masuk/daftar akun terlebih dahulu.');
        return;
      }

      if (!amt || isNaN(amt) || amt < 0) {
        alert('Harap masukkan nominal batas anggaran yang valid (contoh: 1.500 rb atau 1.500.000).');
        return;
      }

      const myRole = (localStorage.getItem('dm_role') || userRole || 'personal').toLowerCase();
      const currentMode = localStorage.getItem('dm_mode') || accountMode || 'personal';

      // Jika dalam mode keluarga (Suami/Istri), butuh persetujuan pasangan
      if (currentMode === 'family') {
        const isSuami = myRole === 'suami' || myRole === 'ayah';
        const partnerName = isSuami ? 'Istri' : 'Suami';

        // Cek apakah akun pasangan sudah terdaftar/terhubung
        const hasPartnerAccount = localStorage.getItem('dm_partner_account') === 'true' || localStorage.getItem('dm_has_spouse') === 'true';

        if (!hasPartnerAccount) {
          await showCuteAlert(
            `⚠️ Usulan Perubahan Anggaran DITOLAK!\n\nDi DompetMungil, anggaran bulanan adalah keputusan bersama suami dan istri. Akun ${partnerName} belum terdaftar di sistem.\n\nSilakan daftarkan akun ${partnerName} terlebih dahulu melalui Wizard Akun Keluarga agar dapat saling memberikan izin dan persetujuan.`,
            `Butuh Akun ${partnerName} 👨‍👩‍👧‍👦`
          );
          closeBudgetModal();
          return;
        }

        // Simpan usulan ke sistem persetujuan
        const proposals = getStoredBudgetProposals();
        proposals.push({
          id: 'prop_' + Date.now(),
          category_id: cat,
          category_name: catName,
          amount: amt,
          proposed_by: myRole,
          created_at: new Date().toISOString(),
          status: 'pending'
        });
        saveStoredBudgetProposals(proposals);
        closeBudgetModal();
        renderBudgetProposals();

        await showCuteAlert(
          `💌 Usulan batas anggaran sebesar ${formatRupiah(amt)} untuk "${catName}" telah dikirim ke akun ${partnerName}.\n\nAnggaran akan resmi aktif setelah ${partnerName} menekan tombol [Setujui] di tab Anggaran.`,
          'Menunggu Izin Pasangan ✨'
        );
        return;
      }

      // Mode Personal: Simpan langsung
      try {
        const res = await fetch('/api/v1/budgets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken
          },
          body: JSON.stringify({ category_id: cat, amount: amt })
        });
        const data = await res.json();
        if (res.ok) {
          closeBudgetModal();
          loadBudgets();
          alert('✨ Batas anggaran berhasil disimpan!');
        } else {
          alert(data.message || 'Gagal menyimpan anggaran');
        }
      } catch (err) {
        alert('⚠️ Gagal menyimpan anggaran ke server STB.');
      }
    });
  }

  // Inisialisasi formulir Google Client ID jika sudah tersimpan
  const savedClientId = getGoogleClientId();
  const inputClientId = document.getElementById('customGoogleClientId');
  if (inputClientId && savedClientId) {
    inputClientId.value = savedClientId;
  }
  
  // Periksa apakah pengguna tersambung lewat App Password atau OAuth
  const savedGmailMethod = localStorage.getItem('dm_gmail_method') || 'app_pass';
  switchGmailMethod(savedGmailMethod);

  const savedGmailEmail = localStorage.getItem('dm_gmail_email');
  const savedGmailPass = localStorage.getItem('dm_gmail_app_password');
  const inputUserEmail = document.getElementById('gmailUserEmail');
  const inputAppPass = document.getElementById('gmailAppPassword');
  if (inputUserEmail && savedGmailEmail) inputUserEmail.value = savedGmailEmail;
  if (inputAppPass && savedGmailPass) inputAppPass.value = savedGmailPass;

  if (savedGmailEmail) {
    showGoogleConnected(savedGmailEmail, savedGmailMethod === 'app_pass' ? 'Sandi Aplikasi (16-Digit)' : 'Google OAuth2 (Resmi)');
  } else {
    const savedGoogleAcc = localStorage.getItem('dm_google_email');
    if (savedGoogleAcc) {
      showGoogleConnected(savedGoogleAcc, 'Google OAuth2');
    }
  }

  // Tombol Google OAuth Redirect Resmi
  const btnGoogleRedirect = document.getElementById('btnRedirectGoogleOAuth');
  if (btnGoogleRedirect) {
    btnGoogleRedirect.addEventListener('click', async () => {
      const clientId = getGoogleClientId();
      if (!clientId) {
        alert('⚠️ Harap masukkan Google Client ID Anda terlebih dahulu.\n\nIkuti petunjuk 1 menit di bawah untuk membuatnya gratis di Google Cloud Console dengan tipe "Desktop app".');
        if (inputClientId) inputClientId.focus();
        return;
      }

      // Untuk Desktop app, Google mengizinkan loopback / custom redirect tanpa error domain
      const redirectUri = encodeURIComponent(window.location.origin + '/');
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent('email profile https://www.googleapis.com/auth/gmail.readonly')}` +
        `&include_granted_scopes=true`;

      const ok = await showCuteConfirm('Anda akan dialihkan ke halaman resmi masuk Google untuk menautkan DompetMungil.\n\nLanjutkan?', 'Tautkan Akun Google 🔗', 'Ya, Lanjutkan ✨', 'Batal');
      if (ok) {
        window.location.href = googleAuthUrl;
      }
    });
  }

  // Cek callback token OAuth di URL
  checkGoogleAuthRedirectCallback();

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

  // Handle Form Submit Transaksi (Tambah atau Edit)
  document.getElementById('txForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('txEditClientTxId').value;
    const type = document.getElementById('formType').value;
    const rawAmount = document.getElementById('formAmount').value;
    const amount = parseNominalToNumber(rawAmount);

    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Harap masukkan nominal transaksi yang valid (contoh: 50.000 atau 50 rb).');
      return;
    }

    const category = document.getElementById('formCategory').value;
    const account = document.getElementById('formAccount').value;
    const note = document.getElementById('formNote').value;

    let targetTxId = editId;
    let targetDate = new Date().toISOString().split('T')[0];

    if (editId) {
      const localList = await getAllLocalTx();
      const existing = localList.find(t => t.client_tx_id === editId);
      if (existing && existing.date) {
        targetDate = existing.date;
      }
    } else {
      targetTxId = 'ctx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }

    const txItem = {
      client_tx_id: targetTxId,
      type: type,
      amount: amount,
      category_id: category,
      account_id: account,
      date: targetDate,
      note: note
    };

    // 1. Simpan ke IndexedDB lokal
    await saveLocalTx(txItem, true);
    closeModal();
    document.getElementById('txEditClientTxId').value = '';
    await renderLocalTransactions();

    if (editId) {
      alert('✨ Perubahan transaksi berhasil disimpan!');
    }

    // 2. Coba kirim langsung ke server
    triggerSyncWithServer();
  });

  // Pasang event listener langsung untuk tombol navigasi bawah (5 Tab: home, budget, savings, bank, guide)
  const navBtns = document.querySelectorAll('.bottom-nav .nav-item');
  if (navBtns.length >= 5) {
    navBtns[0].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('home'); });
    navBtns[1].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('budget'); });
    navBtns[2].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('savings'); });
    navBtns[3].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('bank'); });
    navBtns[4].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('guide'); });
  } else if (navBtns.length >= 4) {
    navBtns[0].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('home'); });
    navBtns[1].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('budget'); });
    navBtns[2].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('bank'); });
    navBtns[3].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('guide'); });
  }

  // Handle Form Buat Target Celengan Baru
  const goalForm = document.getElementById('goalForm');
  if (goalForm) {
    goalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('goalTitleInput').value.trim();
      const target = parseFloat(document.getElementById('goalTargetInput').value);
      const current = parseFloat(document.getElementById('goalCurrentInput').value || 0);
      const iconRadio = document.querySelector('input[name="goalIcon"]:checked');
      const icon = iconRadio ? iconRadio.value : '🐔';

      if (!title || !target) return;

      const goals = getStoredSavingsGoals();
      goals.push({
        id: 'goal_' + Date.now(),
        title: title,
        icon: icon,
        target: target,
        current: current
      });
      saveStoredSavingsGoals(goals);
      closeGoalModal();
      renderSavingsGoals();
      alert(`🎉 Target celengan "${title}" berhasil ditambahkan! Semangat menabung!`);
    });
  }

  // Handle Form Tambah Saldo Celengan (Deposit)
  const depositForm = document.getElementById('depositGoalForm');
  if (depositForm) {
    depositForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const goalId = document.getElementById('depositGoalId').value;
      const amt = parseFloat(document.getElementById('depositAmountInput').value);
      if (!amt || amt <= 0) return;

      const goals = getStoredSavingsGoals();
      const g = goals.find(item => item.id === goalId);
      if (g) {
        g.current = (g.current || 0) + amt;
        saveStoredSavingsGoals(goals);
        closeDepositGoalModal();
        renderSavingsGoals();
        if (g.current >= g.target) {
          alert(`🎊 HOREEE!! Impian celengan "${g.title}" SUDAH TERCAPAI! Selamat! 🎉`);
        } else {
          alert(`🪙 Berhasil memasukkan ${formatRupiah(amt)} ke celengan "${g.title}"!`);
        }
      }
    });
  }

  // Handle Form Kategori Kustom Baru
  const catForm = document.getElementById('newCategoryForm');
  if (catForm) {
    catForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('customCatType').value;
      const name = document.getElementById('customCatNameInput').value.trim();
      const iconRadio = document.querySelector('input[name="customCatIcon"]:checked');
      const icon = iconRadio ? iconRadio.value : '🌸';

      if (!name) return;

      const fullName = `${icon} ${name}`;
      const newCatId = 'cat_custom_' + Date.now();

      CATEGORIES = getStoredCategories();
      CATEGORIES[type].push({ id: newCatId, name: fullName });
      saveStoredCategories(CATEGORIES);

      document.getElementById('customCatNameInput').value = '';
      renderCategoryManagerList();
      populateCategoryOptions(type);
      alert(`✨ Kategori "${fullName}" berhasil dibuat!`);
    });
  }

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

  // 🌙 Inisialisasi Cozy Dark Mode
  initDarkMode();

  // 🔐 Inisialisasi App Lock PIN
  initPinLock();

  // Handle Form Tagihan Rutin
  const billForm = document.getElementById('billForm');
  if (billForm) {
    billForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('billNameInput').value.trim();
      const amount = parseFloat(document.getElementById('billAmountInput').value);
      const day = parseInt(document.getElementById('billDayInput').value);
      const iconRadio = document.querySelector('input[name="billIcon"]:checked');
      const icon = iconRadio ? iconRadio.value : '💡';

      if (!name || !amount) return;

      const bills = getStoredBills();
      bills.push({
        id: 'bill_' + Date.now(),
        name: name,
        amount: amount,
        day: day,
        icon: icon,
        paid_month: '' // 'YYYY-MM' saat ditandai lunas
      });
      saveStoredBills(bills);
      closeBillModal();
      renderBillsList();
      alert(`📌 Tagihan "${name}" berhasil ditambahkan!`);
    });
  }

  // Handle Form Hutang / Piutang
  const debtForm = document.getElementById('debtForm');
  if (debtForm) {
    debtForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('debtTypeSelect').value;
      const person = document.getElementById('debtPersonInput').value.trim();
      const amount = parseFloat(document.getElementById('debtAmountInput').value);
      const note = document.getElementById('debtNoteInput').value.trim();

      if (!person || !amount) return;

      const debts = getStoredDebts();
      debts.push({
        id: 'debt_' + Date.now(),
        type: type, // 'my_debt' atau 'others_debt'
        person: person,
        amount: amount,
        note: note,
        date: new Date().toISOString().split('T')[0],
        status: 'unpaid' // 'unpaid' atau 'paid'
      });
      saveStoredDebts(debts);
      closeDebtModal();
      renderDebtsList();
      alert(`🤝 Catatan pinjaman dengan ${person} berhasil disimpan!`);
    });
  }

  // Periodic heartbeat sync (setiap 30 detik coba hubungkan ke server jika pulih dari OOM)
  setInterval(() => {
    triggerSyncWithServer();
  }, 30000);

  // Cek apakah user pertama kali mendaftar/login (jika belum, buka wizard pendaftaran)
  checkUserOnboarding();

  // Jalankan sync pertama saat buka aplikasi
  triggerSyncWithServer();
});

// 📌 Manajemen Tagihan Rutin & Checklist Bulanan
const DEFAULT_BILLS = [
  { id: 'bill_1', name: 'Listrik PLN Rumah', amount: 350000, day: 5, icon: '💡', paid_month: '' },
  { id: 'bill_2', name: 'WiFi Internet Rumah', amount: 280000, day: 15, icon: '📶', paid_month: '' },
  { id: 'bill_3', name: 'Iuran Air PDAM', amount: 95000, day: 20, icon: '💧', paid_month: '' }
];

function getStoredBills() {
  const b = localStorage.getItem('dm_stored_bills');
  if (b) {
    try { return JSON.parse(b); } catch (e) {}
  }
  return JSON.parse(JSON.stringify(DEFAULT_BILLS));
}

function saveStoredBills(bills) {
  localStorage.setItem('dm_stored_bills', JSON.stringify(bills));
}

function openAddBillModal() {
  document.getElementById('billForm').reset();
  document.getElementById('billModal').classList.add('active');
}

function closeBillModal() {
  document.getElementById('billModal').classList.remove('active');
}

function renderBillsList() {
  const container = document.getElementById('billsListContainer');
  if (!container) return;

  const bills = getStoredBills();
  const currentMonthKey = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  let unpaidTotal = 0;
  let paidTotal = 0;

  if (bills.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:var(--text-muted); background:#FFF; border-radius:16px;">
        <span style="font-size:2rem; display:block; margin-bottom:6px;">📌</span>
        <strong>Belum ada tagihan rutin</strong>
        <p style="font-size:0.75rem; margin-top:4px;">Klik "+ Tagihan Baru" untuk membuat checklist langganan.</p>
      </div>
    `;
    document.getElementById('unpaidBillsTotalDisplay').innerText = 'Rp 0';
    document.getElementById('paidBillsTotalDisplay').innerText = 'Rp 0';
    return;
  }

  container.innerHTML = bills.map(b => {
    const isPaid = b.paid_month === currentMonthKey;
    if (isPaid) {
      paidTotal += Number(b.amount);
    } else {
      unpaidTotal += Number(b.amount);
    }

    return `
      <div class="bill-card" style="opacity:${isPaid ? '0.75' : '1'};">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:1.6rem; width:40px; height:40px; border-radius:12px; background:${isPaid ? '#E8F5E9' : '#FFF0F3'}; display:flex; align-items:center; justify-content:center;">
            ${b.icon || '📌'}
          </div>
          <div>
            <strong style="font-size:0.9rem; color:var(--text-primary); text-decoration:${isPaid ? 'line-through' : 'none'};">${escapeHtml(b.name)}</strong>
            <div style="font-size:0.72rem; color:var(--text-muted);">
              Jatuh Tempo: Tgl ${b.day} tiap bulan • <span style="font-weight:700; color:${isPaid ? '#2E7D32' : '#C62828'};">${isPaid ? 'Sudah Lunas Bulan Ini' : 'Belum Bayar'}</span>
            </div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary);">${formatRupiah(b.amount)}</div>
          <div style="display:flex; gap:6px;">
            <button onclick="toggleBillPaid('${b.id}')" class="btn-cute ${isPaid ? '' : 'mint'}" style="padding:4px 8px; font-size:0.72rem;">
              ${isPaid ? '↩️ Batal' : '✅ Bayar'}
            </button>
            <button onclick="deleteBillItem('${b.id}')" style="background:none; border:none; color:#FF9AA2; font-size:0.75rem; cursor:pointer;">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('unpaidBillsTotalDisplay').innerText = formatRupiah(unpaidTotal);
  document.getElementById('paidBillsTotalDisplay').innerText = formatRupiah(paidTotal);
}

async function toggleBillPaid(billId) {
  const bills = getStoredBills();
  const bill = bills.find(b => b.id === billId);
  if (!bill) return;

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  if (bill.paid_month === currentMonthKey) {
    bill.paid_month = '';
    saveStoredBills(bills);
    renderBillsList();
    alert(`Status pembayaran "${bill.name}" dibatalkan.`);
  } else {
    const ok = await showCuteConfirm(`Tandai "${bill.name}" (${formatRupiah(bill.amount)}) sudah dibayar dan otomatis catat ke pengeluaran dompet?`, 'Bayar Tagihan 📌', 'Ya, Bayar & Catat ✨', 'Hanya Tandai');
    bill.paid_month = currentMonthKey;
    saveStoredBills(bills);
    if (ok) {
      const newTx = {
        client_tx_id: `ctx_bill_${Date.now()}`,
        type: 'expense',
        amount: bill.amount,
        category_id: 'cat_tagihan',
        account_id: 'acc_bank',
        date: new Date().toISOString().split('T')[0],
        note: `Pembayaran ${bill.name} (${currentMonthKey})`
      };
      await saveLocalTx(newTx, true);
      await renderLocalTransactions();
      triggerSyncWithServer();
    }
    renderBillsList();
    alert(`🎉 Tagihan "${bill.name}" berhasil dilunasi!`);
  }
}

async function deleteBillItem(billId) {
  const ok = await showCuteConfirm('Yakin ingin menghapus tagihan rutin ini?', 'Hapus Tagihan 📌', 'Ya, Hapus', 'Batal');
  if (!ok) return;
  let bills = getStoredBills();
  bills = bills.filter(b => b.id !== billId);
  saveStoredBills(bills);
  renderBillsList();
}

// 🤝 Manajemen Hutang & Piutang
const DEFAULT_DEBTS = [
  { id: 'debt_1', type: 'others_debt', person: 'Rian (Teman Kantor)', amount: 200000, note: 'Pinjam uang makan siang', date: '2026-11-01', status: 'unpaid' }
];

function getStoredDebts() {
  const d = localStorage.getItem('dm_stored_debts');
  if (d) {
    try { return JSON.parse(d); } catch (e) {}
  }
  return JSON.parse(JSON.stringify(DEFAULT_DEBTS));
}

function saveStoredDebts(debts) {
  localStorage.setItem('dm_stored_debts', JSON.stringify(debts));
}

function openAddDebtModal() {
  document.getElementById('debtForm').reset();
  document.getElementById('debtModal').classList.add('active');
}

function closeDebtModal() {
  document.getElementById('debtModal').classList.remove('active');
}

function renderDebtsList() {
  const container = document.getElementById('debtsListContainer');
  if (!container) return;

  const debts = getStoredDebts();
  let myDebtTotal = 0;
  let othersDebtTotal = 0;

  if (debts.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:var(--text-muted); background:#FFF; border-radius:16px;">
        <span style="font-size:2rem; display:block; margin-bottom:6px;">🤝</span>
        <strong>Tidak ada catatan hutang / piutang</strong>
        <p style="font-size:0.75rem; margin-top:4px;">Keuangan bebas dari tanggungan pinjaman!</p>
      </div>
    `;
    document.getElementById('totalMyDebtDisplay').innerText = 'Rp 0';
    document.getElementById('totalOthersDebtDisplay').innerText = 'Rp 0';
    return;
  }

  container.innerHTML = debts.map(d => {
    const isPaid = d.status === 'paid';
    const isMyDebt = d.type === 'my_debt';

    if (!isPaid) {
      if (isMyDebt) myDebtTotal += Number(d.amount);
      else othersDebtTotal += Number(d.amount);
    }

    return `
      <div class="debt-card" style="opacity:${isPaid ? '0.7' : '1'};">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:1.5rem; width:40px; height:40px; border-radius:12px; background:${isMyDebt ? '#FFEBEE' : '#E8F5E9'}; display:flex; align-items:center; justify-content:center;">
            ${isMyDebt ? '🔴' : '🟢'}
          </div>
          <div>
            <strong style="font-size:0.9rem; color:var(--text-primary); text-decoration:${isPaid ? 'line-through' : 'none'};">${escapeHtml(d.person)}</strong>
            <div style="font-size:0.72rem; color:var(--text-muted);">
              ${isMyDebt ? 'Saya Berhutang' : 'Orang Berhutang'} • ${d.date} ${d.note ? '• ' + escapeHtml(d.note) : ''}
            </div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div style="font-weight:800; font-size:0.95rem; color:${isMyDebt ? '#C62828' : '#2E7D32'};">
            ${formatRupiah(d.amount)}
          </div>
          <div style="display:flex; gap:6px;">
            <button onclick="toggleDebtPaid('${d.id}')" class="btn-cute ${isPaid ? '' : 'mint'}" style="padding:4px 8px; font-size:0.72rem;">
              ${isPaid ? 'Belum Lunas' : '✅ Lunas'}
            </button>
            <button onclick="deleteDebtItem('${d.id}')" style="background:none; border:none; color:#FF9AA2; font-size:0.75rem; cursor:pointer;">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('totalMyDebtDisplay').innerText = formatRupiah(myDebtTotal);
  document.getElementById('totalOthersDebtDisplay').innerText = formatRupiah(othersDebtTotal);
}

async function toggleDebtPaid(debtId) {
  const debts = getStoredDebts();
  const d = debts.find(item => item.id === debtId);
  if (!d) return;

  d.status = d.status === 'paid' ? 'unpaid' : 'paid';
  saveStoredDebts(debts);
  renderDebtsList();
  alert(`✨ Status catatan ${d.person} berhasil diubah menjadi: ${d.status === 'paid' ? 'LUNAS 🎉' : 'Belum Lunas'}`);
}

async function deleteDebtItem(debtId) {
  const ok = await showCuteConfirm('Yakin ingin menghapus catatan pinjaman ini?', 'Hapus Catatan 🤝', 'Ya, Hapus', 'Batal');
  if (!ok) return;
  let debts = getStoredDebts();
  debts = debts.filter(item => item.id !== debtId);
  saveStoredDebts(debts);
  renderDebtsList();
}

// 🌙 Cozy Dark Mode Manager
function initDarkMode() {
  const isDark = localStorage.getItem('dm_dark_mode') === 'true';
  applyDarkMode(isDark);
}

function toggleDarkMode() {
  const isCurrentlyDark = document.body.classList.contains('dark-mode');
  const nextMode = !isCurrentlyDark;
  localStorage.setItem('dm_dark_mode', String(nextMode));
  applyDarkMode(nextMode);
}

function applyDarkMode(isDark) {
  const btn = document.getElementById('btnToggleDarkMode');
  if (isDark) {
    document.body.classList.add('dark-mode');
    if (btn) btn.innerText = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    if (btn) btn.innerText = '🌙';
  }
}

// 🔐 Kunci PIN Layar (App Lock)
function initPinLock() {
  const savedPin = localStorage.getItem('dm_app_pin');
  const lockScreen = document.getElementById('appLockScreen');
  if (savedPin && lockScreen) {
    lockScreen.style.display = 'flex';
    setTimeout(() => {
      const inp = document.getElementById('unlockPinInput');
      if (inp) inp.focus();
    }, 100);
  }
}

function openPinConfigModal() {
  const savedPin = localStorage.getItem('dm_app_pin');
  const statusText = document.getElementById('pinStatusText');
  const btnDisable = document.getElementById('btnDisablePin');
  const inp = document.getElementById('newPinInput');

  if (statusText) {
    statusText.innerText = savedPin ? 'Status: Aktif 🔒 (Terproteksi PIN)' : 'Status: Tidak Aktif (Bebas Kunci)';
    statusText.style.color = savedPin ? '#2E7D32' : '#888';
  }
  if (btnDisable) {
    btnDisable.style.display = savedPin ? 'block' : 'none';
  }
  if (inp) inp.value = '';

  document.getElementById('pinConfigModal').classList.add('active');
}

function closePinConfigModal() {
  document.getElementById('pinConfigModal').classList.remove('active');
}

function saveNewPin() {
  const inp = document.getElementById('newPinInput');
  const val = inp ? inp.value.trim() : '';
  if (!val || val.length !== 4 || isNaN(Number(val))) {
    alert('Harap masukkan tepat 4 angka PIN (misal: 1234).');
    return;
  }
  localStorage.setItem('dm_app_pin', val);
  closePinConfigModal();
  alert('🎉 Kunci PIN 4 digit berhasil diaktifkan! Aplikasi aman terlindungi.');
}

async function disablePin() {
  const ok = await showCuteConfirm('Yakin ingin menonaktifkan kunci PIN aplikasi?', 'Nonaktifkan PIN 🔐', 'Ya, Hapus PIN', 'Batal');
  if (!ok) return;
  localStorage.removeItem('dm_app_pin');
  closePinConfigModal();
  alert('Kunci PIN dinonaktifkan.');
}

function checkUnlockPin(val) {
  if (val && val.length === 4) {
    verifyUnlockPin(val);
  }
}

function verifyUnlockPinBtn() {
  const inp = document.getElementById('unlockPinInput');
  if (inp) verifyUnlockPin(inp.value);
}

function verifyUnlockPin(inputVal) {
  const savedPin = localStorage.getItem('dm_app_pin');
  const lockScreen = document.getElementById('appLockScreen');
  if (inputVal === savedPin) {
    if (lockScreen) lockScreen.style.display = 'none';
  } else {
    alert('❌ PIN salah! Silakan coba lagi.');
    const inp = document.getElementById('unlockPinInput');
    if (inp) {
      inp.value = '';
      inp.focus();
    }
  }
}

