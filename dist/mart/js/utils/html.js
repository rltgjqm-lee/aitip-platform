/**
 * AITIP Mart Portal - 공통 HTML 이스케이프 & ESM 이벤트 유틸 (ESM)
 */

export function escapeHtml(v = '') {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const esc = escapeHtml;

export function bindStopPropagation(container) {
  if (!container) return;
  container.querySelectorAll('.mc-stop-prop').forEach(el => {
    el.addEventListener('click', (e) => e.stopPropagation());
  });
}

export function showToast(message, tone = 'info') {
  const prev = document.getElementById('mart-portal-toast');
  if (prev) prev.remove();
  const colors = {
    success: { bg: '#065f46', border: '#10b981' },
    error:   { bg: '#991b1b', border: '#f87171' },
    warn:    { bg: '#92400e', border: '#fbbf24' },
    info:    { bg: '#0f172a', border: '#38bdf8' }
  };
  const c = colors[tone] || colors.info;
  const el = document.createElement('div');
  el.id = 'mart-portal-toast';
  el.style.cssText = `position:fixed;top:16px;right:16px;z-index:2000;background:${c.bg};color:#fff;padding:11px 16px;border-radius:10px;border-left:4px solid ${c.border};box-shadow:0 10px 25px rgba(15,23,42,0.25);font-size:13px;font-weight:600;max-width:360px;line-height:1.45;`;
  el.textContent = String(message || '');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
