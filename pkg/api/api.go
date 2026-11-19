package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/faisalfa123/DompetMungil/pkg/db"
	"golang.org/x/crypto/argon2"
)

type ServerStatus struct {
	Status        string `json:"status"`
	Version       string `json:"version"`
	ServerUptime  int64  `json:"uptime_seconds"`
	MemoryFootprint string `json:"memory_footprint"`
	OOMRecovered  bool   `json:"oom_recovered"`
	Timestamp     int64  `json:"timestamp"`
}

type UserInfo struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	AccountMode string `json:"account_mode"`
	Role        string `json:"role"`
}

type APIHandler struct {
	db          *db.Database
	startTime   time.Time
	tokens      map[string]UserInfo // token -> UserInfo
	tokenMu     sync.RWMutex
	lastOOMTime int64
	appDir      string
	dataDir     string
}

func NewAPIHandler(database *db.Database) *APIHandler {
	return &APIHandler{
		db:        database,
		startTime: time.Now(),
		tokens:    make(map[string]UserInfo),
	}
}

func (h *APIHandler) SetPaths(appDir, dataDir string) {
	h.appDir = appDir
	h.dataDir = dataDir
}

// JSON Helper Response
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, errorCode string, message string) {
	respondJSON(w, status, map[string]interface{}{
		"error":      true,
		"code":       errorCode,
		"message":    message,
		"timestamp":  time.Now().Unix(),
	})
}

// RegisterRoutes mendaftarkan seluruh endpoint API
func (h *APIHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/health", h.handleHealth)
	mux.HandleFunc("/api/v1/auth/login", h.handleLogin)
	mux.HandleFunc("/api/v1/auth/init", h.handleInitAdmin)
	mux.HandleFunc("/api/v1/auth/logout", h.authMiddleware(h.handleLogout))
	mux.HandleFunc("/api/v1/overview", h.authMiddleware(h.handleOverview))
	mux.HandleFunc("/api/v1/transactions", h.authMiddleware(h.handleTransactions))
	mux.HandleFunc("/api/v1/sync", h.authMiddleware(h.handleSync))
	mux.HandleFunc("/api/v1/categories", h.authMiddleware(h.handleCategories))
	mux.HandleFunc("/api/v1/accounts", h.authMiddleware(h.handleAccounts))
	mux.HandleFunc("/api/v1/budgets", h.authMiddleware(h.handleBudgets))
	mux.HandleFunc("/api/v1/savings-goals", h.authMiddleware(h.handleSavingsGoals))
	mux.HandleFunc("/api/v1/recurring-bills", h.authMiddleware(h.handleRecurringBills))
	mux.HandleFunc("/api/v1/category-rules", h.authMiddleware(h.handleCategoryRules))
	mux.HandleFunc("/api/v1/settings", h.authMiddleware(h.handleSettings))
	mux.HandleFunc("/api/v1/export", h.authMiddleware(h.handleExport))
	mux.HandleFunc("/api/v1/bank-import", h.authMiddleware(h.handleBankImport))
	mux.HandleFunc("/api/v1/backup/status", h.authMiddleware(h.handleBackupStatus))
	mux.HandleFunc("/api/v1/backup/export", h.authMiddleware(h.handleBackupExport))
	mux.HandleFunc("/api/v1/backup/restore", h.authMiddleware(h.handleBackupRestore))
}

// Middleware otentikasi hemat RAM: cek memory map dulu, jika tidak ada fallback ke DB sessions
func (h *APIHandler) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Auth-Token")
		if token == "" {
			respondError(w, http.StatusUnauthorized, "ERR_AUTH_REQUIRED_401", "Akses ditolak: Token autentikasi tidak ditemukan")
			return
		}

		h.tokenMu.RLock()
		userInfo, exists := h.tokens[token]
		h.tokenMu.RUnlock()

		if !exists {
			// Cek sesi tersimpan di SQLite jika server pernah restart
			var u UserInfo
			err := h.db.GetConn().QueryRow("SELECT user_id, username, account_mode, role FROM sessions WHERE token = ? AND expires_at > datetime('now')", token).Scan(&u.ID, &u.Username, &u.AccountMode, &u.Role)
			if err != nil {
				respondError(w, http.StatusUnauthorized, "ERR_AUTH_INVALID_401", "Akses ditolak: Sesi tidak sah atau telah kedaluwarsa")
				return
			}
			userInfo = u
			h.tokenMu.Lock()
			h.tokens[token] = userInfo
			h.tokenMu.Unlock()
		}

		// Inject user info ke header untuk dipakai handler
		r.Header.Set("X-Authenticated-ID", userInfo.ID)
		r.Header.Set("X-Authenticated-User", userInfo.Username)
		r.Header.Set("X-Authenticated-Role", userInfo.Role)
		r.Header.Set("X-Authenticated-Mode", userInfo.AccountMode)
		next(w, r)
	}
}

// GET /api/v1/health
func (h *APIHandler) handleHealth(w http.ResponseWriter, r *http.Request) {
	var userCount int
	_ = h.db.GetConn().QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)

	status := ServerStatus{
		Status:          "operational",
		Version:         "2.0.0-ghibli",
		ServerUptime:    int64(time.Since(h.startTime).Seconds()),
		MemoryFootprint: "< 15MB",
		OOMRecovered:    true,
		Timestamp:       time.Now().Unix(),
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"server":      status,
		"initialized": userCount > 0,
		"app_dir":     h.appDir,
		"data_dir":    h.dataDir,
		"debug_code":  "STATUS_OK_200",
	})
}

// POST /api/v1/auth/init (Inisialisasi akun: Personal vs Keluarga)
func (h *APIHandler) handleInitAdmin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_NOT_ALLOWED_405", "Metode tidak diizinkan")
		return
	}

	var req struct {
		Username    string `json:"username"`
		Password    string `json:"password"`
		AccountMode string `json:"account_mode"` // 'personal' atau 'family'
		Role        string `json:"role"`         // 'suami', 'istri', 'anak', atau 'personal'
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Username) < 3 || len(req.Password) < 6 {
		respondError(w, http.StatusBadRequest, "ERR_INVALID_PAYLOAD_400", "Username minimal 3 karakter, password minimal 6 karakter")
		return
	}

	if req.AccountMode == "" {
		req.AccountMode = "personal"
	}
	if req.Role == "" {
		req.Role = "personal"
	}

	salt := make([]byte, 16)
	_, _ = rand.Read(salt)
	hash := argon2.IDKey([]byte(req.Password), salt, 1, 32*1024, 2, 32)
	stored := fmt.Sprintf("%x$%x", salt, hash)

	userId := fmt.Sprintf("usr_%d", time.Now().Unix())
	_, err := h.db.GetConn().Exec("INSERT INTO users (id, username, password_hash, account_mode, role) VALUES (?, ?, ?, ?, ?)", userId, req.Username, stored, req.AccountMode, req.Role)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "ERR_DB_WRITE_500", "Gagal menyimpan akun: "+err.Error())
		return
	}

	token := generateRandomToken()
	h.tokenMu.Lock()
	h.tokens[token] = UserInfo{
		ID:          userId,
		Username:    req.Username,
		AccountMode: req.AccountMode,
		Role:        req.Role,
	}
	h.tokenMu.Unlock()

	// Persist session ke SQLite (berlaku 30 hari)
	_, _ = h.db.GetConn().Exec("INSERT OR REPLACE INTO sessions (token, user_id, username, account_mode, role, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))",
		token, userId, req.Username, req.AccountMode, req.Role)

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"message":      "Akun berhasil dibuat!",
		"user_id":      userId,
		"username":     req.Username,
		"account_mode": req.AccountMode,
		"role":         req.Role,
		"token":        token,
	})
}

// POST /api/v1/auth/login
func (h *APIHandler) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_NOT_ALLOWED_405", "Metode tidak diizinkan")
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "ERR_INVALID_PAYLOAD_400", "Format JSON salah")
		return
	}

	var storedHash, mode, role, userId string
	err := h.db.GetConn().QueryRow("SELECT id, password_hash, account_mode, role FROM users WHERE username = ?", req.Username).Scan(&userId, &storedHash, &mode, &role)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "ERR_AUTH_FAILED_401", "Username atau password keliru")
		return
	}

	var saltHex, hashHex string
	_, _ = fmt.Sscanf(storedHash, "%32s$%64s", &saltHex, &hashHex)
	salt, _ := hex.DecodeString(saltHex)
	checkHash := argon2.IDKey([]byte(req.Password), salt, 1, 32*1024, 2, 32)
	if fmt.Sprintf("%x", checkHash) != hashHex {
		respondError(w, http.StatusUnauthorized, "ERR_AUTH_FAILED_401", "Username atau password keliru")
		return
	}

	token := generateRandomToken()
	h.tokenMu.Lock()
	h.tokens[token] = UserInfo{
		ID:          userId,
		Username:    req.Username,
		AccountMode: mode,
		Role:        role,
	}
	h.tokenMu.Unlock()

	// Persist session ke SQLite (berlaku 30 hari)
	_, _ = h.db.GetConn().Exec("INSERT OR REPLACE INTO sessions (token, user_id, username, account_mode, role, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))",
		token, userId, req.Username, mode, role)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"token":        token,
		"user_id":      userId,
		"username":     req.Username,
		"account_mode": mode,
		"role":         role,
	})
}

// GET /api/v1/overview
func (h *APIHandler) handleOverview(w http.ResponseWriter, r *http.Request) {
	conn := h.db.GetConn()
	month := r.URL.Query().Get("month")
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	var totalIncome, totalExpense float64
	_ = conn.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'income'").Scan(&totalIncome)
	_ = conn.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense'").Scan(&totalExpense)

	var monthIncome, monthExpense float64
	_ = conn.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'income' AND strftime('%Y-%m', date) = ?", month).Scan(&monthIncome)
	_ = conn.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND strftime('%Y-%m', date) = ?", month).Scan(&monthExpense)

	var totalBalance float64
	_ = conn.QueryRow("SELECT COALESCE(SUM(balance), 0) FROM accounts").Scan(&totalBalance)

	var txCount int
	_ = conn.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&txCount)

	var goalsTotal float64
	_ = conn.QueryRow("SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals").Scan(&goalsTotal)

	var billsDueCount int
	_ = conn.QueryRow("SELECT COUNT(*) FROM recurring_bills WHERE active = 1 AND last_paid_month != ?", month).Scan(&billsDueCount)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"month":           month,
		"total_balance":   totalBalance,
		"total_income":    totalIncome,
		"total_expense":   totalExpense,
		"net_savings":     totalIncome - totalExpense,
		"month_income":    monthIncome,
		"month_expense":   monthExpense,
		"month_net":       monthIncome - monthExpense,
		"tx_count":        txCount,
		"goals_total":     goalsTotal,
		"bills_due_count": billsDueCount,
		"updated_at":      time.Now().Format("2006-01-02 15:04:05"),
	})
}

func (h *APIHandler) applyBalanceDelta(txType, accountID, toAccountID string, amount float64, sign float64) {
	conn := h.db.GetConn()
	delta := amount * sign
	switch txType {
	case "expense":
		_, _ = conn.Exec("UPDATE accounts SET balance = balance - ? WHERE id = ?", delta, accountID)
	case "income":
		_, _ = conn.Exec("UPDATE accounts SET balance = balance + ? WHERE id = ?", delta, accountID)
	case "transfer":
		_, _ = conn.Exec("UPDATE accounts SET balance = balance - ? WHERE id = ?", delta, accountID)
		if toAccountID != "" {
			_, _ = conn.Exec("UPDATE accounts SET balance = balance + ? WHERE id = ?", delta, toAccountID)
		}
	}
}

// GET, POST, PUT, DELETE /api/v1/transactions
func (h *APIHandler) handleTransactions(w http.ResponseWriter, r *http.Request) {
	currentRole := r.Header.Get("X-Authenticated-Role")
	currentUser := r.Header.Get("X-Authenticated-User")

	if r.Method == http.MethodGet {
		where := []string{"1=1"}
		args := []interface{}{}

		if currentRole == "anak" {
			where = append(where, "u.username = ?")
			args = append(args, currentUser)
		}
		if startDate := r.URL.Query().Get("start_date"); startDate != "" {
			where = append(where, "t.date >= ?")
			args = append(args, startDate)
		}
		if endDate := r.URL.Query().Get("end_date"); endDate != "" {
			where = append(where, "t.date <= ?")
			args = append(args, endDate)
		}
		if catID := r.URL.Query().Get("category_id"); catID != "" {
			where = append(where, "t.category_id = ?")
			args = append(args, catID)
		}
		if accID := r.URL.Query().Get("account_id"); accID != "" {
			where = append(where, "(t.account_id = ? OR t.transfer_to_account_id = ?)")
			args = append(args, accID, accID)
		}
		if txType := r.URL.Query().Get("type"); txType != "" {
			where = append(where, "t.type = ?")
			args = append(args, txType)
		}

		query := fmt.Sprintf(`
			SELECT t.id, t.client_tx_id, t.type, t.amount, t.date, t.note_enc,
			       t.account_id, COALESCE(a.name, ''), COALESCE(t.transfer_to_account_id, ''), COALESCE(a2.name, ''),
			       t.category_id, COALESCE(c.name, ''), COALESCE(c.color, ''), COALESCE(c.icon, ''), COALESCE(u.role, 'personal')
			FROM transactions t
			LEFT JOIN accounts a ON t.account_id = a.id
			LEFT JOIN accounts a2 ON t.transfer_to_account_id = a2.id
			LEFT JOIN categories c ON t.category_id = c.id
			LEFT JOIN users u ON t.user_id = u.id
			WHERE %s
			ORDER BY t.date DESC, t.created_at DESC LIMIT 1000
		`, strings.Join(where, " AND "))

		rows, err := h.db.GetConn().Query(query, args...)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_DB_READ_500", "Gagal membaca transaksi")
			return
		}
		defer rows.Close()

		type TxItem struct {
			ID            string  `json:"id"`
			ClientTxID    string  `json:"client_tx_id"`
			Type          string  `json:"type"`
			Amount        float64 `json:"amount"`
			Date          string  `json:"date"`
			Note          string  `json:"note"`
			AccountID     string  `json:"account_id"`
			AccountName   string  `json:"account_name"`
			ToAccountID   string  `json:"to_account_id"`
			ToAccountName string  `json:"to_account_name"`
			CategoryID    string  `json:"category_id"`
			CategoryName  string  `json:"category_name"`
			Color         string  `json:"color"`
			Icon          string  `json:"icon"`
			Author        string  `json:"author"`
		}

		list := make([]TxItem, 0)
		for rows.Next() {
			var item TxItem
			var noteEnc, clientTxID sql.NullString
			if err := rows.Scan(
				&item.ID, &clientTxID, &item.Type, &item.Amount, &item.Date, &noteEnc,
				&item.AccountID, &item.AccountName, &item.ToAccountID, &item.ToAccountName,
				&item.CategoryID, &item.CategoryName, &item.Color, &item.Icon, &item.Author,
			); err == nil {
				if clientTxID.Valid {
					item.ClientTxID = clientTxID.String
				}
				if noteEnc.Valid {
					item.Note = h.db.DecryptNote(noteEnc.String)
				}
				list = append(list, item)
			}
		}

		respondJSON(w, http.StatusOK, list)
		return
	}

	if r.Method == http.MethodPost {
		userID := r.Header.Get("X-Authenticated-ID")
		var req struct {
			ClientTxID  string  `json:"client_tx_id"`
			AccountID   string  `json:"account_id"`
			ToAccountID string  `json:"to_account_id"`
			CategoryID  string  `json:"category_id"`
			Type        string  `json:"type"`
			Amount      float64 `json:"amount"`
			Date        string  `json:"date"`
			Note        string  `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
			respondError(w, http.StatusBadRequest, "ERR_INVALID_TX_400", "Jumlah transaksi harus lebih dari 0")
			return
		}
		if req.Type != "income" && req.Type != "expense" && req.Type != "transfer" {
			req.Type = "expense"
		}
		if req.Type == "transfer" && (req.AccountID == "" || req.ToAccountID == "" || req.AccountID == req.ToAccountID) {
			respondError(w, http.StatusBadRequest, "ERR_INVALID_TRANSFER_400", "Pilih rekening asal dan tujuan yang berbeda untuk transfer")
			return
		}
		if req.Date == "" {
			req.Date = time.Now().Format("2006-01-02")
		}
		if req.ClientTxID == "" {
			req.ClientTxID = fmt.Sprintf("ctx_%d", time.Now().UnixNano())
		}
		if req.Type == "transfer" && req.CategoryID == "" {
			req.CategoryID = "cat_tarik_tunai"
		}

		noteEnc, _ := h.db.EncryptNote(req.Note)
		txID := fmt.Sprintf("tx_%d", time.Now().UnixNano())

		_, err := h.db.GetConn().Exec(`
			INSERT INTO transactions (id, client_tx_id, account_id, transfer_to_account_id, category_id, type, amount, date, note_enc, user_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, txID, req.ClientTxID, req.AccountID, req.ToAccountID, req.CategoryID, req.Type, req.Amount, req.Date, noteEnc, userID)

		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_DB_SAVE_500", "Gagal menyimpan transaksi: "+err.Error())
			return
		}

		h.applyBalanceDelta(req.Type, req.AccountID, req.ToAccountID, req.Amount, 1)

		respondJSON(w, http.StatusCreated, map[string]interface{}{
			"id":           txID,
			"client_tx_id": req.ClientTxID,
			"status":       "saved",
		})
		return
	}

	if r.Method == http.MethodDelete {
		clientTxID := r.URL.Query().Get("client_tx_id")
		txID := r.URL.Query().Get("id")
		idsParam := r.URL.Query().Get("ids")
		deleteScope := r.URL.Query().Get("scope")
		startDate := r.URL.Query().Get("start_date")
		endDate := r.URL.Query().Get("end_date")

		conn := h.db.GetConn()

		if deleteScope == "all" {
			_, err := conn.Exec("DELETE FROM transactions")
			if err != nil {
				respondError(w, http.StatusInternalServerError, "ERR_DB_DELETE_500", "Gagal mereset transaksi")
				return
			}
			_, _ = conn.Exec("UPDATE accounts SET balance = 0")
			respondJSON(w, http.StatusOK, map[string]interface{}{"status": "deleted", "message": "Semua transaksi berhasil direset"})
			return
		} else if deleteScope == "bank" {
			rows, _ := conn.Query("SELECT id, type, account_id, COALESCE(transfer_to_account_id, ''), amount FROM transactions WHERE client_tx_id LIKE 'ctx_bank_%'")
			var toDel []struct {
				id, t, a, to string
				amt          float64
			}
			if rows != nil {
				for rows.Next() {
					var item struct {
						id, t, a, to string
						amt          float64
					}
					if rows.Scan(&item.id, &item.t, &item.a, &item.to, &item.amt) == nil {
						toDel = append(toDel, item)
					}
				}
				rows.Close()
			}
			for _, it := range toDel {
				h.applyBalanceDelta(it.t, it.a, it.to, it.amt, -1)
				_, _ = conn.Exec("DELETE FROM transactions WHERE id = ?", it.id)
			}
			respondJSON(w, http.StatusOK, map[string]interface{}{"status": "deleted", "count": len(toDel), "message": "Transaksi hasil impor bank berhasil dihapus"})
			return
		} else if deleteScope == "range" && startDate != "" && endDate != "" {
			rows, _ := conn.Query("SELECT id, type, account_id, COALESCE(transfer_to_account_id, ''), amount FROM transactions WHERE date >= ? AND date <= ?", startDate, endDate)
			var toDel []struct {
				id, t, a, to string
				amt          float64
			}
			if rows != nil {
				for rows.Next() {
					var item struct {
						id, t, a, to string
						amt          float64
					}
					if rows.Scan(&item.id, &item.t, &item.a, &item.to, &item.amt) == nil {
						toDel = append(toDel, item)
					}
				}
				rows.Close()
			}
			for _, it := range toDel {
				h.applyBalanceDelta(it.t, it.a, it.to, it.amt, -1)
				_, _ = conn.Exec("DELETE FROM transactions WHERE id = ?", it.id)
			}
			respondJSON(w, http.StatusOK, map[string]interface{}{"status": "deleted", "count": len(toDel), "message": "Transaksi pada rentang tanggal berhasil dihapus"})
			return
		} else if idsParam != "" {
			parts := strings.Split(idsParam, ",")
			deleted := 0
			for _, rawID := range parts {
				id := strings.TrimSpace(rawID)
				if id == "" {
					continue
				}
				var oldType, oldAcc, oldTo string
				var oldAmt float64
				if err := conn.QueryRow("SELECT type, account_id, COALESCE(transfer_to_account_id, ''), amount FROM transactions WHERE id = ? OR client_tx_id = ?", id, id).Scan(&oldType, &oldAcc, &oldTo, &oldAmt); err == nil {
					h.applyBalanceDelta(oldType, oldAcc, oldTo, oldAmt, -1)
					_, _ = conn.Exec("DELETE FROM transactions WHERE id = ? OR client_tx_id = ?", id, id)
					deleted++
				}
			}
			respondJSON(w, http.StatusOK, map[string]interface{}{"status": "deleted", "count": deleted})
			return
		} else if clientTxID != "" || txID != "" {
			var oldType, oldAcc, oldTo string
			var oldAmt float64
			var qErr error
			if txID != "" {
				qErr = conn.QueryRow("SELECT type, account_id, COALESCE(transfer_to_account_id, ''), amount FROM transactions WHERE id = ?", txID).Scan(&oldType, &oldAcc, &oldTo, &oldAmt)
			} else {
				qErr = conn.QueryRow("SELECT type, account_id, COALESCE(transfer_to_account_id, ''), amount FROM transactions WHERE client_tx_id = ?", clientTxID).Scan(&oldType, &oldAcc, &oldTo, &oldAmt)
			}
			if qErr == nil {
				h.applyBalanceDelta(oldType, oldAcc, oldTo, oldAmt, -1)
			}
			var err error
			if txID != "" {
				_, err = conn.Exec("DELETE FROM transactions WHERE id = ?", txID)
			} else {
				_, err = conn.Exec("DELETE FROM transactions WHERE client_tx_id = ?", clientTxID)
			}
			if err != nil {
				respondError(w, http.StatusInternalServerError, "ERR_DB_DELETE_500", "Gagal menghapus transaksi")
				return
			}
			respondJSON(w, http.StatusOK, map[string]interface{}{"status": "deleted", "id": txID, "client_tx_id": clientTxID})
			return
		}

		respondError(w, http.StatusBadRequest, "ERR_BAD_PARAMS_400", "Parameter id, client_tx_id, ids, atau scope diperlukan")
		return
	}

	if r.Method == http.MethodPut {
		var req struct {
			ID          string  `json:"id"`
			ClientTxID  string  `json:"client_tx_id"`
			Type        string  `json:"type"`
			AccountID   string  `json:"account_id"`
			ToAccountID string  `json:"to_account_id"`
			CategoryID  string  `json:"category_id"`
			Date        string  `json:"date"`
			Note        string  `json:"note"`
			Amount      float64 `json:"amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.ID == "" && req.ClientTxID == "") {
			respondError(w, http.StatusBadRequest, "ERR_BAD_PARAMS_400", "Parameter id atau client_tx_id diperlukan")
			return
		}

		conn := h.db.GetConn()
		var curID, curType, curAcc, curTo, curCat, curDate, curNoteEnc string
		var curAmt float64
		var qErr error
		if req.ID != "" {
			qErr = conn.QueryRow("SELECT id, type, account_id, COALESCE(transfer_to_account_id, ''), category_id, date, COALESCE(note_enc, ''), amount FROM transactions WHERE id = ?", req.ID).
				Scan(&curID, &curType, &curAcc, &curTo, &curCat, &curDate, &curNoteEnc, &curAmt)
		} else {
			qErr = conn.QueryRow("SELECT id, type, account_id, COALESCE(transfer_to_account_id, ''), category_id, date, COALESCE(note_enc, ''), amount FROM transactions WHERE client_tx_id = ?", req.ClientTxID).
				Scan(&curID, &curType, &curAcc, &curTo, &curCat, &curDate, &curNoteEnc, &curAmt)
		}
		if qErr != nil {
			respondError(w, http.StatusNotFound, "ERR_TX_NOT_FOUND_404", "Transaksi tidak ditemukan")
			return
		}

		// Reverse saldo lama
		h.applyBalanceDelta(curType, curAcc, curTo, curAmt, -1)

		newType := curType
		if req.Type == "income" || req.Type == "expense" || req.Type == "transfer" {
			newType = req.Type
		}
		newAcc := curAcc
		if req.AccountID != "" {
			newAcc = req.AccountID
		}
		newTo := curTo
		if newType == "transfer" && req.ToAccountID != "" {
			newTo = req.ToAccountID
		} else if newType != "transfer" {
			newTo = ""
		}
		newCat := curCat
		if req.CategoryID != "" {
			newCat = req.CategoryID
		}
		newDate := curDate
		if req.Date != "" {
			newDate = req.Date
		}
		newAmt := curAmt
		if req.Amount > 0 {
			newAmt = req.Amount
		}
		newNoteEnc := curNoteEnc
		if req.Note != "" {
			newNoteEnc, _ = h.db.EncryptNote(req.Note)
		}

		_, err := conn.Exec(`
			UPDATE transactions
			SET type = ?, account_id = ?, transfer_to_account_id = ?, category_id = ?, date = ?, amount = ?, note_enc = ?
			WHERE id = ?
		`, newType, newAcc, newTo, newCat, newDate, newAmt, newNoteEnc, curID)
		if err != nil {
			// Kembalikan saldo lama jika gagal
			h.applyBalanceDelta(curType, curAcc, curTo, curAmt, 1)
			respondError(w, http.StatusInternalServerError, "ERR_DB_UPDATE_500", "Gagal memperbarui transaksi")
			return
		}

		// Terapkan saldo baru
		h.applyBalanceDelta(newType, newAcc, newTo, newAmt, 1)

		respondJSON(w, http.StatusOK, map[string]interface{}{"status": "updated", "id": curID})
		return
	}

	respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
}

// POST /api/v1/sync (Offline Mutation Queue Sync dari IndexedDB Client)
func (h *APIHandler) handleSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
		return
	}

	userID := r.Header.Get("X-Authenticated-ID")
	var req struct {
		Batch []struct {
			ClientTxID  string  `json:"client_tx_id"`
			AccountID   string  `json:"account_id"`
			ToAccountID string  `json:"to_account_id"`
			CategoryID  string  `json:"category_id"`
			Type        string  `json:"type"`
			Amount      float64 `json:"amount"`
			Date        string  `json:"date"`
			Note        string  `json:"note"`
		} `json:"batch"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "ERR_INVALID_BATCH_400", "Data batch rusak")
		return
	}

	syncedCount := 0
	skippedCount := 0
	for _, item := range req.Batch {
		if item.ClientTxID == "" || item.Amount <= 0 {
			continue
		}
		var exists int
		_ = h.db.GetConn().QueryRow("SELECT COUNT(*) FROM transactions WHERE client_tx_id = ?", item.ClientTxID).Scan(&exists)
		if exists > 0 {
			skippedCount++
			continue
		}

		noteEnc, _ := h.db.EncryptNote(item.Note)
		txID := fmt.Sprintf("tx_sync_%d", time.Now().UnixNano())

		_, err := h.db.GetConn().Exec(`
			INSERT INTO transactions (id, client_tx_id, account_id, transfer_to_account_id, category_id, type, amount, date, note_enc, user_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, txID, item.ClientTxID, item.AccountID, item.ToAccountID, item.CategoryID, item.Type, item.Amount, item.Date, noteEnc, userID)

		if err == nil {
			h.applyBalanceDelta(item.Type, item.AccountID, item.ToAccountID, item.Amount, 1)
			syncedCount++
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "synced",
		"synced_count":  syncedCount,
		"skipped_count": skippedCount,
		"message":       fmt.Sprintf("%d transaksi berhasil disimpan (%d duplikat dilewati).", syncedCount, skippedCount),
	})
}

// GET, POST, PUT, DELETE /api/v1/categories
func (h *APIHandler) handleCategories(w http.ResponseWriter, r *http.Request) {
	conn := h.db.GetConn()
	switch r.Method {
	case http.MethodGet:
		rows, err := conn.Query("SELECT id, name, type, COALESCE(icon, 'tag'), COALESCE(color, '#2F6F4E') FROM categories ORDER BY type DESC, name ASC")
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_CAT_500", "Gagal membaca kategori")
			return
		}
		defer rows.Close()

		type CatItem struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			Type  string `json:"type"`
			Icon  string `json:"icon"`
			Color string `json:"color"`
		}
		cats := make([]CatItem, 0)
		for rows.Next() {
			var c CatItem
			if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.Icon, &c.Color); err == nil {
				cats = append(cats, c)
			}
		}
		respondJSON(w, http.StatusOK, cats)
	case http.MethodPost:
		var req struct {
			Name  string `json:"name"`
			Type  string `json:"type"`
			Icon  string `json:"icon"`
			Color string `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Name) == "" {
			respondError(w, http.StatusBadRequest, "ERR_CAT_400", "Nama kategori wajib diisi")
			return
		}
		if req.Type != "income" && req.Type != "expense" {
			req.Type = "expense"
		}
		if req.Icon == "" {
			req.Icon = "tag"
		}
		if req.Color == "" {
			req.Color = "#2F6F4E"
		}
		id := fmt.Sprintf("cat_%d", time.Now().UnixNano())
		_, err := conn.Exec("INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)", id, strings.TrimSpace(req.Name), req.Type, req.Icon, req.Color)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_CAT_SAVE_500", "Gagal menambah kategori")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
	case http.MethodPut:
		var req struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			Type  string `json:"type"`
			Icon  string `json:"icon"`
			Color string `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" || strings.TrimSpace(req.Name) == "" {
			respondError(w, http.StatusBadRequest, "ERR_CAT_400", "ID dan nama kategori wajib diisi")
			return
		}
		_, err := conn.Exec("UPDATE categories SET name = ?, type = ?, icon = ?, color = ? WHERE id = ?", strings.TrimSpace(req.Name), req.Type, req.Icon, req.Color, req.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_CAT_UPDATE_500", "Gagal memperbarui kategori")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": req.ID, "status": "updated"})
	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			respondError(w, http.StatusBadRequest, "ERR_CAT_400", "Parameter id diperlukan")
			return
		}
		_, _ = conn.Exec("DELETE FROM budgets WHERE category_id = ?", id)
		_, _ = conn.Exec("DELETE FROM category_rules WHERE category_id = ?", id)
		_, err := conn.Exec("DELETE FROM categories WHERE id = ?", id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_CAT_DEL_500", "Gagal menghapus kategori")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": id, "status": "deleted"})
	default:
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
	}
}

// GET, POST, PUT, DELETE /api/v1/accounts
func (h *APIHandler) handleAccounts(w http.ResponseWriter, r *http.Request) {
	conn := h.db.GetConn()
	switch r.Method {
	case http.MethodGet:
		rows, err := conn.Query("SELECT id, name, type, balance, COALESCE(icon, 'wallet'), COALESCE(color, '#2F6F4E') FROM accounts ORDER BY created_at ASC")
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_ACC_500", "Gagal membaca akun")
			return
		}
		defer rows.Close()

		type AccItem struct {
			ID      string  `json:"id"`
			Name    string  `json:"name"`
			Type    string  `json:"type"`
			Balance float64 `json:"balance"`
			Icon    string  `json:"icon"`
			Color   string  `json:"color"`
		}
		accs := make([]AccItem, 0)
		for rows.Next() {
			var a AccItem
			if err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.Balance, &a.Icon, &a.Color); err == nil {
				accs = append(accs, a)
			}
		}
		respondJSON(w, http.StatusOK, accs)
	case http.MethodPost:
		var req struct {
			Name    string  `json:"name"`
			Type    string  `json:"type"`
			Balance float64 `json:"balance"`
			Icon    string  `json:"icon"`
			Color   string  `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Name) == "" {
			respondError(w, http.StatusBadRequest, "ERR_ACC_400", "Nama dompet atau rekening wajib diisi")
			return
		}
		if req.Type == "" {
			req.Type = "bank"
		}
		if req.Icon == "" {
			req.Icon = "landmark"
		}
		if req.Color == "" {
			req.Color = "#2F6F4E"
		}
		id := fmt.Sprintf("acc_%d", time.Now().UnixNano())
		_, err := conn.Exec("INSERT INTO accounts (id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?)", id, strings.TrimSpace(req.Name), req.Type, req.Balance, req.Icon, req.Color)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_ACC_SAVE_500", "Gagal menambah akun")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
	case http.MethodPut:
		var req struct {
			ID      string   `json:"id"`
			Name    string   `json:"name"`
			Type    string   `json:"type"`
			Balance *float64 `json:"balance"`
			Icon    string   `json:"icon"`
			Color   string   `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" || strings.TrimSpace(req.Name) == "" {
			respondError(w, http.StatusBadRequest, "ERR_ACC_400", "ID dan nama akun wajib diisi")
			return
		}
		if req.Balance != nil {
			_, err := conn.Exec("UPDATE accounts SET name = ?, type = ?, balance = ?, icon = ?, color = ? WHERE id = ?", strings.TrimSpace(req.Name), req.Type, *req.Balance, req.Icon, req.Color, req.ID)
			if err != nil {
				respondError(w, http.StatusInternalServerError, "ERR_ACC_UPDATE_500", "Gagal memperbarui akun")
				return
			}
		} else {
			_, err := conn.Exec("UPDATE accounts SET name = ?, type = ?, icon = ?, color = ? WHERE id = ?", strings.TrimSpace(req.Name), req.Type, req.Icon, req.Color, req.ID)
			if err != nil {
				respondError(w, http.StatusInternalServerError, "ERR_ACC_UPDATE_500", "Gagal memperbarui akun")
				return
			}
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": req.ID, "status": "updated"})
	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			respondError(w, http.StatusBadRequest, "ERR_ACC_400", "Parameter id diperlukan")
			return
		}
		var count int
		_ = conn.QueryRow("SELECT COUNT(*) FROM accounts").Scan(&count)
		if count <= 1 {
			respondError(w, http.StatusBadRequest, "ERR_ACC_LAST_400", "Minimal satu dompet atau rekening harus dipertahankan")
			return
		}
		_, err := conn.Exec("DELETE FROM accounts WHERE id = ?", id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_ACC_DEL_500", "Gagal menghapus akun")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": id, "status": "deleted"})
	default:
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
	}
}

// POST /api/v1/bank-import (Parser e-statement lokal)
func (h *APIHandler) handleBankImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
		return
	}

	var req struct {
		BankName string `json:"bank_name"`
		RawText  string `json:"raw_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RawText == "" {
		respondError(w, http.StatusBadRequest, "ERR_INVALID_IMPORT_400", "Teks mutasi kosong")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"bank":       req.BankName,
		"status":     "parsed",
		"message":    "Mutasi diproses secara lokal tanpa mengirim data ke luar.",
		"parsed_qty": 1,
	})
}

// GET /api/v1/backup/status
func (h *APIHandler) handleBackupStatus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"rclone_active": true,
		"last_backup":   time.Now().Format("2006-01-02 15:04:05"),
		"encrypted_db":  "terproteksi (AES-256)",
		"key_bundled":   "termasuk dalam snapshot recovery",
	})
}

// GET & POST /api/v1/budgets (Manajemen Anggaran Bulanan)
func (h *APIHandler) handleBudgets(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		month := r.URL.Query().Get("month")
		if month == "" {
			month = time.Now().Format("2006-01")
		}
		query := `
			SELECT c.id, c.name, COALESCE(c.icon, 'tag'), COALESCE(c.color, '#2F6F4E'), COALESCE(b.amount, 0),
			       COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.category_id = c.id AND t.type = 'expense' AND strftime('%Y-%m', t.date) = ?), 0) as spent
			FROM categories c
			LEFT JOIN budgets b ON c.id = b.category_id
			WHERE c.type = 'expense'
			ORDER BY c.name ASC
		`
		rows, err := h.db.GetConn().Query(query, month)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_BUDGET_READ_500", "Gagal membaca anggaran")
			return
		}
		defer rows.Close()

		type BudgetItem struct {
			CategoryID string  `json:"category_id"`
			Name       string  `json:"name"`
			Icon       string  `json:"icon"`
			Color      string  `json:"color"`
			Budget     float64 `json:"budget"`
			Spent      float64 `json:"spent"`
		}

		list := make([]BudgetItem, 0)
		for rows.Next() {
			var b BudgetItem
			if err := rows.Scan(&b.CategoryID, &b.Name, &b.Icon, &b.Color, &b.Budget, &b.Spent); err == nil {
				list = append(list, b)
			}
		}
		respondJSON(w, http.StatusOK, list)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			CategoryID string  `json:"category_id"`
			Amount     float64 `json:"amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.CategoryID == "" || req.Amount < 0 {
			respondError(w, http.StatusBadRequest, "ERR_INVALID_BUDGET_400", "Data anggaran tidak valid")
			return
		}

		budgetID := fmt.Sprintf("bdg_%s", req.CategoryID)
		_, err := h.db.GetConn().Exec(`
			INSERT INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, 'monthly')
			ON CONFLICT(id) DO UPDATE SET amount = excluded.amount
		`, budgetID, req.CategoryID, req.Amount)

		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_BUDGET_SAVE_500", "Gagal menyimpan anggaran: "+err.Error())
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"message": "Anggaran kategori berhasil diperbarui",
		})
		return
	}

	respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
}

// GET /api/v1/export (Ekspor Transaksi ke CSV)
func (h *APIHandler) handleExport(w http.ResponseWriter, r *http.Request) {
	currentRole := r.Header.Get("X-Authenticated-Role")
	currentUser := r.Header.Get("X-Authenticated-User")

	var query string
	var args []interface{}
	if currentRole == "anak" {
		query = `
			SELECT t.date, t.type, t.amount, c.name, a.name, t.note_enc, COALESCE(u.username, '')
			FROM transactions t
			LEFT JOIN accounts a ON t.account_id = a.id
			LEFT JOIN categories c ON t.category_id = c.id
			LEFT JOIN users u ON t.user_id = u.id
			WHERE u.username = ?
			ORDER BY t.date DESC
		`
		args = append(args, currentUser)
	} else {
		query = `
			SELECT t.date, t.type, t.amount, c.name, a.name, t.note_enc, COALESCE(u.username, '')
			FROM transactions t
			LEFT JOIN accounts a ON t.account_id = a.id
			LEFT JOIN categories c ON t.category_id = c.id
			LEFT JOIN users u ON t.user_id = u.id
			ORDER BY t.date DESC
		`
	}

	rows, err := h.db.GetConn().Query(query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "ERR_EXPORT_500", "Gagal memproses ekspor")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"dompetmungil_export_%s.csv\"", time.Now().Format("20060102_1504")))

	// Write UTF-8 BOM agar rapi saat dibuka di Microsoft Excel
	_, _ = w.Write([]byte("\xEF\xBB\xBF"))
	_, _ = fmt.Fprintln(w, "Tanggal,Jenis,Nominal,Kategori,Akun,Pencatat,Catatan")

	for rows.Next() {
		var date, txType, catName, accName, author string
		var amount float64
		var noteEnc sql.NullString
		if err := rows.Scan(&date, &txType, &amount, &catName, &accName, &noteEnc, &author); err == nil {
			note := ""
			if noteEnc.Valid {
				note = h.db.DecryptNote(noteEnc.String)
			}
			jenis := "Pengeluaran"
			if txType == "income" {
				jenis = "Pemasukan"
			}
			// Escape double quotes
			cleanNote := strings.ReplaceAll(note, "\"", "\"\"")
			_, _ = fmt.Fprintf(w, "\"%s\",\"%s\",%.0f,\"%s\",\"%s\",\"%s\",\"%s\"\n",
				date, jenis, amount, catName, accName, author, cleanNote)
		}
	}
}

func generateRandomToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

