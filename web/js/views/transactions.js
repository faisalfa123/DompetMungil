/* Transactions View with Search, Filters, Inline Quick Edit, and Bulk Delete */

import { state, esc, formatRupiah, formatDateId, toast, refreshAll } from '../store.js';
import { api } from '../api.js';
import { icon } from '../icons.js';

const viewState = {
  q: '',
  type: '',
  category_id: '',
  account_id: '',
  editingId: '',
  selectedIds: new Set(),
};

export function renderTransactions(container, { openTxModal, scene }) {
  const filtered = state.transactions.filter((tx) => {
    if (viewState.type && tx.type !== viewState.type) return false;
    if (viewState.category_id && tx.category_id !== viewState.category_id) return false;
    if (viewState.account_id && tx.account_id !== viewState.account_id && tx.to_account_id !== viewState.account_id) return false;
    if (viewState.q) {
      const hay = `${tx.note} ${tx.category_name} ${tx.account_name} ${tx.date}`.toLowerCase();
      if (!hay.includes(viewState.q.toLowerCase())) return false;
    }
    return true;
  });

  const sumIn = filtered.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const sumOut = filtered.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

  container.innerHTML = `
    <div class="stack-20">
      <section class="card" aria-label="Filter Transaksi">
        <div class="grid-3" style="margin-bottom:12px;">
          <div class="field">
            <label for="tx-search">Cari catatan atau kategori</label>
            <input id="tx-search" class="input" type="search" placeholder="Misal: Indomaret, kopi, listrik..." value="${esc(viewState.q)}" />
          </div>
          <div class="field">
            <label for="tx-filter-type">Jenis</label>
            <select id="tx-filter-type" class="select">
              <option value="">Semua Jenis</option>
              <option value="expense" ${viewState.type === 'expense' ? 'selected' : ''}>Pengeluaran</option>
              <option value="income" ${viewState.type === 'income' ? 'selected' : ''}>Pemasukan</option>
              <option value="transfer" ${viewState.type === 'transfer' ? 'selected' : ''}>Transfer</option>
            </select>
          </div>
          <div class="field">
            <label for="tx-filter-cat">Kategori</label>
            <select id="tx-filter-cat" class="select">
              <option value="">Semua Kategori</option>
              ${state.categories.map((c) => `<option value="${esc(c.id)}" ${viewState.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="row-between">
          <div class="row">
            <label for="tx-filter-acc" class="sr-only">Filter Dompet</label>
            <select id="tx-filter-acc" class="select" style="width:auto;min-width:170px;">
              <option value="">Semua Dompet</option>
              ${state.accounts.map((a) => `<option value="${esc(a.id)}" ${viewState.account_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
            </select>
            <span class="badge badge-income">Masuk: ${esc(formatRupiah(sumIn))}</span>
            <span class="badge badge-expense">Keluar: ${esc(formatRupiah(sumOut))}</span>
          </div>
          <div class="row">
            ${viewState.selectedIds.size > 0 ? `
              <button type="button" class="btn btn-sm btn-danger" id="btn-bulk-delete">
                ${icon('trash', 16)} Hapus Terpilih (${viewState.selectedIds.size})
              </button>
            ` : ''}
            <button type="button" class="btn btn-sm btn-primary" id="btn-tx-add">
              ${icon('plus', 16)} Catat Baru
            </button>
          </div>
        </div>
      </section>

      <section class="card" aria-label="Daftar Transaksi">
        <div class="card-header">
          <div>
            <h2 class="card-title">Riwayat Transaksi (${filtered.length})</h2>
            <p class="card-sub">Klik tombol Edit pada baris mana saja untuk mengubah nominal, kategori, atau catatan secara langsung</p>
          </div>
          ${filtered.length > 0 ? `
            <label style="display:inline-flex;align-items:center;gap:8px;font-size:0.86rem;font-weight:700;">
              <input type="checkbox" id="tx-select-all" ${filtered.length > 0 && filtered.every((t) => viewState.selectedIds.has(t.id)) ? 'checked' : ''} />
              Pilih Semua
            </label>
          ` : ''}
        </div>

        ${filtered.length === 0 ? `
          <div class="state-box">
            ${icon('search', 28)}
            <p><strong>Tidak ada transaksi yang cocok</strong></p>
            <p class="card-sub">Coba ubah filter pencarian atau tambah transaksi baru.</p>
          </div>
        ` : `
          <div class="tx-list">
            ${filtered.map((tx) => {
              const isEditing = viewState.editingId === tx.id;
              const sign = tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-';
              const cls = tx.type === 'income' ? 'text-income' : tx.type === 'transfer' ? 'text-info' : 'text-expense';
              const accText = tx.type === 'transfer'
                ? `${tx.account_name} -> ${tx.to_account_name || 'Tujuan'}`
                : tx.account_name;
              return `
                <div class="tx-row" style="flex-direction:column;align-items:stretch;">
                  <div style="display:flex;align-items:center;gap:12px;width:100%;">
                    <input type="checkbox" class="tx-check" data-id="${esc(tx.id)}" aria-label="Pilih transaksi ${esc(tx.note || tx.category_name)}" ${viewState.selectedIds.has(tx.id) ? 'checked' : ''} />
                    <div class="tx-icon" style="background:${esc(tx.color || '#2A6B4A')};">
                      ${icon(tx.type === 'transfer' ? 'transfer' : (tx.icon || 'tag'), 18)}
                    </div>
                    <div class="tx-body">
                      <div class="tx-title">${esc(tx.note || tx.category_name || 'Tanpa catatan')}</div>
                      <div class="tx-meta">
                        <span>${esc(formatDateId(tx.date))}</span>
                        <span>&bull;</span>
                        <span>${esc(tx.category_name || (tx.type === 'transfer' ? 'Transfer' : 'Umum'))}</span>
                        <span>&bull;</span>
                        <span>${esc(accText)}</span>
                      </div>
                    </div>
                    <div class="tx-amount num ${cls}">${sign}${esc(formatRupiah(tx.amount))}</div>
                    <div class="tx-actions">
                      <button type="button" class="btn btn-sm btn-ghost" data-edit-tx="${esc(tx.id)}" aria-label="Edit cepat transaksi">
                        ${icon('edit', 16)}
                      </button>
                      <button type="button" class="btn btn-sm btn-ghost text-expense" data-del-tx="${esc(tx.id)}" aria-label="Hapus transaksi">
                        ${icon('trash', 16)}
                      </button>
                    </div>
                  </div>
                  ${isEditing ? `
                    <form class="tx-inline-edit" data-inline-form="${esc(tx.id)}">
                      <div class="field">
                        <label for="ie-date-${esc(tx.id)}">Tanggal</label>
                        <input id="ie-date-${esc(tx.id)}" name="date" type="date" class="input" value="${esc(tx.date)}" required />
                      </div>
                      <div class="field">
                        <label for="ie-amount-${esc(tx.id)}">Nominal (Rp)</label>
                        <input id="ie-amount-${esc(tx.id)}" name="amount" type="number" min="1" step="1" class="input num" value="${Math.round(tx.amount)}" required />
                      </div>
                      <div class="field">
                        <label for="ie-cat-${esc(tx.id)}">Kategori</label>
                        <select id="ie-cat-${esc(tx.id)}" name="category_id" class="select">
                          ${state.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === tx.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                        </select>
                      </div>
                      <div class="field">
                        <label for="ie-acc-${esc(tx.id)}">Dompet</label>
                        <select id="ie-acc-${esc(tx.id)}" name="account_id" class="select">
                          ${state.accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === tx.account_id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
                        </select>
                      </div>
                      <div class="field" style="grid-column: 1 / -1;">
                        <label for="ie-note-${esc(tx.id)}">Catatan</label>
                        <input id="ie-note-${esc(tx.id)}" name="note" type="text" class="input" value="${esc(tx.note)}" />
                      </div>
                      <div class="row" style="grid-column: 1 / -1; justify-content: flex-end;">
                        <button type="button" class="btn btn-sm" data-cancel-edit>Batal</button>
                        <button type="submit" class="btn btn-sm btn-primary">${icon('check', 16)} Simpan Perubahan</button>
                      </div>
                    </form>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>
    </div>
  `;

  const rerender = () => renderTransactions(container, { openTxModal, scene });

  const searchInput = container.querySelector('#tx-search');
  searchInput?.addEventListener('input', (e) => {
    viewState.q = e.target.value;
    rerender();
    const nextInput = container.querySelector('#tx-search');
    if (nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
    }
  });

  container.querySelector('#tx-filter-type')?.addEventListener('change', (e) => { viewState.type = e.target.value; rerender(); });
  container.querySelector('#tx-filter-cat')?.addEventListener('change', (e) => { viewState.category_id = e.target.value; rerender(); });
  container.querySelector('#tx-filter-acc')?.addEventListener('change', (e) => { viewState.account_id = e.target.value; rerender(); });
  container.querySelector('#btn-tx-add')?.addEventListener('click', () => openTxModal());

  container.querySelector('#tx-select-all')?.addEventListener('change', (e) => {
    if (e.target.checked) filtered.forEach((t) => viewState.selectedIds.add(t.id));
    else viewState.selectedIds.clear();
    rerender();
  });

  container.querySelectorAll('.tx-check').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const id = cb.getAttribute('data-id');
      if (e.target.checked) viewState.selectedIds.add(id);
      else viewState.selectedIds.delete(id);
      rerender();
    });
  });

  container.querySelector('#btn-bulk-delete')?.addEventListener('click', async () => {
    if (!confirm(`Hapus ${viewState.selectedIds.size} transaksi terpilih? Saldo dompet akan disesuaikan otomatis.`)) return;
    try {
      await api.deleteTransaction({ ids: [...viewState.selectedIds].join(',') });
      viewState.selectedIds.clear();
      toast('Transaksi terpilih berhasil dihapus.');
      await refreshAll(scene);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelectorAll('[data-edit-tx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-tx');
      viewState.editingId = viewState.editingId === id ? '' : id;
      rerender();
    });
  });

  container.querySelector('[data-cancel-edit]')?.addEventListener('click', () => {
    viewState.editingId = '';
    rerender();
  });

  container.querySelectorAll('[data-inline-form]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = form.getAttribute('data-inline-form');
      const fd = new FormData(form);
      try {
        await api.updateTransaction({
          id,
          date: fd.get('date'),
          amount: Number(fd.get('amount')),
          category_id: fd.get('category_id'),
          account_id: fd.get('account_id'),
          note: String(fd.get('note') || '').trim(),
        });
        viewState.editingId = '';
        toast('Transaksi berhasil diperbarui.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('[data-del-tx]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-tx');
      if (!confirm('Hapus transaksi ini? Saldo dompet akan dikembalikan otomatis.')) return;
      try {
        await api.deleteTransaction({ id });
        viewState.selectedIds.delete(id);
        toast('Transaksi dihapus.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}
