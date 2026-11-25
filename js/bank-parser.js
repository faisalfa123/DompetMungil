/* 100% Client-Side Indonesian Bank & E-Wallet Statement Parser
 * Supports: CSV/TSV/TXT, Excel (.xlsx/.xls via lazy SheetJS), PDF e-Statement (via lazy PDF.js + password),
 * Paste Text Mutasi, Auto-detection for 17 Indonesian banks/e-wallets, Manual Column Mapping,
 * SHA-256 deduplication, and user-editable auto-category rules.
 */

export const INDONESIAN_BANKS = [
  { id: 'auto', name: 'Deteksi Otomatis (Semua Bank & E-Wallet)' },
  { id: 'bca', name: 'BCA (KlikBCA / myBCA)' },
  { id: 'bri', name: 'BRI / BRImo' },
  { id: 'mandiri', name: 'Bank Mandiri / Livin' },
  { id: 'bni', name: 'BNI / wondr' },
  { id: 'bsi', name: 'BSI (Bank Syariah Indonesia)' },
  { id: 'btn', name: 'BTN' },
  { id: 'cimb', name: 'CIMB Niaga / OCTO' },
  { id: 'permata', name: 'Bank Permata' },
  { id: 'danamon', name: 'Bank Danamon' },
  { id: 'jago', name: 'Bank Jago' },
  { id: 'seabank', name: 'SeaBank' },
  { id: 'blu', name: 'blu by BCA Digital' },
  { id: 'neobank', name: 'Neo Bank (BNC)' },
  { id: 'gopay', name: 'GoPay' },
  { id: 'ovo', name: 'OVO' },
  { id: 'dana', name: 'DANA' },
  { id: 'shopeepay', name: 'ShopeePay' },
  { id: 'other', name: 'Bank Daerah (BPD) / Lainnya (Pemetaan Manual)' },
];

const ID_MONTHS = {
  jan: '01', januari: '01',
  feb: '02', februari: '02',
  mar: '03', maret: '03',
  apr: '04', april: '04',
  mei: '05', may: '05',
  jun: '06', juni: '06',
  jul: '07', juli: '07',
  agu: '08', ags: '08', agustus: '08', aug: '08',
  sep: '09', sept: '09', september: '09',
  okt: '10', oct: '10', oktober: '10',
  nov: '11', november: '11',
  des: '12', dec: '12', desember: '12',
};

function loadScriptOnce(url, globalCheck) {
  if (globalCheck()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Gagal memuat pustaka: ${url}`)));
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Gagal memuat pustaka offline/CDN: ${url}. Gunakan format CSV atau tempel teks mutasi.`));
    document.head.appendChild(s);
  });
}

export async function ensureSheetJS() {
  await loadScriptOnce(
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    () => typeof window.XLSX !== 'undefined',
  );
  return window.XLSX;
}

export async function ensurePdfJS() {
  await loadScriptOnce(
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    () => typeof window.pdfjsLib !== 'undefined',
  );
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
  return window.pdfjsLib;
}

export function detectBankFromText(text) {
  const low = (text || '').toLowerCase();
  if (low.includes('bank central asia') || low.includes('klikbca') || low.includes('mybca') || low.includes('trsf e-banking')) return 'bca';
  if (low.includes('bank rakyat indonesia') || low.includes('brimo') || low.includes('briva')) return 'bri';
  if (low.includes('bank mandiri') || low.includes('livin') || low.includes('mcm ')) return 'mandiri';
  if (low.includes('bank negara indonesia') || low.includes('bni ') || low.includes('wondr')) return 'bni';
  if (low.includes('syariah indonesia') || low.includes('bsi mobile') || low.includes('byond')) return 'bsi';
  if (low.includes('bank tabungan negara') || low.includes('btn ')) return 'btn';
  if (low.includes('cimb niaga') || low.includes('octo mobile')) return 'cimb';
  if (low.includes('bank permata') || low.includes('permatame')) return 'permata';
  if (low.includes('danamon')) return 'danamon';
  if (low.includes('bank jago') || low.includes('kantong jago')) return 'jago';
  if (low.includes('seabank')) return 'seabank';
  if (low.includes('bca digital') || low.includes('bluaccount')) return 'blu';
  if (low.includes('neo commerce') || low.includes('neobank')) return 'neobank';
  if (low.includes('gopay')) return 'gopay';
  if (low.includes('ovo ')) return 'ovo';
  if (low.includes('dana ')) return 'dana';
  if (low.includes('shopeepay')) return 'shopeepay';
  return 'auto';
}

export function parseIndonesianDate(raw, fallbackYear = new Date().getFullYear()) {
  if (!raw) return '';
  const s = String(raw).trim().replace(/['"]/g, '');

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD MMM YYYY or DD MMM YY (Indonesian / English month)
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,10})\s+(\d{2,4})/);
  if (m) {
    const mo = ID_MONTHS[m[2].toLowerCase()];
    if (mo) {
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${year}-${mo}-${m[1].padStart(2, '0')}`;
    }
  }

  // BCA short format DD/MM
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${fallbackYear}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return '';
}

export function parseIndonesianAmount(raw) {
  if (raw === null || raw === undefined) return { amount: 0, hintType: '' };
  let s = String(raw).trim();
  if (!s || s === '-' || s === '0' || s === '0.00' || s === '0,00') {
    return { amount: 0, hintType: '' };
  }

  let hintType = '';
  if (/\b(db|dr|debit|debet|keluar|out)\b/i.test(s) || s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'))) {
    hintType = 'expense';
  } else if (/\b(cr|kredit|credit|masuk|in)\b/i.test(s) || s.startsWith('+')) {
    hintType = 'income';
  }

  // Strip currency and letters
  s = s.replace(/rp\.?|idr|\s|[a-zA-Z()+-]/gi, '');
  if (!s) return { amount: 0, hintType };

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // Indonesian: 1.250.000,50
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US/BCA: 1,250,000.50
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const after = s.length - lastComma - 1;
    if (after === 2) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastDot !== -1) {
    const after = s.length - lastDot - 1;
    if (after === 3) s = s.replace(/\./g, '');
  }

  const val = Math.abs(parseFloat(s));
  return { amount: Number.isFinite(val) ? Math.round(val) : 0, hintType };
}

export function parseDelimitedText(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect delimiter from first 15 lines
  const sample = lines.slice(0, 15).join('\n');
  const counts = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
  };
  let delim = ',';
  if (counts[';'] > counts[delim]) delim = ';';
  if (counts['\t'] > counts[delim]) delim = '\t';

  const rows = [];
  for (const line of lines) {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

export function detectHeaderAndColumns(rows) {
  const headerKeywords = {
    date: ['tanggal', 'tgl', 'date', 'posting date', 'waktu', 'value date', 'transaction date'],
    note: ['keterangan', 'uraian', 'deskripsi', 'description', 'berita', 'remark', 'transaksi', 'catatan', 'detail', 'merchant'],
    debit: ['debit', 'debet', 'keluar', 'pengeluaran', 'uang keluar', 'dr', 'tarik', 'withdrawal'],
    credit: ['kredit', 'credit', 'masuk', 'pemasukan', 'uang masuk', 'cr', 'setor', 'deposit'],
    amount: ['jumlah', 'nominal', 'amount', 'mutasi', 'nilai', 'total'],
    type: ['tipe', 'jenis', 'type', 'db/cr', 'd/c', 'mutasi'],
  };

  let headerIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (row.length < 3) continue;
    let score = 0;
    for (const cell of row) {
      const low = String(cell || '').toLowerCase().trim();
      if (headerKeywords.date.some((k) => low.includes(k))) score += 2;
      if (headerKeywords.note.some((k) => low.includes(k))) score += 2;
      if (headerKeywords.debit.some((k) => low === k || low.includes(k))) score += 2;
      if (headerKeywords.credit.some((k) => low === k || low.includes(k))) score += 2;
      if (headerKeywords.amount.some((k) => low === k || low.includes(k))) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      headerIdx = i;
    }
  }

  const mapping = {
    headerIdx: headerIdx >= 0 ? headerIdx : 0,
    dateCol: -1,
    noteCol: -1,
    debitCol: -1,
    creditCol: -1,
    amountCol: -1,
    typeCol: -1,
  };

  const headerRow = rows[mapping.headerIdx] || [];
  headerRow.forEach((cell, idx) => {
    const low = String(cell || '').toLowerCase().trim();
    if (mapping.dateCol === -1 && headerKeywords.date.some((k) => low.includes(k))) mapping.dateCol = idx;
    else if (mapping.noteCol === -1 && headerKeywords.note.some((k) => low.includes(k))) mapping.noteCol = idx;
    else if (mapping.debitCol === -1 && headerKeywords.debit.some((k) => low === k || low.includes(k))) mapping.debitCol = idx;
    else if (mapping.creditCol === -1 && headerKeywords.credit.some((k) => low === k || low.includes(k))) mapping.creditCol = idx;
    else if (mapping.amountCol === -1 && headerKeywords.amount.some((k) => low === k || low.includes(k))) mapping.amountCol = idx;
    else if (mapping.typeCol === -1 && headerKeywords.type.some((k) => low === k || low.includes(k))) mapping.typeCol = idx;
  });

  // Heuristic fallback if no clear header found
  if (mapping.dateCol === -1 && rows.length > 0) {
    mapping.dateCol = 0;
    mapping.noteCol = Math.min(1, rows[0].length - 1);
    mapping.amountCol = Math.min(2, rows[0].length - 1);
  }

  return mapping;
}

export async function fingerprintTx(date, type, amount, note) {
  const input = `${date}|${type}|${Math.round(amount)}|${String(note || '').trim().toLowerCase().slice(0, 80)}`;
  if (window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder().encode(input);
    const buf = await window.crypto.subtle.digest('SHA-256', enc);
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `ctx_bank_${hex.slice(0, 18)}`;
  }
  // Deterministic FNV-1a fallback when served over plain HTTP LAN IP
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ctx_bank_${(h >>> 0).toString(16).padStart(8, '0')}_${Math.round(amount)}`;
}

export function autoCategorize(note, txType, rules = [], categories = []) {
  const low = String(note || '').toLowerCase();
  const sorted = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const rule of sorted) {
    if (rule.tx_type && rule.tx_type !== 'any' && rule.tx_type !== txType) continue;
    const keywords = String(rule.keyword || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (keywords.some((kw) => low.includes(kw))) {
      return rule.category_id;
    }
  }

  // Fallback category matching txType
  const fallback = categories.find((c) => c.type === txType);
  return fallback ? fallback.id : (txType === 'income' ? 'cat_gaji' : 'cat_belanja');
}

export async function extractTransactionsFromTable(rows, mapping, rules, categories, existingIds = new Set()) {
  const results = [];
  const startRow = mapping.headerIdx >= 0 ? mapping.headerIdx + 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;

    const date = parseIndonesianDate(r[mapping.dateCol]);
    if (!date) continue;

    const note = mapping.noteCol >= 0 ? String(r[mapping.noteCol] || '').trim() : '';
    let amount = 0;
    let type = 'expense';

    if (mapping.debitCol >= 0 || mapping.creditCol >= 0) {
      const deb = mapping.debitCol >= 0 ? parseIndonesianAmount(r[mapping.debitCol]) : { amount: 0 };
      const cre = mapping.creditCol >= 0 ? parseIndonesianAmount(r[mapping.creditCol]) : { amount: 0 };
      if (cre.amount > 0 && deb.amount === 0) {
        amount = cre.amount;
        type = 'income';
      } else if (deb.amount > 0) {
        amount = deb.amount;
        type = 'expense';
      }
    }

    if (amount === 0 && mapping.amountCol >= 0) {
      const parsed = parseIndonesianAmount(r[mapping.amountCol]);
      amount = parsed.amount;
      if (parsed.hintType) type = parsed.hintType;
      if (mapping.typeCol >= 0) {
        const tStr = String(r[mapping.typeCol] || '').toLowerCase();
        if (/\b(cr|kredit|credit|masuk|in)\b/.test(tStr)) type = 'income';
        else if (/\b(db|dr|debit|debet|keluar|out)\b/.test(tStr)) type = 'expense';
      }
    }

    if (amount <= 0) continue;

    const cleanNote = note || 'Mutasi Bank';
    const client_tx_id = await fingerprintTx(date, type, amount, cleanNote);
    const category_id = autoCategorize(cleanNote, type, rules, categories);

    results.push({
      client_tx_id,
      date,
      type,
      amount,
      note: cleanNote,
      category_id,
      duplicate: existingIds.has(client_tx_id),
      selected: !existingIds.has(client_tx_id),
    });
  }

  return results;
}

export async function parseRawTextMutasi(text, rules, categories, existingIds = new Set()) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const results = [];
  const dateRegex = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Ags|Aug|Sep|Okt|Oct|Nov|Des|Dec)[a-z]*\s+\d{2,4}|\b\d{1,2}\/\d{1,2}\b)/i;
  const amountRegex = /(?:rp\.?\s*)?([+-]?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|[+-]?\d+(?:[.,]\d{2}))\s*(db|cr|dr|debit|kredit)?/gi;

  for (const line of lines) {
    const dm = line.match(dateRegex);
    if (!dm) continue;
    const date = parseIndonesianDate(dm[1]);
    if (!date) continue;

    const matches = [...line.matchAll(amountRegex)];
    if (matches.length === 0) continue;

    // Usually the transaction amount is the first large amount (or second-to-last if trailing balance exists)
    let chosen = matches[0];
    if (matches.length >= 2) {
      const hasMarker = matches.find((m) => m[2]);
      chosen = hasMarker || matches[matches.length - 2];
    }

    const parsed = parseIndonesianAmount(`${chosen[1]} ${chosen[2] || ''}`);
    if (parsed.amount <= 0) continue;

    let type = parsed.hintType || 'expense';
    if (/\b(cr|kredit|credit|masuk|terima|setor|gaji|bunga)\b/i.test(line) && !/\b(db|debit|debet|keluar|bayar|tarik)\b/i.test(line)) {
      type = 'income';
    }

    let note = line.replace(dm[0], '').replace(chosen[0], '').replace(/\s+/g, ' ').trim();
    if (!note) note = 'Mutasi Teks';

    const client_tx_id = await fingerprintTx(date, type, parsed.amount, note);
    const category_id = autoCategorize(note, type, rules, categories);

    results.push({
      client_tx_id,
      date,
      type,
      amount: parsed.amount,
      note,
      category_id,
      duplicate: existingIds.has(client_tx_id),
      selected: !existingIds.has(client_tx_id),
    });
  }

  return results;
}

export async function parseUploadedFile(file, password = '') {
  const name = (file.name || '').toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await ensureSheetJS();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', raw: false });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    const textSample = rows.slice(0, 15).map((r) => r.join(' ')).join('\n');
    return { kind: 'table', rows, detectedBank: detectBankFromText(textSample) };
  }

  if (name.endsWith('.pdf')) {
    const pdfjsLib = await ensurePdfJS();
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buf, password: password || undefined });
    const pdf = await loadingTask.promise;
    const allLines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      // Group text items by vertical Y coordinate so table rows stay on one line
      const byY = new Map();
      for (const item of tc.items) {
        const y = Math.round(item.transform[5] / 4) * 4;
        if (!byY.has(y)) byY.set(y, []);
        byY.get(y).push({ x: item.transform[4], str: item.str });
      }
      const sortedYs = [...byY.keys()].sort((a, b) => b - a);
      for (const y of sortedYs) {
        const rowText = byY.get(y).sort((a, b) => a.x - b.x).map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
        if (rowText) allLines.push(rowText);
      }
    }
    const fullText = allLines.join('\n');
    return { kind: 'text', text: fullText, detectedBank: detectBankFromText(fullText) };
  }

  // Default: CSV / TSV / TXT
  const text = await file.text();
  const rows = parseDelimitedText(text);
  const detectedBank = detectBankFromText(text.slice(0, 1500));
  if (rows.length > 0 && rows.some((r) => r.length >= 3)) {
    return { kind: 'table', rows, detectedBank };
  }
  return { kind: 'text', text, detectedBank };
}
