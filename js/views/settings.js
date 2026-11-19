/* Unified Settings View: Themes, Animation, Accounts, Categories, Bank Rules, Backup & Restore */

import { state, esc, formatRupiah, toast, applyTheme, refreshAll } from '../store.js';
import { api } from '../api.js';
import { icon, AVAILABLE_ICONS } from '../icons.js';

const THEMES = [
  {
    id: 'meadow',
    name: 'Padang Rumput Pagi',
    desc: 'Kertas cat air krem hangat, hijau lumut, dan langit pagi yang teduh.',
    swatches: ['#F6F2E7', '#2A6B4A', '#B54C32', '#1F2D24'],
  },
  {
    id: 'bakery',
    name: 'Kafe Roti Kiki',
    desc: 'Nuansa mentega hangat, kayu manis, dan aksen pita merah bata.',
    swatches: ['#F9EFE2', '#A83B32', '#3D6B3B', '#2F1F18'],
  },
  {
    id: 'lantern',
    name: 'Danau Lentera Senja',
    desc: 'Mode malam tenang dengan biru senja dan cahaya lentera emas lembut.',
    swatches: ['#121B24', '#1A2633', '#E8B256', '#6FD49B'],
  },
];

const SWATCH_COLORS = ['#2A6B4A', '#C85A3F', '#3A5F8A', '#8F5B14', '#9A4C72', '#B53D4B', '#2A6F68', '#3D7A3B'];

export function renderSettings(container, { scene }) {
  const curTheme = state.settings.theme || 'meadow';
  const curAnim = state.settings.anim_mode || 'full';

  container.innerHTML = `
    <div class="stack-20">
      <section class="card" aria-label="Tampilan dan Tema Ghibli">
        <div class="card-header">
          <div>
            <h2 class="card-title">Identitas Buku & Tema Ghibli</h2>
            <p class="card-sub">Ubah suasana warna, nama buku keluarga, dan mode animasi latar</p>
          </div>
        </div>

        <form id="set-profile-form" class="grid-2" style="margin-bottom:18px;align-items:end;">
          <div class="field">
            <label for="set-title">Nama Buku Keuangan</label>
            <input id="set-title" class="input" type="text" value="${esc(state.settings.family_title || 'DompetMungil')}" required />
          </div>
          <div class="field">
            <label for="set-sub">Subjudul (tampil di sampul & cetak)</label>
            <div class="row">
              <input id="set-sub" class="input" style="flex:1;" type="text" value="${esc(state.settings.family_subtitle || 'Buku Catatan Keuangan Keluarga')}" />
              <button type="submit" class="btn btn-primary">Simpan</button>
            </div>
          </div>
        </form>

        <p style="font-weight:700;font-size:0.88rem;margin-bottom:8px;color:var(--text-secondary);">Pilih Tema Ghibli</p>
        <div class="theme-grid" style="margin-bottom:18px;">
          ${THEMES.map((t) => `
            <button type="button" class="theme-card ${curTheme === t.id ? 'active' : ''}" data-pick-theme="${t.id}" aria-pressed="${curTheme === t.id}">
              <div class="row-between" style="width:100%;">
                <strong>${esc(t.name)}</strong>
                ${curTheme === t.id ? '<span class="badge badge-income">Aktif</span>' : ''}
              </div>
              <p class="card-sub">${esc(t.desc)}</p>
              <div class="swatch-row">
                ${t.swatches.map((hex) => `<span class="swatch" style="background:${hex};"></span>`).join('')}
              </div>
            </button>
          `).join('')}
        </div>

        <div class="row-between">
          <div>
            <strong style="font-size:0.9rem;">Animasi Latar Ghibli (Canvas)</strong>
            <p class="card-sub">Awan, daun melayang, uap hangat, atau kunang-kunang di latar</p>
          </div>
          <div class="segmented" style="max-width:300px;">
            <button type="button" class="${curAnim === 'full' ? 'active' : ''}" data-pick-anim="full">Penuh</button>
            <button type="button" class="${curAnim === 'light' ? 'active' : ''}" data-pick-anim="light">Hemat</button>
            <button type="button" class="${curAnim === 'off' ? 'active' : ''}" data-pick-anim="off">Mati</button>
          </div>
        </div>
      </section>

      <section class="card" aria-label="Kelola Dompet dan Rekening">
        <div class="card-header">
          <div>
            <h2 class="card-title">Dompet & Rekening Bank</h2>
            <p class="card-sub">Tambah atau ubah saldo rekening bank, tunai, dan e-wallet</p>
          </div>
        </div>
        <form id="acc-create-form" class="grid-3" style="margin-bottom:14px;align-items:end;">
          <div class="field">
            <label for="acc-name">Nama Dompet / Bank</label>
            <input id="acc-name" class="input" type="text" placeholder="Misal: BCA Utama, GoPay" required />
          </div>
          <div class="field">
            <label for="acc-type">Tipe</label>
            <select id="acc-type" class="select">
              <option value="bank">Rekening Bank</option>
              <option value="cash">Dompet Tunai</option>
              <option value="ewallet">E-Wallet</option>
            </select>
          </div>
          <div class="field">
            <label for="acc-bal">Saldo Awal (Rp)</label>
            <div class="row">
              <input id="acc-bal" class="input num" style="flex:1;" type="number" step="1000" value="0" />
              <button type="submit" class="btn btn-primary">${icon('plus', 16)} Tambah</button>
            </div>
          </div>
        </form>
        <div class="tx-list">
          ${state.accounts.map((a) => `
            <div class="tx-row">
              <div class="tx-icon" style="background:${esc(a.color || '#2A6B4A')};">${icon(a.icon || 'wallet', 18)}</div>
              <div class="tx-body">
                <div class="tx-title">${esc(a.name)}</div>
                <div class="tx-meta"><span>${esc(a.type)}</span></div>
              </div>
              <div class="tx-amount num">${esc(formatRupiah(a.balance, true))}</div>
              <div class="tx-actions">
                <button type="button" class="btn btn-sm btn-ghost" data-edit-acc="${esc(a.id)}" aria-label="Edit akun ${esc(a.name)}">${icon('edit', 16)}</button>
                <button type="button" class="btn btn-sm btn-ghost text-expense" data-del-acc="${esc(a.id)}" aria-label="Hapus akun ${esc(a.name)}">${icon('trash', 16)}</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="card" aria-label="Kelola Kategori">
        <div class="card-header">
          <div>
            <h2 class="card-title">Kategori Transaksi</h2>
            <p class="card-sub">Sesuaikan kategori pengeluaran dan pemasukan keluarga</p>
          </div>
        </div>
        <form id="cat-create-form" class="grid-3" style="margin-bottom:14px;align-items:end;">
          <div class="field">
            <label for="cat-name">Nama Kategori</label>
            <input id="cat-name" class="input" type="text" placeholder="Misal: Susu & Popok" required />
          </div>
          <div class="field">
            <label for="cat-type">Jenis</label>
            <select id="cat-type" class="select">
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
          </div>
          <div class="field">
            <label for="cat-icon">Ikon & Warna</label>
            <div class="row">
              <select id="cat-icon" class="select" style="flex:1;">
                ${AVAILABLE_ICONS.map((ic) => `<option value="${ic}">${ic}</option>`).join('')}
              </select>
              <select id="cat-color" class="select" style="width:92px;">
                ${SWATCH_COLORS.map((hex, i) => `<option value="${hex}">Warna ${i + 1}</option>`).join('')}
              </select>
              <button type="submit" class="btn btn-primary">${icon('plus', 16)}</button>
            </div>
          </div>
        </form>
        <div class="grid-2">
          ${state.categories.map((c) => `
            <div class="mini-stat row-between">
              <div class="row" style="gap:10px;">
                <span class="tx-icon" style="width:32px;height:32px;background:${esc(c.color || '#2A6B4A')};">${icon(c.icon || 'tag', 16)}</span>
                <div>
                  <strong style="font-size:0.9rem;">${esc(c.name)}</strong>
                  <div class="card-sub">${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</div>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-ghost text-expense" data-del-cat="${esc(c.id)}" aria-label="Hapus kategori ${esc(c.name)}">${icon('trash', 15)}</button>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="card" aria-label="Aturan Auto-Kategorisasi Bank">
        <div class="card-header">
          <div>
            <h2 class="card-title">Aturan Auto-Kategori Mutasi Bank</h2>
            <p class="card-sub">Saat mengimpor mutasi bank, kata kunci berikut otomatis dikelompokkan ke kategori pilihan Anda</p>
          </div>
        </div>
        <form id="rule-create-form" class="grid-3" style="margin-bottom:14px;align-items:end;">
          <div class="field">
            <label for="rule-kw">Kata Kunci (pisah dengan koma)</label>
            <input id="rule-kw" class="input" type="text" placeholder="Misal: indomaret, alfamart, kopi" required />
          </div>
          <div class="field">
            <label for="rule-cat">Kategori Tujuan</label>
            <select id="rule-cat" class="select">
              ${state.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <button type="submit" class="btn btn-primary">${icon('plus', 16)} Tambah Aturan</button>
          </div>
        </form>
        <div class="tx-list">
          ${state.rules.map((r) => `
            <div class="mini-stat row-between">
              <div>
                <strong style="font-size:0.88rem;">${esc(r.category_name || r.category_id)}</strong>
                <div class="card-sub">${esc(r.keyword)}</div>
              </div>
              <button type="button" class="btn btn-sm btn-ghost text-expense" data-del-rule="${esc(r.id)}" aria-label="Hapus aturan">${icon('trash', 15)}</button>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="card" aria-label="Cadangan dan Ekspor Data">
        <div class="card-header">
          <div>
            <h2 class="card-title">Cadangan, Pemulihan & Ekspor</h2>
            <p class="card-sub">Data Anda 100% milik Anda. Unduh salinan JSON lengkap atau CSV Excel kapan saja</p>
          </div>
        </div>
        <div class="row">
          <button type="button" class="btn btn-primary" id="btn-export-json">${icon('download', 16)} Unduh Backup JSON</button>
          <label for="restore-json-file" class="btn">${icon('upload', 16)} Pulihkan Backup JSON</label>
          <input id="restore-json-file" type="file" accept=".json" class="sr-only" />
          <button type="button" class="btn btn-soft" id="btn-export-csv">${icon('file', 16)} Ekspor CSV (Excel)</button>
        </div>
      </section>
    </div>
  `;

  container.querySelector('#set-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const family_title = container.querySelector('#set-title').value.trim();
    const family_subtitle = container.querySelector('#set-sub').value.trim();
    try {
      await api.saveSettings({ family_title, family_subtitle });
      toast('Identitas buku keuangan diperbarui.');
      await refreshAll(scene);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelectorAll('[data-pick-theme]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = btn.getAttribute('data-pick-theme');
      applyTheme(theme, state.settings.anim_mode, scene);
      try { await api.saveSettings({ theme }); } catch { /* local fallback ok */ }
      toast('Tema Ghibli diterapkan.');
      renderSettings(container, { scene });
    });
  });

  container.querySelectorAll('[data-pick-anim]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const anim_mode = btn.getAttribute('data-pick-anim');
      applyTheme(state.settings.theme, anim_mode, scene);
      try { await api.saveSettings({ anim_mode }); } catch { /* local fallback ok */ }
      toast('Mode animasi diperbarui.');
      renderSettings(container, { scene });
    });
  });

  container.querySelector('#acc-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = container.querySelector('#acc-type').value;
    const iconName = type === 'bank' ? 'landmark' : type === 'ewallet' ? 'smartphone' : 'wallet';
    try {
      await api.createAccount({
        name: container.querySelector('#acc-name').value.trim(),
        type,
        balance: Number(container.querySelector('#acc-bal').value) || 0,
        icon: iconName,
        color: '#2A6B4A',
      });
      toast('Dompet baru ditambahkan.');
      await refreshAll(scene);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelectorAll('[data-edit-acc]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-edit-acc');
      const acc = state.accounts.find((a) => a.id === id);
      if (!acc) return;
      const newName = prompt('Ubah nama dompet / rekening:', acc.name);
      if (!newName || !newName.trim()) return;
      const newBalStr = prompt('Sesuaikan saldo saat ini (Rp):', String(Math.round(acc.balance)));
      if (newBalStr === null) return;
      try {
        await api.updateAccount({
          id: acc.id,
          name: newName.trim(),
          type: acc.type,
          balance: Number(newBalStr),
          icon: acc.icon,
          color: acc.color,
        });
        toast('Dompet diperbarui.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('[data-del-acc]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-acc');
      if (!confirm('Hapus dompet/rekening ini?')) return;
      try {
        await api.deleteAccount(id);
        toast('Dompet dihapus.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelector('#cat-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.createCategory({
        name: container.querySelector('#cat-name').value.trim(),
        type: container.querySelector('#cat-type').value,
        icon: container.querySelector('#cat-icon').value,
        color: container.querySelector('#cat-color').value,
      });
      toast('Kategori baru ditambahkan.');
      await refreshAll(scene);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelectorAll('[data-del-cat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-cat');
      if (!confirm('Hapus kategori ini?')) return;
      try {
        await api.deleteCategory(id);
        toast('Kategori dihapus.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelector('#rule-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.createRule({
        keyword: container.querySelector('#rule-kw').value.trim(),
        category_id: container.querySelector('#rule-cat').value,
        tx_type: 'any',
        priority: 15,
      });
      toast('Aturan auto-kategori ditambahkan.');
      await refreshAll(scene);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelectorAll('[data-del-rule]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-rule');
      try {
        await api.deleteRule(id);
        toast('Aturan dihapus.');
        await refreshAll(scene);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  container.querySelector('#btn-export-json')?.addEventListener('click', async () => {
    try {
      const data = await api.exportBackupJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dompetmungil_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup JSON berhasil diunduh.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelector('#restore-json-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Pulihkan seluruh data dari file backup ini? Data saat ini akan diganti.')) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await api.restoreBackupJson(payload);
      toast(`Pemulihan selesai (${res.transactions || 0} transaksi dipulihkan).`);
      await refreshAll(scene);
    } catch (err) {
      toast(err.message || 'Gagal memulihkan file JSON.', 'error');
    }
  });

  container.querySelector('#btn-export-csv')?.addEventListener('click', async () => {
    try {
      await api.downloadCsv();
      toast('File CSV berhasil diunduh.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
