/**
 * AITIP Enterprise Platform - Standard Pagination Module (ESM)
 * 엔터프라이즈 ERP 공통 표준 페이지네이션 모듈
 * 100% ESM, Zero 전역 오염
 */

export function paginateItems(items = [], page = 1, pageSize = 10) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const validPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pagedItems = items.slice(startIndex, endIndex);

  return {
    pagedItems,
    total,
    page: validPage,
    pageSize,
    totalPages,
    startIndex: total > 0 ? startIndex + 1 : 0,
    endIndex
  };
}

export function renderPaginationHtml({ total, page, pageSize, totalPages, startIndex, endIndex }) {
  if (total === 0) {
    return '';
  }

  // 페이지 번호 생성 (최대 5개 표시)
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  const pageButtons = [];
  for (let p = startPage; p <= endPage; p++) {
    pageButtons.push(`
      <button type="button" class="header-btn btn-pagination-page ${p === page ? 'header-btn-primary' : ''}" data-page="${p}" style="min-width: 28px; padding: 3px 8px; font-size: 11.5px; font-weight: ${p === page ? '800' : '600'};">
        ${p}
      </button>
    `);
  }

  return `
    <div class="table-pagination-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #fafafa; border-top: 1px solid var(--border-default); flex-wrap: wrap; gap: 10px;">
      <!-- 좌측: 현재 범위 표시 -->
      <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">
        총 <b style="color: var(--text-primary); font-weight: 800;">${total.toLocaleString()}</b>개 항목 중 
        <span style="font-weight: 700; color: var(--brand-mint-text);">${startIndex} - ${endIndex}</span>개 표시
      </div>

      <!-- 중앙: 페이지네이션 네비게이션 -->
      <div style="display: flex; align-items: center; gap: 4px;">
        <button type="button" class="header-btn btn-pagination-prev" ${page <= 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 3px 8px; font-size: 11.5px;"' : 'style="padding: 3px 8px; font-size: 11.5px;"'}>
          ◀ 이전
        </button>
        ${pageButtons.join('')}
        <button type="button" class="header-btn btn-pagination-next" ${page >= totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 3px 8px; font-size: 11.5px;"' : 'style="padding: 3px 8px; font-size: 11.5px;"'}>
          다음 ▶
        </button>
      </div>

      <!-- 우측: 페이지당 건수 셀렉터 -->
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">페이지당:</span>
        <select class="erp-select pagination-page-size" style="font-size: 11.5px; padding: 3px 6px; font-weight: 700;">
          <option value="10" ${pageSize === 10 ? 'selected' : ''}>10개씩 보기</option>
          <option value="20" ${pageSize === 20 ? 'selected' : ''}>20개씩 보기</option>
          <option value="50" ${pageSize === 50 ? 'selected' : ''}>50개씩 보기</option>
        </select>
      </div>
    </div>
  `;
}

export function bindPaginationEvents(container, currentPage, onPageChange, onPageSizeChange) {
  if (!container) return;

  // 이전 페이지
  container.querySelector('.btn-pagination-prev')?.addEventListener('click', () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  });

  // 다음 페이지
  container.querySelector('.btn-pagination-next')?.addEventListener('click', () => {
    onPageChange(currentPage + 1);
  });

  // 개별 페이지 번호
  container.querySelectorAll('.btn-pagination-page').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPage = parseInt(btn.dataset.page, 10);
      if (!isNaN(targetPage) && targetPage !== currentPage) {
        onPageChange(targetPage);
      }
    });
  });

  // 페이지당 건수
  const sizeSelect = container.querySelector('.pagination-page-size');
  if (sizeSelect && onPageSizeChange) {
    sizeSelect.addEventListener('change', () => {
      const newSize = parseInt(sizeSelect.value, 10);
      if (!isNaN(newSize)) {
        onPageSizeChange(newSize);
      }
    });
  }
}
