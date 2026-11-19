package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"github.com/faisalfa123/DompetMungil/pkg/api"
	"github.com/faisalfa123/DompetMungil/pkg/crypto"
	"github.com/faisalfa123/DompetMungil/pkg/db"
)

// Embed seluruh direktori web statis PWA langsung ke dalam binary Go
//
//go:embed web
var webFS embed.FS

func getAppDirectory() string {
	// 1. Coba deteksi dari lokasi path file executable (binary) yang sedang berjalan
	execPath, err := os.Executable()
	if err == nil {
		resolvedPath, err := filepath.EvalSymlinks(execPath)
		if err == nil {
			execPath = resolvedPath
		}
		dir := filepath.Dir(execPath)
		// Jika binary dijalankan langsung dari folder instalasi
		return dir
	}

	// 2. Fallback ke current working directory
	pwd, err := os.Getwd()
	if err == nil {
		return pwd
	}

	return "."
}

func isWritableDir(dir string) bool {
	if dir == "" {
		return false
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return false
	}
	testFile := filepath.Join(dir, fmt.Sprintf(".perm_test_%d", os.Getpid()))
	if err := os.WriteFile(testFile, []byte("1"), 0600); err != nil {
		return false
	}
	_ = os.Remove(testFile)
	return true
}

func main() {
	// Deteksi otomatis direktori di mana aplikasi ini terpasang / berjalan
	appDir := getAppDirectory()

	defaultPort := 1100
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil && p > 0 && p < 65536 {
			defaultPort = p
		}
	}

	// Parse CLI flags
	port := flag.Int("port", defaultPort, "Port kustom server PWA (atau env PORT)")
	dataDir := flag.String("data-dir", os.Getenv("DATA_DIR"), "Direktori penyimpanan database dan kunci rahasia (kosong = autodetect)")
	flag.Parse()

	// Deteksi otomatis direktori data yang aman dan memiliki izin tulis (writable)
	resolvedDataDir := *dataDir
	if resolvedDataDir == "" {
		candidates := []string{}

		// 1. STATE_DIRECTORY (standar systemd saat StateDirectory=mastermind/dompetmungil aktif)
		if stateDir := os.Getenv("STATE_DIRECTORY"); stateDir != "" {
			for _, part := range strings.Split(stateDir, ":") {
				if part != "" {
					candidates = append(candidates, part)
				}
			}
		}

		// 2. Direktori jail Mastermind resmi
		candidates = append(candidates, "/var/lib/mastermind/dompetmungil")

		// 3. Current Working Directory (dalam jail Mastermind, WorkingDirectory adalah /var/lib/mastermind/dompetmungil)
		if pwd, err := os.Getwd(); err == nil && pwd != "/" {
			candidates = append(candidates, pwd, filepath.Join(pwd, "data"))
		}

		// 4. Folder instalasi binary / local
		candidates = append(candidates, filepath.Join(appDir, "data"))

		// 5. Direktori legacy Debian/Linux
		candidates = append(candidates, "/var/lib/dompetmungil", "/opt/dompetmungil/data")

		for _, candidate := range candidates {
			if isWritableDir(candidate) {
				resolvedDataDir = candidate
				break
			}
		}

		if resolvedDataDir == "" {
			resolvedDataDir = filepath.Join(appDir, "data")
		}
	}

	// Validasi kepastian izin tulis pada direktori yang terpilih
	if !isWritableDir(resolvedDataDir) {
		log.Printf("PERINGATAN: Direktori data terpilih (%s) tidak memiliki izin tulis!", resolvedDataDir)
		fallbacks := []string{
			os.Getenv("STATE_DIRECTORY"),
			"/var/lib/mastermind/dompetmungil",
			filepath.Join(os.TempDir(), "dompetmungil-data"),
		}
		for _, fb := range fallbacks {
			if fb != "" && isWritableDir(fb) {
				log.Printf("Mengalihkan lokasi data ke fallback yang aman: %s", fb)
				resolvedDataDir = fb
				break
			}
		}
	}

	log.Printf("=====================================================")
	log.Printf(" DompetMungil - Catatan Keuangan Keluarga (PWA)      ")
	log.Printf(" Server Target: Odroid C2 / STB HG680P (Amlogic S905X)")
	log.Printf(" Lokasi Terdeteksi (App Dir): %s", appDir)
	log.Printf(" Lokasi Data (Data Dir)    : %s", resolvedDataDir)
	log.Printf("=====================================================")

	if err := os.MkdirAll(resolvedDataDir, 0700); err != nil {
		log.Fatalf("FATAL: Gagal membuat direktori data: %v", err)
	}

	keyPath := filepath.Join(resolvedDataDir, "secret.key")
	dbPath := filepath.Join(resolvedDataDir, "data.db")

	// Coba pulihkan/salin data lama jika di lokasi baru masih kosong
	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		for _, legacyDir := range []string{"/opt/dompetmungil/data", "/var/lib/dompetmungil"} {
			if legacyDir == resolvedDataDir {
				continue
			}
			legacyKey := filepath.Join(legacyDir, "secret.key")
			legacyDB := filepath.Join(legacyDir, "data.db")
			if kData, err := os.ReadFile(legacyKey); err == nil && len(kData) == 32 {
				log.Printf("Menemukan kunci enkripsi lama di %s, menyalin ke %s...", legacyKey, keyPath)
				_ = os.WriteFile(keyPath, kData, 0600)
				break
			}
			if dbData, err := os.ReadFile(legacyDB); err == nil && len(dbData) > 0 {
				log.Printf("Menemukan database lama di %s, menyalin ke %s...", legacyDB, dbPath)
				_ = os.WriteFile(dbPath, dbData, 0600)
			}
		}
	}

	// 1. Muat atau buat kunci enkripsi AES-256 lokal
	log.Printf("[1/3] Memeriksa kunci enkripsi lokal...")
	key, err := crypto.GenerateOrLoadKey(keyPath)
	if err != nil {
		log.Fatalf("FATAL: Gagal memuat kunci enkripsi: %v", err)
	}
	log.Printf(" -> Kunci enkripsi AES-256 aktif di: %s (Hanya pemilik yang dapat membaca)", keyPath)

	// 2. Inisialisasi Database SQLite WAL terenkripsi
	log.Printf("[2/3] Membuka database SQLite WAL (Memory footprint < 15MB)...")
	database, err := db.InitDB(dbPath, key)
	if err != nil {
		log.Fatalf("FATAL: Gagal membuka database: %v", err)
	}
	defer database.Close()
	log.Printf(" -> Database siap di: %s (Tahan OOM & Auto-migrasi aktif)", dbPath)

	// 3. Konfigurasi HTTP Router
	mux := http.NewServeMux()

	// Daftarkan endpoint API
	apiHandler := api.NewAPIHandler(database)
	apiHandler.SetPaths(appDir, resolvedDataDir)
	apiHandler.RegisterRoutes(mux)

	// Serve Frontend PWA dari Embedded FS
	subFS, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatalf("FATAL: Gagal memuat asset statis PWA: %v", err)
	}
	fileServer := http.FileServer(http.FS(subFS))

	// Custom 404 & SPA router fallback
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Jika request adalah API yang tidak ditemukan, berikan custom JSON 404
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusNotFound)
			fmt.Fprintf(w, `{"error":true,"code":"ERR_ENDPOINT_NOT_FOUND_404","message":"Endpoint API '%s' tidak ditemukan di server"}`, r.URL.Path)
			return
		}

		// Sajikan file statis atau index.html
		cleanPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
		if cleanPath != "" && cleanPath != "." {
			if f, err := subFS.Open(cleanPath); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// Fallback ke index.html untuk Single Page Application PWA
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})

	addr := fmt.Sprintf(":%d", *port)
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	// Tangani shutdown anggun (graceful shutdown) saat menerima SIGINT/SIGTERM dari systemd
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[3/3] Server aktif di http://0.0.0.0:%d", *port)
		log.Printf("Siap melayani client PWA (Android / iOS / Desktop)...")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-stopChan
	log.Printf("Menerima sinyal stop / OOM warning. Menutup koneksi database dengan aman...")
	_ = server.Close()
	log.Printf("Database aman. Server berhenti.")
}
