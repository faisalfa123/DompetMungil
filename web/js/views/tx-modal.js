/* Quick Transaction Modal with Mobile Custom Numpad, Pinned Templates, and Inter-Account Transfer */

import { state, esc, toast, refreshAll, haptic } from '../store.js';
import { api } from '../api.js';
import { icon } from '../icons.js';

const PINNED_KEY = 'dompetmungil_pinned_templates';

function loadPinnedTemplates() {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [
    { id: 'tpl_bensin', label: 'Bensin 50rb', type: 'expense', amount: 50000, category_id: 'cat_kendaraan', note: 'Isi bensin' },
    { id: 'tpl_makan', label: 'Makan Siang 25rb', type: 'expense', amount: 25000, category_id: 'cat_makan', note: 'Makan siang' },
  ];
}

function savePinnedTemplates(list) {
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    // ignore
  }
}

function evalSimpleMath(expr) {
  const clean = String(expr || '').replace(/[^0-9+\-*/.() ]/g, '').trim();
  if (!clean) return 0;
  try {
    const fn = new Function(`"use strict"; return (${clean});`);
    const out = Number(fn());
    return Number.isFinite(out) && out > 0 ? Math.round(out) : 0;
  } catch {
    return 0;
  }
}

export function openTransactionModal(scene) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  let txType = 'expense';
  let showCalc = false;
  const isMobile = window.innerWidth < 768;

  const render = () => {
    const cats = state.categories.filter((c) => txType === 'transfer' ? true : c.type === txType);
    const today = new Date().toISOString().slice(0, 10);
    const templates = loadPinnedTemplates();

    root.innerHTML = `
      <div class="modal-backdrop" id="tx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tx-modal-title">
        <div class="modal-card">
          <div class="card-header">
            <h2 id="tx-modal-title" class="card-title">Catat Transaksi Cepat</h2>
            <button type="button" class="btn btn-icon btn-ghost" id="btn-close-modal" aria-label="Tutup jendela">
              ${icon('close', 20)}
            </button>
          </div>

          ${templates.length > 0 ? `
            <div class="pinned-templates" aria-label="Template Transaksi Cepat">
              ${templates.map((t) => `
                <button type="button" class="btn btn-sm btn-soft pinned-chip" data-tpl-id="${esc(t.id)}">
                  📌 ${esc(t.label)}
                </button>
              `).join('')}
            </div>
          ` : ''}

          <div class="segmented" style="margin-bottom:14px;">
            <button type="button" class="${txType === 'expense' ? 'active' : ''}" data-m-type="expense">Pengeluaran</button>
            <button type="button" class="${txType === 'income' ? 'active' : ''}" data-m-type="income">Pemasukan</button>
            <button type="button" class="${txType === 'transfer' ? 'active' : ''}" data-m-type="transfer">Transfer</button>
          </div>

          <form id="tx-modal-form" class="stack-16">
            <div class="field">
              <div class="row-between">
                <label for="m-amount">Nominal (Rp)</label>
                ${!isMobile ? `<button type="button" class="btn btn-sm btn-ghost" id="btn-toggle-calc">${icon('calculator', 15)} ${showCalc ? 'Tutup Kalkulator' : 'Kalkulator'}</button>` : ''}
              </div>
              <input id="m-amount" name="amount" type="text"
                inputmode="${isMobile ? 'none' : 'decimal'}"
                ${isMobile ? 'readonly' : 'autofocus'}
                class="input num" style="font-size:1.35rem;font-weight:800;" placeholder="0" required />
              <div class="row" style="gap:6px;">
                <button type="button" class="btn btn-sm btn-soft" data-add-amt="10000">+10rb</button>
                <button type="button" class="btn btn-sm btn-soft" data-add-amt="25000">+25rb</button>
                <button type="button" class="btn btn-sm btn-soft" data-add-amt="50000">+50rb</button>
                <button type="button" class="btn btn-sm btn-soft" data-add-amt="100000">+100rb</button>
              </div>
              ${isMobile ? `
                <div class="custom-numpad" aria-label="Papan Angka Cepat">
                  ${['1','2','3','4','5','6','7','8','9','000','0','⌫'].map((k) =>
                    `<button type="button" class="numpad-btn ${k === '⌫' ? 'numpad-del' : ''}" data-numpad-key="${k}">${k}</button>`
                  ).join('')}
                </div>
              ` : (showCalc ? `
                <div class="calc-grid" aria-label="Kalkulator Mini">
                  ${['7','8','9','/','4','5','6','*','1','2','3','-','C','0','=','+'].map((k) =>
                    `<button type="button" data-calc-key="${k}">${k}</button>`
                  ).join('')}
                </div>
              ` : '')}
            </div>

            <div class="grid-2">
              <div class="field">
                <label for="m-account">${txType === 'transfer' ? 'Dari Rekening / Dompet' : 'Dompet / Rekening'}</label>
                <select id="m-account" name="account_id" class="select" required>
                  ${state.accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}
                </select>
              </div>

              ${txType === 'transfer' ? `
                <div class="field">
                  <label for="m-to-account">Ke Rekening / Dompet</label>
                  <select id="m-to-account" name="to_account_id" class="select" required>
                    ${state.accounts.map((a, i) => `<option value="${esc(a.id)}" ${i === 1 ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
                  </select>
                </div>
              ` : `
                <div class="field">
                  <label for="m-category">Kategori</label>
                  <select id="m-category" name="category_id" class="select" required>
                    ${cats.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
                  </select>
                </div>
              `}
            </div>

            <div class="grid-2">
              <div class="field">
                <label for="m-date">Tanggal</label>
                <input id="m-date" name="date" type="date" class="input" value="${today}" required />
              </div>
              <div class="field">
                <label for="m-note">Catatan (Terenkripsi AES-256)</label>
                <input id="m-note" name="note" type="text" class="input" placeholder="Misal: Belanja sayur pagi" />
              </div>
            </div>

            <div class="row-between">
              <label style="display:inline-flex;align-items:center;gap:6px;font-size:0.84rem;color:var(--ink-muted);cursor:pointer;">
                <input type="checkbox" id="m-pin-tpl" name="pin_tpl" />
                📌 Pin sebagai template cepat
              </label>
              <div class="row">
                <button type="button" class="btn" id="btn-cancel-modal">Batal</button>
                <button type="submit" class="btn btn-primary" id="btn-save-tx">${icon('check', 16)} Simpan</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { root.innerHTML = ''; };
    const amtInput = root.querySelector('#m-amount');

    root.querySelector('#btn-close-modal')?.addEventListener('click', close);
    root.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
    root.querySelector('#tx-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'tx-modal-backdrop') close();
    });

    root.querySelectorAll('[data-m-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        haptic(50);
        txType = btn.getAttribute('data-m-type');
        render();
      });
    });

    root.querySelectorAll('[data-tpl-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        haptic(50);
        const tpl = templates.find((t) => t.id === btn.getAttribute('data-tpl-id'));
        if (!tpl) return;
        if (tpl.type && tpl.type !== txType) {
          txType = tpl.type;
          render();
        }
        const nextAmt = root.querySelector('#m-amount');
        const nextCat = root.querySelector('#m-category');
        const nextNote = root.querySelector('#m-note');
        if (nextAmt) nextAmt.value = String(tpl.amount);
        if (nextCat && tpl.category_id) nextCat.value = tpl.category_id;
        if (nextNote && tpl.note) nextNote.value = tpl.note;
        toast(`Template "${tpl.label}" diterapkan.`);
      });
    });

    root.querySelector('#btn-toggle-calc')?.addEventListener('click', () => {
      haptic(50);
      const curVal = amtInput.value;
      showCalc = !showCalc;
      render();
      const nextAmt = root.querySelector('#m-amount');
      if (nextAmt) { nextAmt.value = curVal; nextAmt.focus(); }
    });

    root.querySelectorAll('[data-add-amt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        haptic(50);
        const cur = evalSimpleMath(amtInput.value);
        amtInput.value = String(cur + Number(btn.getAttribute('data-add-amt')));
        if (!isMobile) amtInput.focus();
      });
    });

    root.querySelectorAll('[data-numpad-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        haptic(50);
        const k = btn.getAttribute('data-numpad-key');
        if (k === '⌫') {
          amtInput.value = amtInput.value.slice(0, -1);
        } else {
          if (amtInput.value === '0') amtInput.value = '';
          amtInput.value = `${amtInput.value}${k}`;
        }
      });
    });

    root.querySelectorAll('[data-calc-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        haptic(50);
        const k = btn.getAttribute('data-calc-key');
        if (k === 'C') amtInput.value = '';
        else if (k === '=') amtInput.value = String(evalSimpleMath(amtInput.value) || '');
        else amtInput.value = `${amtInput.value}${k}`;
        amtInput.focus();
      });
    });

    root.querySelector('#tx-modal-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      haptic(50);
      const fd = new FormData(e.target);
      const amount = evalSimpleMath(fd.get('amount'));
      if (!amount || amount <= 0) {
        toast('Masukkan nominal transaksi yang valid.', 'error');
        return;
      }
      const noteText = String(fd.get('note') || '').trim();
      const catId = txType === 'transfer' ? 'cat_tarik_tunai' : fd.get('category_id');

      if (fd.get('pin_tpl')) {
        const currentTpls = loadPinnedTemplates();
        const label = noteText || `${Math.round(amount / 1000)}rb`;
        currentTpls.unshift({
          id: `tpl_${Date.now()}`,
          label: `${label} (${Math.round(amount / 1000)}rb)`,
          type: txType,
          amount,
          category_id: catId,
          note: noteText,
        });
        savePinnedTemplates(currentTpls);
      }

      const saveBtn = root.querySelector('#btn-save-tx');
      saveBtn.disabled = true;
      try {
        await api.createTransaction({
          type: txType,
          amount,
          account_id: fd.get('account_id'),
          to_account_id: txType === 'transfer' ? fd.get('to_account_id') : '',
          category_id: catId,
          date: fd.get('date'),
          note: noteText,
        });
        toast('Transaksi berhasil dicatat.');
        close();
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
        saveBtn.disabled = false;
      }
    });
  };

  render();
}
