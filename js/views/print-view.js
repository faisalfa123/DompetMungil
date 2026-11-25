/* Studio Cetak Cantik (Client-Side Print & Save PDF Studio) */

import { state, esc, formatRupiah, formatDateId } from '../store.js';
import { icon, ghibliMascot } from '../icons.js';

const printState = {
  template: 'ghibli', // 'ghibli' | 'formal' | 'receipt'
  startDate: `${new Date().toISOString().slice(0, 7)}-01`,
  endDate: new Date().toISOString().slice(0, 10),
  accountId: '',
  categoryId: '',
  customTitle: '',
};

function buildSvgSpendingChart(txs) {
  const byCat = new Map();
  let total = 0;
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    total += t.amount;
    const k = t.category_name || 'Lainnya';
    const cur = byCat.get(k) || { name: k, amount: 0, color: t.color || '#2A6B4A' };
    cur.amount += t.amount;
    byCat.set(k, cur);
  }
  const items = [...byCat.values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
  if (items.length === 0) return '';

  const barH = 22;
  const gap = 10;
  const height = items.length * (barH + gap) + 12;
  const maxVal = items[0].amount || 1;

  const bars = items.map((it, i) => {
    const y = i * (barH + gap) + 4;
    const w = Math.max(8, Math.round((it.amount / maxVal) * 280));
    const pct = total > 0 ? Math.round((it.amount / total) * 100) : 0;
    return `
      <text x="0" y="${y + 15}" font-size="11" fill="#1F2D24" font-family="sans-serif">${esc(it.name.slice(0, 22))}</text>
      <rect x="155" y="${y + 2}" width="${w}" height="16" rx="6" fill="${esc(it.color)}" />
      <text x="${162 + w}" y="${y + 15}" font-size="11" fill="#475A4D" font-family="sans-serif">${esc(formatRupiah(it.amount, true))} (${pct}%)</text>
    `;
  }).join('');

  return `<svg width="100%" viewBox="0 0 600 ${height}" role="img" aria-label="Grafik pengeluaran per kategori" style="max-width:600px;display:block;margin:12px 0;">
    ${bars}
  </svg>`;
}

export function renderPrintStudio(container) {
  const title = printState.customTitle || state.settings.family_title || 'DompetMungil';
  const subtitle = state.settings.family_subtitle || 'Laporan Keuangan Keluarga';

  const filtered = state.transactions.filter((t) => {
    if (printState.startDate && t.date < printState.startDate) return false;
    if (printState.endDate && t.date > printState.endDate) return false;
    if (printState.accountId && t.account_id !== printState.accountId && t.to_account_id !== printState.accountId) return false;
    if (printState.categoryId && t.category_id !== printState.categoryId) return false;
    return true;
  });

  const totalIn = filtered.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalOut = filtered.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const net = totalIn - totalOut;

  container.innerHTML = `
    <div class="stack-20">
      <section class="card no-print" aria-label="Pengaturan Studio Cetak">
        <div class="card-header">
          <div>
            <h2 class="card-title">Studio Cetak Cantik</h2>
            <p class="card-sub">Pilih gaya laporan, atur rentang tanggal, lalu cetak langsung atau simpan sebagai PDF</p>
          </div>
          <button type="button" class="btn btn-primary" id="btn-print-now">
            ${icon('printer', 18)} Cetak / Simpan PDF
          </button>
        </div>

        <div class="grid-3" style="margin-bottom:14px;">
          <div class="field">
            <label for="pr-style">Gaya Cetak</label>
            <select id="pr-style" class="select">
              <option value="ghibli" ${printState.template === 'ghibli' ? 'selected' : ''}>Jurnal Cat Air Ghibli (A4 + Grafik)</option>
              <option value="formal" ${printState.template === 'formal' ? 'selected' : ''}>Laporan Formal Keluarga (A4 Rapi)</option>
              <option value="receipt" ${printState.template === 'receipt' ? 'selected' : ''}>Ringkasan Struk Hemat Kertas (80mm)</option>
            </select>
          </div>
          <div class="field">
            <label for="pr-start">Dari Tanggal</label>
            <input id="pr-start" type="date" class="input" value="${esc(printState.startDate)}" />
          </div>
          <div class="field">
            <label for="pr-end">Sampai Tanggal</label>
            <input id="pr-end" type="date" class="input" value="${esc(printState.endDate)}" />
          </div>
          <div class="field">
            <label for="pr-acc">Filter Dompet</label>
            <select id="pr-acc" class="select">
              <option value="">Semua Dompet</option>
              ${state.accounts.map((a) => `<option value="${esc(a.id)}" ${printState.accountId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="pr-cat">Filter Kategori</label>
            <select id="pr-cat" class="select">
              <option value="">Semua Kategori</option>
              ${state.categories.map((c) => `<option value="${esc(c.id)}" ${printState.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="pr-title">Judul Header Laporan</label>
            <input id="pr-title" type="text" class="input" value="${esc(title)}" />
          </div>
        </div>
      </section>

      <article class="print-paper style-${esc(printState.template)}" aria-label="Pratinjau Kertas Cetak">
        ${printState.template === 'receipt' ? renderReceiptBody(title, filtered, totalIn, totalOut, net) : renderA4Body(title, subtitle, filtered, totalIn, totalOut, net)}
      </article>
    </div>
  `;

  const rerender = () => renderPrintStudio(container);
  container.querySelector('#pr-style')?.addEventListener('change', (e) => { printState.template = e.target.value; rerender(); });
  container.querySelector('#pr-start')?.addEventListener('change', (e) => { printState.startDate = e.target.value; rerender(); });
  container.querySelector('#pr-end')?.addEventListener('change', (e) => { printState.endDate = e.target.value; rerender(); });
  container.querySelector('#pr-acc')?.addEventListener('change', (e) => { printState.accountId = e.target.value; rerender(); });
  container.querySelector('#pr-cat')?.addEventListener('change', (e) => { printState.categoryId = e.target.value; rerender(); });
  container.querySelector('#pr-title')?.addEventListener('input', (e) => { printState.customTitle = e.target.value; });
  container.querySelector('#btn-print-now')?.addEventListener('click', () => window.print());
}

function renderA4Body(title, subtitle, filtered, totalIn, totalOut, net) {
  const isGhibli = printState.template === 'ghibli';
  return `
    <header style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #D4CBB8;padding-bottom:14px;margin-bottom:18px;gap:12px;">
      <div>
        <h2 style="font-family:var(--font-display);font-size:1.55rem;color:#1F2D24;margin:0;">${esc(title)}</h2>
        <p style="font-size:0.9rem;color:#475A4D;margin-top:4px;">${esc(subtitle)} &bull; Periode ${esc(formatDateId(printState.startDate))} s.d. ${esc(formatDateId(printState.endDate))}</p>
      </div>
      ${isGhibli ? ghibliMascot(state.settings.theme, 'calm', 58) : `<div style="text-align:right;font-size:0.82rem;color:#475A4D;">Dicetak: ${esc(formatDateId(new Date().toISOString().slice(0, 10)))}<br/>${filtered.length} transaksi</div>`}
    </header>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
      <div style="padding:12px;border:1px solid #D4CBB8;border-radius:10px;background:${isGhibli ? '#DFEFE5' : '#F8F8F8'};">
        <div style="font-size:0.78rem;color:#475A4D;font-weight:700;">Total Pemasukan</div>
        <div class="num" style="font-size:1.1rem;font-weight:800;color:#1E6B47;">${esc(formatRupiah(totalIn, true))}</div>
      </div>
      <div style="padding:12px;border:1px solid #D4CBB8;border-radius:10px;background:${isGhibli ? '#F9E3E3' : '#F8F8F8'};">
        <div style="font-size:0.78rem;color:#475A4D;font-weight:700;">Total Pengeluaran</div>
        <div class="num" style="font-size:1.1rem;font-weight:800;color:#B53B3B;">${esc(formatRupiah(totalOut, true))}</div>
      </div>
      <div style="padding:12px;border:1px solid #D4CBB8;border-radius:10px;background:${isGhibli ? '#EDE6D6' : '#F8F8F8'};">
        <div style="font-size:0.78rem;color:#475A4D;font-weight:700;">Selisih Bersih</div>
        <div class="num" style="font-size:1.1rem;font-weight:800;color:#1F2D24;">${esc(formatRupiah(net, true))}</div>
      </div>
    </div>

    ${isGhibli ? `
      <div style="margin-bottom:18px;">
        <h3 style="font-size:0.96rem;color:#1F2D24;margin-bottom:6px;">Ringkasan Pengeluaran per Kategori</h3>
        ${buildSvgSpendingChart(filtered) || '<p style="font-size:0.86rem;color:#55675A;">Tidak ada pengeluaran pada periode ini.</p>'}
      </div>
    ` : ''}

    <table class="data-table" style="color:#1F2D24;">
      <thead>
        <tr>
          <th style="background:#EDE6D6;color:#1F2D24;">Tanggal</th>
          <th style="background:#EDE6D6;color:#1F2D24;">Kategori</th>
          <th style="background:#EDE6D6;color:#1F2D24;">Keterangan</th>
          <th style="background:#EDE6D6;color:#1F2D24;">Dompet</th>
          <th style="background:#EDE6D6;color:#1F2D24;text-align:right;">Nominal</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.length === 0 ? `
          <tr><td colspan="5" style="text-align:center;padding:20px;color:#55675A;">Tidak ada transaksi pada rentang filter ini.</td></tr>
        ` : filtered.map((tx) => {
          const sign = tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-';
          const col = tx.type === 'income' ? '#1E6B47' : tx.type === 'transfer' ? '#2B5B84' : '#B53B3B';
          return `<tr>
            <td class="num" style="white-space:nowrap;">${esc(formatDateId(tx.date))}</td>
            <td>${esc(tx.category_name || (tx.type === 'transfer' ? 'Transfer' : 'Umum'))}</td>
            <td>${esc(tx.note || '-')}</td>
            <td>${esc(tx.account_name || '-')}</td>
            <td class="num" style="text-align:right;font-weight:700;color:${col};white-space:nowrap;">${sign}${esc(formatRupiah(tx.amount, true))}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <footer style="margin-top:24px;padding-top:12px;border-top:1px dashed #C7BDA7;display:flex;justify-content:space-between;font-size:0.8rem;color:#55675A;">
      <span>Dibuat secara lokal dengan DompetMungil</span>
      <span>Dicetak pada ${esc(new Date().toLocaleString('id-ID'))}</span>
    </footer>
  `;
}

function renderReceiptBody(title, filtered, totalIn, totalOut, net) {
  return `
    <div style="text-align:center;border-bottom:1px dashed #475A4D;padding-bottom:10px;margin-bottom:10px;">
      <strong style="font-size:1.1rem;">${esc(title)}</strong><br/>
      <span style="font-size:0.78rem;">${esc(printState.startDate)} s.d. ${esc(printState.endDate)}</span>
    </div>
    <div style="border-bottom:1px dashed #475A4D;padding-bottom:10px;margin-bottom:10px;font-size:0.84rem;">
      <div class="row-between"><span>Pemasukan</span><span class="num">${esc(formatRupiah(totalIn, true))}</span></div>
      <div class="row-between"><span>Pengeluaran</span><span class="num">${esc(formatRupiah(totalOut, true))}</span></div>
      <div class="row-between" style="font-weight:800;margin-top:4px;"><span>Selisih</span><span class="num">${esc(formatRupiah(net, true))}</span></div>
    </div>
    <div style="font-size:0.8rem;display:flex;flex-direction:column;gap:6px;">
      ${filtered.slice(0, 40).map((tx) => `
        <div class="row-between" style="align-items:flex-start;gap:6px;">
          <span style="flex:1;">${esc(tx.date.slice(5))} ${esc((tx.note || tx.category_name).slice(0, 22))}</span>
          <span class="num">${tx.type === 'income' ? '+' : '-'}${esc(formatRupiah(tx.amount, true))}</span>
        </div>
      `).join('')}
    </div>
    <div style="text-align:center;border-top:1px dashed #475A4D;padding-top:10px;margin-top:12px;font-size:0.75rem;">
      Total ${filtered.length} transaksi &bull; DompetMungil
    </div>
  `;
}
