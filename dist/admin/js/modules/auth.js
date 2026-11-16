/**
 * ============================================================================
 * AITIP Enterprise Platform Admin Authentication & RBAC Controller (ESM)
 * Standard: Enatega Login.jsx + DOC-18 3-Tier Hierarchy Access Control
 * ============================================================================
 */

import { adminApi } from '../admin-api.js';

export function setupAuth(onUserChange) {
  const modalOverlay = document.getElementById('login-modal-overlay');
  const btnLogout = document.getElementById('btn-operator-logout');
  const formLogin = document.getElementById('form-admin-login');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const inputId = document.getElementById('login-input-id');
  const inputPw = document.getElementById('login-input-pw');
  const inputOtp = document.getElementById('login-input-otp');

  // 1. 현재 세션 로드 및 사이드바 표시
  let currentUser = adminApi.getCurrentUser();
  updateOperatorUI(currentUser);

  // 2. 프리셋 버튼 클릭 바인딩
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.getAttribute('data-id');
      if (inputId) inputId.value = targetId;
      if (inputPw) inputPw.value = '••••••••••••';
      if (inputOtp) inputOtp.value = '898901';
    });
  });

  // 3. 로그인 폼 제출
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = inputId?.value || 'admin_hq';
      const pw = inputPw?.value || '';
      const otp = inputOtp?.value || '';

      const submitBtn = document.getElementById('btn-login-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '2FA 보안 인증 확인 중...';
      }

      const res = await adminApi.login(id, pw, otp);
      currentUser = res.user;
      updateOperatorUI(currentUser);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '보안 세션 로그인 및 콘솔 진입';
      }

      closeLoginModal();
      if (typeof onUserChange === 'function') {
        onUserChange(currentUser);
      }
    });
  }

  // 4. 로그아웃 클릭
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      await adminApi.logout();
      currentUser = null;
      openLoginModal();
    });
  }

  function openLoginModal() {
    if (modalOverlay) modalOverlay.style.display = 'flex';
  }

  function closeLoginModal() {
    if (modalOverlay) modalOverlay.style.display = 'none';
  }

  function updateOperatorUI(user) {
    const nameEl = document.getElementById('operator-name');
    const roleEl = document.getElementById('operator-role');
    if (nameEl) nameEl.textContent = user?.name || '미인증 오퍼레이터';
    if (roleEl) roleEl.textContent = user?.role_label || '로그인 필요';
  }

  return {
    getCurrentUser: () => currentUser,
    openLoginModal,
    closeLoginModal
  };
}
