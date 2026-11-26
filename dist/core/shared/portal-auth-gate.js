/**
 * AITIP Platform - Shared Portal Auth Gate & 1-Hour Session Timer (ESM)
 * 전사 관리자 포털(/admin/, /food/, /mart/) 공용 로그인 · 역할 검증 · 1시간 카운트다운 · 연장 · 로그아웃 모듈
 * - AGENTS.md 제3·4항 준수: 전역 오염 0%, 중앙 세션 API(/api/mart/auth/*) 일원화
 */

const AUTH_BASE = '/api/mart/auth';

const ROLE_LABEL = {
  SUPER_ADMIN: '슈퍼관리자',
  MART_ADMIN: '마트 관리자',
  MART_PICKER: '피킹 담당자',
  B2B_ORG: '기관 담당자'
};

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMmSs(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

async function authFetch(path, options = {}) {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function showInlineNotice(msg, isError = false) {
  const prev = document.getElementById('aitip-portal-auth-toast');
  if (prev) prev.remove();
  const el = document.createElement('div');
  el.id = 'aitip-portal-auth-toast';
  el.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:2500;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:700;color:#fff;background:${isError ? '#dc2626' : '#0f172a'};box-shadow:0 10px 25px rgba(15,23,42,0.25);`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export async function initPortalAuthGate({
  title = 'AITIP 관리자 로그인',
  badgeText = 'HQ',
  badgeColor = '#0f172a',
  allowedRoles = ['SUPER_ADMIN'],
  headerSelector = '.header-right',
  placeholderEmail = '이메일 입력',
  onAuthenticated = null
} = {}) {
  const state = {
    user: null,
    expiresAt: 0,
    timerId: null,
    warnedFiveMin: false,
    initialized: false
  };

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function removeOverlay() {
    const el = document.getElementById('aitip-portal-auth-overlay');
    if (el) el.remove();
  }

  function renderSessionBar() {
    const host = headerSelector ? document.querySelector(headerSelector) : null;
    let bar = document.getElementById('aitip-portal-session-bar');
    if (!state.user) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'aitip-portal-session-bar';
      if (host) {
        bar.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:8px;background:#f8fafc;border:1px solid #cbd5e1;font-size:12px;color:#0f172a;margin-right:6px;white-space:nowrap;';
        host.prepend(bar);
      } else {
        bar.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:1600;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;background:rgba(248,250,252,0.96);border:1px solid #cbd5e1;box-shadow:0 8px 20px rgba(15,23,42,0.16);font-size:12px;color:#0f172a;white-space:nowrap;';
        document.body.appendChild(bar);
      }
    }
    const roleLabel = ROLE_LABEL[state.user.role] || state.user.role;
    const remainSec = Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000));
    const isLow = remainSec <= 300;
    bar.innerHTML = `
      <span style="font-weight:700;">${esc(state.user.display_name || state.user.email)}</span>
      <span style="color:#475569;font-size:11px;">(${esc(roleLabel)})</span>
      <span id="aitip-portal-session-timer" style="font-family:monospace;font-weight:800;padding:2px 6px;border-radius:4px;background:${isLow ? '#fef2f2' : '#ecfdf5'};color:${isLow ? '#dc2626' : '#047857'};">${formatMmSs(remainSec)}</span>
      <button type="button" id="btn-aitip-session-extend" style="padding:3px 7px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font-size:11px;font-weight:700;cursor:pointer;">시간 연장</button>
      <button type="button" id="btn-aitip-session-logout" style="padding:3px 7px;border:1px solid #fecaca;border-radius:6px;background:#fff;color:#b91c1c;font-size:11px;font-weight:700;cursor:pointer;">로그아웃</button>
    `;

    bar.querySelector('#btn-aitip-session-extend')?.addEventListener('click', async () => {
      try {
        const res = await authFetch('/extend', { method: 'POST' });
        state.expiresAt = Number(res.expires_at || (Date.now() + 3600 * 1000));
        state.warnedFiveMin = false;
        startTimer();
        showInlineNotice('로그인 시간이 1시간 연장되었습니다.');
      } catch (err) {
        showInlineNotice(`시간 연장 실패: ${err.message}`, true);
      }
    });

    bar.querySelector('#btn-aitip-session-logout')?.addEventListener('click', async () => {
      try { await authFetch('/logout', { method: 'POST' }); } catch (_) {}
      stopTimer();
      state.user = null;
      renderSessionBar();
      showOverlay('로그아웃되었습니다.');
    });
  }

  function startTimer() {
    stopTimer();
    state.warnedFiveMin = false;
    renderSessionBar();
    state.timerId = setInterval(() => {
      const remainSec = Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000));
      const el = document.getElementById('aitip-portal-session-timer');
      if (el) {
        el.textContent = formatMmSs(remainSec);
        const isLow = remainSec <= 300;
        el.style.background = isLow ? '#fef2f2' : '#ecfdf5';
        el.style.color = isLow ? '#dc2626' : '#047857';
      }
      if (remainSec <= 300 && remainSec > 0 && !state.warnedFiveMin) {
        state.warnedFiveMin = true;
        showInlineNotice('세션 만료가 5분 미만 남았습니다. [시간 연장]을 눌러 연장하세요.', true);
      }
      if (remainSec <= 0) {
        stopTimer();
        state.user = null;
        renderSessionBar();
        showOverlay('로그인 유효시간(1시간)이 만료되었습니다. 다시 로그인해 주세요.');
      }
    }, 1000);
  }

  function showOverlay(noticeMsg = '', showSwitchAccount = false) {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'aitip-portal-auth-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2400;background:rgba(15,23,42,0.78);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="width:100%;max-width:410px;background:#ffffff;border-radius:14px;box-shadow:0 24px 48px rgba(15,23,42,0.3);padding:28px 24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:36px;padding:0 8px;border-radius:9px;background:${esc(badgeColor)};color:#fff;font-weight:800;font-size:13px;">${esc(badgeText)}</span>
          <div>
            <div style="font-size:16px;font-weight:800;color:#0f172a;">${esc(title)}</div>
            <div style="font-size:12px;color:#64748b;">보안 세션 유효시간: 1시간 (상단에서 연장 가능)</div>
          </div>
        </div>
        <div id="aitip-portal-auth-notice" style="${noticeMsg ? '' : 'display:none;'}margin-bottom:14px;padding:9px 11px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12px;font-weight:600;">${esc(noticeMsg)}</div>
        ${showSwitchAccount ? `<button type="button" id="btn-aitip-switch-account" style="width:100%;margin-bottom:12px;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#0f172a;font-size:12px;font-weight:700;cursor:pointer;">현재 계정 로그아웃 후 다른 계정으로 로그인</button>` : ''}
        <form id="aitip-portal-auth-form" style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label for="aitip-portal-email" style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;">관리자 이메일</label>
            <input id="aitip-portal-email" type="email" required autocomplete="username" placeholder="${esc(placeholderEmail)}"
              style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;" />
          </div>
          <div>
            <label for="aitip-portal-pw" style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;">비밀번호</label>
            <input id="aitip-portal-pw" type="password" required autocomplete="current-password" placeholder="비밀번호 입력"
              style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;" />
          </div>
          <button type="submit" id="aitip-portal-submit"
            style="margin-top:6px;padding:11px 14px;border:none;border-radius:8px;background:${esc(badgeColor)};color:#ffffff;font-size:14px;font-weight:800;cursor:pointer;">
            로그인
          </button>
          <a href="/" style="text-align:center;font-size:12px;color:#64748b;text-decoration:none;margin-top:4px;">서비스 관제 허브로 돌아가기</a>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-aitip-switch-account')?.addEventListener('click', async () => {
      try { await authFetch('/logout', { method: 'POST' }); } catch (_) {}
      showOverlay('로그아웃되었습니다. 권한이 있는 계정으로 로그인해 주세요.', false);
    });

    const form = overlay.querySelector('#aitip-portal-auth-form');
    const emailEl = overlay.querySelector('#aitip-portal-email');
    const pwEl = overlay.querySelector('#aitip-portal-pw');
    const submitBtn = overlay.querySelector('#aitip-portal-submit');
    const noticeEl = overlay.querySelector('#aitip-portal-auth-notice');
    emailEl?.focus();

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '인증 확인 중...';
      }
      try {
        const res = await authFetch('/login', {
          method: 'POST',
          body: JSON.stringify({
            email: String(emailEl?.value || '').trim(),
            password: String(pwEl?.value || '')
          })
        });
        if (!allowedRoles.includes(res.user?.role)) {
          if (noticeEl) {
            noticeEl.style.display = 'block';
            noticeEl.textContent = `현재 계정(${res.user?.email}, ${ROLE_LABEL[res.user?.role] || res.user?.role})은 이 포털 접근 권한이 없습니다.`;
          }
          return;
        }
        state.user = res.user;
        state.expiresAt = Number(res.expires_at || (Date.now() + 3600 * 1000));
        removeOverlay();
        startTimer();
        showInlineNotice(`${res.user?.display_name || res.user?.email}님 로그인되었습니다. (1시간 유효)`);
        if (!state.initialized) {
          state.initialized = true;
          await onAuthenticated?.(res.user);
        }
      } catch (err) {
        if (noticeEl) {
          noticeEl.style.display = 'block';
          noticeEl.textContent = err.message || '로그인에 실패했습니다.';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '로그인';
        }
      }
    });
  }

  try {
    const me = await authFetch('/me');
    if (me?.authenticated && me?.user) {
      if (!allowedRoles.includes(me.user.role)) {
        showOverlay(
          `현재 로그인된 계정(${me.user.email}, ${ROLE_LABEL[me.user.role] || me.user.role})은 이 포털 접근 권한이 없습니다. 슈퍼관리자 계정으로 로그인해 주세요.`,
          true
        );
        return;
      }
      state.user = me.user;
      state.expiresAt = Number(me.expires_at || (Date.now() + 3600 * 1000));
      startTimer();
      state.initialized = true;
      await onAuthenticated?.(me.user);
      return;
    }
    showOverlay('');
  } catch (err) {
    if (err?.status === 404 && ['localhost', '127.0.0.1'].includes(location.hostname)) {
      state.initialized = true;
      await onAuthenticated?.(null);
      return;
    }
    showOverlay('인증 상태를 확인할 수 없습니다. 로그인해 주세요.');
  }
}
