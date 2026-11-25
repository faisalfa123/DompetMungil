/* Planning View: Anggaran Bulanan, Celengan Impian, dan Tagihan Rutin */

import { state, esc, formatRupiah, formatMonthId, toast, refreshAll } from '../store.js';
import { api } from '../api.js';
import { icon } from '../icons.js';

export function renderPlanning(container, { scene }) {
  container.innerHTML = `
    <div class="stack-20">
      <section class="card" aria-label="Anggaran Bulanan">
        <div class="card-header">
          <div>
            <h2 class="card-title">Anggaran Bulanan (${esc(formatMonthId(state.month))})</h2>
            <p class="card-sub">Atur batas pengeluaran tiap kategori agar belanja keluarga tetap tenang</p>
          </div>
        </div>
        <div class="grid-2">
          ${state.budgets.map((b) => {
            const pct = b.budget > 0 ? Math.min(100, Math.round((b.spent / b.budget) * 100)) : 0;
            const fillCls = b.budget > 0 && b.spent > b.budget ? 'over' : pct >= 80 ? 'warn' : '';
            return `
              <div class="mini-stat stack-12" style="gap:8px;">
                <div class="row-between">
                  <div class="row" style="gap:8px;">
                    <span class="tx-icon" style="width:32px;height:32px;background:${esc(b.color || '#2A6B4A')};">${icon(b.icon || 'tag', 16)}</span>
                    <strong>${esc(b.name)}</strong>
                  </div>
                  <span class="num card-sub">${esc(formatRupiah(b.spent))} terpakai</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill ${fillCls}" style="width:${pct}%;"></div>
                </div>
                <form class="row" data-budget-form="${esc(b.category_id)}">
                  <label for="bdg-${esc(b.category_id)}" class="sr-only">Anggaran ${esc(b.name)}</label>
                  <input id="bdg-${esc(b.category_id)}" type="number" min="0" step="10000" class="input num" style="flex:1;min-height:38px;" value="${Math.round(b.budget)}" placeholder="Target bulanan (Rp)" />
                  <button type="submit" class="btn btn-sm btn-soft">Simpan</button>
                </form>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <section class="card" aria-label="Celengan Impian">
        <div class="card-header">
          <div>
            <h2 class="card-title">Celengan Impian</h2>
            <p class="card-sub">Tabungan khusus untuk dana darurat, liburan, atau pendidikan anak</p>
          </div>
        </div>
        <form id="goal-create-form" class="grid-3" style="margin-bottom:16px;align-items:end;">
          <div class="field">
            <label for="goal-title">Nama Celengan</label>
            <input id="goal-title" class="input" type="text" placeholder="Misal: Dana Darurat" required />
          </div>
          <div class="field">
            <label for="goal-target">Target (Rp)</label>
            <input id="goal-target" class="input num" type="number" min="1000" step="10000" placeholder="5000000" required />
          </div>
          <div class="field">
            <label for="goal-current">Saldo Awal (Rp)</label>
            <div class="row">
              <input id="goal-current" class="input num" style="flex:1;" type="number" min="0" step="10000" value="0" />
              <button type="submit" class="btn btn-primary">${icon('plus', 16)} Tambah</button>
            </div>
          </div>
        </form>

        ${state.goals.length === 0 ? `
          <div class="state-box">
            ${icon('piggy', 28)}
            <p><strong>Belum ada celengan impian</strong></p>
            <p class="card-sub">Buat target tabungan pertama Anda di formulir atas.</p>
          </div>
        ` : `
          <div class="grid-2">
            ${state.goals.map((g) => {
              const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
              return `
                <div class="mini-stat stack-12" style="gap:10px;">
                  <div class="row-between">
                    <strong>${esc(g.title)}</strong>
                    <span class="badge badge-income">${pct}%</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" style="width:${pct}%;"></div>
                  </div>
                  <div class="row-between card-sub num">
                    <span>Terkumpul: ${esc(formatRupiah(g.current_amount))}</span>
                    <span>Target: ${esc(formatRupiah(g.target_amount))}</span>
                  </div>
                  <div class="row-between">
                    <button type="button" class="btn btn-sm btn-soft" data-add-goal="${esc(g.id)}">${icon('plus', 15)} Tabung</button>
                    <button type="button" class="btn btn-sm btn-ghost text-expense" data-del-goal="${esc(g.id)}" aria-label="Hapus celengan ${esc(g.title)}">${icon('trash', 15)}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <section class="card" aria-label="Tagihan Rutin Bulanan">
        <div class="card-header">
          <div>
            <h2 class="card-title">Pengingat Tagihan Rutin</h2>
            <p class="card-sub">Catat tagihan bulanan seperti listrik, internet, atau cicilan cukup dengan satu klik</p>
          </div>
        </div>
        <form id="bill-create-form" class="grid-3" style="margin-bottom:16px;align-items:end;">
          <div class="field">
            <label for="bill-title">Nama Tagihan</label>
            <input id="bill-title" class="input" type="text" placeholder="Misal: Internet Rumah" required />
          </div>
          <div class="field">
            <label for="bill-amount">Nominal (Rp)</label>
            <input id="bill-amount" class="input num" type="number" min="1000" step="1000" placeholder="350000" required />
          </div>
          <div class="field">
            <label for="bill-day">Jatuh Tempo (Tgl 1-31)</label>
            <input id="bill-day" class="input num" type="number" min="1" max="31" value="5" required />
          </div>
          <div class="field">
            <label for="bill-cat">Kategori</label>
            <select id="bill-cat" class="select">
              ${state.categories.filter((c) => c.type === 'expense').map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="bill-acc">Dompet Pembayaran</label>
            <select id="bill-acc" class="select">
              ${state.accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <button type="submit" class="btn btn-primary">${icon('plus', 16)} Tambah Tagihan</button>
          </div>
        </form>

        ${state.bills.length === 0 ? `
          <div class="state-box">
            ${icon('calendar', 28)}
            <p><strong>Belum ada jadwal tagihan rutin</strong></p>
            <p class="card-sub">Tambahkan tagihan bulanan agar tidak ada pembayaran yang terlewat.</p>
          </div>
        ` : `
          <div class="tx-list">
            ${state.bills.map((b) => {
              const paid = b.last_paid_month === state.month;
              return `
                <div class="tx-row">
                  <div class="tx-icon" style="background:${paid ? 'var(--income)' : 'var(--warning)'};">${icon('calendar', 18)}</div>
                  <div class="tx-body">
                    <div class="tx-title">${esc(b.title)}</div>
                    <div class="tx-meta">
                      <span>Setiap tanggal ${b.due_day}</span>
                      <span>&bull;</span>
                      <span>${esc(b.category_name || 'Tagihan')}</span>
                      <span>&bull;</span>
                      <span>${esc(b.account_name || 'Dompet')}</span>
                    </div>
                  </div>
                  <div class="tx-amount num">${esc(formatRupiah(b.amount))}</div>
                  <div class="tx-actions">
                    ${paid
                      ? '<span class="badge badge-income">Lunas Bulan Ini</span>'
                      : `<button type="button" class="btn btn-sm btn-primary" data-pay-bill="${esc(b.id)}">Catat Sekarang</button>`}
                    <button type="button" class="btn btn-sm btn-ghost text-expense" data-del-bill="${esc(b.id)}" aria-label="Hapus tagihan ${esc(b.title)}">${icon('trash', 15)}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>
    </div>
  `;

  container.querySelectorAll('[data-budget-form]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const catId = form.getAttribute('data-budget-form');
      const amt = Number(form.querySelector('input').value) || 0;
      try {
        await api.saveBudget(catId, amt);
        toast('Anggaran bulanan disimpan.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelector('#goal-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.createGoal({
        title: container.querySelector('#goal-title').value.trim(),
        target_amount: Number(container.querySelector('#goal-target').value),
        current_amount: Number(container.querySelector('#goal-current').value) || 0,
      });
      toast('Celengan impian berhasil dibuat.');
      await refreshAll(scene);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelectorAll('[data-add-goal]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-add-goal');
      const val = prompt('Masukkan nominal tambahan tabungan (Rp):', '100000');
      const amt = Number(val);
      if (!amt || amt <= 0) return;
      try {
        await api.addGoalFunds(id, amt);
        toast('Tabungan celengan bertambah.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('[data-del-goal]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-goal');
      if (!confirm('Hapus celengan impian ini?')) return;
      try {
        await api.deleteGoal(id);
        toast('Celengan dihapus.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelector('#bill-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.createBill({
        title: container.querySelector('#bill-title').value.trim(),
        amount: Number(container.querySelector('#bill-amount').value),
        due_day: Number(container.querySelector('#bill-day').value) || 1,
        category_id: container.querySelector('#bill-cat').value,
        account_id: container.querySelector('#bill-acc').value,
        type: 'expense',
      });
      toast('Tagihan rutin ditambahkan.');
      await refreshAll(scene);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelectorAll('[data-pay-bill]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-pay-bill');
      try {
        await api.payBill(id);
        toast('Tagihan rutin berhasil dicatat.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('[data-del-bill]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-bill');
      if (!confirm('Hapus pengingat tagihan rutin ini?')) return;
      try {
        await api.deleteBill(id);
        toast('Tagihan rutin dihapus.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}
