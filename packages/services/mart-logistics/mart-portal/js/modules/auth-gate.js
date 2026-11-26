/**
 * AITIP Mart Portal - Auth Gate & 1-Hour Session Timer Module (ESM)
 * - AGENTS.md 제3·4항 준수: window 전역 오염 금지, martApi 경유 일원화
 * - 로그인 세션 1시간(3,600초) 실시간 카운트다운 + [시간 연장] + [로그아웃]
 */

import { martApi, setUnauthorizedHandler, setActiveMartId } from '../api.js';
import { esc, showToast } from '../utils/html.js';

const ROLE_LABEL = {
  SUPER_ADMIN: '슈퍼관리자',
  MART_ADMIN: '마트 관리자',
  MART_PICKER: '피킹 담당자',
  B2B_ORG: '기관 담당자'
};

let _sessionState = {
  user: null,
  expiresAt: 0,
  timerId: null,
  warnedFiveMin: false,
  onAuthenticated: null,
  initializedPortal: false
};

function formatMmSs(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function stopCountdown() {
  if (_sessionState.timerId) {
    clearInterval(_sessionState.timerId);
    _sessionState.timerId = null;
  }
}

function removeLoginOverlay() {
  const el = document.getElementById('mart-auth-overlay');
  if (el) el.remove();
}

function updateHeaderSessionBar() {
  const actions = document.querySelector('.top-header .header-actions');
  if (!actions) return;

  let bar = document.getElementById('mart-auth-session-bar');
  if (!_sessionState.user) {
    if (bar) bar.remove();
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mart-auth-session-bar';
    bar.style.cssText = 'display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border-radius:8px;background:#f8fafc;border:1px solid #cbd5e1;font-size:12px;color:#0f172a;';
    actions.prepend(bar);
  }

  const u = _sessionState.user;
  const roleLabel = ROLE_LABEL[u.role] || u.role;
  const remainSec = Math.max(0, Math.floor((_sessionState.expiresAt - Date.now()) / 1000));
  const isLow = remainSec <= 300;

  bar.innerHTML = `
    <span style="font-weight:700;">${esc(u.display_name || u.email)}</span>
    <span style="color:#475569;font-size:11px;">(${esc(roleLabel)})</span>
    <span id="mart-session-timer" style="font-family:monospace;font-weight:800;padding:2px 6px;border-radius:4px;background:${isLow ? '#fef2f2' : '#ecfdf5'};color:${isLow ? '#dc2626' : '#047857'};">${formatMmSs(remainSec)}</span>
    <button type="button" id="btn-mart-session-extend" class="btn btn-default" style="padding:3px 8px;font-size:11px;font-weight:700;">시간 연장</button>
    <button type="button" id="btn-mart-session-logout" class="btn btn-default" style="padding:3px 8px;font-size:11px;color:#b91c1c;border-color:#fecaca;">로그아웃</button>
  `;

  bar.querySelector('#btn-mart-session-extend')?.addEventListener('click', handleExtendSession);
  bar.querySelector('#btn-mart-session-logout')?.addEventListener('click', handleLogout);

  const footerName = document.querySelector('.sidebar-footer .user-name');
  if (footerName) footerName.textContent = `${u.display_name || u.email} (${roleLabel})`;
}

function startCountdown() {
  stopCountdown();
  _sessionState.warnedFiveMin = false;
  updateHeaderSessionBar();

  _sessionState.timerId = setInterval(() => {
    const remainSec = Math.max(0, Math.floor((_sessionState.expiresAt - Date.now()) / 1000));
    const timerEl = document.getElementById('mart-session-timer');
    if (timerEl) {
      timerEl.textContent = formatMmSs(remainSec);
      const isLow = remainSec <= 300;
      timerEl.style.background = isLow ? '#fef2f2' : '#ecfdf5';
      timerEl.style.color = isLow ? '#dc2626' : '#047857';
    }
    if (remainSec <= 300 && remainSec > 0 && !_sessionState.warnedFiveMin) {
      _sessionState.warnedFiveMin = true;
      showToast('로그인 세션 만료가 5분 미만 남았습니다. 상단 [시간 연장]을 눌러 연장하세요.', 'error');
    }
    if (remainSec <= 0) {
      stopCountdown();
      _sessionState.user = null;
      updateHeaderSessionBar();
      showLoginOverlay('로그인 유효시간(1시간)이 만료되었습니다. 다시 로그인해 주세요.');
    }
  }, 1000);
}

async function handleExtendSession() {
  const btn = document.getElementById('btn-mart-session-extend');
  if (btn) btn.disabled = true;
  try {
    const res = await martApi.extendSession();
    _sessionState.expiresAt = Number(res.expires_at || (Date.now() + 3600 * 1000));
    _sessionState.warnedFiveMin = false;
    startCountdown();
    showToast('로그인 시간이 1시간 연장되었습니다.', 'success');
  } catch (err) {
    showToast(`시간 연장 실패: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await martApi.logout();
  } catch (_) {}
  stopCountdown();
  _sessionState.user = null;
  _sessionState.expiresAt = 0;
  setActiveMartId('');
  updateHeaderSessionBar();
  showLoginOverlay('로그아웃되었습니다.');
}

function showLoginOverlay(noticeMessage = '') {
  removeLoginOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'mart-auth-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,0.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;';

  overlay.innerHTML = `
    <div style="width:100%;max-width:400px;background:#ffffff;border-radius:14px;box-shadow:0 24px 48px rgba(15,23,42,0.28);padding:28px 24px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9px;background:#007749;color:#fff;font-weight:800;font-size:14px;">NH</span>
        <div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;">하나로마트 위탁운영 로그인</div>
          <div style="font-size:12px;color:#64748b;">보안 세션 유효시간: 1시간 (상단에서 연장 가능)</div>
        </div>
      </div>

      ${noticeMessage ? `<div id="mart-auth-notice" style="margin-bottom:14px;padding:9px 11px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12px;font-weight:600;">${esc(noticeMessage)}</div>` : '<div id="mart-auth-notice" style="display:none;margin-bottom:14px;padding:9px 11px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12px;font-weight:600;"></div>'}

      <form id="mart-auth-form" style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label for="mart-auth-email" style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;">관리자 이메일</label>
          <input id="mart-auth-email" type="email" required autocomplete="username" placeholder="mart@aitip.com"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;" />
        </div>
        <div>
          <label for="mart-auth-password" style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;">비밀번호</label>
          <input id="mart-auth-password" type="password" required autocomplete="current-password" placeholder="비밀번호 입력"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;" />
        </div>
        <button type="submit" id="mart-auth-submit"
          style="margin-top:6px;padding:11px 14px;border:none;border-radius:8px;background:#007749;color:#ffffff;font-size:14px;font-weight:800;cursor:pointer;">
          로그인
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const form = overlay.querySelector('#mart-auth-form');
  const emailInput = overlay.querySelector('#mart-auth-email');
  const pwInput = overlay.querySelector('#mart-auth-password');
  const submitBtn = overlay.querySelector('#mart-auth-submit');
  const noticeEl = overlay.querySelector('#mart-auth-notice');
  emailInput?.focus();

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = String(emailInput?.value || '').trim();
    const password = String(pwInput?.value || '');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '인증 확인 중...';
    }
    try {
      const res = await martApi.login(email, password);
      _sessionState.user = res.user;
      _sessionState.expiresAt = Number(res.expires_at || (Date.now() + 3600 * 1000));
      if (res.user?.mart_id) setActiveMartId(res.user.mart_id);
      removeLoginOverlay();
      startCountdown();
      showToast(`${res.user?.display_name || res.user?.email}님 로그인되었습니다. (1시간 유효)`, 'success');
      if (!_sessionState.initializedPortal) {
        _sessionState.initializedPortal = true;
        _sessionState.onAuthenticated?.(res.user);
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

export async function initMartAuthGate({ onAuthenticated } = {}) {
  _sessionState.onAuthenticated = onAuthenticated;

  setUnauthorizedHandler((msg) => {
    stopCountdown();
    _sessionState.user = null;
    updateHeaderSessionBar();
    showLoginOverlay(msg);
  });

  try {
    const me = await martApi.getAuthMe();
    if (me?.authenticated && me?.user) {
      _sessionState.user = me.user;
      _sessionState.expiresAt = Number(me.expires_at || (Date.now() + 3600 * 1000));
      if (me.user.mart_id) setActiveMartId(me.user.mart_id);
      startCountdown();
      _sessionState.initializedPortal = true;
      onAuthenticated?.(me.user);
      return;
    }
    showLoginOverlay('');
  } catch (err) {
    // 로컬 dev-server(D1 미바인딩, /auth/me 404) 환경 호환
    if (err?.status === 404 && ['localhost', '127.0.0.1'].includes(location.hostname)) {
      _sessionState.initializedPortal = true;
      onAuthenticated?.(null);
      return;
    }
    showLoginOverlay('인증 상태를 확인할 수 없습니다. 로그인해 주세요.');
  }
}
