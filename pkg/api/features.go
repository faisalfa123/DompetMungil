package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// POST /api/v1/auth/logout
func (h *APIHandler) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
		return
	}
	token := r.Header.Get("X-Auth-Token")
	h.tokenMu.Lock()
	delete(h.tokens, token)
	h.tokenMu.Unlock()
	_, _ = h.db.GetConn().Exec("DELETE FROM sessions WHERE token = ?", token)
	respondJSON(w, http.StatusOK, map[string]interface{}{"status": "logged_out"})
}

// GET, POST, PUT, DELETE /api/v1/savings-goals
func (h *APIHandler) handleSavingsGoals(w http.ResponseWriter, r *http.Request) {
	conn := h.db.GetConn()
	switch r.Method {
	case http.MethodGet:
		rows, err := conn.Query("SELECT id, title, icon, target_amount, current_amount, color FROM savings_goals ORDER BY created_at ASC")
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_GOALS_500", "Gagal membaca celengan impian")
			return
		}
		defer rows.Close()
		type Goal struct {
			ID            string  `json:"id"`
			Title         string  `json:"title"`
			Icon          string  `json:"icon"`
			TargetAmount  float64 `json:"target_amount"`
			CurrentAmount float64 `json:"current_amount"`
			Color         string  `json:"color"`
		}
		list := make([]Goal, 0)
		for rows.Next() {
			var g Goal
			if rows.Scan(&g.ID, &g.Title, &g.Icon, &g.TargetAmount, &g.CurrentAmount, &g.Color) == nil {
				list = append(list, g)
			}
		}
		respondJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var req struct {
			Action        string  `json:"action"` // optional "add"
			ID            string  `json:"id"`
			Title         string  `json:"title"`
			Icon          string  `json:"icon"`
			TargetAmount  float64 `json:"target_amount"`
			CurrentAmount float64 `json:"current_amount"`
			AddAmount     float64 `json:"add_amount"`
			Color         string  `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "ERR_GOALS_400", "Format data tidak valid")
			return
		}
		if req.Action == "add" && req.ID != "" && req.AddAmount > 0 {
			_, err := conn.Exec("UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ?", req.AddAmount, req.ID)
			if err != nil {
				respondError(w, http.StatusInternalServerError, "ERR_GOALS_500", "Gagal menambah tabungan celengan")
				return
			}
			respondJSON(w, http.StatusOK, map[string]interface{}{"status": "added", "id": req.ID})
			return
		}
		if strings.TrimSpace(req.Title) == "" || req.TargetAmount <= 0 {
			respondError(w, http.StatusBadRequest, "ERR_GOALS_400", "Nama celengan dan target nominal wajib diisi")
			return
		}
		if req.Icon == "" {
			req.Icon = "sprout"
		}
		if req.Color == "" {
			req.Color = "#2F6F4E"
		}
		id := fmt.Sprintf("goal_%d", time.Now().UnixNano())
		_, err := conn.Exec("INSERT INTO savings_goals (id, title, icon, target_amount, current_amount, color) VALUES (?, ?, ?, ?, ?, ?)",
			id, strings.TrimSpace(req.Title), req.Icon, req.TargetAmount, req.CurrentAmount, req.Color)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_GOALS_500", "Gagal menyimpan celengan")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
	case http.MethodPut:
		var req struct {
			ID            string  `json:"id"`
			Title         string  `json:"title"`
			Icon          string  `json:"icon"`
			TargetAmount  float64 `json:"target_amount"`
			CurrentAmount float64 `json:"current_amount"`
			Color         string  `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" || strings.TrimSpace(req.Title) == "" {
			respondError(w, http.StatusBadRequest, "ERR_GOALS_400", "ID dan nama celengan wajib diisi")
			return
		}
		_, err := conn.Exec("UPDATE savings_goals SET title = ?, icon = ?, target_amount = ?, current_amount = ?, color = ? WHERE id = ?",
			strings.TrimSpace(req.Title), req.Icon, req.TargetAmount, req.CurrentAmount, req.Color, req.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_GOALS_500", "Gagal memperbarui celengan")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": req.ID, "status": "updated"})
	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			respondError(w, http.StatusBadRequest, "ERR_GOALS_400", "Parameter id diperlukan")
			return
		}
		_, err := conn.Exec("DELETE FROM savings_goals WHERE id = ?", id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_GOALS_500", "Gagal menghapus celengan")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": id, "status": "deleted"})
	default:
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
	}
}

// GET, POST, PUT, DELETE /api/v1/recurring-bills
func (h *APIHandler) handleRecurringBills(w http.ResponseWriter, r *http.Request) {
	conn := h.db.GetConn()
	switch r.Method {
	case http.MethodGet:
		rows, err := conn.Query(`
			SELECT b.id, b.title, b.amount, b.category_id, COALESCE(c.name, ''), b.account_id, COALESCE(a.name, ''), b.due_day, b.type, b.last_paid_month, b.active
			FROM recurring_bills b
			LEFT JOIN categories c ON b.category_id = c.id
			LEFT JOIN accounts a ON b.account_id = a.id
			ORDER BY b.due_day ASC, b.title ASC
		`)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_BILLS_500", "Gagal membaca tagihan rutin")
			return
		}
		defer rows.Close()
		type Bill struct {
			ID            string  `json:"id"`
			Title         string  `json:"title"`
			Amount        float64 `json:"amount"`
			CategoryID    string  `json:"category_id"`
			CategoryName  string  `json:"category_name"`
			AccountID     string  `json:"account_id"`
			AccountName   string  `json:"account_name"`
			DueDay        int     `json:"due_day"`
			Type          string  `json:"type"`
			LastPaidMonth string  `json:"last_paid_month"`
			Active        bool    `json:"active"`
		}
		list := make([]Bill, 0)
		for rows.Next() {
			var b Bill
			var activeInt int
			if rows.Scan(&b.ID, &b.Title, &b.Amount, &b.CategoryID, &b.CategoryName, &b.AccountID, &b.AccountName, &b.DueDay, &b.Type, &b.LastPaidMonth, &activeInt) == nil {
				b.Active = activeInt == 1
				list = append(list, b)
			}
		}
		respondJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var req struct {
			Action     string  `json:"action"` // optional "pay"
			ID         string  `json:"id"`
			Title      string  `json:"title"`
			Amount     float64 `json:"amount"`
			CategoryID string  `json:"category_id"`
			AccountID  string  `json:"account_id"`
			DueDay     int     `json:"due_day"`
			Type       string  `json:"type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "ERR_BILLS_400", "Format data tagihan salah")
			return
		}
		if req.Action == "pay" && req.ID != "" {
			var title, catID, accID, txType string
			var amt float64
			err := conn.QueryRow("SELECT title, amount, category_id, account_id, type FROM recurring_bills WHERE id = ?", req.ID).
				Scan(&title, &amt, &catID, &accID, &txType)
			if err != nil {
				respondError(w, http.StatusNotFound, "ERR_BILLS_404", "Tagihan rutin tidak ditemukan")
				return
			}
			now := time.Now()
			month := now.Format("2006-01")
			dateStr := now.Format("2006-01-02")
			txID := fmt.Sprintf("tx_bill_%d", now.UnixNano())
			clientTxID := fmt.Sprintf("ctx_bill_%s_%s", req.ID, month)
			noteEnc, _ := h.db.EncryptNote("Tagihan rutin: " + title)
			userID := r.Header.Get("X-Authenticated-ID")

			_, err = conn.Exec(`
				INSERT INTO transactions (id, client_tx_id, account_id, transfer_to_account_id, category_id, type, amount, date, note_enc, user_id)
				VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)
			`, txID, clientTxID, accID, catID, txType, amt, dateStr, noteEnc, userID)
			if err != nil {
				// Jika sudah pernah dicatat bulan ini
				_, _ = conn.Exec("UPDATE recurring_bills SET last_paid_month = ? WHERE id = ?", month, req.ID)
				respondJSON(w, http.StatusOK, map[string]interface{}{"status": "already_paid", "month": month})
				return
			}
			h.applyBalanceDelta(txType, accID, "", amt, 1)
			_, _ = conn.Exec("UPDATE recurring_bills SET last_paid_month = ? WHERE id = ?", month, req.ID)
			respondJSON(w, http.StatusOK, map[string]interface{}{"status": "paid", "tx_id": txID, "month": month})
			return
		}

		if strings.TrimSpace(req.Title) == "" || req.Amount <= 0 {
			respondError(w, http.StatusBadRequest, "ERR_BILLS_400", "Nama tagihan dan nominal wajib diisi")
			return
		}
		if req.DueDay < 1 || req.DueDay > 31 {
			req.DueDay = 1
		}
		if req.Type != "income" && req.Type != "expense" {
			req.Type = "expense"
		}
		id := fmt.Sprintf("bill_%d", time.Now().UnixNano())
		_, err := conn.Exec("INSERT INTO recurring_bills (id, title, amount, category_id, account_id, due_day, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
			id, strings.TrimSpace(req.Title), req.Amount, req.CategoryID, req.AccountID, req.DueDay, req.Type)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_BILLS_500", "Gagal menyimpan tagihan rutin")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
	case http.MethodPut:
		var req struct {
			ID         string  `json:"id"`
			Title      string  `json:"title"`
			Amount     float64 `json:"amount"`
			CategoryID string  `json:"category_id"`
			AccountID  string  `json:"account_id"`
			DueDay     int     `json:"due_day"`
			Type       string  `json:"type"`
			Active     *bool   `json:"active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
			respondError(w, http.StatusBadRequest, "ERR_BILLS_400", "ID tagihan wajib diisi")
			return
		}
		activeInt := 1
		if req.Active != nil && !*req.Active {
			activeInt = 0
		}
		_, err := conn.Exec("UPDATE recurring_bills SET title = ?, amount = ?, category_id = ?, account_id = ?, due_day = ?, type = ?, active = ? WHERE id = ?",
			strings.TrimSpace(req.Title), req.Amount, req.CategoryID, req.AccountID, req.DueDay, req.Type, activeInt, req.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_BILLS_500", "Gagal memperbarui tagihan rutin")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": req.ID, "status": "updated"})
	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			respondError(w, http.StatusBadRequest, "ERR_BILLS_400", "Parameter id diperlukan")
			return
		}
		_, err := conn.Exec("DELETE FROM recurring_bills WHERE id = ?", id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_BILLS_500", "Gagal menghapus tagihan rutin")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": id, "status": "deleted"})
	default:
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
	}
}

// GET, POST, PUT, DELETE /api/v1/category-rules
func (h *APIHandler) handleCategoryRules(w http.ResponseWriter, r *http.Request) {
	conn := h.db.GetConn()
	switch r.Method {
	case http.MethodGet:
		rows, err := conn.Query(`
			SELECT r.id, r.keyword, r.category_id, COALESCE(c.name, ''), r.tx_type, r.priority
			FROM category_rules r
			LEFT JOIN categories c ON r.category_id = c.id
			ORDER BY r.priority DESC, r.created_at ASC
		`)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_RULES_500", "Gagal membaca aturan kategori")
			return
		}
		defer rows.Close()
		type Rule struct {
			ID           string `json:"id"`
			Keyword      string `json:"keyword"`
			CategoryID   string `json:"category_id"`
			CategoryName string `json:"category_name"`
			TxType       string `json:"tx_type"`
			Priority     int    `json:"priority"`
		}
		list := make([]Rule, 0)
		for rows.Next() {
			var item Rule
			if rows.Scan(&item.ID, &item.Keyword, &item.CategoryID, &item.CategoryName, &item.TxType, &item.Priority) == nil {
				list = append(list, item)
			}
		}
		respondJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var req struct {
			Keyword    string `json:"keyword"`
			CategoryID string `json:"category_id"`
			TxType     string `json:"tx_type"`
			Priority   int    `json:"priority"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Keyword) == "" || req.CategoryID == "" {
			respondError(w, http.StatusBadRequest, "ERR_RULES_400", "Kata kunci dan kategori tujuan wajib diisi")
			return
		}
		if req.TxType == "" {
			req.TxType = "any"
		}
		if req.Priority == 0 {
			req.Priority = 10
		}
		id := fmt.Sprintf("rule_%d", time.Now().UnixNano())
		_, err := conn.Exec("INSERT INTO category_rules (id, keyword, category_id, tx_type, priority) VALUES (?, ?, ?, ?, ?)",
			id, strings.ToLower(strings.TrimSpace(req.Keyword)), req.CategoryID, req.TxType, req.Priority)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_RULES_500", "Gagal menambah aturan kategori")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
	case http.MethodPut:
		var req struct {
			ID         string `json:"id"`
			Keyword    string `json:"keyword"`
			CategoryID string `json:"category_id"`
			TxType     string `json:"tx_type"`
			Priority   int    `json:"priority"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
			respondError(w, http.StatusBadRequest, "ERR_RULES_400", "ID aturan wajib diisi")
			return
		}
		_, err := conn.Exec("UPDATE category_rules SET keyword = ?, category_id = ?, tx_type = ?, priority = ? WHERE id = ?",
			strings.ToLower(strings.TrimSpace(req.Keyword)), req.CategoryID, req.TxType, req.Priority, req.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_RULES_500", "Gagal memperbarui aturan")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": req.ID, "status": "updated"})
	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			respondError(w, http.StatusBadRequest, "ERR_RULES_400", "Parameter id diperlukan")
			return
		}
		_, err := conn.Exec("DELETE FROM category_rules WHERE id = ?", id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_RULES_500", "Gagal menghapus aturan")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"id": id, "status": "deleted"})
	default:
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
	}
}

// GET & PUT /api/v1/settings
func (h *APIHandler) handleSettings(w http.ResponseWriter, r *http.Request) {
	conn := h.db.GetConn()
	if r.Method == http.MethodGet {
		rows, err := conn.Query("SELECT key, value FROM app_settings")
		if err != nil {
			respondError(w, http.StatusInternalServerError, "ERR_SETTINGS_500", "Gagal membaca pengaturan")
			return
		}
		defer rows.Close()
		settings := map[string]string{}
		for rows.Next() {
			var k, v string
			if rows.Scan(&k, &v) == nil {
				settings[k] = v
			}
		}
		respondJSON(w, http.StatusOK, settings)
		return
	}
	if r.Method == http.MethodPut || r.Method == http.MethodPost {
		var req map[string]string
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "ERR_SETTINGS_400", "Format pengaturan tidak valid")
			return
		}
		for k, v := range req {
			if strings.TrimSpace(k) == "" {
				continue
			}
			_, _ = conn.Exec("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v)
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"status": "updated"})
		return
	}
	respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
}

type BackupPayload struct {
	Version        string              `json:"version"`
	ExportedAt     string              `json:"exported_at"`
	Settings       map[string]string   `json:"settings"`
	Accounts       []map[string]any    `json:"accounts"`
	Categories     []map[string]any    `json:"categories"`
	Transactions   []map[string]any    `json:"transactions"`
	Budgets        []map[string]any    `json:"budgets"`
	SavingsGoals   []map[string]any    `json:"savings_goals"`
	RecurringBills []map[string]any    `json:"recurring_bills"`
	CategoryRules  []map[string]any    `json:"category_rules"`
}

// GET /api/v1/backup/export
func (h *APIHandler) handleBackupExport(w http.ResponseWriter, r *http.Request) {
	conn := h.db.GetConn()
	payload := BackupPayload{
		Version:        "2.0.0",
		ExportedAt:     time.Now().Format(time.RFC3339),
		Settings:       map[string]string{},
		Accounts:       []map[string]any{},
		Categories:     []map[string]any{},
		Transactions:   []map[string]any{},
		Budgets:        []map[string]any{},
		SavingsGoals:   []map[string]any{},
		RecurringBills: []map[string]any{},
		CategoryRules:  []map[string]any{},
	}

	if rows, err := conn.Query("SELECT key, value FROM app_settings"); err == nil {
		for rows.Next() {
			var k, v string
			if rows.Scan(&k, &v) == nil {
				payload.Settings[k] = v
			}
		}
		rows.Close()
	}
	if rows, err := conn.Query("SELECT id, name, type, balance, COALESCE(icon,''), COALESCE(color,'') FROM accounts"); err == nil {
		for rows.Next() {
			var id, name, typ, icon, color string
			var bal float64
			if rows.Scan(&id, &name, &typ, &bal, &icon, &color) == nil {
				payload.Accounts = append(payload.Accounts, map[string]any{"id": id, "name": name, "type": typ, "balance": bal, "icon": icon, "color": color})
			}
		}
		rows.Close()
	}
	if rows, err := conn.Query("SELECT id, name, type, COALESCE(icon,''), COALESCE(color,'') FROM categories"); err == nil {
		for rows.Next() {
			var id, name, typ, icon, color string
			if rows.Scan(&id, &name, &typ, &icon, &color) == nil {
				payload.Categories = append(payload.Categories, map[string]any{"id": id, "name": name, "type": typ, "icon": icon, "color": color})
			}
		}
		rows.Close()
	}
	if rows, err := conn.Query("SELECT id, COALESCE(client_tx_id,''), account_id, COALESCE(transfer_to_account_id,''), category_id, type, amount, date, COALESCE(note_enc,'') FROM transactions"); err == nil {
		for rows.Next() {
			var id, cid, acc, toAcc, cat, typ, dt, noteEnc string
			var amt float64
			if rows.Scan(&id, &cid, &acc, &toAcc, &cat, &typ, &amt, &dt, &noteEnc) == nil {
				payload.Transactions = append(payload.Transactions, map[string]any{
					"id": id, "client_tx_id": cid, "account_id": acc, "to_account_id": toAcc,
					"category_id": cat, "type": typ, "amount": amt, "date": dt, "note": h.db.DecryptNote(noteEnc),
				})
			}
		}
		rows.Close()
	}
	if rows, err := conn.Query("SELECT id, category_id, amount, period FROM budgets"); err == nil {
		for rows.Next() {
			var id, cat, period string
			var amt float64
			if rows.Scan(&id, &cat, &amt, &period) == nil {
				payload.Budgets = append(payload.Budgets, map[string]any{"id": id, "category_id": cat, "amount": amt, "period": period})
			}
		}
		rows.Close()
	}
	if rows, err := conn.Query("SELECT id, title, icon, target_amount, current_amount, color FROM savings_goals"); err == nil {
		for rows.Next() {
			var id, title, icon, color string
			var target, current float64
			if rows.Scan(&id, &title, &icon, &target, &current, &color) == nil {
				payload.SavingsGoals = append(payload.SavingsGoals, map[string]any{"id": id, "title": title, "icon": icon, "target_amount": target, "current_amount": current, "color": color})
			}
		}
		rows.Close()
	}
	if rows, err := conn.Query("SELECT id, title, amount, category_id, account_id, due_day, type, last_paid_month, active FROM recurring_bills"); err == nil {
		for rows.Next() {
			var id, title, cat, acc, typ, paid string
			var amt float64
			var due, active int
			if rows.Scan(&id, &title, &amt, &cat, &acc, &due, &typ, &paid, &active) == nil {
				payload.RecurringBills = append(payload.RecurringBills, map[string]any{"id": id, "title": title, "amount": amt, "category_id": cat, "account_id": acc, "due_day": due, "type": typ, "last_paid_month": paid, "active": active})
			}
		}
		rows.Close()
	}
	if rows, err := conn.Query("SELECT id, keyword, category_id, tx_type, priority FROM category_rules"); err == nil {
		for rows.Next() {
			var id, kw, cat, typ string
			var prio int
			if rows.Scan(&id, &kw, &cat, &typ, &prio) == nil {
				payload.CategoryRules = append(payload.CategoryRules, map[string]any{"id": id, "keyword": kw, "category_id": cat, "tx_type": typ, "priority": prio})
			}
		}
		rows.Close()
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"dompetmungil_backup_%s.json\"", time.Now().Format("20060102_1504")))
	respondJSON(w, http.StatusOK, payload)
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func asFloat(v any) float64 {
	if f, ok := v.(float64); ok {
		return f
	}
	return 0
}

// POST /api/v1/backup/restore
func (h *APIHandler) handleBackupRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "ERR_METHOD_405", "Metode tidak diizinkan")
		return
	}
	var payload BackupPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, "ERR_RESTORE_400", "File cadangan JSON tidak valid")
		return
	}

	conn := h.db.GetConn()
	tx, err := conn.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "ERR_RESTORE_500", "Gagal memulai transaksi pemulihan")
		return
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	execIgnore := func(stmt *sql.Tx, q string, args ...any) {
		_, _ = stmt.Exec(q, args...)
	}

	if len(payload.Accounts) > 0 {
		execIgnore(tx, "DELETE FROM accounts")
		for _, a := range payload.Accounts {
			execIgnore(tx, "INSERT OR REPLACE INTO accounts (id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?)",
				asString(a["id"]), asString(a["name"]), asString(a["type"]), asFloat(a["balance"]), asString(a["icon"]), asString(a["color"]))
		}
	}
	if len(payload.Categories) > 0 {
		execIgnore(tx, "DELETE FROM categories")
		for _, c := range payload.Categories {
			execIgnore(tx, "INSERT OR REPLACE INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)",
				asString(c["id"]), asString(c["name"]), asString(c["type"]), asString(c["icon"]), asString(c["color"]))
		}
	}
	if len(payload.Transactions) > 0 {
		execIgnore(tx, "DELETE FROM transactions")
		userID := r.Header.Get("X-Authenticated-ID")
		for _, t := range payload.Transactions {
			noteEnc, _ := h.db.EncryptNote(asString(t["note"]))
			cid := asString(t["client_tx_id"])
			if cid == "" {
				cid = asString(t["id"])
			}
			execIgnore(tx, "INSERT OR REPLACE INTO transactions (id, client_tx_id, account_id, transfer_to_account_id, category_id, type, amount, date, note_enc, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				asString(t["id"]), cid, asString(t["account_id"]), asString(t["to_account_id"]), asString(t["category_id"]), asString(t["type"]), asFloat(t["amount"]), asString(t["date"]), noteEnc, userID)
		}
	}
	if len(payload.Budgets) > 0 {
		execIgnore(tx, "DELETE FROM budgets")
		for _, b := range payload.Budgets {
			execIgnore(tx, "INSERT OR REPLACE INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)",
				asString(b["id"]), asString(b["category_id"]), asFloat(b["amount"]), asString(b["period"]))
		}
	}
	if len(payload.SavingsGoals) > 0 {
		execIgnore(tx, "DELETE FROM savings_goals")
		for _, g := range payload.SavingsGoals {
			execIgnore(tx, "INSERT OR REPLACE INTO savings_goals (id, title, icon, target_amount, current_amount, color) VALUES (?, ?, ?, ?, ?, ?)",
				asString(g["id"]), asString(g["title"]), asString(g["icon"]), asFloat(g["target_amount"]), asFloat(g["current_amount"]), asString(g["color"]))
		}
	}
	if len(payload.RecurringBills) > 0 {
		execIgnore(tx, "DELETE FROM recurring_bills")
		for _, b := range payload.RecurringBills {
			execIgnore(tx, "INSERT OR REPLACE INTO recurring_bills (id, title, amount, category_id, account_id, due_day, type, last_paid_month, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
				asString(b["id"]), asString(b["title"]), asFloat(b["amount"]), asString(b["category_id"]), asString(b["account_id"]), int(asFloat(b["due_day"])), asString(b["type"]), asString(b["last_paid_month"]), int(asFloat(b["active"])))
		}
	}
	if len(payload.CategoryRules) > 0 {
		execIgnore(tx, "DELETE FROM category_rules")
		for _, rl := range payload.CategoryRules {
			execIgnore(tx, "INSERT OR REPLACE INTO category_rules (id, keyword, category_id, tx_type, priority) VALUES (?, ?, ?, ?, ?)",
				asString(rl["id"]), asString(rl["keyword"]), asString(rl["category_id"]), asString(rl["tx_type"]), int(asFloat(rl["priority"])))
		}
	}
	for k, v := range payload.Settings {
		execIgnore(tx, "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v)
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "ERR_RESTORE_500", "Gagal menyimpan hasil pemulihan")
		return
	}
	tx = nil
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":       "restored",
		"transactions": len(payload.Transactions),
		"accounts":     len(payload.Accounts),
		"categories":   len(payload.Categories),
	})
}
