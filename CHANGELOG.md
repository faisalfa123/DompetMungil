# CHANGELOG

Semua perubahan dan catatan rilis pada proyek **DompetMungil** didokumentasikan di berkas ini.
Format ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/).

---

## [v0.02.0-beta] - 2026-11-04

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
