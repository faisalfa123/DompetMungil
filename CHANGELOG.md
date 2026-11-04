# CHANGELOG

Semua perubahan dan catatan rilis pada proyek **DompetMungil** didokumentasikan di berkas ini.
Format ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/).

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
