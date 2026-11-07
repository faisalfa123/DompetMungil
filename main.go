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
	"syscall"

	"github.com/faisalfa123/DompetMungil/pkg/api"
	"github.com/faisalfa123/DompetMungil/pkg/crypto"
	"github.com/faisalfa123/DompetMungil/pkg/db"
)

// Embed seluruh direktori web statis PWA langsung ke dalam binary Go
//go:embed web/*
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

func main() {
	// Deteksi otomatis direktori di mana aplikasi ini terpasang / berjalan
	appDir := getAppDirectory()

	// Parse CLI flags
	port := flag.Int("port", 1234, "Port kustom server PWA")
	dataDir := flag.String("data-dir", "", "Direktori penyimpanan database dan kunci rahasia (kosong = autodetect)")
	flag.Parse()

	// Jika dataDir tidak dispesifikasikan via flag, autodetect lokasi terbaik:
	// Prioritas:
	// 1. <appDir>/data (lokasi folder tempat aplikasi berada, misal /opt/dompetmungil/data)
	// 2. /opt/dompetmungil/data jika direktori /opt/dompetmungil ada
	// 3. /var/lib/dompetmungil (legacy fallback)
	resolvedDataDir := *dataDir
	if resolvedDataDir == "" {
		localDataDir := filepath.Join(appDir, "data")
		optDataDir := "/opt/dompetmungil/data"
		systemDataDir := "/var/lib/dompetmungil"

		if info, err := os.Stat(localDataDir); err == nil && info.IsDir() {
			resolvedDataDir = localDataDir
		} else if info, err := os.Stat("/opt/dompetmungil"); err == nil && info.IsDir() {
			resolvedDataDir = optDataDir
		} else if info, err := os.Stat(systemDataDir); err == nil && info.IsDir() {
			resolvedDataDir = systemDataDir
		} else {
			resolvedDataDir = localDataDir
		}
	}

	log.Printf("=====================================================")
	log.Printf(" Catatan Keuangan Keluarga (Cute & Ultra-Light PWA) ")
	log.Printf(" Server Target: Odroid C2 / STB HG680P (Amlogic S905X)")
	log.Printf(" Lokasi Terdeteksi (App Dir): %s", appDir)
	log.Printf(" Lokasi Data (Data Dir)    : %s", resolvedDataDir)
	log.Printf("=====================================================")

	if err := os.MkdirAll(resolvedDataDir, 0700); err != nil {
		log.Fatalf("FATAL: Gagal membuat direktori data: %v", err)
	}

	keyPath := filepath.Join(resolvedDataDir, "secret.key")
	dbPath := filepath.Join(resolvedDataDir, "data.db")

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
		if len(r.URL.Path) >= 4 && r.URL.Path[:5] == "/api/" {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusNotFound)
			fmt.Fprintf(w, `{"error":true,"code":"ERR_ENDPOINT_NOT_FOUND_404","message":"Endpoint API '%s' tidak ditemukan di server"}`, r.URL.Path)
			return
		}

		// Sajikan file statis atau index.html
		f, err := subFS.Open(filepath.Clean(r.URL.Path[1:]))
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
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
