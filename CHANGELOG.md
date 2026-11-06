# CHANGELOG

Semua perubahan dan catatan rilis pada proyek **DompetMungil** didokumentasikan di berkas ini.
Format ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/).

---

## [v0.04.0-beta] - 2026-11-06

### 🐛 Perbaikan Bug Kritis (Bug Fixes)
- **Modal Masuk / Login untuk Pengguna Lama**:
  - Menyediakan form Login (`loginForm`) di modal akun dengan tombol toggle bolak-balik antara form pendaftaran mode baru dan form masuk akun lama.
- **Penyimpanan `user_id` pada Transaksi**:
  - Endpoint `POST /api/v1/transactions` dan `POST /api/v1/sync` kini mengekstrak identitas pengguna dari header otentikasi (`X-Authenticated-ID`) dan menyimpannya ke kolom `user_id` pada tabel `transactions`.
  - Sistem transparansi terkontrol kini berfungsi optimal: peran **Anak** hanya dapat melihat transaksi yang dicatat oleh akunnya sendiri.
- **Sesi Token Persisten di SQLite**:
  - Menambahkan tabel `sessions` dengan kedaluwarsa 30 hari. Token otentikasi tidak lagi hilang saat server STB mengalami restart atau OOM recovery.
- **Penanganan 4 Tab Navigasi**:
  - Event listener navigasi bawah kini mendukung secara presisi ke-4 tab: Dompet, Anggaran, Bank Mutasi, dan Panduan.

### 🌟 Fitur Baru (Added)
- **Manajemen Anggaran Bulanan (Budgeting)**:
  - Tab baru **"🎯 Anggaran"** untuk memantau batas pengeluaran per kategori.
  - Progress bar visual yang dinamis dengan indikator peringatan (*⚠️ Overbudget*) ketika realisasi melebihi batas.
- **Visualisasi Komposisi Pengeluaran (Pie Chart SVG Murni)**:
  - Diagram lingkaran interaktif SVG murni di dashboard utama tanpa pustaka pihak ketiga eksternal, hemat memori dan ramah low-RAM SBC.
  - Dilengkapi legenda kategori dan persentase pengeluaran real-time.
- **Filter Rentang Tanggal**:
  - Pilihan filter cepat: **Semua**, **Bulan Ini**, **Bulan Lalu**, dan **Tahun Ini** untuk riwayat transaksi dan grafik pengeluaran.
- **Ekspor Laporan Transaksi ke CSV / Excel**:
  - Tombol **"📥 Ekspor CSV"** di dashboard yang mendukung pengunduhan server-side UTF-8 BOM (ramah Microsoft Excel) maupun fallback client-side IndexedDB lokal.
- **Peningkatan Cache PWA**:
  - Service worker cache diperbarui ke `dompetmungil-v12` untuk pembaruan aset otomatis pada perangkat ponsel.

---

## [v0.03.0-beta] - 2026-11-05

### 🌟 Fitur Baru & Perbaikan (Added & Fixed)
- **Pemisahan Kategori Pemasukan vs Pengeluaran**:
  - Modal pencatatan transaksi kini secara dinamis menampilkan kategori yang sesuai dengan tipe transaksi.
  - *Pengeluaran*: Makanan, Belanja Dapur, Listrik/Wifi, Pendidikan Anak, Rekreasi, Kesehatan, Transportasi.
  - *Pemasukan*: Gaji/Pendapatan Bulanan Tetap, Bonus, Usaha Sampingan, Investasi, Hadiah.
- **Sistem Jadwal Gaji Pokok Rutin & 1-Klik Recall**:
  - Pengguna dapat mengatur tanggal gajian pasti (1-31) dan nominal gaji bulanan.
  - Tombol **"⚡ Terapkan Gaji Bulan Ini"** pada kartu dompet untuk secara instan mencatat pemasukan bulanan tetap tanpa perlu mengetik ulang dari awal setiap bulan.
- **Auto-Recovery & Penyambungan Konfigurasi di Setup Wizard (`install.sh`)**:
  - Jika konfigurasi lama ditemukan, wizard otomatis menyambungkannya (*seamless update*) tanpa menanyakan ulang port atau backup.
  - Pada instalasi baru/fresh install di STB, jika terdeteksi `rclone` (Google Drive), wizard langsung menawarkan opsi **"Pulihkan Data dari Cloud (Recovery)"** untuk mengunduh snapshot `keuangan_snapshot_*.tar.gz` (database + kunci enkripsi) secara otomatis.

---

## [v0.02.2-beta] - 2026-11-04

### 🌟 Fitur Baru (Added)
- **Mode Akun: Personal vs Keluarga**:
  - Pilihan alur pendaftaran awal: *Personal* (langsung form daftar sederhana) vs *Keluarga*.
  - Pemilihan peran keluarga: **Suami**, **Istri**, dan **Anak**.
- **Sistem Transparansi Terkontrol (Role-Based Access)**:
  - Suami & Istri dapat memantau seluruh transaksi keluarga, saldo total, serta mengelola anggaran rumah tangga.
  - Peran Anak hanya dapat melihat dompet uang saku dan transaksi yang dicatat oleh dirinya sendiri demi privasi dan edukasi finansial yang sehat.
- **Jadwal Pendapatan Pokok Rutin & Kalender Nyata**:
  - Konfigurasi tanggal penerimaan gaji/pendapatan berkala (misal: tanggal 25 tiap bulan atau hari kerja tertentu) dengan integrasi kalender tahun nyata.
  - Pengelompokan visual (*grouping*) otomatis antara pemasukan dan pengeluaran.
- **Pilihan Maskot Hewan Kawaii (Cute Theme Switcher)**:
  - 5 maskot orisinal SVG: **Kucing Kawaii (Neko)**, **Shiba Inu (Anjing Lucu)**, **Capybara Santai**, **Kelinci Imut (Usagi)**, dan **Panda Menggemaskan**.
  - Pengguna dapat mengganti maskot dan warna tema favorit kapan saja melalui antarmuka aplikasi.
- **Opsi Ganda Impor Mutasi Rekening Bank**:
  - **Opsi 1**: Unggah/tempel berkas e-Statement & CSV (BCA, Mandiri, BRI, BNI, Jago/GoPay).
  - **Opsi 2**: *Sign in with Google* (OAuth2 Token berbasis Client-Side) untuk membaca notifikasi transaksi resmi dari bank secara terenkripsi tanpa perantara server luar.

---

## [v0.01.0-beta] - 2026-11-04

### 🚀 Rilis Awal (Initial Release)
- Arsitektur backend ultra-ringan berbasis Go (RAM footprint < 20MB) khusus server Odroid C2 / STB HG680P (Amlogic S905X).
- Database SQLite lokal WAL terenkripsi AES-256-GCM.
- PWA Offline-First dengan IndexedDB dan mekanisme pemulihan OOM Killer (*OOM-Resistant*).
- Wizard instalasi terminal TUI (`install.sh`) dengan dukungan pencadangan berpasangan (*Database + Secret Key*) ke remote storage `rclone` / `rsync`.
- GitHub Actions CI/CD untuk build binary multi-arsitektur (`arm64`, `armv7`, `x86_64`).
- Lisensi resmi GNU General Public License v3.0 (GPL-3.0).
