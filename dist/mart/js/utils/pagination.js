/**
 * AITIP Mart Portal - 전사 공통 표준 페이지네이션 유틸 (ESM)
 * 좌측: 총 건수/범위, 중앙: << < 1 2 ... > >>, 우측: 페이지 크기(10/20/50)
 */

export function paginateArray(items = [], page = 1, pageSize = 10) {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paged = items.slice(startIdx, startIdx + pageSize);
  return { paged, totalCount, totalPages, page: safePage, pageSize, startIdx };
}

export function renderMartPaginationHtml({ totalCount, totalPages, page, pageSize, startIdx }, prefix = 'mart') {
  const startP = Math.max(1, Math.min(page - 2, totalPages - 4));
  const endP = Math.min(totalPages, startP + 4);
  const pageBtns = [];
  for (let pg = startP; pg <= endP; pg++) {
    pageBtns.push(`<button type="button" class="${pg === page ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-${prefix}-page" data-page="${pg}" style="height: 30px; min-width: 30px; padding: 0 8px; font-size: 12px;">${pg}</button>`);
  }
  const rangeText = totalCount === 0 ? 0 : `${startIdx + 1}~${Math.min(startIdx + pageSize, totalCount)}`;
  return `
    <div style="padding: 12px 16px; border-top: 1px solid #f1f5f9; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;">
      <div style="font-size: 12.5px; color: #64748b;">총 <b>${totalCount}</b>건 중 ${rangeText}건</div>
      <div style="display: flex; gap: 4px; align-items: center; justify-content: center;">
        <button type="button" class="mc-btn-secondary btn-${prefix}-page" data-page="1" title="처음" ${page <= 1 ? 'disabled' : ''} style="height: 30px; min-width: 30px; padding: 0 8px; font-size: 12px;">&lt;&lt;</button>
        <button type="button" class="mc-btn-secondary btn-${prefix}-page" data-page="${page - 1}" title="이전" ${page <= 1 ? 'disabled' : ''} style="height: 30px; min-width: 30px; padding: 0 8px; font-size: 12px;">&lt;</button>
        ${pageBtns.join('')}
        <button type="button" class="mc-btn-secondary btn-${prefix}-page" data-page="${page + 1}" title="다음" ${page >= totalPages ? 'disabled' : ''} style="height: 30px; min-width: 30px; padding: 0 8px; font-size: 12px;">&gt;</button>
        <button type="button" class="mc-btn-secondary btn-${prefix}-page" data-page="${totalPages}" title="끝" ${page >= totalPages ? 'disabled' : ''} style="height: 30px; min-width: 30px; padding: 0 8px; font-size: 12px;">&gt;&gt;</button>
      </div>
      <div style="display: flex; justify-content: flex-end;">
        <select id="${prefix}-page-size" class="erp-input" style="width: 90px; height: 30px; font-size: 12px;">
          ${[10, 20, 50].map(sz => `<option value="${sz}" ${pageSize === sz ? 'selected' : ''}>${sz}개씩</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}

export function bindMartPaginationEvents(container, { prefix = 'mart', totalPages, onPageChange, onSizeChange }) {
  container.querySelector(`#${prefix}-page-size`)?.addEventListener('change', (e) => {
    onSizeChange?.(Number(e.target.value) || 10);
  });
  container.querySelectorAll(`.btn-${prefix}-page`).forEach(btn => {
    btn.addEventListener('click', () => {
      const nextP = Number(btn.dataset.page);
      if (nextP >= 1 && nextP <= totalPages) onPageChange?.(nextP);
    });
  });
}
