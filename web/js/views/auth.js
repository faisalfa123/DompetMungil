/* Authentication View (Login & Initial Account Setup) */

import { api, setSession } from '../api.js';
import { state, esc, toast } from '../store.js';
import { ghibliMascot, icon } from '../icons.js';

export function renderAuth(container, { onSuccess }) {
  let isSetup = !state.initialized;
  let errorMsg = '';

  const render = () => {
    container.innerHTML = `
      <main class="auth-wrap">
        <section class="auth-card" aria-labelledby="auth-heading">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-flex;margin-bottom:10px;">
              ${ghibliMascot(state.settings.theme, 'happy', 68)}
            </div>
            <h1 id="auth-heading" style="font-size:1.65rem;">DompetMungil</h1>
            <p class="card-sub" style="margin-top:4px;">
              ${isSetup
                ? 'Buat akun lokal pertama untuk menjaga catatan keuangan keluarga Anda.'
                : 'Masuk ke buku catatan keuangan lokal Anda.'}
            </p>
          </div>

          ${errorMsg ? `<div class="toast error" style="margin-bottom:14px;" role="alert">${esc(errorMsg)}</div>` : ''}

          <form id="auth-form" class="stack-16">
            <div class="field">
              <label for="auth-user">Nama Pengguna</label>
              <input id="auth-user" name="username" type="text" class="input" minlength="3" autocomplete="username" placeholder="Minimal 3 karakter" required />
            </div>
            <div class="field">
              <label for="auth-pass">Kata Sandi</label>
              <input id="auth-pass" name="password" type="password" class="input" minlength="6" autocomplete="${isSetup ? 'new-password' : 'current-password'}" placeholder="Minimal 6 karakter" required />
            </div>

            ${isSetup ? `
              <div class="grid-2">
                <div class="field">
                  <label for="auth-mode">Mode Buku</label>
                  <select id="auth-mode" name="account_mode" class="select">
                    <option value="family">Keluarga</option>
                    <option value="personal">Pribadi</option>
                  </select>
                </div>
                <div class="field">
                  <label for="auth-role">Peran</label>
                  <select id="auth-role" name="role" class="select">
                    <option value="suami">Suami / Admin</option>
                    <option value="istri">Istri / Admin</option>
                    <option value="personal">Pribadi</option>
                    <option value="anak">Anak</option>
                  </select>
                </div>
              </div>
            ` : ''}

            <button type="submit" class="btn btn-primary" id="btn-auth-submit" style="width:100%;">
              ${icon('lock', 16)} ${isSetup ? 'Buat Akun & Mulai' : 'Masuk ke DompetMungil'}
            </button>
          </form>

          <div style="text-align:center;margin-top:16px;">
            <button type="button" class="btn btn-sm btn-ghost" id="btn-toggle-auth">
              ${isSetup ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Buat akun baru'}
            </button>
          </div>
        </section>
      </main>
    `;

    container.querySelector('#btn-toggle-auth')?.addEventListener('click', () => {
      isSetup = !isSetup;
      errorMsg = '';
      render();
    });

    container.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = container.querySelector('#btn-auth-submit');
      btn.disabled = true;
      errorMsg = '';

      try {
        let data;
        if (isSetup) {
          data = await api.initAdmin({
            username: String(fd.get('username') || '').trim(),
            password: String(fd.get('password') || ''),
            account_mode: fd.get('account_mode') || 'family',
            role: fd.get('role') || 'suami',
          });
          toast('Akun lokal berhasil dibuat.');
        } else {
          data = await api.login({
            username: String(fd.get('username') || '').trim(),
            password: String(fd.get('password') || ''),
          });
          toast('Selamat datang kembali.');
        }
        setSession(data);
        state.user = data;
        state.initialized = true;
        onSuccess();
      } catch (err) {
        errorMsg = err.message || 'Gagal memproses autentikasi.';
        render();
      }
    });
  };

  render();
}
