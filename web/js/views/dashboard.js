/* Dashboard View (Beranda) */

import { state, esc, formatRupiah, formatDateId, formatMonthId, toast, refreshAll } from '../store.js';
import { api } from '../api.js';
import { icon, ghibliMascot } from '../icons.js';

function renderCategoryChart(monthTxs) {
  const byCat = new Map();
  let totalExp = 0;
  for (const tx of monthTxs) {
    if (tx.type !== 'expense') continue;
    totalExp += tx.amount;
    const key = tx.category_name || 'Lainnya';
    const cur = byCat.get(key) || { name: key, amount: 0, color: tx.color || '#2A6B4A' };
    cur.amount += tx.amount;
    byCat.set(key, cur);
  }

  const sorted = [...byCat.values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
  if (sorted.length === 0) {
    return `<div class="state-box">
      ${icon('sprout', 28)}
      <p><strong>Belum ada pengeluaran di ${esc(formatMonthId(state.month))}</strong></p>
      <p class="card-sub">Catat transaksi pertama atau impor mutasi bank untuk melihat rincian kategori.</p>
    </div>`;
  }

  const rows = sorted.map((item) => {
    const pct = totalExp > 0 ? Math.round((item.amount / totalExp) * 100) : 0;
    return `<div class="stack-12" style="gap:6px;">
      <div class="row-between">
        <span style="font-weight:700;font-size:0.9rem;">${esc(item.name)}</span>
        <span class="num" style="font-weight:700;font-size:0.88rem;">${esc(formatRupiah(item.amount))} <span class="text-muted">(${pct}%)</span></span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${Math.max(pct, 3)}%;background:${esc(item.color)};"></div>
      </div>
    </div>`;
  }).join('');

  return `<div class="stack-12">${rows}</div>`;
}

export function renderDashboard(container, { openTxModal, navigate, scene }) {
  const ov = state.overview;
  const monthTxs = state.transactions.filter((t) => (t.date || '').startsWith(state.month));
  const recent = state.transactions.slice(0, 6);
  const dueBills = state.bills.filter((b) => b.active && b.last_paid_month !== state.month);
  const activeBudgets = state.budgets.filter((b) => b.budget > 0).slice(0, 4);

  const mood = ov.month_expense > ov.month_income && ov.month_income > 0
    ? 'careful'
    : ov.month_net > 0 ? 'happy' : 'calm';

  const greeting = mood === 'careful'
    ? 'Pengeluaran bulan ini sedikit melebihi pemasukan. Mari tinjau anggaran pelan-pelan.'
    : mood === 'happy'
      ? 'Arus kas bulan ini sehat dan menyisakan tabungan. Pertahankan ritme baik ini.'
      : 'Semua catatan keuangan tersimpan rapi dan terenkripsi di perangkat lokal Anda.';

  container.innerHTML = `
    <section class="hero-card" aria-label="Ringkasan Saldo">
      <div>
        <div class="row-between" style="margin-bottom:4px;">
          <span class="hero-label">Total Saldo Gabungan</span>
          <span class="badge">${esc(formatMonthId(state.month))}</span>
        </div>
        <div class="hero-balance num">${esc(formatRupiah(ov.total_balance))}</div>
        <div class="row" style="gap:10px;">
          ${ghibliMascot(state.settings.theme, mood, 48)}
          <p class="card-sub" style="flex:1;min-width:180px;">${esc(greeting)}</p>
        </div>
      </div>
      <div class="hero-stats">
        <div class="mini-stat">
          <div class="mini-stat-label">Pemasukan Bulan Ini</div>
          <div class="mini-stat-val num text-income">${esc(formatRupiah(ov.month_income))}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Pengeluaran Bulan Ini</div>
          <div class="mini-stat-val num text-expense">${esc(formatRupiah(ov.month_expense))}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Selisih Bersih</div>
          <div class="mini-stat-val num ${ov.month_net >= 0 ? 'text-income' : 'text-expense'}">${esc(formatRupiah(ov.month_net))}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Celengan Impian</div>
          <div class="mini-stat-val num">${esc(formatRupiah(ov.goals_total))}</div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-bottom:20px;" aria-label="Daftar Dompet dan Rekening">
      <div class="card-header">
        <div>
          <h2 class="card-title">Dompet & Rekening</h2>
          <p class="card-sub">Saldo real-time dari setiap kantong keuangan Anda</p>
        </div>
        <button type="button" class="btn btn-sm btn-soft" data-action="go-settings">
          ${icon('settings', 16)} Kelola Dompet
        </button>
      </div>
      <div class="grid-3">
        ${state.accounts.map((acc) => `
          <div class="mini-stat" style="display:flex;align-items:center;gap:12px;">
            <div class="tx-icon" style="background:${esc(acc.color || '#2A6B4A')};">
              ${icon(acc.icon || 'wallet', 18)}
            </div>
            <div style="min-width:0;flex:1;">
              <div class="mini-stat-label" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(acc.name)}</div>
              <div class="mini-stat-val num">${esc(formatRupiah(acc.balance))}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <div class="grid-main-side">
      <div class="stack-20">
        ${(() => {
          const days = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const iso = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString('id-ID', { weekday: 'short' });
            const total = state.transactions
              .filter((t) => t.type === 'expense' && t.date === iso)
              .reduce((sum, t) => sum + t.amount, 0);
            days.push({ iso, label, total });
          }
          const maxVal = Math.max(...days.map((d) => d.total), 1);
          return `
            <section class="card" aria-label="Grafik Pengeluaran Mingguan">
              <div class="card-header">
                <div>
                  <h2 class="card-title">Pengeluaran 7 Hari Terakhir</h2>
                  <p class="card-sub">Visualisasi cepat arus keluar harian</p>
                </div>
              </div>
              <div class="svg-chart-wrap">
                <svg viewBox="0 0 350 110" class="svg-bar-chart" role="img" aria-label="Grafik batang pengeluaran 7 hari terakhir">
                  ${days.map((d, idx) => {
                    const barH = Math.max(4, Math.round((d.total / maxVal) * 70));
                    const x = idx * 50 + 10;
                    const y = 82 - barH;
                    const isToday = idx === 6;
                    return `
                      <g class="chart-bar-group">
                        <title>${esc(d.label)} (${esc(d.iso)}): ${esc(formatRupiah(d.total))}</title>
                        <rect x="${x}" y="${y}" width="30" height="${barH}" rx="6"
                          fill="${isToday ? 'var(--accent, #2F6F4E)' : 'var(--accent-soft, #A7D7B8)'}" />
                        <text x="${x + 15}" y="100" text-anchor="middle" font-size="10" fill="var(--ink-muted, #666)">${esc(d.label)}</text>
                      </g>
                    `;
                  }).join('')}
                </svg>
              </div>
            </section>
          `;
        })()}
        <section class="card" aria-label="Pengeluaran per Kategori">
          <div class="card-header">
            <div>
              <h2 class="card-title">Rincian Pengeluaran (${esc(formatMonthId(state.month))})</h2>
              <p class="card-sub">Proporsi kategori pengeluaran terbesar bulan ini</p>
            </div>
            <button type="button" class="btn btn-sm" data-action="go-print">
              ${icon('printer', 16)} Cetak Laporan
            </button>
          </div>
          ${(() => {
            const expTxs = monthTxs.filter((t) => t.type === 'expense');
            const totalExp = expTxs.reduce((s, t) => s + t.amount, 0);
            if (totalExp <= 0) return '';
            const byCat = {};
            expTxs.forEach((t) => {
              const k = t.category_name || 'Lainnya';
              if (!byCat[k]) byCat[k] = { name: k, amount: 0, color: t.color || '#2F6F4E' };
              byCat[k].amount += t.amount;
            });
            const slices = Object.values(byCat).sort((a, b) => b.amount - a.amount).slice(0, 6);
            const r = 36;
            const circ = 2 * Math.PI * r;
            let offset = 0;
            return `
              <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
                <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="Pie chart penggunaan dana">
                  ${slices.map((s) => {
                    const pct = s.amount / totalExp;
                    const dash = pct * circ;
                    const seg = `<circle cx="50" cy="50" r="${r}" fill="transparent" stroke="${esc(s.color)}" stroke-width="14" stroke-dasharray="${dash} ${circ}" stroke-dashoffset="-${offset}" transform="rotate(-90 50 50)"><title>${esc(s.name)}: ${Math.round(pct * 100)}%</title></circle>`;
                    offset += dash;
                    return seg;
                  }).join('')}
                  <text x="50" y="53" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink, #1f2937)">100%</text>
                </svg>
                <div style="display:flex;flex-wrap:wrap;gap:8px;flex:1;">
                  ${slices.map((s) => `
                    <span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;">
                      <span style="width:10px;height:10px;border-radius:50%;background:${esc(s.color)};display:inline-block;"></span>
                      ${esc(s.name)} (${Math.round((s.amount / totalExp) * 100)}%)
                    </span>
                  `).join('')}
                </div>
              </div>
            `;
          })()}
          ${renderCategoryChart(monthTxs)}
        </section>

        <section class="card" aria-label="Transaksi Terbaru">
          <div class="card-header">
            <div>
              <h2 class="card-title">Transaksi Terbaru</h2>
              <p class="card-sub">${state.transactions.length} catatan tersimpan</p>
            </div>
            <button type="button" class="btn btn-sm" data-action="go-transactions">
              Lihat Semua
            </button>
          </div>
          ${recent.length === 0 ? `
            <div class="state-box">
              ${icon('book', 28)}
              <p><strong>Belum ada catatan transaksi</strong></p>
              <p class="card-sub">Mulai catat pengeluaran harian atau impor mutasi bank Anda.</p>
              <div class="row">
                <button type="button" class="btn btn-primary btn-sm" data-action="new-tx">${icon('plus', 16)} Catat Transaksi</button>
                <button type="button" class="btn btn-sm" data-action="go-import">${icon('import', 16)} Impor Bank</button>
              </div>
            </div>
          ` : `
            <div class="tx-list">
              ${recent.map((tx) => {
                const sign = tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-';
                const cls = tx.type === 'income' ? 'text-income' : tx.type === 'transfer' ? 'text-info' : 'text-expense';
                const accText = tx.type === 'transfer'
                  ? `${tx.account_name} -> ${tx.to_account_name || 'Rekening lain'}`
                  : tx.account_name;
                return `<div class="tx-row">
                  <div class="tx-icon" style="background:${esc(tx.color || '#2A6B4A')};">
                    ${icon(tx.type === 'transfer' ? 'transfer' : (tx.icon || 'tag'), 18)}
                  </div>
                  <div class="tx-body">
                    <div class="tx-title">${esc(tx.note || tx.category_name || 'Transaksi')}</div>
                    <div class="tx-meta">
                      <span>${esc(formatDateId(tx.date))}</span>
                      <span>&bull;</span>
                      <span>${esc(tx.category_name || (tx.type === 'transfer' ? 'Transfer' : 'Umum'))}</span>
                      <span>&bull;</span>
                      <span>${esc(accText)}</span>
                    </div>
                  </div>
                  <div class="tx-amount num ${cls}">${sign}${esc(formatRupiah(tx.amount))}</div>
                </div>`;
              }).join('')}
            </div>
          `}
        </section>
      </div>

      <div class="stack-20">
        <section class="card" aria-label="Pengingat Tagihan Rutin">
          <div class="card-header">
            <div>
              <h2 class="card-title">Tagihan Rutin Bulan Ini</h2>
              <p class="card-sub">${dueBills.length} belum dicatat</p>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" data-action="go-planning">Atur</button>
          </div>
          ${dueBills.length === 0 ? `
            <p class="card-sub">Semua tagihan rutin bulan ini sudah beres atau belum ada jadwal tagihan.</p>
          ` : `
            <div class="stack-12">
              ${dueBills.slice(0, 4).map((b) => `
                <div class="mini-stat row-between">
                  <div>
                    <div style="font-weight:700;font-size:0.9rem;">${esc(b.title)}</div>
                    <div class="card-sub">Tgl ${b.due_day} &bull; ${esc(formatRupiah(b.amount))}</div>
                  </div>
                  <button type="button" class="btn btn-sm btn-soft" data-pay-bill="${esc(b.id)}">Catat</button>
                </div>
              `).join('')}
            </div>
          `}
        </section>

        <section class="card" aria-label="Pantauan Anggaran">
          <div class="card-header">
            <div>
              <h2 class="card-title">Pantauan Anggaran</h2>
              <p class="card-sub">Batas pengeluaran bulan ini</p>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" data-action="go-planning">Semua</button>
          </div>
          ${activeBudgets.length === 0 ? `
            <p class="card-sub">Belum ada anggaran bulanan yang dipasang. Buka menu Rencana untuk mengatur batas pengeluaran per kategori.</p>
          ` : `
            <div class="stack-12">
              ${activeBudgets.map((b) => {
                const pct = b.budget > 0 ? Math.min(100, Math.round((b.spent / b.budget) * 100)) : 0;
                const fillCls = b.spent > b.budget ? 'over' : pct >= 80 ? 'warn' : '';
                return `<div class="stack-12" style="gap:5px;">
                  <div class="row-between">
                    <span style="font-weight:700;font-size:0.86rem;">${esc(b.name)}</span>
                    <span class="num card-sub">${esc(formatRupiah(b.spent))} / ${esc(formatRupiah(b.budget))}</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill ${fillCls}" style="width:${pct}%;"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          `}
        </section>
      </div>
    </div>
  `;

  container.querySelector('[data-action="go-settings"]')?.addEventListener('click', () => navigate('settings'));
  container.querySelector('[data-action="go-print"]')?.addEventListener('click', () => navigate('print'));
  container.querySelector('[data-action="go-transactions"]')?.addEventListener('click', () => navigate('transactions'));
  container.querySelector('[data-action="go-import"]')?.addEventListener('click', () => navigate('import'));
  container.querySelector('[data-action="new-tx"]')?.addEventListener('click', () => openTxModal());
  container.querySelectorAll('[data-action="go-planning"]').forEach((btn) =>
    btn.addEventListener('click', () => navigate('planning')),
  );

  container.querySelectorAll('[data-pay-bill]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-pay-bill');
      btn.disabled = true;
      try {
        await api.payBill(id);
        toast('Tagihan rutin berhasil dicatat sebagai transaksi.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });
}
