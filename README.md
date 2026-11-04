# 🌸 DompetMungil (Cute & Ultra-Lightweight Family Finance PWA)

Aplikasi pencatatan keuangan keluarga orisinal, bertema manis (*kawaii pastel*), dan dirancang khusus untuk berjalan super ringan pada server hemat daya seperti **Odroid C2 / STB HG680P (Amlogic S905X / RAM 1-2GB)** dengan lisensi terbuka **GNU GPL v3.0**.

Frontend PWA di-embed langsung ke dalam *single static binary* Go sehingga **tidak memerlukan NodeJS ataupun build tool di server STB Anda**.

---

## ✨ Fitur Unggulan

1. **Ultra-Lightweight & OOM-Resistant**:
   - Runtime binary Go murni (*CGO-free*), hanya menggunakan RAM **< 20MB**.
   - Dilengkapi *tuning systemd* (`OOMScoreAdjust=-500`) dan *Write-Ahead Logging (WAL)* SQLite.
2. **Offline-First & Auto-Recovery (PWA)**:
   - Jika server STB sedang bekerja keras atau dimatikan oleh OOM Killer, Anda tetap bisa mencatat transaksi di HP (tersimpan di IndexedDB).
   - Saat server online kembali, PWA otomatis menyinkronkan data dan memunculkan pop-up pemberitahuan pemulihan.
3. **Keamanan Maksimal & Terisolasi**:
   - Catatan pengeluaran dan pemasukan dienkripsi dengan **AES-256-GCM** menggunakan kunci rahasia per-perangkat.
   - Database tidak dapat dibaca oleh aplikasi lain di server.
4. **Desain Cute & Ikon Orisinal**:
   - Nuansa pastel aesthetic dengan maskot kucing lucu dan 100% ikon SVG orisinal tanpa unduh pihak ketiga.
   - Mode responsif otomatis: Tampilan mobile (bottom-bar) dan desktop (dashboard lebar).
5. **Pencadangan Berpasangan (Database + Kunci Enkripsi)**:
   - Terintegrasi dengan `rclone` / `rsync` untuk backup berkala ke Google Drive / Cloud Storage.
   - Menyimpan database dan file kunci enkripsi bersamaan untuk menjamin pemulihan data 100% saat install ulang server.
6. **Integrasi Mutasi Bank Indonesia**:
   - Fitur parser e-statement lokal (BCA, Mandiri, BRI, BNI) tanpa mengirim data ke pihak ketiga.
7. **Wizard TUI Interaktif**:
   - Instalasi berbasis teks grafis (TUI dengan `whiptail`/`dialog`), cek RAM bebas, pemilihan custom port, dan deteksi update otomatis.

---

## 🚀 Panduan Instalasi Cepat di Odroid C2 / STB HG680P

### 1. Unduh dan Jalankan Wizard TUI
Login ke terminal Odroid/STB Anda melalui SSH, lalu jalankan:

```bash
git clone https://github.com/faisalfa123/DompetMungil.git /tmp/dompetmungil
cd /tmp/dompetmungil
sudo bash install.sh
```

Wizard TUI akan otomatis:
1. Memeriksa sisa RAM dan spesifikasi prosesor Amlogic S905X.
2. Meminta port akses kustom (misal: `8080`).
3. Mendeteksi apakah `rclone` (Google Drive) aktif di server dan menawarkan backup otomatis.
4. Memasang `systemd` service dengan proteksi OOM Killer.

---

## 📱 Membuka dan Menginstal di HP (PWA)

1. Buka browser di HP Anda (Chrome untuk Android / Safari untuk iOS).
2. Kunjungi alamat server:
   ```text
   http://IP_ODROID_ANDA:PORT
   ```
3. Tekan menu browser lalu pilih **"Tambahkan ke Layar Utama" (Add to Home Screen)**.
4. Aplikasi akan terpasang layaknya aplikasi bawaan toko aplikasi dengan ikon maskot lucu!

---

## 🛠️ Perintah Berguna di Server STB

- **Mengecek Status Service:**
  ```bash
  systemctl status keuangan-keluarga
  ```
- **Melihat Log Transaksi & OOM Recovery:**
  ```bash
  journalctl -u keuangan-keluarga -f
  ```
- **Menjalankan Snapshot Manual ke Cloud:**
  ```bash
  sudo /usr/local/bin/keuangan-backup.sh
  ```
- **Restart Aplikasi:**
  ```bash
  sudo systemctl restart keuangan-keluarga
  ```

---

## ⚙️ Kode Debug & Error Reference

Untuk mempermudah proses debugging, aplikasi menyertakan kode error standar:
- `STATUS_OK_200`: Server beroperasi normal.
- `ERR_SERVER_OFFLINE_OOM_503`: Server STB sedang istirahat / OOM; client beralih ke mode IndexedDB lokal.
- `ERR_AUTH_REQUIRED_401`: Sesi token autentikasi tidak ditemukan.
- `ERR_INVALID_TX_400`: Format data transaksi atau nominal keliru.
- `ERR_ENDPOINT_NOT_FOUND_404`: Alamat API yang diminta tidak tersedia di server.

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah **GNU General Public License v3.0 (GPL-3.0)**. Anda bebas menggunakan, memodifikasi, dan mendistribusikannya kembali sesuai ketentuan lisensi GNU GPL.
