#!/bin/bash
# ==============================================================================
#  WIZARD INSTALASI TUI: CATATAN KEUANGAN KELUARGA (CUTE & ULTRA-LIGHT PWA)
#  Target Hardware: Odroid C2 / STB HG680P (Amlogic S905X / RAM 1-2GB)
#  Lisensi: GNU General Public License v3.0 (GPL-3.0)
# ==============================================================================

set -e

CURRENT_VERSION="V2.00.1 BETA"

# Warna ANSI untuk terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

APP_NAME="dompetmungil"
CONFIG_DIR="/etc/${APP_NAME}"
SYSTEMD_FILE="/etc/systemd/system/${APP_NAME}.service"
GITHUB_REPO="faisalfa123/DompetMungil"
GLOBAL_BIN="/usr/local/bin/${APP_NAME}"

# 1. Cek Hak Akses Root
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}[ERROR] Script instalasi ini wajib dijalankan sebagai root (sudo bash ...)!${NC}"
    exit 1
fi

# Pastikan stdin terhubung ke terminal fisik (/dev/tty) jika dijalankan via pipe (curl | bash)
if [ ! -t 0 ] && [ -e /dev/tty ]; then
    exec < /dev/tty
fi

# Pastikan git, curl, tar terpasang
ensure_packages() {
    local missing=()
    if ! command -v git >/dev/null 2>&1; then missing+=("git"); fi
    if ! command -v curl >/dev/null 2>&1; then missing+=("curl"); fi
    if ! command -v tar >/dev/null 2>&1; then missing+=("tar"); fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${YELLOW}Menginstal paket yang dibutuhkan: ${missing[*]}...${NC}"
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update -y && apt-get install -y "${missing[@]}"
        fi
    fi
}
ensure_packages

# Deteksi ketersediaan TUI engine (whiptail / dialog)
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
        $TUI_BIN --title "$title" --msgbox "$msg" 15 76 </dev/tty >/dev/tty
    else
        echo -e "\n${CYAN}=== $title ===${NC}"
        echo -e "$msg"
        echo -e "${YELLOW}Tekan Enter untuk melanjutkan...${NC}"
        read -r </dev/tty
    fi
}

show_yesno() {
    local title="$1"
    local msg="$2"
    if [ -n "$TUI_BIN" ]; then
        $TUI_BIN --title "$title" --yesno "$msg" 14 76 </dev/tty >/dev/tty
        return $?
    else
        echo -e "\n${CYAN}=== $title ===${NC}"
        echo -e "$msg"
        read -p "(y/n): " choice </dev/tty
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
        $TUI_BIN --title "$title" --inputbox "$prompt" 13 76 "$default_val" </dev/tty 3>&1 1>&2 2>&3
    else
        echo -e "\n${CYAN}$prompt [Default: $default_val]${NC}"
        read -r val </dev/tty
        echo "${val:-$default_val}"
    fi
}

clear
show_msg "🌸 Catatan Keuangan Keluarga 🌸" \
"Selamat datang di Wizard Instalasi Catatan Keuangan Keluarga (${CURRENT_VERSION})!\n\n\
Aplikasi PWA ultra-ringan & efisien khusus STB / Odroid C2 / Linux Server.\n\
Installer ini akan memandu Anda menentukan:\n\
- Folder Tempat Aplikasi Di-Install\n\
- Port Web Server\n\
- Integrasi Cloud Backup (Opsional)\n\n\
Seluruh akun Admin / Orang Tua langsung dibuat di Web saat pertama kali dibuka."

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

# 3. Tentukan Lokasi Folder Instalasi (Ditanyakan ke Pengguna)
DEFAULT_INSTALL_DIR="/opt/${APP_NAME}"
if [ -f "$CONFIG_DIR/config.env" ]; then
    # shellcheck disable=SC1091
    source "$CONFIG_DIR/config.env" 2>/dev/null || true
    if [ -n "$APP_DIR" ]; then
        DEFAULT_INSTALL_DIR="$APP_DIR"
    fi
fi

INSTALL_DIR=$(show_input "Folder Tempat Aplikasi Di-Install" \
"Tentukan path folder absolut tempat aplikasi DompetMungil akan dipasang di server Anda:" \
"$DEFAULT_INSTALL_DIR")

# Normalisasi path (hilangkan trailing slash)
INSTALL_DIR="${INSTALL_DIR%/}"
DATA_DIR="${INSTALL_DIR}/data"
BIN_PATH="${INSTALL_DIR}/${APP_NAME}"
VERSION_FILE="${INSTALL_DIR}/.version"

# 4. Deteksi Versi & Penanganan Versi di Bawah V2.00.1 BETA (Wajib Fresh Install)
INSTALLED_VERSION=""
if [ -f "$VERSION_FILE" ]; then
    INSTALLED_VERSION=$(cat "$VERSION_FILE" 2>/dev/null || echo "")
fi

LEGACY_DETECTED=0
if [ -z "$INSTALLED_VERSION" ]; then
    if [ -f "$CONFIG_DIR/config.env" ] || [ -d "/var/lib/${APP_NAME}" ] || [ -f "/usr/local/bin/${APP_NAME}" ] || systemctl list-unit-files "${APP_NAME}.service" >/dev/null 2>&1; then
        LEGACY_DETECTED=1
    fi
elif [ "$INSTALLED_VERSION" != "$CURRENT_VERSION" ]; then
    LEGACY_DETECTED=1
fi

IS_FRESH_INSTALL=1
SAVED_PORT="8080"
SAVED_ENABLE_BACKUP="no"
SAVED_RCLONE_REMOTE=""

# Jika versi sama persis sudah terpasang, aktifkan Mode Update (pertahankan konfigurasi)
if [ -n "$INSTALLED_VERSION" ] && [ "$INSTALLED_VERSION" = "$CURRENT_VERSION" ] && [ -f "$CONFIG_DIR/config.env" ]; then
    IS_FRESH_INSTALL=0
    # shellcheck disable=SC1091
    source "$CONFIG_DIR/config.env"
    SAVED_PORT="${PORT:-8080}"
    SAVED_ENABLE_BACKUP="${ENABLE_BACKUP:-no}"
    SAVED_RCLONE_REMOTE="${RCLONE_REMOTE:-}"
    show_msg "Deteksi Instalasi Aktif (${INSTALLED_VERSION})" \
    "Aplikasi terdeteksi sudah terpasang dengan versi ${INSTALLED_VERSION} di ${INSTALL_DIR}.\n\n\
Seluruh konfigurasi server sebelumnya otomatis digunakan:\n\
- Folder Install: ${INSTALL_DIR}\n\
- Port Server   : ${SAVED_PORT}\n\
- Cloud Backup  : ${SAVED_ENABLE_BACKUP} (${SAVED_RCLONE_REMOTE})\n\n\
Binary aplikasi akan diperbarui tanpa mengubah konfigurasi server."
elif [ "$LEGACY_DETECTED" -eq 1 ]; then
    show_msg "Pemberitahuan Wajib Install Ulang" \
    "Perhatian: Terdeteksi instalasi versi lama atau belum standar ${CURRENT_VERSION}.\n\n\
Untuk mencegah bentrok dependensi & struktur folder baru di ${INSTALL_DIR},\n\
sistem akan melakukan FRESH INSTALL (Instalasi Baru Bersih).\n\n\
Catatan: Jika ada database lama di /var/lib/${APP_NAME}, cadangan akan disalin aman."

    # Hentikan dan hapus service lama jika ada
    systemctl stop "$APP_NAME" 2>/dev/null || true
    killall -9 "$APP_NAME" 2>/dev/null || true

    # Salin database lama jika ada ke folder baru agar data keuangan tetap utuh
    if [ -f "/var/lib/${APP_NAME}/data.db" ] && [ ! -f "${DATA_DIR}/data.db" ]; then
        mkdir -p "${DATA_DIR}"
        cp -a /var/lib/${APP_NAME}/* "${DATA_DIR}/" 2>/dev/null || true
        echo -e "${GREEN}[INFO] Migrasi database & kunci rahasia dari /var/lib/${APP_NAME} ke ${DATA_DIR} berhasil disalin aman.${NC}"
    fi

    # Jika ada port lama, tawarkan sebagai default
    if [ -f "$CONFIG_DIR/config.env" ]; then
        # shellcheck disable=SC1091
        source "$CONFIG_DIR/config.env" 2>/dev/null || true
        SAVED_PORT="${PORT:-8080}"
        SAVED_ENABLE_BACKUP="${ENABLE_BACKUP:-no}"
        SAVED_RCLONE_REMOTE="${RCLONE_REMOTE:-}"
    fi
fi

# 5. Konfigurasi Port Web Server
PORT="$SAVED_PORT"
if [ "$IS_FRESH_INSTALL" -eq 1 ]; then
    PORT=$(show_input "Konfigurasi Port Web Server" "Tentukan nomor port untuk mengakses PWA di browser:" "$SAVED_PORT")
fi

# 6. Deteksi Backup & Pemulihan Cloud (rclone)
RCLONE_INSTALLED=0
RCLONE_REMOTES=""
if command -v rclone >/dev/null 2>&1; then
    RCLONE_INSTALLED=1
    RCLONE_REMOTES=$(rclone listremotes 2>/dev/null || echo "")
fi

ENABLE_BACKUP="$SAVED_ENABLE_BACKUP"
SELECTED_REMOTE="$SAVED_RCLONE_REMOTE"

if [ "$IS_FRESH_INSTALL" -eq 1 ] && [ -n "$RCLONE_REMOTES" ]; then
    if show_yesno "Integrasi Cloud Backup Otomatis" \
    "Terdeteksi rclone aktif di server Anda!\n\nRemote ditemukan:\n$RCLONE_REMOTES\n\
Apakah Anda ingin mengaktifkan pencadangan otomatis harian database & kunci enkripsi ke rclone?"; then
        ENABLE_BACKUP="yes"
        SELECTED_REMOTE=$(show_input "Pilih Remote rclone" "Ketik nama remote rclone (misal: gdrive:backup):" "$(echo "$RCLONE_REMOTES" | head -n1)")
    else
        ENABLE_BACKUP="no"
        SELECTED_REMOTE=""
    fi
fi

# 7. Menyiapkan Folder Instalasi dan Mengunduh / Menyinkronkan Source
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$CONFIG_DIR"
chmod 755 "$INSTALL_DIR"
chmod 700 "$DATA_DIR"
chmod 700 "$CONFIG_DIR"

# Simpan marker versi aktif
echo "${CURRENT_VERSION}" > "$VERSION_FILE"
chmod 644 "$VERSION_FILE"

# Cek apakah script ini dijalankan dari folder source lokal atau dari curl pipe
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/main.go" ] && [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
    echo -e "${CYAN}Menyinkronkan file aplikasi dari folder lokal ke ${INSTALL_DIR}...${NC}"
    cp -r "$SCRIPT_DIR/web" "$INSTALL_DIR/" 2>/dev/null || true
    if [ -d "$SCRIPT_DIR/pkg" ]; then cp -r "$SCRIPT_DIR/pkg" "$INSTALL_DIR/"; fi
    if [ -f "$SCRIPT_DIR/main.go" ]; then cp "$SCRIPT_DIR/main.go" "$INSTALL_DIR/"; fi
    if [ -f "$SCRIPT_DIR/go.mod" ]; then cp "$SCRIPT_DIR/go.mod" "$INSTALL_DIR/"; fi
    if [ -f "$SCRIPT_DIR/go.sum" ]; then cp "$SCRIPT_DIR/go.sum" "$INSTALL_DIR/"; fi
    if [ -d "$SCRIPT_DIR/bin" ]; then cp -r "$SCRIPT_DIR/bin" "$INSTALL_DIR/"; fi
    cp "$SCRIPT_DIR/install.sh" "$INSTALL_DIR/" 2>/dev/null || true
elif [ ! -f "$INSTALL_DIR/main.go" ]; then
    echo -e "${CYAN}Mengunduh source code Catatan Keuangan Keluarga dari GitHub (${GITHUB_REPO})...${NC}"
    TMP_CLONE="/tmp/dompetmungil_clone_$$"
    rm -rf "$TMP_CLONE"
    git clone --depth 1 "https://github.com/${GITHUB_REPO}.git" "$TMP_CLONE"
    cp -r "$TMP_CLONE/web" "$INSTALL_DIR/"
    cp -r "$TMP_CLONE/pkg" "$INSTALL_DIR/"
    cp "$TMP_CLONE/main.go" "$INSTALL_DIR/"
    cp "$TMP_CLONE/go.mod" "$INSTALL_DIR/"
    cp "$TMP_CLONE/go.sum" "$INSTALL_DIR/" 2>/dev/null || true
    if [ -d "$TMP_CLONE/bin" ]; then cp -r "$TMP_CLONE/bin" "$INSTALL_DIR/"; fi
    cp "$TMP_CLONE/install.sh" "$INSTALL_DIR/"
    rm -rf "$TMP_CLONE"
fi

# Simpan konfigurasi server
cat <<EOF > "$CONFIG_DIR/config.env"
PORT=${PORT}
APP_DIR=${INSTALL_DIR}
DATA_DIR=${DATA_DIR}
ENABLE_BACKUP=${ENABLE_BACKUP}
RCLONE_REMOTE=${SELECTED_REMOTE}
VERSION=${CURRENT_VERSION}
EOF
chmod 600 "$CONFIG_DIR/config.env"

# 8. Memasang Binary Aplikasi di $BIN_PATH
ARCH=$(uname -m)
BINARY_SRC=""
if [ -f "$INSTALL_DIR/bin/keuangan-server-linux-${ARCH}" ]; then
    BINARY_SRC="$INSTALL_DIR/bin/keuangan-server-linux-${ARCH}"
elif [ -f "$INSTALL_DIR/bin/server" ]; then
    BINARY_SRC="$INSTALL_DIR/bin/server"
elif [ -f "$INSTALL_DIR/dompetmungil" ]; then
    BINARY_SRC="$INSTALL_DIR/dompetmungil"
fi

# Hentikan service jika sedang berjalan
if systemctl is-active --quiet "$APP_NAME" 2>/dev/null; then
    echo -e "${YELLOW}Menghentikan service ${APP_NAME} untuk pembaruan binary...${NC}"
    systemctl stop "$APP_NAME" 2>/dev/null || true
fi
killall -9 "$APP_NAME" 2>/dev/null || true

if [ -n "$BINARY_SRC" ] && [ "$BINARY_SRC" != "$BIN_PATH" ]; then
    rm -f "$BIN_PATH" 2>/dev/null || true
    cp "$BINARY_SRC" "$BIN_PATH"
    chmod 755 "$BIN_PATH"
elif [ ! -f "$BIN_PATH" ] || [ "$IS_FRESH_INSTALL" -eq 1 ]; then
    if command -v go >/dev/null 2>&1; then
        echo -e "${YELLOW}Mengompilasi binary langsung dari source di ${INSTALL_DIR}...${NC}"
        rm -f "$BIN_PATH" 2>/dev/null || true
        (cd "$INSTALL_DIR" && go build -o "$BIN_PATH" main.go)
        chmod 755 "$BIN_PATH"
    elif [ -f "$BINARY_SRC" ]; then
        cp "$BINARY_SRC" "$BIN_PATH"
        chmod 755 "$BIN_PATH"
    else
        echo -e "${RED}[ERROR] Binary untuk $ARCH tidak ditemukan. Kompilasi butuh 'go' terpasang.${NC}"
        exit 1
    fi
fi

# Pasang symlink global di /usr/local/bin
ln -sf "$BIN_PATH" "$GLOBAL_BIN"

# 9. Skrip Backup & Recovery Berpasangan
cat << 'EOF' > /usr/local/bin/keuangan-backup.sh
#!/bin/bash
set -e
CONFIG_FILE="/etc/dompetmungil/config.env"
if [ ! -f "$CONFIG_FILE" ]; then exit 0; fi
source "$CONFIG_FILE"

if [ "$ENABLE_BACKUP" != "yes" ] || [ -z "$RCLONE_REMOTE" ]; then
    exit 0
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_TEMP="/tmp/keuangan_backup_${TIMESTAMP}"
mkdir -p "$BACKUP_TEMP"

cp "$DATA_DIR/data.db"* "$BACKUP_TEMP/" 2>/dev/null || true
cp "$DATA_DIR/secret.key" "$BACKUP_TEMP/" 2>/dev/null || true

tar -czf "/tmp/keuangan_snapshot_${TIMESTAMP}.tar.gz" -C "$BACKUP_TEMP" .
rm -rf "$BACKUP_TEMP"

rclone copy "/tmp/keuangan_snapshot_${TIMESTAMP}.tar.gz" "$RCLONE_REMOTE"
rm -f "/tmp/keuangan_snapshot_${TIMESTAMP}.tar.gz"
EOF
chmod 700 /usr/local/bin/keuangan-backup.sh

if [ "$ENABLE_BACKUP" = "yes" ]; then
    (crontab -l 2>/dev/null | grep -v "keuangan-backup.sh" ; echo "0 3 * * * /usr/local/bin/keuangan-backup.sh >/dev/null 2>&1") | crontab -
fi

# 10. Konfigurasi Systemd Service
cat <<EOF > "$SYSTEMD_FILE"
[Unit]
Description=Catatan Keuangan Keluarga (Cute & Ultra-Light PWA)
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$CONFIG_DIR/config.env
ExecStart=$BIN_PATH -port \${PORT} -data-dir \${DATA_DIR}
Restart=always
RestartSec=3s

# Perlindungan OOM Killer
OOMScoreAdjust=-500

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$APP_NAME"
systemctl restart "$APP_NAME"

LOCAL_IP=$(hostname -I | awk '{print $1}')

show_msg "Instalasi Berhasil! 🎉" \
"Aplikasi Catatan Keuangan Keluarga (${CURRENT_VERSION}) telah aktif!\n\n\
Folder Aplikasi : ${INSTALL_DIR}\n\
Database & Kunci: ${DATA_DIR}\n\
Port Server     : ${PORT}\n\
Cloud Backup    : ${ENABLE_BACKUP}\n\n\
Silakan buka browser di HP / Laptop Anda melalui URL:\n\
👉 http://${LOCAL_IP}:${PORT}\n\n\
Saat pertama kali dibuka, buat akun Admin / Orang Tua langsung di antarmuka web.\n\
Pengaturan Admin & Kategori dapat diubah kapan saja oleh Orang Tua di web."

echo -e "\n${GREEN}✔ Sukses! Kunjungi http://${LOCAL_IP}:${PORT} untuk membuka PWA.${NC}\n"
