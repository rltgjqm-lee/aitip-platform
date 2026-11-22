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
