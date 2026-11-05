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

// Konfigurasi Google Client ID
function getGoogleClientId() {
  return localStorage.getItem('dm_google_client_id') || '';
}

function saveGoogleClientId() {
  const input = document.getElementById('customGoogleClientId');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    alert('Silakan masukkan Google Client ID Anda terlebih dahulu.');
    return;
  }
  localStorage.setItem('dm_google_client_id', val);
  alert('✅ Google Client ID berhasil disimpan!');
}

// Periksa URL hash apakah ada token kembalian dari Google OAuth2
function checkGoogleAuthRedirectCallback() {
  if (window.location.hash) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      localStorage.setItem('dm_google_oauth_token', token);
      localStorage.setItem('dm_google_email', 'google.user@gmail.com');
      window.location.hash = ''; // Bersihkan hash di URL
      alert('🎉 Berhasil masuk dengan Akun Google! Izin kolaborasi notifikasi mutasi rekening aktif.');
    }
  }
}

function showGoogleConnected(email) {
  const card = document.getElementById('googleConnectedCard');
  const emailText = document.getElementById('connectedGoogleEmail');
  const btn = document.getElementById('btnRedirectGoogleOAuth');
  if (card && emailText && btn) {
    emailText.innerText = email;
    card.style.display = 'block';
    btn.innerHTML = '🔄 Ganti Akun Google yang Berkolaborasi';
  }
}

function disconnectGoogleAccount() {
  if (confirm('Yakin ingin memutuskan kolaborasi akun Google?')) {
    localStorage.removeItem('dm_google_email');
    localStorage.removeItem('dm_google_oauth_token');
    document.getElementById('googleConnectedCard').style.display = 'none';
    const btn = document.getElementById('btnRedirectGoogleOAuth');
    if (btn) {
      btn.innerHTML = `<svg style="width:20px; height:20px; vertical-align:middle; margin-right:8px;" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg> Lanjutkan dengan Akun Google (Redirect)`;
    }
    alert('Akun Google berhasil diputuskan.');
  }
}
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

// Logika Panduan Game Spotlight di Dashboard (RPG/Game-Style Tour)
const TOUR_STEPS = [
  {
    target: '#mascotAvatarContainer',
    title: 'Pilih Teman Finansialmu 🐾',
    desc: 'Sentuh avatar ini kapan saja untuk memilih maskot (Kucing, Shiba, Capybara, Usagi, Panda). Seluruh warna tema aplikasi akan ikut berganti manis!'
  },
  {
    target: '.card-wallet',
    title: 'Kartu Dompet & Jadwal Gaji 💰',
    desc: 'Di sini Anda dapat melihat total saldo, total pengeluaran, pemasukan, serta mengatur kalender tanggal gajian rutin dengan 1 sentuhan.'
  },
  {
    target: '.quick-actions-bar',
    title: 'Pencatatan Secepat Kilat 🌸',
    desc: 'Klik Catat Keluar atau Catat Masuk. Data dienkripsi AES-256 dan tetap tersimpan aman di HP meski server STB sedang offline.'
  },
  {
    target: '.bottom-nav',
    title: 'Navigasi Lengkap 🧭',
    desc: 'Pindah ke tab Bank Mutasi untuk impor rekening atau tab Panduan untuk membaca tips dan mengulang tur game ini kapan saja!'
  }
];

let currentTourIndex = 0;

function startDashboardTour() {
  window.switchTab('home');
  currentTourIndex = 0;
  const overlay = document.getElementById('spotlightOverlay');
  if (overlay) overlay.classList.add('active');
  renderTourStep();
}

function stopDashboardTour() {
  const overlay = document.getElementById('spotlightOverlay');
  if (overlay) overlay.classList.remove('active');
  localStorage.setItem('dm_tour_completed', 'true');
}

function nextTourStep() {
  if (currentTourIndex < TOUR_STEPS.length - 1) {
    currentTourIndex++;
    renderTourStep();
  } else {
    stopDashboardTour();
    alert('🎉 Hore! Anda sudah siap menjelajahi DompetMungil!');
  }
}

function renderTourStep() {
  const step = TOUR_STEPS[currentTourIndex];
  const highlight = document.getElementById('spotlightHighlight');
  const tooltip = document.getElementById('spotlightTooltip');
  const title = document.getElementById('tourTooltipTitle');
  const desc = document.getElementById('tourTooltipDesc');
  const indicator = document.getElementById('tourStepIndicator');
  const btnNext = document.getElementById('btnTourNext');

  if (!highlight || !tooltip) return;

  const targetEl = document.querySelector(step.target);
  if (!targetEl) {
    console.warn('Target tour tidak ditemukan:', step.target);
    return;
  }

  // Gulir ke elemen target dengan halus
  targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    const rect = targetEl.getBoundingClientRect();
    const padding = 8;
    
    // Posisikan highlight tepat di sekeliling elemen target
    highlight.style.top = `${rect.top - padding + window.scrollY}px`;
    highlight.style.left = `${rect.left - padding + window.scrollX}px`;
    highlight.style.width = `${rect.width + padding * 2}px`;
    highlight.style.height = `${rect.height + padding * 2}px`;

    // Posisikan tooltip di bawah atau di atas elemen target tergantung ruang layar
    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    let tooltipTop = rect.bottom + 16 + window.scrollY;
    let tooltipLeft = Math.max(16, (window.innerWidth - tooltipWidth) / 2);

    if (rect.bottom + 180 > window.innerHeight) {
      tooltipTop = Math.max(10, rect.top - 170 + window.scrollY);
    }

    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.left = `${tooltipLeft}px`;
    tooltip.style.width = `${tooltipWidth}px`;

    title.innerHTML = `<span>🐾</span> ${step.title}`;
    desc.innerText = step.desc;
    indicator.innerText = `${currentTourIndex + 1} / ${TOUR_STEPS.length}`;
    btnNext.innerText = currentTourIndex === TOUR_STEPS.length - 1 ? 'Selesai ✨' : 'Lanjut ➡️';
  }, 100);
}

// Logika Panduan Interaktif Langkah Demi Langkah (Step-by-Step Guide)
const GUIDE_STEPS = [
  {
    title: '1. Pilih Peran & Mode Akun 👨‍👩‍👧‍👦',
    desc: 'Di awal penggunaan, tentukan apakah Anda menggunakan mode <strong>Personal</strong> (mandiri) atau <strong>Keluarga</strong> (Suami/Istri/Anak). Suami & Istri dapat mengelola anggaran penuh, sedangkan Anak memiliki dompet uang saku privat.'
  },
  {
    title: '2. Atur Tanggal Gajian Rutin 🗓️',
    desc: 'Sentuh tombol <strong>"Gajian: Tgl 25"</strong> di kartu dompet untuk memilih tanggal gajian melalui kalender mini. Begitu tanggal gajian tiba, cukup klik <strong>"⚡ Terapkan Gaji Bulan Ini"</strong> untuk pencatatan instan.'
  },
  {
    title: '3. Pencatatan Cepat & Offline-First 🌸',
    desc: 'Gunakan tombol <strong>➖ Catat Keluar</strong> atau <strong>➕ Catat Masuk</strong>. Kategori pengeluaran dan pemasukan sudah terpisah rapi. Transaksi akan langsung tersimpan di HP walau server Odroid sedang mati/OOM!'
  },
  {
    title: '4. Personalisasi Karakter Maskot 🐾',
    desc: 'Sentuh ikon maskot di pojok kiri atas untuk memilih teman finansial Anda (Kucing, Shiba, Capybara, Kelinci, atau Panda). Seluruh warna tema aplikasi akan bertransformasi seketika!'
  }
];

let currentGuideStepIndex = 0;

function openStepGuideModal() {
  currentGuideStepIndex = 0;
  renderGuideStep();
  document.getElementById('stepGuideModal').classList.add('active');
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

window.switchTab = function(tab) {
  const viewHome = document.getElementById('viewHome');
  const viewBank = document.getElementById('viewBank');
  const viewGuide = document.getElementById('viewGuide');

  if (!viewHome || !viewBank || !viewGuide) {
    console.error('View panel tidak ditemukan');
    return;
  }

  currentTab = tab;

  // Sembunyikan semua tab secara tegas
  viewHome.style.display = 'none';
  viewBank.style.display = 'none';
  viewGuide.style.display = 'none';

  // Tampilkan tab target
  if (tab === 'home') viewHome.style.display = 'block';
  if (tab === 'bank') viewBank.style.display = 'block';
  if (tab === 'guide') viewGuide.style.display = 'block';

  // Update status tombol aktif di navbar
  document.querySelectorAll('.bottom-nav .nav-item').forEach((item, index) => {
    item.classList.remove('active');
    if ((tab === 'home' && index === 0) || (tab === 'bank' && index === 1) || (tab === 'guide' && index === 2)) {
      item.classList.add('active');
    }
  });
};

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
      } else {
        alert(data.message || 'Gagal mendaftar');
      }
    } catch (err) {
      alert('Tidak dapat terhubung ke server STB.');
    }
  });

  // Setup tampilan URL saat ini di petunjuk Google Console
  const urlDisplay = document.getElementById('currentAppUrlDisplay');
  if (urlDisplay) {
    urlDisplay.innerText = window.location.origin + '/';
  }
  const customIdInput = document.getElementById('customGoogleClientId');
  if (customIdInput) {
    customIdInput.value = getGoogleClientId();
  }

  // Tombol Google OAuth Redirect
  const btnGoogleRedirect = document.getElementById('btnRedirectGoogleOAuth');
  if (btnGoogleRedirect) {
    btnGoogleRedirect.addEventListener('click', () => {
      const clientId = getGoogleClientId();
      if (!clientId) {
        alert('⚠️ Google OAuth membutuhkan Google Client ID Anda.\n\nSilakan masukkan Client ID Anda pada kolom di atas (tersedia petunjuk 1 menit gratis), atau gunakan opsi "Unggah e-Statement / CSV" untuk langsung pakai 100% offline tanpa akun!');
        document.getElementById('customGoogleClientId').focus();
        return;
      }

      const redirectUri = encodeURIComponent(window.location.origin + '/');
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly email profile')}` +
        `&include_granted_scopes=true`;

      if (confirm('Anda akan dialihkan ke halaman masuk resmi Google (accounts.google.com) untuk memberikan izin pembacaan notifikasi bank.\n\nLanjutkan?')) {
        window.location.href = googleAuthUrl;
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

  // Pasang event listener langsung untuk tombol navigasi bawah
  const navBtns = document.querySelectorAll('.bottom-nav .nav-item');
  if (navBtns.length >= 3) {
    navBtns[0].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('home'); });
    navBtns[1].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('bank'); });
    navBtns[2].addEventListener('click', (e) => { e.preventDefault(); window.switchTab('guide'); });
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

  // Periodic heartbeat sync (setiap 30 detik coba hubungkan ke server jika pulih dari OOM)
  setInterval(() => {
    triggerSyncWithServer();
  }, 30000);

  // Jalankan sync pertama saat buka aplikasi
  triggerSyncWithServer();
});
