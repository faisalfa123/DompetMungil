package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/faisalfa123/DompetMungil/pkg/crypto"
	_ "modernc.org/sqlite"
)

type Database struct {
	conn *sql.DB
	key  []byte
	mu   sync.RWMutex
}

// InitDB membuka koneksi SQLite dengan mode WAL (Write-Ahead Logging) hemat memori & OOM-resistant
func InitDB(dbPath string, key []byte) (*Database, error) {
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0700); err != nil {
			return nil, err
		}
	}

	// SQLite connection string dengan tuning ketat untuk ARM/RAM terbatas:
	// - WAL mode: transaksi tidak memblokir pembacaan
	// - synchronous=NORMAL: performa tinggi dengan integritas WAL terjaga saat mati mendadak
	// - cache_size=-2000 (sekitar 2MB RAM cache)
	// - busy_timeout=5000: toleransi lock hingga 5 detik
	dsn := fmt.Sprintf("file:%s?_journal_mode=WAL&_synchronous=NORMAL&_busy_timeout=5000&_cache_size=-2000", dbPath)
	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	// Batasi pool koneksi agar RAM Odroid C2 tetap sangat rendah (< 15MB)
	conn.SetMaxOpenConns(5)
	conn.SetMaxIdleConns(2)
	conn.SetConnMaxLifetime(10 * time.Minute)

	db := &Database{
		conn: conn,
		key:  key,
	}

	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, err
	}

	return db, nil
}

func (d *Database) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		account_mode TEXT NOT NULL DEFAULT 'personal', -- 'personal' atau 'family'
		role TEXT NOT NULL DEFAULT 'member', -- 'suami', 'istri', 'anak', atau 'personal'
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS salary_schedules (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		payday_date INTEGER NOT NULL, -- Tanggal gajian (misal 25)
		amount REAL NOT NULL,
		note_enc TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS accounts (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		balance REAL DEFAULT 0,
		icon TEXT,
		color TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS categories (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		type TEXT NOT NULL, -- 'income' atau 'expense'
		icon TEXT,
		color TEXT
	);

	CREATE TABLE IF NOT EXISTS transactions (
		id TEXT PRIMARY KEY,
		client_tx_id TEXT UNIQUE, -- id dari IndexedDB client untuk deduplikasi offline sync
		account_id TEXT NOT NULL,
		category_id TEXT NOT NULL,
		type TEXT NOT NULL, -- 'income', 'expense', 'transfer'
		amount REAL NOT NULL,
		date TEXT NOT NULL,
		note_enc TEXT, -- catatan terenkripsi AES-256
		user_id TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (account_id) REFERENCES accounts(id),
		FOREIGN KEY (category_id) REFERENCES categories(id)
	);

	CREATE TABLE IF NOT EXISTS budgets (
		id TEXT PRIMARY KEY,
		category_id TEXT NOT NULL,
		amount REAL NOT NULL,
		period TEXT NOT NULL, -- 'monthly', 'weekly'
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (category_id) REFERENCES categories(id)
	);

	CREATE TABLE IF NOT EXISTS bank_import_rules (
		id TEXT PRIMARY KEY,
		bank_name TEXT NOT NULL,
		pattern_enc TEXT NOT NULL, -- pola mutasi terenkripsi
		category_id TEXT,
		auto_approve INTEGER DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS system_recovery_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		event TEXT NOT NULL,
		client_id TEXT,
		details TEXT,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := d.conn.Exec(schema)
	if err != nil {
		return err
	}

	// Migrasi adaptif: Tambahkan kolom baru ke tabel users jika tabel sudah dibuat dari versi lama
	_, _ = d.conn.Exec("ALTER TABLE users ADD COLUMN account_mode TEXT NOT NULL DEFAULT 'personal'")
	_, _ = d.conn.Exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'")

	// Masukkan kategori default jika belum ada
	var count int
	_ = d.conn.QueryRow("SELECT COUNT(*) FROM categories").Scan(&count)
	if count == 0 {
		defaultCats := `
		INSERT INTO categories (id, name, type, icon, color) VALUES
		('cat_makan', 'Makanan & Minuman', 'expense', 'cute-cat-food', '#FFB7B2'),
		('cat_belanja', 'Belanja Harian', 'expense', 'cute-shopping-basket', '#B5EAD7'),
		('cat_tagihan', 'Listrik & Air & Wifi', 'expense', 'cute-bill-light', '#E2F0CB'),
		('cat_pendidikan', 'Pendidikan Anak', 'expense', 'cute-book-pencil', '#C7CEEA'),
		('cat_hiburan', 'Jalan-jalan & Liburan', 'expense', 'cute-ticket-star', '#FFDAC1'),
		('cat_kesehatan', 'Kesehatan & Obat', 'expense', 'cute-heart-pill', '#FF9AA2'),
		('cat_gaji', 'Gaji Bulanan', 'income', 'cute-money-bag', '#A0E7E5'),
		('cat_bonus', 'Bonus & Hadiah', 'income', 'cute-gift-ribbon', '#B4F8C8'),
		('cat_invest', 'Hasil Investasi', 'income', 'cute-plant-growth', '#FBE7C6');
		`
		_, _ = d.conn.Exec(defaultCats)
	}

	// Masukkan akun dompet default jika belum ada
	var accCount int
	_ = d.conn.QueryRow("SELECT COUNT(*) FROM accounts").Scan(&accCount)
	if accCount == 0 {
		defaultAccs := `
		INSERT INTO accounts (id, name, type, balance, icon, color) VALUES
		('acc_dompet', 'Dompet Tunai', 'cash', 0, 'cute-wallet', '#FFB7B2'),
		('acc_bank', 'Rekening Bank', 'bank', 0, 'cute-bank-vault', '#B5EAD7'),
		('acc_ewallet', 'E-Wallet', 'ewallet', 0, 'cute-phone-pay', '#C7CEEA');
		`
		_, _ = d.conn.Exec(defaultAccs)
	}

	return nil
}

func (d *Database) Close() error {
	return d.conn.Close()
}

func (d *Database) GetConn() *sql.DB {
	return d.conn
}

func (d *Database) GetKey() []byte {
	return d.key
}

// EncryptNote mengenkripsi catatan transaksi menggunakan kunci database
func (d *Database) EncryptNote(plainNote string) (string, error) {
	if plainNote == "" {
		return "", nil
	}
	return crypto.EncryptText(plainNote, d.key)
}

// DecryptNote mendekripsi catatan transaksi
func (d *Database) DecryptNote(cipherNote string) string {
	if cipherNote == "" {
		return ""
	}
	dec, err := crypto.DecryptText(cipherNote, d.key)
	if err != nil {
		return "[Data Terkunci/Kunci Berbeda]"
	}
	return dec
}
