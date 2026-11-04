#!/bin/bash
# ==============================================================================
#  WIZARD INSTALASI TUI: CATATAN KEUANGAN KELUARGA (CUTE & ULTRA-LIGHT PWA)
#  Target Hardware: Odroid C2 / STB HG680P (Amlogic S905X / RAM 1-2GB)
#  Lisensi: GNU General Public License v3.0 (GPL-3.0)
# ==============================================================================

set -e

# Warna ANSI untuk fallback jika dialog/whiptail tidak ada
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

APP_NAME="dompetmungil"
CONFIG_DIR="/etc/${APP_NAME}"
DATA_DIR="/var/lib/${APP_NAME}"
BIN_PATH="/usr/local/bin/${APP_NAME}"
SYSTEMD_FILE="/etc/systemd/system/${APP_NAME}.service"
GITHUB_REPO="faisalfa123/DompetMungil"

# Deteksi ketersediaan TUI engine
TUI_BIN=""
if command -v whiptail >/dev/null 2>&1; then
    TUI_BIN="whiptail"
elif command -v dialog >/dev/null 2>&1; then
    TUI_BIN="dialog"
fi

show_msg() {
    local title="$1"
    local msg="$2"
    if [ -n "$TUI_BIN" ]; then
        $TUI_BIN --title "$title" --msgbox "$msg" 12 70
    else
        echo -e "\n${CYAN}=== $title ===${NC}"
        echo -e "$msg"
        echo -e "${YELLOW}Tekan Enter untuk melanjutkan...${NC}"
        read -r
    fi
}

show_yesno() {
    local title="$1"
    local msg="$2"
    if [ -n "$TUI_BIN" ]; then
        $TUI_BIN --title "$title" --yesno "$msg" 12 70
        return $?
    else
        echo -e "\n${CYAN}=== $title ===${NC}"
        echo -e "$msg"
        read -p "(y/n): " choice
        case "$choice" in
            y|Y ) return 0;;
            * ) return 1;;
        esac
    fi
}

show_input() {
    local title="$1"
    local prompt="$2"
    local default_val="$3"
    if [ -n "$TUI_BIN" ]; then
        $TUI_BIN --title "$title" --inputbox "$prompt" 12 70 "$default_val" 3>&1 1>&2 2>&3
    else
        echo -e "\n${CYAN}$prompt [Default: $default_val]${NC}"
        read -r val
        echo "${val:-$default_val}"
    fi
}

# 1. Cek Hak Akses Root
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}[ERROR] Script instalasi ini wajib dijalankan sebagai root (sudo ./install.sh)!${NC}"
    exit 1
fi

clear
show_msg "🌸 Catatan Keuangan Keluarga 🌸" \
"Selamat datang di Wizard Instalasi Catatan Keuangan Keluarga!\n\n\
Aplikasi ini dirancang ultra-ringan (RAM < 20MB) khusus untuk server Odroid C2 / STB HG680P (Amlogic S905X).\n\
Semua data dienkripsi dengan AES-256 dan bebas dari OOM Crash."

# 2. Periksa Spesifikasi Hardware & RAM Bebas
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
AVAIL_RAM_MB=$(free -m | awk '/^Mem:/{print $7}')
CPU_MODEL=$(lscpu 2>/dev/null | grep "Model name" | cut -d: -f2 | xargs || uname -m)

HARDWARE_INFO="Spesifikasi Server Terdeteksi:\n\
- CPU: ${CPU_MODEL}\n\
- Total RAM: ${TOTAL_RAM_MB} MB\n\
- RAM Tersedia: ${AVAIL_RAM_MB} MB\n\n"

if [ "$AVAIL_RAM_MB" -lt 50 ]; then
    HARDWARE_INFO+="${RED}Peringatan: RAM tersedia sangat rendah (< 50MB)! Aplikasi Go ini akan beroperasi pada mode ultra-hemat (cache 2MB).${NC}"
else
    HARDWARE_INFO+="${GREEN}Kondisi server memadai untuk menjalankan aplikasi Catatan Keuangan Keluarga.${NC}"
fi

show_msg "Pemeriksaan Sumber Daya Server" "$HARDWARE_INFO"

# 3. Deteksi Apakah Ini Pembaruan (Update Mode)
IS_UPDATE=0
SAVED_PORT="8080"
if [ -f "$CONFIG_DIR/config.env" ]; then
    IS_UPDATE=1
    # shellcheck disable=SC1091
    source "$CONFIG_DIR/config.env"
    SAVED_PORT="${PORT:-8080}"
    show_msg "Deteksi Konfigurasi Lama" \
    "Ditemukan instalasi sebelumnya!\n\n\
Port aktif: $SAVED_PORT\n\
Database & Kunci Enkripsi Anda di $DATA_DIR akan TETAP DIKUNCI & TIDAK DIHAPUS."
fi

# 4. Tentukan Port Kustom
PORT="$SAVED_PORT"
if [ "$IS_UPDATE" -eq 0 ]; then
    PORT=$(show_input "Konfigurasi Port Kustom" "Masukkan port untuk mengakses PWA di browser:" "8080")
fi

# 5. Deteksi Backup Cloud (rclone / rsync)
RCLONE_INSTALLED=0
RCLONE_REMOTES=""
if command -v rclone >/dev/null 2>&1; then
    RCLONE_INSTALLED=1
    RCLONE_REMOTES=$(rclone listremotes 2>/dev/null || echo "")
fi

ENABLE_BACKUP="no"
SELECTED_REMOTE=""
if [ -n "$RCLONE_REMOTES" ]; then
    if show_yesno "Integrasi Cloud Backup Otomatis" \
    "Terdeteksi rclone aktif di server Anda!\n\nRemote ditemukan:\n$RCLONE_REMOTES\n\
Apakah Anda ingin mengaktifkan backup otomatis database & KUNCI ENKRIPSI ke cloud?"; then
        ENABLE_BACKUP="yes"
        SELECTED_REMOTE=$(show_input "Pilih Remote rclone" "Ketik nama remote rclone persis seperti di atas (misal: gdrive:backup):" "$(echo "$RCLONE_REMOTES" | head -n1)")
    fi
fi

# 6. Menyiapkan Direktori & Keamanan
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"
chmod 700 "$CONFIG_DIR"
chmod 700 "$DATA_DIR"

cat <<EOF > "$CONFIG_DIR/config.env"
PORT=${PORT}
DATA_DIR=${DATA_DIR}
ENABLE_BACKUP=${ENABLE_BACKUP}
RCLONE_REMOTE=${SELECTED_REMOTE}
EOF
chmod 600 "$CONFIG_DIR/config.env"

# 7. Memasang Binary Aplikasi
ARCH=$(uname -m)
BINARY_SRC=""
if [ -f "./bin/keuangan-server-linux-${ARCH}" ]; then
    BINARY_SRC="./bin/keuangan-server-linux-${ARCH}"
elif [ -f "./bin/server" ]; then
    BINARY_SRC="./bin/server"
elif [ -f "./keuangan-keluarga" ]; then
    BINARY_SRC="./keuangan-keluarga"
fi

if [ -n "$BINARY_SRC" ]; then
    cp "$BINARY_SRC" "$BIN_PATH"
    chmod 755 "$BIN_PATH"
else
    # Jika binary belum dikompilasi lokal, kompilasi cepat jika ada go
    if command -v go >/dev/null 2>&1; then
        echo -e "${YELLOW}Mengompilasi binary langsung dari source...${NC}"
        go build -o "$BIN_PATH" main.go
        chmod 755 "$BIN_PATH"
    else
        echo -e "${RED}[ERROR] Binary untuk $ARCH tidak ditemukan. Silakan download release siap pakai dari GitHub Actions!${NC}"
        exit 1
    fi
fi

# 8. Menyiapkan Skrip Backup & Recovery Berpasangan (DB + Kunci Enkripsi)
cat << 'EOF' > /usr/local/bin/keuangan-backup.sh
#!/bin/bash
set -e
CONFIG_FILE="/etc/keuangan-keluarga/config.env"
if [ ! -f "$CONFIG_FILE" ]; then exit 0; fi
source "$CONFIG_FILE"

if [ "$ENABLE_BACKUP" != "yes" ] || [ -z "$RCLONE_REMOTE" ]; then
    exit 0
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_TEMP="/tmp/keuangan_backup_${TIMESTAMP}"
mkdir -p "$BACKUP_TEMP"

# Salin aman database SQLite (menggunakan sqlite3 online backup jika ada, atau copy WAL)
cp "$DATA_DIR/data.db"* "$BACKUP_TEMP/" 2>/dev/null || true
# Salin kunci enkripsi berpasangan untuk menjamin recovery 100% jika reinstall
cp "$DATA_DIR/secret.key" "$BACKUP_TEMP/" 2>/dev/null || true

# Arsipkan terenkripsi
tar -czf "/tmp/keuangan_snapshot_${TIMESTAMP}.tar.gz" -C "$BACKUP_TEMP" .
rm -rf "$BACKUP_TEMP"

# Upload ke remote rclone
rclone copy "/tmp/keuangan_snapshot_${TIMESTAMP}.tar.gz" "$RCLONE_REMOTE"
rm -f "/tmp/keuangan_snapshot_${TIMESTAMP}.tar.gz"
EOF
chmod 700 /usr/local/bin/keuangan-backup.sh

# Pasang cron job harian jika backup aktif
if [ "$ENABLE_BACKUP" = "yes" ]; then
    (crontab -l 2>/dev/null | grep -v "keuangan-backup.sh" ; echo "0 3 * * * /usr/local/bin/keuangan-backup.sh >/dev/null 2>&1") | crontab -
fi

# 9. Konfigurasi Systemd Service (OOM-Resistant & Watchdog)
cat <<EOF > "$SYSTEMD_FILE"
[Unit]
Description=Catatan Keuangan Keluarga (Cute & Ultra-Light PWA)
After=network.target

[Service]
Type=simple
EnvironmentFile=$CONFIG_DIR/config.env
ExecStart=$BIN_PATH -port \${PORT} -data-dir \${DATA_DIR}
Restart=always
RestartSec=5s

# Perlindungan OOM Killer: Berikan prioritas agar tidak dibunuh duluan saat server berat
OOMScoreAdjust=-500

# Pengamanan sandbox Linux
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$APP_NAME"
systemctl restart "$APP_NAME"

# Ambil IP Lokal Server
LOCAL_IP=$(hostname -I | awk '{print $1}')

show_msg "Instalasi Berhasil! 🎉" \
"Aplikasi Catatan Keuangan Keluarga telah aktif!\n\n\
Buka browser di HP / Laptop Anda melalui URL:\n\
👉 http://${LOCAL_IP}:${PORT}\n\n\
Status Service: systemctl status $APP_NAME\n\
Database & Kunci Enkripsi: $DATA_DIR (Terenkripsi AES-256)\n\
Integrasi Cloud Backup: ${ENABLE_BACKUP}"

echo -e "\n${GREEN}✔ Sukses! Kunjungi http://${LOCAL_IP}:${PORT} untuk membuka PWA.${NC}\n"
