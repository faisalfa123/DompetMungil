/* Universal Indonesian Bank & E-Wallet Statement Import View (100% Client-Side) */

import { state, esc, formatRupiah, toast, refreshAll } from '../store.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import {
  INDONESIAN_BANKS,
  parseUploadedFile,
  detectHeaderAndColumns,
  extractTransactionsFromTable,
  parseRawTextMutasi,
} from '../bank-parser.js';

const imp = {
  tab: 'file', // 'file' | 'paste'
  bankId: 'auto',
  targetAccountId: '',
  rawRows: null,
  mapping: null,
  showManualMap: false,
  parsedItems: [],
  statusMsg: '',
  errorMsg: '',
  needsPdfPassword: false,
  pendingFile: null,
  pasteText: '',
  busy: false,
};

function existingClientIds() {
  return new Set(state.transactions.map((t) => t.client_tx_id).filter(Boolean));
}

export function renderBankImport(container, { scene }) {
  if (!imp.targetAccountId && state.accounts.length > 0) {
    const bankAcc = state.accounts.find((a) => a.type === 'bank') || state.accounts[0];
    imp.targetAccountId = bankAcc.id;
  }

  const selectedCount = imp.parsedItems.filter((x) => x.selected).length;
  const dupCount = imp.parsedItems.filter((x) => x.duplicate).length;

  container.innerHTML = `
    <div class="stack-20">
      <section class="card" aria-label="Impor Mutasi Bank Indonesia">
        <div class="card-header">
          <div>
            <h2 class="card-title">Pembaca Mutasi Seluruh Bank Indonesia</h2>
            <p class="card-sub">100% diproses di browser Anda (CSV, Excel .xlsx/.xls, PDF e-Statement ber-password, atau Tempel Teks). Mendukung BCA, BRI, Mandiri, BNI, BSI, BTN, CIMB, Permata, Danamon, Jago, SeaBank, Blu, Neo Bank, GoPay, OVO, DANA, ShopeePay, dan BPD.</p>
          </div>
          <span class="badge badge-income">${icon('lock', 14)} Proses Lokal 100%</span>
        </div>

        <div class="grid-2" style="margin-bottom:14px;">
          <div class="field">
            <label for="imp-bank">Bank / E-Wallet Sumber</label>
            <select id="imp-bank" class="select">
              ${INDONESIAN_BANKS.map((b) => `<option value="${esc(b.id)}" ${imp.bankId === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="imp-account">Simpan ke Dompet / Rekening</label>
            <select id="imp-account" class="select">
              ${state.accounts.map((a) => `<option value="${esc(a.id)}" ${imp.targetAccountId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="segmented" style="max-width:380px;margin-bottom:16px;" role="tablist">
          <button type="button" role="tab" aria-selected="${imp.tab === 'file'}" class="${imp.tab === 'file' ? 'active' : ''}" data-imp-tab="file">Unggah File (CSV / Excel / PDF)</button>
          <button type="button" role="tab" aria-selected="${imp.tab === 'paste'}" class="${imp.tab === 'paste' ? 'active' : ''}" data-imp-tab="paste">Tempel Teks Mutasi</button>
        </div>

        ${imp.tab === 'file' ? `
          <div id="imp-dropzone" class="dropzone">
            <div style="margin-bottom:10px;color:var(--accent);">${icon('upload', 32)}</div>
            <p style="font-weight:700;margin-bottom:6px;">Tarik & letakkan file mutasi di sini, atau pilih dari perangkat</p>
            <p class="card-sub" style="margin-bottom:14px;">Format: .csv, .tsv, .txt, .xlsx, .xls, .pdf (termasuk PDF e-Statement terkunci password)</p>
            <label for="imp-file" class="btn btn-primary">
              ${icon('file', 16)} Pilih File Mutasi
            </label>
            <input id="imp-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf" class="sr-only" />
          </div>

          ${imp.needsPdfPassword ? `
            <form id="imp-pdf-pw-form" class="card" style="margin-top:14px;background:var(--warning-soft);border-color:var(--warning);">
              <p style="font-weight:700;margin-bottom:8px;">PDF e-Statement ini dilindungi kata sandi (misal: DDMMYYYY tanggal lahir).</p>
              <div class="row">
                <label for="imp-pdf-pw" class="sr-only">Kata sandi PDF</label>
                <input id="imp-pdf-pw" type="password" class="input" style="max-width:260px;" placeholder="Masukkan kata sandi PDF..." required />
                <button type="submit" class="btn btn-primary">Buka PDF</button>
              </div>
            </form>
          ` : ''}
        ` : `
          <div class="field">
            <label for="imp-paste">Tempel baris mutasi dari aplikasi m-banking / e-wallet</label>
            <textarea id="imp-paste" class="textarea" placeholder="Contoh:&#10;12/05/2026 QRIS INDOMARET 45.000 DB&#10;13/05/2026 TRANSFER MASUK GAJI 5.500.000 CR">${esc(imp.pasteText)}</textarea>
            <div class="row" style="margin-top:8px;">
              <button type="button" class="btn btn-primary" id="btn-parse-paste">${icon('sparkles', 16)} Baca Teks Mutasi</button>
              <button type="button" class="btn" id="btn-sample-paste">Isi Contoh Mutasi</button>
            </div>
          </div>
        `}

        ${imp.busy ? `<p class="card-sub" style="margin-top:12px;">Sedang membaca dan mengelompokkan mutasi...</p>` : ''}
        ${imp.statusMsg ? `<p style="margin-top:12px;font-weight:700;color:var(--income);">${esc(imp.statusMsg)}</p>` : ''}
        ${imp.errorMsg ? `<p style="margin-top:12px;font-weight:700;color:var(--expense);">${esc(imp.errorMsg)}</p>` : ''}
      </section>

      ${imp.rawRows && imp.mapping ? `
        <section class="card" aria-label="Pemetaan Kolom Manual">
          <div class="card-header">
            <div>
              <h2 class="card-title">Pemetaan Kolom (Otomatis & Manual)</h2>
              <p class="card-sub">Cocok untuk bank daerah (BPD) atau format CSV/Excel kustom</p>
            </div>
            <button type="button" class="btn btn-sm" id="btn-toggle-map">${imp.showManualMap ? 'Sembunyikan Pemetaan' : 'Sesuaikan Kolom Manual'}</button>
          </div>
          ${imp.showManualMap ? renderManualMapper(imp.rawRows, imp.mapping) : ''}
        </section>
      ` : ''}

      ${imp.parsedItems.length > 0 ? `
        <section class="card" aria-label="Pratinjau Hasil Impor">
          <div class="card-header">
            <div>
              <h2 class="card-title">Pratinjau Mutasi (${imp.parsedItems.length} baris ditemukan)</h2>
              <p class="card-sub">${selectedCount} siap diimpor &bull; ${dupCount} terdeteksi duplikat (otomatis dilewati)</p>
            </div>
            <div class="row">
              <button type="button" class="btn btn-sm" id="btn-imp-clear">Bersihkan</button>
              <button type="button" class="btn btn-primary" id="btn-imp-commit" ${selectedCount === 0 || imp.busy ? 'disabled' : ''}>
                ${icon('check', 16)} Impor ${selectedCount} Transaksi
              </button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th><input type="checkbox" id="imp-check-all" aria-label="Pilih semua baris" ${selectedCount === imp.parsedItems.length ? 'checked' : ''} /></th>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Jenis</th>
                  <th>Kategori</th>
                  <th style="text-align:right;">Nominal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${imp.parsedItems.map((it, idx) => `
                  <tr>
                    <td><input type="checkbox" class="imp-row-check" data-idx="${idx}" aria-label="Pilih baris ${idx + 1}" ${it.selected ? 'checked' : ''} /></td>
                    <td class="num" style="white-space:nowrap;">${esc(it.date)}</td>
                    <td style="min-width:180px;">${esc(it.note)}</td>
                    <td>
                      <select class="select imp-row-type" data-idx="${idx}" style="min-height:36px;padding:4px 8px;">
                        <option value="expense" ${it.type === 'expense' ? 'selected' : ''}>Keluar</option>
                        <option value="income" ${it.type === 'income' ? 'selected' : ''}>Masuk</option>
                      </select>
                    </td>
                    <td>
                      <select class="select imp-row-cat" data-idx="${idx}" style="min-height:36px;padding:4px 8px;">
                        ${state.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === it.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                      </select>
                    </td>
                    <td class="num ${it.type === 'income' ? 'text-income' : 'text-expense'}" style="text-align:right;font-weight:700;white-space:nowrap;">
                      ${esc(formatRupiah(it.amount, true))}
                    </td>
                    <td>
                      ${it.duplicate ? '<span class="badge badge-warning">Duplikat</span>' : '<span class="badge badge-income">Baru</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}
    </div>
  `;

  const rerender = () => renderBankImport(container, { scene });

  container.querySelector('#imp-bank')?.addEventListener('change', (e) => { imp.bankId = e.target.value; });
  container.querySelector('#imp-account')?.addEventListener('change', (e) => { imp.targetAccountId = e.target.value; });

  container.querySelectorAll('[data-imp-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      imp.tab = btn.getAttribute('data-imp-tab');
      imp.errorMsg = '';
      rerender();
    });
  });

  async function handleFile(file, password = '') {
    imp.busy = true;
    imp.errorMsg = '';
    imp.statusMsg = '';
    imp.needsPdfPassword = false;
    imp.pendingFile = file;
    rerender();

    try {
      const res = await parseUploadedFile(file, password);
      if (imp.bankId === 'auto' && res.detectedBank && res.detectedBank !== 'auto') {
        imp.bankId = res.detectedBank;
      }
      if (res.kind === 'table') {
        imp.rawRows = res.rows;
        imp.mapping = detectHeaderAndColumns(res.rows);
        imp.parsedItems = await extractTransactionsFromTable(res.rows, imp.mapping, state.rules, state.categories, existingClientIds());
        imp.showManualMap = imp.parsedItems.length === 0;
      } else {
        imp.rawRows = null;
        imp.mapping = null;
        imp.parsedItems = await parseRawTextMutasi(res.text, state.rules, state.categories, existingClientIds());
      }
      const bankLabel = INDONESIAN_BANKS.find((b) => b.id === imp.bankId)?.name || 'Bank';
      imp.statusMsg = `Berhasil membaca ${imp.parsedItems.length} transaksi dari ${file.name} (${bankLabel}).`;
    } catch (err) {
      if (err && (err.name === 'PasswordException' || String(err.message || '').toLowerCase().includes('password'))) {
        imp.needsPdfPassword = true;
        imp.errorMsg = 'File PDF membutuhkan kata sandi untuk dibuka.';
      } else {
        imp.errorMsg = err.message || 'Gagal membaca file mutasi.';
      }
    } finally {
      imp.busy = false;
      rerender();
    }
  }

  container.querySelector('#imp-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  });

  const dz = container.querySelector('#imp-dropzone');
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });
  }

  container.querySelector('#imp-pdf-pw-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = container.querySelector('#imp-pdf-pw')?.value || '';
    if (imp.pendingFile) handleFile(imp.pendingFile, pw);
  });

  container.querySelector('#imp-paste')?.addEventListener('input', (e) => { imp.pasteText = e.target.value; });

  container.querySelector('#btn-sample-paste')?.addEventListener('click', () => {
    imp.pasteText = [
      '01/05/2026 TRANSFER MASUK GAJI BULANAN 6.500.000 CR',
      '02/05/2026 QRIS INDOMARET KEMANG 78.500 DB',
      '03/05/2026 BAYAR TAGIHAN LISTRIK PLN 425.000 DB',
      '04/05/2026 GOFOOD KOPI KENANGAN 54.000 DB',
      '05/05/2026 TARIK TUNAI ATM BCA 500.000 DB',
    ].join('\n');
    rerender();
  });

  container.querySelector('#btn-parse-paste')?.addEventListener('click', async () => {
    if (!imp.pasteText.trim()) {
      imp.errorMsg = 'Tempel teks mutasi terlebih dahulu.';
      rerender();
      return;
    }
    imp.busy = true;
    imp.errorMsg = '';
    rerender();
    try {
      imp.rawRows = null;
      imp.mapping = null;
      imp.parsedItems = await parseRawTextMutasi(imp.pasteText, state.rules, state.categories, existingClientIds());
      imp.statusMsg = `Berhasil membaca ${imp.parsedItems.length} baris dari teks mutasi.`;
    } catch (err) {
      imp.errorMsg = err.message;
    } finally {
      imp.busy = false;
      rerender();
    }
  });

  container.querySelector('#btn-toggle-map')?.addEventListener('click', () => {
    imp.showManualMap = !imp.showManualMap;
    rerender();
  });

  container.querySelector('#btn-apply-map')?.addEventListener('click', async () => {
    const getVal = (id) => parseInt(container.querySelector(id)?.value ?? '-1', 10);
    imp.mapping = {
      headerIdx: getVal('#map-header'),
      dateCol: getVal('#map-date'),
      noteCol: getVal('#map-note'),
      debitCol: getVal('#map-debit'),
      creditCol: getVal('#map-credit'),
      amountCol: getVal('#map-amount'),
      typeCol: getVal('#map-type'),
    };
    imp.parsedItems = await extractTransactionsFromTable(imp.rawRows, imp.mapping, state.rules, state.categories, existingClientIds());
    imp.statusMsg = `Pemetaan manual diterapkan: ${imp.parsedItems.length} transaksi terbaca.`;
    rerender();
  });

  container.querySelector('#imp-check-all')?.addEventListener('change', (e) => {
    imp.parsedItems.forEach((it) => { it.selected = e.target.checked; });
    rerender();
  });

  container.querySelectorAll('.imp-row-check').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const idx = parseInt(cb.getAttribute('data-idx'), 10);
      imp.parsedItems[idx].selected = e.target.checked;
      rerender();
    });
  });

  container.querySelectorAll('.imp-row-type').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(sel.getAttribute('data-idx'), 10);
      imp.parsedItems[idx].type = e.target.value;
      rerender();
    });
  });

  container.querySelectorAll('.imp-row-cat').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(sel.getAttribute('data-idx'), 10);
      imp.parsedItems[idx].category_id = e.target.value;
    });
  });

  container.querySelector('#btn-imp-clear')?.addEventListener('click', () => {
    imp.parsedItems = [];
    imp.rawRows = null;
    imp.mapping = null;
    imp.statusMsg = '';
    imp.errorMsg = '';
    rerender();
  });

  container.querySelector('#btn-imp-commit')?.addEventListener('click', async () => {
    const batch = imp.parsedItems
      .filter((x) => x.selected)
      .map((x) => ({
        client_tx_id: x.client_tx_id,
        account_id: imp.targetAccountId,
        category_id: x.category_id,
        type: x.type,
        amount: x.amount,
        date: x.date,
        note: x.note,
      }));
    if (batch.length === 0) return;

    imp.busy = true;
    rerender();
    try {
      const res = await api.syncBatch(batch);
      toast(res.message || `${batch.length} transaksi berhasil diimpor.`);
      imp.parsedItems = [];
      imp.rawRows = null;
      imp.mapping = null;
      imp.statusMsg = res.message || 'Impor selesai.';
      await refreshAll(scene);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      imp.busy = false;
      rerender();
    }
  });
}

function renderManualMapper(rows, mapping) {
  const headerRow = rows[mapping.headerIdx] || rows[0] || [];
  const colOpts = (selected) => {
    const base = `<option value="-1" ${selected === -1 ? 'selected' : ''}>-- Tidak dipakai --</option>`;
    return base + headerRow.map((h, i) => `<option value="${i}" ${selected === i ? 'selected' : ''}>Kolom ${i + 1}: ${esc(String(h || '').slice(0, 28))}</option>`).join('');
  };

  return `
    <div class="grid-3" style="margin-bottom:12px;">
      <div class="field">
        <label for="map-header">Baris Header (0 = baris pertama)</label>
        <input id="map-header" type="number" min="0" max="${Math.max(0, rows.length - 1)}" class="input" value="${mapping.headerIdx}" />
      </div>
      <div class="field">
        <label for="map-date">Kolom Tanggal</label>
        <select id="map-date" class="select">${colOpts(mapping.dateCol)}</select>
      </div>
      <div class="field">
        <label for="map-note">Kolom Keterangan</label>
        <select id="map-note" class="select">${colOpts(mapping.noteCol)}</select>
      </div>
      <div class="field">
        <label for="map-debit">Kolom Debit (Keluar)</label>
        <select id="map-debit" class="select">${colOpts(mapping.debitCol)}</select>
      </div>
      <div class="field">
        <label for="map-credit">Kolom Kredit (Masuk)</label>
        <select id="map-credit" class="select">${colOpts(mapping.creditCol)}</select>
      </div>
      <div class="field">
        <label for="map-amount">Kolom Nominal Tunggal</label>
        <select id="map-amount" class="select">${colOpts(mapping.amountCol)}</select>
      </div>
      <div class="field">
        <label for="map-type">Kolom DB/CR (Opsional)</label>
        <select id="map-type" class="select">${colOpts(mapping.typeCol)}</select>
      </div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" id="btn-apply-map">${icon('check', 16)} Terapkan Pemetaan</button>
  `;
}
