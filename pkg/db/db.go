package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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

	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		username TEXT NOT NULL,
		account_mode TEXT NOT NULL,
		role TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS savings_goals (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		icon TEXT NOT NULL DEFAULT 'sprout',
		target_amount REAL NOT NULL,
		current_amount REAL NOT NULL DEFAULT 0,
		color TEXT NOT NULL DEFAULT '#2F6F4E',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS recurring_bills (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		amount REAL NOT NULL,
		category_id TEXT NOT NULL,
		account_id TEXT NOT NULL,
		due_day INTEGER NOT NULL DEFAULT 1,
		type TEXT NOT NULL DEFAULT 'expense',
		last_paid_month TEXT NOT NULL DEFAULT '',
		active INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS category_rules (
		id TEXT PRIMARY KEY,
		keyword TEXT NOT NULL,
		category_id TEXT NOT NULL,
		tx_type TEXT NOT NULL DEFAULT 'any',
		priority INTEGER NOT NULL DEFAULT 10,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS app_settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`
	_, err := d.conn.Exec(schema)
	if err != nil {
		return err
	}

	// Migrasi adaptif: Tambahkan kolom baru ke tabel users & transactions jika tabel sudah dibuat dari versi lama
	_, _ = d.conn.Exec("ALTER TABLE users ADD COLUMN account_mode TEXT NOT NULL DEFAULT 'personal'")
	_, _ = d.conn.Exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'")
	_, _ = d.conn.Exec("ALTER TABLE transactions ADD COLUMN user_id TEXT")
	_, _ = d.conn.Exec("ALTER TABLE transactions ADD COLUMN transfer_to_account_id TEXT DEFAULT ''")

	// Indeks performa untuk query riwayat transaksi, filter kategori, dan multi-user
	_, _ = d.conn.Exec("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC, created_at DESC)")
	_, _ = d.conn.Exec("CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id)")
	_, _ = d.conn.Exec("CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)")

	// Masukkan kategori default jika belum ada
	var count int
	_ = d.conn.QueryRow("SELECT COUNT(*) FROM categories").Scan(&count)
	if count == 0 {
		defaultCats := `
		INSERT INTO categories (id, name, type, icon, color) VALUES
		('cat_makan', 'Makanan & Minuman', 'expense', 'utensils', '#C85A3F'),
		('cat_belanja', 'Belanja Harian', 'expense', 'basket', '#2F6F4E'),
		('cat_tagihan', 'Listrik, Air & Internet', 'expense', 'bolt', '#8F5B14'),
		('cat_pendidikan', 'Pendidikan Anak', 'expense', 'book', '#3A5F8A'),
		('cat_hiburan', 'Jalan-jalan & Hiburan', 'expense', 'compass', '#9A4C72'),
		('cat_kesehatan', 'Kesehatan & Obat', 'expense', 'heart', '#B53D4B'),
		('cat_kendaraan', 'Bensin & Transportasi', 'expense', 'bike', '#B45D24'),
		('cat_tarik_tunai', 'Tarik Tunai ATM', 'expense', 'banknote', '#2A6F68'),
		('cat_gaji', 'Gaji Bulanan', 'income', 'wallet', '#2A7A50'),
		('cat_bonus', 'Bonus & Hadiah', 'income', 'gift', '#3D7A3B'),
		('cat_invest', 'Hasil Investasi', 'income', 'sprout', '#2F6B7A');
		`
		_, _ = d.conn.Exec(defaultCats)
	} else {
		// Pastikan kategori baru tetap ada di database yang sudah dibuat sebelumnya
		_, _ = d.conn.Exec(`INSERT OR IGNORE INTO categories (id, name, type, icon, color) VALUES 
			('cat_kendaraan', 'Bensin & Transportasi', 'expense', 'bike', '#B45D24'),
			('cat_tarik_tunai', 'Tarik Tunai ATM', 'expense', 'banknote', '#2A6F68')`)
	}

	// Auto-migrasi transaksi tarik tunai ATM yang sempat tersimpan sebagai bensin / cat_kendaraan
	d.migrateAtmTransactions()

	// Masukkan akun dompet default jika belum ada
	var accCount int
	_ = d.conn.QueryRow("SELECT COUNT(*) FROM accounts").Scan(&accCount)
	if accCount == 0 {
		defaultAccs := `
		INSERT INTO accounts (id, name, type, balance, icon, color) VALUES
		('acc_dompet', 'Dompet Tunai', 'cash', 0, 'wallet', '#C85A3F'),
		('acc_bank', 'Rekening Bank', 'bank', 0, 'landmark', '#2F6F4E'),
		('acc_ewallet', 'E-Wallet', 'ewallet', 0, 'smartphone', '#3A5F8A');
		`
		_, _ = d.conn.Exec(defaultAccs)
	}

	// Masukkan aturan auto-kategorisasi default untuk mutasi bank Indonesia jika masih kosong
	var ruleCount int
	_ = d.conn.QueryRow("SELECT COUNT(*) FROM category_rules").Scan(&ruleCount)
	if ruleCount == 0 {
		defaultRules := `
		INSERT INTO category_rules (id, keyword, category_id, tx_type, priority) VALUES
		('rule_1', 'indomaret,alfamart,alfamidi,superindo,hypermart,transmart,tokopedia,shopee,blibli', 'cat_belanja', 'expense', 10),
		('rule_2', 'gofood,grabfood,shopeefood,kopi,warung,resto,mcd,kfc,hokben,starbucks,bakso,soto,nasi', 'cat_makan', 'expense', 10),
		('rule_3', 'pln,pdam,indihome,biznet,firstmedia,telkomsel,xl,indosat,tri,by.u,bpjs,listrik,wifi', 'cat_tagihan', 'expense', 10),
		('rule_4', 'pertamina,shell,spbu,bensin,gojek,grab,maxim,kai,commuter,mrt,transjakarta,tol,parkir', 'cat_kendaraan', 'expense', 10),
		('rule_5', 'tarik tunai,penarikan tunai,atm,cash withdrawal', 'cat_tarik_tunai', 'expense', 20),
		('rule_6', 'apotek,kimia farma,k24,halodoc,rumah sakit,klinik,dokter,obat', 'cat_kesehatan', 'expense', 10),
		('rule_7', 'spp,sekolah,kuliah,gramedia,buku,kursus,les', 'cat_pendidikan', 'expense', 10),
		('rule_8', 'bioskop,xxi,cgv,netflix,spotify,tiket,hotel,traveloka', 'cat_hiburan', 'expense', 10),
		('rule_9', 'gaji,payroll,salary,honor,upah', 'cat_gaji', 'income', 20),
		('rule_10', 'dividen,bunga,kupon,reksadana,bibit,bareksa,deposito', 'cat_invest', 'income', 15),
		('rule_11', 'bonus,thr,cashback,hadiah,komisi', 'cat_bonus', 'income', 10);
		`
		_, _ = d.conn.Exec(defaultRules)
	}

	// Pengaturan default aplikasi
	_, _ = d.conn.Exec(`INSERT OR IGNORE INTO app_settings (key, value) VALUES
		('family_title', 'DompetMungil'),
		('family_subtitle', 'Buku Catatan Keuangan Keluarga'),
		('theme', 'meadow'),
		('anim_mode', 'full'),
		('currency', 'IDR')`)

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

// migrateAtmTransactions memeriksa semua transaksi ber-kategori cat_kendaraan,
// jika catatannya mengindikasikan penarikan tunai ATM, pindahkan ke cat_tarik_tunai.
func (d *Database) migrateAtmTransactions() {
	rows, err := d.conn.Query("SELECT id, note_enc FROM transactions WHERE category_id = 'cat_kendaraan'")
	if err != nil {
		return
	}
	defer rows.Close()

	type toUpdate struct {
		id string
	}
	var updates []toUpdate

	for rows.Next() {
		var id, noteEnc sql.NullString
		if err := rows.Scan(&id, &noteEnc); err == nil && id.Valid {
			note := ""
			if noteEnc.Valid {
				note = d.DecryptNote(noteEnc.String)
			}
			nLower := strings.ToLower(note)
			if strings.Contains(nLower, "tarik tunai") || strings.Contains(nLower, "penarikan tunai") || strings.Contains(nLower, "atm") || strings.Contains(nLower, "tarik") {
				updates = append(updates, toUpdate{id: id.String})
			}
		}
	}

	for _, u := range updates {
		_, _ = d.conn.Exec("UPDATE transactions SET category_id = 'cat_tarik_tunai' WHERE id = ?", u.id)
	}
}

