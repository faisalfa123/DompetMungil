#!/bin/bash
# ==============================================================================
#  INSTALLER MODERN: CATATAN KEUANGAN KELUARGA (CUTE & ULTRA-LIGHT PWA)
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
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
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

# Tentukan sumber input terminal (jika via pipe, alihkan ke /dev/tty)
TTY_IN="/dev/stdin"
if [ ! -t 0 ] && [ -e /dev/tty ]; then
    TTY_IN="/dev/tty"
fi

# Fungsi helper UI estetik modern
box_header() {
    local title="$1"
    echo -e "\n${PURPLE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    printf "${PURPLE}║${WHITE}${BOLD} %-76s ${PURPLE}║${NC}\n" "$title"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
}

prompt_input() {
    local prompt_text="$1"
    local default_value="$2"
    local user_val=""

    echo -e "\n${CYAN}▶ ${prompt_text}${NC}" >&2
    echo -ne "${YELLOW}  [Tekan Enter untuk default: ${WHITE}${BOLD}${default_value}${YELLOW}]: ${NC}" >&2
    read -r user_val < "$TTY_IN" || user_val=""
    if [ -z "$user_val" ]; then
        echo "$default_value"
    else
        echo "$user_val"
    fi
}

prompt_yesno() {
    local prompt_text="$1"
    local default_choice="$2" # y or n
    local choice=""

    echo -e "\n${CYAN}▶ ${prompt_text}${NC}" >&2
    if [ "$default_choice" = "y" ]; then
        echo -ne "${YELLOW}  (Y/n) [Default: Ya]: ${NC}" >&2
    else
        echo -ne "${YELLOW}  (y/N) [Default: Tidak]: ${NC}" >&2
    fi
    read -r choice < "$TTY_IN" || choice=""
    choice=$(echo "$choice" | tr '[:upper:]' '[:lower:]')
    if [ -z "$choice" ]; then
        choice="$default_choice"
    fi
    if [ "$choice" = "y" ] || [ "$choice" = "yes" ]; then
        return 0
    else
        return 1
    fi
}

clear
box_header "🌸 CATATAN KEUANGAN KELUARGA (${CURRENT_VERSION}) 🌸"
echo -e "${WHITE}Aplikasi Catatan Keuangan PWA Ultra-Ringan (RAM < 20MB) & AES-256 Encrypted.${NC}"
echo -e "${WHITE}Dioptimalkan khusus untuk STB HG680P / Odroid C2 / Linux Server.${NC}"

# 2. Periksa Spesifikasi Hardware & RAM Bebas
TOTAL_RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo "1024")
AVAIL_RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}' || echo "512")
CPU_MODEL=$(lscpu 2>/dev/null | grep "Model name" | cut -d: -f2 | xargs || uname -m)

echo -e "\n${BOLD}Spesifikasi Server Terdeteksi:${NC}"
echo -e "  • CPU          : ${CYAN}${CPU_MODEL}${NC}"
echo -e "  • Total RAM    : ${CYAN}${TOTAL_RAM_MB} MB${NC}"
echo -e "  • RAM Tersedia : ${CYAN}${AVAIL_RAM_MB} MB${NC}"

if [ "$AVAIL_RAM_MB" -lt 50 ]; then
    echo -e "  • Status RAM   : ${RED}Rendah (< 50MB) - Mode ultra-hemat cache 2MB aktif.${NC}"
else
    echo -e "  • Status RAM   : ${GREEN}Normal & Memadai.${NC}"
fi

# Fungsi aman membaca nilai key dari file env tanpa menjalankan eval/source
get_env_val() {
    local file="$1"
    local key="$2"
    if [ -f "$file" ]; then
        grep -E "^${key}=" "$file" 2>/dev/null | head -n1 | cut -d'=' -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^['\"]//" -e "s/['\"]$//" || echo ""
    fi
}

# 3. Tentukan Lokasi Folder Instalasi
DEFAULT_INSTALL_DIR="/opt/${APP_NAME}"
if [ -f "$CONFIG_DIR/config.env" ]; then
    LOADED_APP_DIR=$(get_env_val "$CONFIG_DIR/config.env" "APP_DIR")
    # Hanya gunakan jika path valid (dimulai dengan '/')
    if [[ "$LOADED_APP_DIR" == /* ]]; then
        DEFAULT_INSTALL_DIR="$LOADED_APP_DIR"
    fi
fi

INSTALL_DIR=$(prompt_input "Tentukan folder tempat aplikasi dipasang" "$DEFAULT_INSTALL_DIR")
INSTALL_DIR="${INSTALL_DIR%/}"
DATA_DIR="${INSTALL_DIR}/data"
BIN_PATH="${INSTALL_DIR}/${APP_NAME}"
VERSION_FILE="${INSTALL_DIR}/.version"

# 4. Deteksi Versi & Penanganan Versi di Bawah V2.00.1 BETA (Wajib Fresh Install)
INSTALLED_VERSION=""
if [ -f "$VERSION_FILE" ]; then
    INSTALLED_VERSION=$(cat "$VERSION_FILE" 2>/dev/null | tr -d '\r\n' || echo "")
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
SAVED_PORT="1234"
SAVED_ENABLE_BACKUP="no"
SAVED_RCLONE_REMOTE=""

if [ -n "$INSTALLED_VERSION" ] && [ "$INSTALLED_VERSION" = "$CURRENT_VERSION" ] && [ -f "$CONFIG_DIR/config.env" ]; then
    IS_FRESH_INSTALL=0
    LOADED_PORT=$(get_env_val "$CONFIG_DIR/config.env" "PORT")
    LOADED_BACKUP=$(get_env_val "$CONFIG_DIR/config.env" "ENABLE_BACKUP")
    LOADED_REMOTE=$(get_env_val "$CONFIG_DIR/config.env" "RCLONE_REMOTE")
    if [ -n "$LOADED_PORT" ]; then SAVED_PORT="$LOADED_PORT"; fi
    if [ -n "$LOADED_BACKUP" ]; then SAVED_ENABLE_BACKUP="$LOADED_BACKUP"; fi
    if [ -n "$LOADED_REMOTE" ]; then SAVED_RCLONE_REMOTE="$LOADED_REMOTE"; fi
    echo -e "\n${GREEN}✔ Terdeteksi instalasi aktif ${INSTALLED_VERSION}. Menggunakan konfigurasi yang ada.${NC}"
elif [ "$LEGACY_DETECTED" -eq 1 ]; then
    echo -e "\n${YELLOW}⚠ Terdeteksi versi lama. Melakukan FRESH INSTALL bersih di ${INSTALL_DIR} untuk mencegah bentrok.${NC}"
    systemctl stop "$APP_NAME" 2>/dev/null || true
    killall -9 "$APP_NAME" 2>/dev/null || true

    # Salin database lama jika ada
    if [ -f "/var/lib/${APP_NAME}/data.db" ] && [ ! -f "${DATA_DIR}/data.db" ]; then
        mkdir -p "${DATA_DIR}"
        cp -a /var/lib/${APP_NAME}/* "${DATA_DIR}/" 2>/dev/null || true
        echo -e "${GREEN}✔ Salinan database lama dari /var/lib/${APP_NAME} berhasil dimigrasikan ke ${DATA_DIR}.${NC}"
    fi

    if [ -f "$CONFIG_DIR/config.env" ]; then
        LOADED_PORT=$(get_env_val "$CONFIG_DIR/config.env" "PORT")
        LOADED_BACKUP=$(get_env_val "$CONFIG_DIR/config.env" "ENABLE_BACKUP")
        LOADED_REMOTE=$(get_env_val "$CONFIG_DIR/config.env" "RCLONE_REMOTE")
        if [ -n "$LOADED_PORT" ]; then SAVED_PORT="$LOADED_PORT"; fi
        if [ -n "$LOADED_BACKUP" ]; then SAVED_ENABLE_BACKUP="$LOADED_BACKUP"; fi
        if [ -n "$LOADED_REMOTE" ]; then SAVED_RCLONE_REMOTE="$LOADED_REMOTE"; fi
    fi
fi

# 5. Konfigurasi Port Web Server
PORT="$SAVED_PORT"
if [ "$IS_FRESH_INSTALL" -eq 1 ]; then
    PORT=$(prompt_input "Tentukan port web server PWA" "$SAVED_PORT")
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
    echo -e "\n${GREEN}✔ Terdeteksi rclone aktif: $(echo "$RCLONE_REMOTES" | tr '\n' ' ')${NC}"
    if prompt_yesno "Aktifkan pencadangan harian otomatis database & kunci ke cloud via rclone?" "y"; then
        ENABLE_BACKUP="yes"
        SELECTED_REMOTE=$(prompt_input "Ketik nama remote rclone tempat backup disimpan" "$(echo "$RCLONE_REMOTES" | head -n1)")
    else
        ENABLE_BACKUP="no"
        SELECTED_REMOTE=""
    fi
fi

# 7. Menyiapkan Folder Instalasi
box_header "MEMASANG APLIKASI DI ${INSTALL_DIR}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$CONFIG_DIR"
chmod 755 "$INSTALL_DIR"
chmod 700 "$DATA_DIR"
chmod 700 "$CONFIG_DIR"

echo "${CURRENT_VERSION}" > "$VERSION_FILE"
chmod 644 "$VERSION_FILE"

# Cek apakah dijalankan dari folder lokal atau curl pipe
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

cat <<EOF > "$CONFIG_DIR/config.env"
PORT=${PORT}
APP_DIR=${INSTALL_DIR}
DATA_DIR=${DATA_DIR}
ENABLE_BACKUP=${ENABLE_BACKUP}
RCLONE_REMOTE=${SELECTED_REMOTE}
VERSION=${CURRENT_VERSION}
EOF
chmod 600 "$CONFIG_DIR/config.env"

# 8. Memasang Binary Siap Pakai dari GitHub Releases (Anti-Hang di STB)
ARCH=$(uname -m)
ASSET_NAME=""
case "$ARCH" in
    aarch64|arm64)
        ASSET_NAME="keuangan-server-linux-aarch64"
        ;;
    armv7*|armhf)
        ASSET_NAME="keuangan-server-linux-armv7l"
        ;;
    x86_64|amd64)
        ASSET_NAME="keuangan-server-linux-x86_64"
        ;;
    *)
        ASSET_NAME="keuangan-server-linux-aarch64"
        ;;
esac

if systemctl is-active --quiet "$APP_NAME" 2>/dev/null; then
    echo -e "${YELLOW}Menghentikan sementara service ${APP_NAME} untuk pembaruan binary...${NC}"
    systemctl stop "$APP_NAME" 2>/dev/null || true
fi
killall -9 "$APP_NAME" 2>/dev/null || true

echo -e "${CYAN}Mengunduh binary siap pakai (${ASSET_NAME}) dari GitHub Actions Release...${NC}"
BINARY_DOWNLOADED=0
RELEASE_URL="https://github.com/${GITHUB_REPO}/releases/download/latest/${ASSET_NAME}"

# Gunakan --progress-bar agar pengguna melihat kecepatan/persentase unduhan secara realtime
if curl -fL --progress-bar --connect-timeout 15 --retry 3 --retry-delay 2 "$RELEASE_URL" -o "${BIN_PATH}.tmp"; then
    mv "${BIN_PATH}.tmp" "$BIN_PATH"
    chmod 755 "$BIN_PATH"
    BINARY_DOWNLOADED=1
    echo -e "${GREEN}✔ Berhasil mengunduh binary ${ASSET_NAME} siap pakai dari GitHub!${NC}"
fi

if [ "$BINARY_DOWNLOADED" -eq 0 ]; then
    if [ -f "$INSTALL_DIR/bin/${ASSET_NAME}" ]; then
        cp "$INSTALL_DIR/bin/${ASSET_NAME}" "$BIN_PATH"
        chmod 755 "$BIN_PATH"
        BINARY_DOWNLOADED=1
    elif [ -f "$INSTALL_DIR/dompetmungil" ]; then
        cp "$INSTALL_DIR/dompetmungil" "$BIN_PATH"
        chmod 755 "$BIN_PATH"
        BINARY_DOWNLOADED=1
    fi
fi

if [ "$BINARY_DOWNLOADED" -eq 0 ]; then
    echo -e "${RED}[ERROR] Gagal mengunduh binary ${ASSET_NAME} dari GitHub Releases.${NC}"
    echo -e "${YELLOW}Pastikan Odroid C2 / STB Anda terhubung ke internet untuk mengunduh release siap pakai.${NC}"
    exit 1
fi

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
OOMScoreAdjust=-500

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$APP_NAME"
systemctl restart "$APP_NAME"

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

box_header "INSTALASI BERHASIL! 🎉"
echo -e "${GREEN}✔ Service ${APP_NAME} aktif dan berjalan otomatis.${NC}"
echo -e "  • Folder Aplikasi : ${CYAN}${INSTALL_DIR}${NC}"
echo -e "  • Database & Kunci: ${CYAN}${DATA_DIR}${NC}"
echo -e "  • Port Server     : ${CYAN}${PORT}${NC}"
echo -e "  • Cloud Backup    : ${CYAN}${ENABLE_BACKUP}${NC}"
echo -e "\n${BOLD}${WHITE}Buka browser di HP / Laptop Anda melalui URL:${NC}"
echo -e "👉 ${YELLOW}${BOLD}http://${LOCAL_IP}:${PORT}${NC}\n"
echo -e "${WHITE}Catatan: Akun Admin / Orang Tua langsung dibuat di Web saat pertama kali dibuka.${NC}\n"
