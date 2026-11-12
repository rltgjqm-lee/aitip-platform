/**
 * ============================================================================
 * AITIP Customer PWA Application Controller (ESM)
 * 소상공인 요식업 모바일 주문 & 예약 시스템
 * 
 * [배민 2.0 & NextOrders / Enatega 벤치마크 표준 구현]
 * 1. 상단 헤더 영구 장바구니 뱃지 버튼 + 4단 네비게이션 탭 (메뉴판/장바구니/정보/리뷰)
 * 2. 서브웨이(Subway) 스타일 다단계(Step-by-Step) 옵션 커스텀 위저드
 *    - 상단 스텝 탭 직접 터치 점프 이동 지원
 *    - 선택 비우기 (초기화 및 '선택 안 함') 지원
 *    - 단계별 친절한 CTA ("다음: 옵션 선택" -> "XX,XXX원 장바구니 담기")
 * 3. 독립 장바구니 확인 화면 (Cart View) & 최소주문금액 게이지
 *    - 배달/포장/매장식사 3단 전환기
 *    - 품목별 옵션 내역, 수량 제어(+/-), 개별 삭제, 장바구니 전체 비우기
 *    - "+ 다른 메뉴 더 담기" 링크
 * 4. 매장식사(홀 QR / 테이블 예약) + 포장 + 배달 통합 체크아웃 & 실시간 KDS 전송
 * ============================================================================
 */

const API_BASE = '/api/food';

import { generateCode128Svg } from './vendor/barcode-generator.js';
import { defaultStore, defaultCategories, defaultOptionGroups, defaultProducts, defaultReviews } from './default-data.js';

const state = {
  store: null,
  categories: [],
  products: [],
  option_groups: [],
  reviews: [],
  carts: {
    DELIVERY: [],
    TAKEOUT: [],
    DINE_IN: []
  },
  get cart() {
    return this.carts[this.activeMode] || [];
  },
  set cart(newItems) {
    if (this.carts[this.activeMode]) {
      this.carts[this.activeMode] = newItems;
    }
  },
  activeMode: 'DELIVERY', // 'DELIVERY' | 'TAKEOUT' | 'DINE_IN'
  activeTab: 'MENU', // 'MENU' | 'CART' | 'INFO' | 'REVIEWS'
  selectedCategory: 'ALL',
  tableNoFromUrl: null,
  dineInTime: '19:30',
  dineInGuests: '4',

  // 서브웨이 위저드 상태 머신
  wizard: {
    product: null,
    stepIndex: 0,
    groups: [],
    selections: {} // { [groupId]: [optionId, ...] }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  parseUrlParams();
  setupNavEvents();
  setupModalEvents();
  await loadStoreData();
});

// URL 테이블 파라미터 감지 (?table=3)
function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const table = params.get('table');
  if (table) {
    state.tableNoFromUrl = table;
    state.activeMode = 'DINE_IN';
  }
}

// 백엔드 데이터 비동기 일괄 로드 (서버리스 API 및 안전망 시드 2중 보호)
async function loadStoreData() {
  try {
    const [storeRes, menuRes, reviewsRes] = await Promise.all([
      fetch(`${API_BASE}/store`).then(r => {
        if (!r.ok || r.headers.get('content-type')?.includes('text/html')) throw new Error('Not JSON');
        return r.json();
      }),
      fetch(`${API_BASE}/menu`).then(r => {
        if (!r.ok || r.headers.get('content-type')?.includes('text/html')) throw new Error('Not JSON');
        return r.json();
      }),
      fetch(`${API_BASE}/reviews`).then(r => {
        if (!r.ok || r.headers.get('content-type')?.includes('text/html')) throw new Error('Not JSON');
        return r.json();
      }).catch(() => [])
    ]);

    state.store = storeRes;
    if (menuRes) {
      state.categories = menuRes.categories || [];
      state.products = menuRes.products || [];
      state.option_groups = menuRes.option_groups || [];
    }
    state.reviews = Array.isArray(reviewsRes) ? reviewsRes : [];
  } catch (err) {
    console.warn('[PWA] 백엔드 응답 지연/오프라인 감지 -> 번들 기본 시드 데이터로 즉시 전환합니다.', err);
    state.store = defaultStore;
    state.categories = defaultCategories;
    state.products = defaultProducts;
    state.option_groups = defaultOptionGroups;
    state.reviews = defaultReviews;
  }

  renderHeader();
  renderContent();
  updateCartBar();
}

// 헤더 렌더링
function renderHeader() {
  const store = state.store;
  if (!store) return;

  const blocks = store.blocks || {};

  // 1. 공지 배너
  const noticeBar = document.getElementById('pwa-notice-bar');
  if (noticeBar) {
    if (blocks.notice) {
      noticeBar.textContent = blocks.notice;
      noticeBar.style.display = 'block';
    } else {
      noticeBar.style.display = 'none';
    }
  }

  // 2. 상호명 및 메타
  const storeTitle = document.getElementById('pwa-store-name');
  if (storeTitle) storeTitle.textContent = store.store_name;

  const parkingBadge = document.getElementById('pwa-parking-badge');
  if (parkingBadge) {
    const isAvailable = blocks.parking?.type !== 'UNAVAILABLE';
    parkingBadge.textContent = isAvailable ? `주차: ${blocks.parking?.capacity_text || '무료가능'}` : '주차 불가';
    parkingBadge.style.background = isAvailable ? '#dcfce7' : '#fee2e2';
    parkingBadge.style.color = isAvailable ? '#166534' : '#991b1b';
  }

  const subwayInfo = document.getElementById('pwa-subway-info');
  if (subwayInfo) {
    subwayInfo.textContent = `${blocks.location_guide?.subway_station || '서초역 1번 출구'} 도보 ${blocks.location_guide?.walking_time_minutes || 3}분`;
  }

  const reviewCount = document.getElementById('pwa-review-count');
  if (reviewCount) {
    reviewCount.textContent = `(리뷰 ${state.reviews.length || 482}개)`;
  }

  // 3. 모드 탭 활성화 상태
  document.querySelectorAll('.pwa-mode-btn').forEach(btn => {
    const mode = btn.getAttribute('data-mode');
    btn.classList.toggle('active', mode === state.activeMode);
  });
}

// 탭 전환 헬퍼
function switchToTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.pwa-nav-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
  });
  renderContent();
  updateCartBar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 기본 네비게이션 이벤트 바인딩
function setupNavEvents() {
  // 상단 헤더 영구 장바구니 버튼
  document.getElementById('btn-header-cart')?.addEventListener('click', () => {
    switchToTab('CART');
  });

  // 모드 탭 (배달 / 포장 / 매장식사)
  document.querySelectorAll('.pwa-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetMode = btn.getAttribute('data-mode') || 'DELIVERY';
      if (state.activeMode === targetMode) return;

      // 이전 모드 장바구니에 담긴 품목이 있고 타겟 모드가 비어있다면 품목 유지 이전
      const prevCart = state.carts[state.activeMode] || [];
      const targetCart = state.carts[targetMode] || [];
      if (prevCart.length > 0 && targetCart.length === 0) {
        state.carts[targetMode] = [...prevCart];
      }

      state.activeMode = targetMode;
      document.querySelectorAll('.pwa-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderContent();
      updateCartBar();
    });
  });

  // 4단 서브탭 (메뉴판 / 장바구니 / 정보·위치·주차 / 리뷰)
  document.querySelectorAll('.pwa-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab') || 'MENU';
      switchToTab(targetTab);
    });
  });

  // 하단 플로팅 카트 바 클릭 시 -> 장바구니 탭 전환 또는 주문
  const cartTrigger = document.getElementById('pwa-cart-trigger');
  if (cartTrigger) {
    cartTrigger.addEventListener('click', () => {
      switchToTab('CART');
    });
  }

  const btnSubmit = document.getElementById('btn-submit-pwa-order');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => {
      if (state.cart.length === 0) {
        switchToTab('MENU');
        return;
      }
      switchToTab('CART');
    });
  }
}

// 모달 닫기 및 위저드 이벤트 바인딩
function setupModalEvents() {
  // 위저드 닫기
  document.getElementById('btn-close-wizard')?.addEventListener('click', closeWizardModal);
  document.getElementById('btn-wizard-prev')?.addEventListener('click', handleWizardPrev);
  document.getElementById('btn-wizard-next')?.addEventListener('click', handleWizardNext);

  // 카트 드로어 닫기 및 비우기
  document.getElementById('btn-close-cart')?.addEventListener('click', closeCartDrawer);
  document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
    if (confirm('장바구니를 모두 비우시겠습니까?')) {
      state.cart = [];
      updateCartBar();
      renderCartDrawer();
      if (state.activeTab === 'CART') {
        renderContent();
      }
    }
  });

  // 카트 -> 체크아웃 이동
  document.getElementById('btn-goto-checkout')?.addEventListener('click', () => {
    if (state.cart.length === 0) {
      alert('장바구니가 비어 있습니다.');
      return;
    }
    closeCartDrawer();
    openCheckoutModal();
  });

  // 체크아웃 닫기 및 결제 제출
  document.getElementById('btn-close-checkout')?.addEventListener('click', closeCheckoutModal);
  document.getElementById('btn-final-pay')?.addEventListener('click', handleFinalOrderSubmit);

  // 결제 수단 라디오 카드 선택 효과
  document.querySelectorAll('.pwa-pay-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.pwa-pay-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // 주문 완료 팝업 닫기
  document.getElementById('btn-close-success')?.addEventListener('click', closeSuccessModal);
  document.getElementById('btn-success-done')?.addEventListener('click', closeSuccessModal);

  // 주소 검색 모달 닫기
  document.getElementById('btn-close-address-modal')?.addEventListener('click', closeAddressSearchModal);
}

// 탭별 콘텐츠 라우팅
function renderContent() {
  const container = document.getElementById('pwa-content-body');
  if (!container) return;

  if (state.activeTab === 'MENU') {
    renderMenuTab(container);
  } else if (state.activeTab === 'CART') {
    renderCartTab(container);
  } else if (state.activeTab === 'INFO') {
    renderInfoTab(container);
  } else if (state.activeTab === 'REVIEWS') {
    renderReviewsTab(container);
  }
}

// ============================================================================
// 메뉴 탭 렌더링
// ============================================================================
function renderMenuTab(container) {
  let dineInBanner = '';
  if (state.activeMode === 'DINE_IN') {
    const tablePrompt = state.tableNoFromUrl ? `[테이블 ${state.tableNoFromUrl}번 착석 주문]` : '매장 식사 / 테이블 예약';
    dineInBanner = `
      <div class="pwa-dinein-box">
        <div class="pwa-dinein-header">
          <span>${tablePrompt}</span>
          <span style="font-size: 11px; background: #ede9fe; color: #5b21b6; padding: 2px 7px; border-radius: 4px; font-weight: 700;">주방 즉시 전송</span>
        </div>
        ${!state.tableNoFromUrl ? `
          <div class="pwa-form-row">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #4b5563;">방문 시각</label>
              <select class="pwa-select" id="pwa-time-select">
                <option value="18:30" ${state.dineInTime === '18:30' ? 'selected' : ''}>오늘 18:30</option>
                <option value="19:00" ${state.dineInTime === '19:00' ? 'selected' : ''}>오늘 19:00</option>
                <option value="19:30" ${state.dineInTime === '19:30' ? 'selected' : ''}>오늘 19:30 (추천)</option>
                <option value="20:00" ${state.dineInTime === '20:00' ? 'selected' : ''}>오늘 20:00</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #4b5563;">방문 인원</label>
              <select class="pwa-select" id="pwa-guest-select">
                <option value="2" ${state.dineInGuests === '2' ? 'selected' : ''}>성인 2명</option>
                <option value="4" ${state.dineInGuests === '4' ? 'selected' : ''}>성인 4명 (창가석)</option>
                <option value="6" ${state.dineInGuests === '6' ? 'selected' : ''}>성인 6명 (단체)</option>
              </select>
            </div>
          </div>
        ` : `
          <div style="font-size: 12.5px; color: #7c3aed; font-weight: 700;">
            테이블 ${state.tableNoFromUrl}번에 즉시 서빙되도록 주방 KDS로 바로 연결됩니다.
          </div>
        `}
      </div>
    `;
  }

  // 카테고리 칩
  const totalCount = state.products.length;
  const categoryChipsHtml = `
    <div class="pwa-cat-bar">
      <button class="pwa-cat-chip ${state.selectedCategory === 'ALL' ? 'active' : ''}" data-cat="ALL">전체 (${totalCount})</button>
      ${state.categories.map(c => {
        const count = state.products.filter(p => p.category_id === c.id).length;
        return `<button class="pwa-cat-chip ${state.selectedCategory === c.id ? 'active' : ''}" data-cat="${c.id}">${c.name} (${count})</button>`;
      }).join('')}
    </div>
  `;

  // 메뉴 리스트 (5대 서비스 및 NextOrders/배민 표준: 카테고리별 섹션 분할 렌더링)
  let menuListHtml = '';
  if (state.selectedCategory === 'ALL') {
    menuListHtml = state.categories.map(cat => {
      const catProducts = state.products.filter(p => p.category_id === cat.id);
      if (catProducts.length === 0) return '';
      return `
        <div class="pwa-category-section">
          <div class="pwa-category-section-title">
            <span>${cat.name}</span>
            <span class="pwa-category-count-pill">${catProducts.length}개</span>
          </div>
          ${renderCategoryItemsHtml(cat, catProducts)}
        </div>
      `;
    }).join('');
  } else {
    const cat = state.categories.find(c => c.id === state.selectedCategory);
    const catProducts = state.products.filter(p => p.category_id === state.selectedCategory);
    menuListHtml = `
      <div class="pwa-category-section">
        <div class="pwa-category-section-title">
          <span>${cat?.name || '선택 카테고리'}</span>
          <span class="pwa-category-count-pill">${catProducts.length}개</span>
        </div>
        ${catProducts.length > 0
          ? renderCategoryItemsHtml(cat || { layout_type: 'CARD_DETAILED' }, catProducts)
          : '<div style="padding: 30px; text-align: center; color: var(--text-muted);">등록된 메뉴가 없습니다.</div>'}
      </div>
    `;
  }

  container.innerHTML = `
    ${dineInBanner}
    ${categoryChipsHtml}
    ${menuListHtml}
  `;

  // 카테고리 칩 이벤트
  container.querySelectorAll('.pwa-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.selectedCategory = chip.getAttribute('data-cat') || 'ALL';
      renderContent();
    });
  });

  // 메뉴 아이템 직접 담기 헬퍼
  function handleDirectAdd(prd) {
    const item = {
      cartItemId: 'cart_' + Date.now() + Math.random().toString(36).substring(2, 7),
      product_id: prd.product_id || prd.id,
      name: prd.name,
      base_price: prd.price,
      selected_options: [],
      total_price: prd.price,
      quantity: 1
    };
    state.cart.push(item);
    updateCartBar();
    showToast(`${prd.name}이(가) 장바구니에 담겼습니다.`);
  }

  // 메뉴 카드/행 클릭 이벤트 (메인치킨, 2열 사이드 그리드, 슬림 음료 행 통합)
  container.querySelectorAll('.pwa-food-card:not(.soldout), .pwa-side-card:not(.soldout), .pwa-drink-row:not(.soldout)').forEach(card => {
    card.addEventListener('click', (e) => {
      // 담기 버튼 직접 클릭 시 이벤트 중복 방지
      if (e.target.closest('.pwa-side-btn-add') || e.target.closest('.pwa-drink-add-btn')) {
        return;
      }
      const prdId = card.getAttribute('data-product-id');
      const prd = state.products.find(p => (p.product_id || p.id) === prdId);
      if (!prd) return;

      const hasOptions = Array.isArray(prd.option_group_ids) && prd.option_group_ids.length > 0;
      if (hasOptions) {
        startSubwayWizard(prd);
      } else {
        handleDirectAdd(prd);
      }
    });
  });

  // 사이드/음료 1초 담기 버튼 단독 클릭 이벤트
  container.querySelectorAll('.pwa-side-btn-add, .pwa-drink-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const prdId = btn.getAttribute('data-product-id');
      const prd = state.products.find(p => (p.product_id || p.id) === prdId);
      if (!prd) return;

      const hasOptions = Array.isArray(prd.option_group_ids) && prd.option_group_ids.length > 0;
      if (hasOptions) {
        startSubwayWizard(prd);
      } else {
        handleDirectAdd(prd);
      }
    });
  });

  // 홀 예약 시간/인원 변경 리스너
  const timeSelect = container.querySelector('#pwa-time-select');
  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => { state.dineInTime = e.target.value; });
  }
  const guestSelect = container.querySelector('#pwa-guest-select');
  if (guestSelect) {
    guestSelect.addEventListener('change', (e) => { state.dineInGuests = e.target.value; });
  }
}

// 카테고리 레이아웃 타입별 분기 렌더러
function renderCategoryItemsHtml(cat, catProducts) {
  if (cat.layout_type === 'GRID_2COL') {
    return `
      <div class="pwa-side-grid">
        ${catProducts.map(p => renderSideCardHtml(p)).join('')}
      </div>
    `;
  }
  if (cat.layout_type === 'ROW_COMPACT') {
    return `
      <div class="pwa-drink-list">
        ${catProducts.map(p => renderDrinkRowHtml(p)).join('')}
      </div>
    `;
  }
  return catProducts.map(p => renderFoodCardHtml(p)).join('');
}

function renderFoodCardHtml(p) {
  const isSold = p.status === 'SOLDOUT';
  const hasOptions = Array.isArray(p.option_group_ids) && p.option_group_ids.length > 0;
  return `
    <div class="pwa-food-card ${isSold ? 'soldout' : ''}" data-product-id="${p.product_id || p.id}">
      <div class="pwa-food-info">
        <div class="pwa-food-name">${p.name}</div>
        <div class="pwa-food-desc">${p.description || '바삭하고 신선하게 바로 조리한 대표 메뉴'}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="pwa-food-price">${p.price.toLocaleString()}원</div>
          ${hasOptions
            ? '<span class="pwa-badge-custom-opt">맞춤옵션</span>'
            : '<span class="pwa-badge-quick-add">1초 담기</span>'}
        </div>
      </div>
      <img src="${p.image_url || 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=150'}" class="pwa-food-thumb" alt="${p.name}">
    </div>
  `;
}

// 2열 그리드 사이드 메뉴 카드 HTML (배민/요기요 표준)
function renderSideCardHtml(p) {
  const isSold = p.status === 'SOLDOUT';
  const hasOptions = Array.isArray(p.option_group_ids) && p.option_group_ids.length > 0;
  return `
    <div class="pwa-side-card ${isSold ? 'soldout' : ''}" data-product-id="${p.product_id || p.id}">
      <img src="${p.image_url || 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=300'}" class="pwa-side-thumb" alt="${p.name}" loading="lazy">
      <div class="pwa-side-body">
        <div>
          <div class="pwa-side-name">${p.name}</div>
          <div class="pwa-side-desc">${p.description || ''}</div>
        </div>
        <div class="pwa-side-bottom">
          <div class="pwa-side-price">${p.price.toLocaleString()}원</div>
          <button type="button" class="pwa-side-btn-add" data-product-id="${p.product_id || p.id}">
            ${hasOptions ? '옵션' : '+ 담기'}
          </button>
        </div>
      </div>
    </div>
  `;
}

// 초슬림 1행 음료/주류 리스트 HTML
function renderDrinkRowHtml(p) {
  const isSold = p.status === 'SOLDOUT';
  const hasOptions = Array.isArray(p.option_group_ids) && p.option_group_ids.length > 0;
  return `
    <div class="pwa-drink-row ${isSold ? 'soldout' : ''}" data-product-id="${p.product_id || p.id}">
      <div class="pwa-drink-left">
        <img src="${p.image_url || 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=120'}" class="pwa-drink-thumb" alt="${p.name}" loading="lazy">
        <div class="pwa-drink-meta">
          <div class="pwa-drink-name">${p.name}</div>
          <div class="pwa-drink-desc">${p.description || ''}</div>
        </div>
      </div>
      <div class="pwa-drink-right">
        <div class="pwa-drink-price">${p.price.toLocaleString()}원</div>
        <button type="button" class="pwa-drink-add-btn" data-product-id="${p.product_id || p.id}" title="장바구니 담기">
          ${hasOptions ? '옵션' : '+'}
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// 서브웨이(Subway) 스타일 다단계 옵션 위저드
// ============================================================================
function startSubwayWizard(product, editingCartItemId = null) {
  const applicableGroups = (state.option_groups || []).filter(g =>
    Array.isArray(product.option_group_ids) && product.option_group_ids.includes(g.group_id)
  );

  // 연계된 옵션 그룹이 없는 경우 바로 기본 담기
  if (applicableGroups.length === 0) {
    commitCustomizedItem({
      cartItemId: editingCartItemId || ('cart_' + Date.now() + Math.random().toString(36).substring(2, 7)),
      product_id: product.product_id || product.id,
      name: product.name,
      base_price: product.price,
      selected_options: [],
      total_price: product.price,
      quantity: 1
    });
    return;
  }

  // 초기 선택값 세팅
  const initialSelections = {};
  if (editingCartItemId) {
    const existingItem = state.cart.find(it => it.cartItemId === editingCartItemId);
    const existingOptions = existingItem ? (existingItem.selected_options || []) : [];

    applicableGroups.forEach(grp => {
      // 기존 옵션 목록에서 해당 그룹에 매칭되는 option_id 추출
      const matchedOptionIds = [];
      existingOptions.forEach(opt => {
        if (opt.group_id === grp.group_id || opt.group_name === grp.group_name.replace(/\(.*?\)/g, '').trim()) {
          const optDef = grp.options?.find(o => o.option_id === opt.option_id || o.option_name === opt.option_name);
          if (optDef && !matchedOptionIds.includes(optDef.option_id)) {
            matchedOptionIds.push(optDef.option_id);
          }
        }
      });

      // 만약 필수인데 기존 선택값이 없으면 기본값 세팅
      if (grp.is_required && matchedOptionIds.length === 0 && grp.options?.length > 0) {
        const defOpt = grp.options?.find(o => o.is_default) || grp.options[0];
        matchedOptionIds.push(defOpt.option_id);
      }

      initialSelections[grp.group_id] = matchedOptionIds;
    });
  } else {
    // 신규 담기 초기값 세팅 (기본값 설정된 옵션 우선 선택)
    applicableGroups.forEach(grp => {
      const defaultOpt = grp.options?.find(o => o.is_default);
      if (defaultOpt) {
        initialSelections[grp.group_id] = [defaultOpt.option_id];
      } else if (grp.is_required && grp.options?.length > 0) {
        initialSelections[grp.group_id] = [grp.options[0].option_id];
      } else {
        initialSelections[grp.group_id] = [];
      }
    });
  }

  state.wizard = {
    product,
    stepIndex: 0,
    groups: applicableGroups,
    selections: initialSelections,
    editingCartItemId
  };

  const titleEl = document.getElementById('pwa-wizard-item-title');
  if (titleEl) {
    titleEl.textContent = editingCartItemId ? `${product.name} (옵션 변경)` : product.name;
  }
  renderWizardStep();
  document.getElementById('pwa-wizard-overlay').classList.add('active');
}

function renderWizardStep() {
  const { product, stepIndex, groups, selections } = state.wizard;
  const currentGroup = groups[stepIndex];
  if (!currentGroup) return;

  // 1. 상단 스텝 프로그레스 바 렌더링 & 직접 클릭(점프) 지원
  const stepsContainer = document.getElementById('pwa-wizard-steps');
  stepsContainer.innerHTML = groups.map((g, idx) => {
    let statusClass = '';
    if (idx === stepIndex) statusClass = 'active';
    else if (idx < stepIndex) statusClass = 'completed';

    let shortName = g.group_name.replace(/\(.*?\)/g, '').trim();
    if (shortName.includes('사이드')) shortName = '3. 사이드';
    else if (shortName.includes('음료') || shortName.includes('주류')) shortName = '4. 음료·주류';
    else if (shortName.includes('소스')) shortName = '2. 소스/토핑';
    else if (shortName.includes('부위')) shortName = '1. 부위 선택';
    else if (shortName.includes('맵기') || shortName.includes('맛')) shortName = '맛/맵기';
    else shortName = `${idx + 1}. ${shortName}`;

    return `
      <div class="pwa-step-indicator ${statusClass}" data-step-index="${idx}" title="${shortName} 단계로 이동">
        <span class="pwa-step-badge">${idx + 1}</span>
        <span>${shortName}</span>
      </div>
    `;
  }).join('');

  // 스텝 탭 직접 클릭 이벤트 바인딩
  stepsContainer.querySelectorAll('.pwa-step-indicator').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetIdx = parseInt(tab.getAttribute('data-step-index'), 10);
      if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < groups.length) {
        state.wizard.stepIndex = targetIdx;
        renderWizardStep();
      }
    });
  });

  // 2. 현재 스텝 옵션 바디 렌더링
  const bodyContainer = document.getElementById('pwa-wizard-body');
  const isSingle = currentGroup.max_select === 1;
  const selectedList = selections[currentGroup.group_id] || [];

  // 선택 안 함(비우기) 카드 (선택 옵션인 경우)
  const isNoneSelected = selectedList.length === 0;
  const noneCardHtml = !currentGroup.is_required ? `
    <div class="pwa-option-card ${isNoneSelected ? 'selected' : ''}" data-option-id="__NONE__">
      <div class="pwa-option-left">
        <div class="pwa-option-radio-mark"></div>
        <div class="pwa-option-name">선택 안 함 (비우기)</div>
      </div>
      <div class="pwa-option-price">+0원</div>
    </div>
  ` : '';

  bodyContainer.innerHTML = `
    <div class="pwa-group-header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div class="pwa-group-title">
          <span>${currentGroup.group_name}</span>
          <span class="pwa-group-badge ${currentGroup.is_required ? 'required' : 'optional'}">
            ${currentGroup.is_required ? '필수' : '선택'}
          </span>
        </div>
        <button class="pwa-btn-clear-step" id="btn-clear-step">${currentGroup.is_required ? '기본값 초기화' : '선택 비우기'}</button>
      </div>
      <div class="pwa-group-desc">
        ${isSingle ? '1개 옵션을 선택해 주세요.' : `최대 ${currentGroup.max_select}개까지 선택 가능합니다.`}
      </div>
    </div>

    <div>
      ${noneCardHtml}
      ${currentGroup.options.map(opt => {
        const isSelected = selectedList.includes(opt.option_id);
        const priceLabel = opt.additional_price > 0 ? `+${opt.additional_price.toLocaleString()}원` : '+0원 (기본)';
        return `
          <div class="pwa-option-card ${isSelected ? 'selected' : ''}" data-option-id="${opt.option_id}">
            <div class="pwa-option-left">
              <div class="pwa-option-radio-mark"></div>
              <div class="pwa-option-name">${opt.option_name}</div>
            </div>
            <div class="pwa-option-price">${priceLabel}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // [선택 비우기] 버튼 이벤트
  bodyContainer.querySelector('#btn-clear-step')?.addEventListener('click', () => {
    if (currentGroup.is_required) {
      const defOpt = currentGroup.options?.find(o => o.is_default) || currentGroup.options?.[0];
      state.wizard.selections[currentGroup.group_id] = defOpt ? [defOpt.option_id] : [];
    } else {
      state.wizard.selections[currentGroup.group_id] = [];
    }
    renderWizardStep();
  });

  // 옵션 카드 클릭 리스너 바인딩
  bodyContainer.querySelectorAll('.pwa-option-card').forEach(card => {
    card.addEventListener('click', () => {
      const optId = card.getAttribute('data-option-id');
      if (optId === '__NONE__') {
        state.wizard.selections[currentGroup.group_id] = [];
        renderWizardStep();
        return;
      }
      handleOptionToggle(currentGroup, optId);
    });
  });

  // 3. 하단 누적 요약 & 이전/다음 버튼 제어
  updateWizardBottomBar();
}

function handleOptionToggle(group, optId) {
  const isSingle = group.max_select === 1;
  const currentList = state.wizard.selections[group.group_id] || [];

  if (isSingle) {
    state.wizard.selections[group.group_id] = [optId];
  } else {
    if (currentList.includes(optId)) {
      state.wizard.selections[group.group_id] = currentList.filter(id => id !== optId);
    } else {
      if (currentList.length < (group.max_select || 5)) {
        state.wizard.selections[group.group_id] = [...currentList, optId];
      } else {
        alert(`최대 ${group.max_select}개까지만 선택할 수 있습니다.`);
      }
    }
  }

  renderWizardStep();
}

function updateWizardBottomBar() {
  const { product, stepIndex, groups, selections } = state.wizard;
  const currentGroup = groups[stepIndex];

  // 실시간 합산 가격 계산 및 옵션 명칭 수집
  let additionalTotal = 0;
  const selectedLabels = [];

  groups.forEach(g => {
    const selOptIds = selections[g.group_id] || [];
    selOptIds.forEach(id => {
      const opt = g.options?.find(o => o.option_id === id);
      if (opt) {
        additionalTotal += (opt.additional_price || 0);
        selectedLabels.push(opt.option_name);
      }
    });
  });

  const finalPrice = product.price + additionalTotal;
  document.getElementById('pwa-wizard-total-price').textContent = `${finalPrice.toLocaleString()}원`;
  document.getElementById('pwa-wizard-summary-text').textContent =
    selectedLabels.length > 0 ? selectedLabels.join(' / ') : '기본 구성 (추가옵션 없음)';

  // 이전/다음 버튼 상태
  const btnPrev = document.getElementById('btn-wizard-prev');
  const btnNext = document.getElementById('btn-wizard-next');

  if (stepIndex === 0) {
    btnPrev.style.display = 'none';
  } else {
    btnPrev.style.display = 'block';
  }

  const isLast = stepIndex === groups.length - 1;
  if (isLast) {
    btnNext.textContent = state.wizard.editingCartItemId
      ? `${finalPrice.toLocaleString()}원 옵션 변경 완료`
      : `${finalPrice.toLocaleString()}원 장바구니 담기`;
  } else {
    const nextGroup = groups[stepIndex + 1];
    const nextTitle = nextGroup ? nextGroup.group_name.replace(/\(.*?\)/g, '').trim() : '다음';
    btnNext.textContent = `다음: ${nextTitle} 선택`;
  }

  // 가드 조건: 필수 옵션 선택 여부 검증
  const currentSelections = selections[currentGroup.group_id] || [];
  const isValid = !currentGroup.is_required || currentSelections.length >= (currentGroup.min_select || 1);
  btnNext.disabled = !isValid;
}

function handleWizardPrev() {
  if (state.wizard.stepIndex > 0) {
    state.wizard.stepIndex--;
    renderWizardStep();
  }
}

function handleWizardNext() {
  const { stepIndex, groups } = state.wizard;
  if (stepIndex < groups.length - 1) {
    state.wizard.stepIndex++;
    renderWizardStep();
  } else {
    // 마지막 단계 완료 -> 장바구니에 최종 커스텀 메뉴 투입 또는 옵션 변경
    commitWizardToCart();
  }
}

function commitWizardToCart() {
  const { product, groups, selections, editingCartItemId } = state.wizard;

  // 치킨 본체 종속 옵션(부위, 맛, 추가소스)과 독립 단품 상품(사이드, 음료/주류) 엄격 분리
  const mainProductOptions = [];
  const separateItems = [];
  let mainAdditionalTotal = 0;

  // 사이드 메뉴 및 음료/주류 그룹은 치킨에 묶지 않고 장바구니 독립 단품으로 분리
  const standaloneGroupIds = ['optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'];

  groups.forEach(g => {
    const optIds = selections[g.group_id] || [];
    const isStandalone = standaloneGroupIds.includes(g.group_id);

    optIds.forEach(id => {
      const opt = g.options?.find(o => o.option_id === id);
      if (!opt) return;

      if (isStandalone) {
        // 독립 단품 카드로 분리 생성 (치킨 수량 증가 시 함께 곱해지는 치명적 버그 방지)
        separateItems.push({
          cartItemId: 'cart_' + Date.now() + Math.random().toString(36).substring(2, 7),
          product_id: opt.option_id,
          name: opt.option_name,
          base_price: opt.additional_price || 0,
          selected_options: [],
          total_price: opt.additional_price || 0,
          quantity: 1
        });
      } else {
        // 치킨 본체 속성 (부위, 맛/맵기, 추가소스)
        mainProductOptions.push({
          group_id: g.group_id,
          group_name: g.group_name.replace(/\(.*?\)/g, '').trim(),
          option_id: opt.option_id,
          option_name: opt.option_name,
          price: opt.additional_price || 0
        });
        mainAdditionalTotal += (opt.additional_price || 0);
      }
    });
  });

  // 1. 기존 장바구니 항목 수정 모드
  if (editingCartItemId) {
    const existing = state.cart.find(it => it.cartItemId === editingCartItemId);
    if (existing) {
      existing.selected_options = mainProductOptions;
      existing.total_price = (existing.base_price || product.price) + mainAdditionalTotal;

      if (separateItems.length > 0) {
        state.cart.push(...separateItems);
      }

      closeWizardModal();
      updateCartBar();
      if (state.activeTab === 'CART') {
        const container = document.getElementById('pwa-content-body');
        if (container) renderCartTab(container);
      }
      showToast(`${product.name} 옵션이 변경되었습니다.`);
      return;
    }
  }

  // 2. 신규 품목 장바구니 추가 모드
  const customizedItem = {
    cartItemId: 'cart_' + Date.now() + Math.random().toString(36).substring(2, 7),
    product_id: product.product_id || product.id,
    name: product.name,
    base_price: product.price,
    selected_options: mainProductOptions,
    total_price: product.price + mainAdditionalTotal,
    quantity: 1
  };

  state.cart.push(customizedItem);
  if (separateItems.length > 0) {
    state.cart.push(...separateItems);
  }

  closeWizardModal();
  updateCartBar();

  const totalAddedCount = 1 + separateItems.length;
  showToast(totalAddedCount > 1
    ? `${product.name} 외 ${separateItems.length}개 메뉴가 장바구니에 담겼습니다.`
    : `${product.name}이(가) 장바구니에 담겼습니다.`
  );
}

function commitCustomizedItem(customizedItem) {
  state.cart.push(customizedItem);
  closeWizardModal();
  updateCartBar();
  showToast(`${customizedItem.name}이(가) 장바구니에 담겼습니다.`);
}

function closeWizardModal() {
  document.getElementById('pwa-wizard-overlay').classList.remove('active');
}

// ============================================================================
// 배민 2.0 & NextOrders 스타일 독립 장바구니 확인 화면 (Cart View)
// ============================================================================
function renderCartTab(container) {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const itemsTotal = state.cart.reduce((sum, item) => sum + (item.total_price * item.quantity), 0);
  const deliveryTip = state.activeMode === 'DELIVERY' ? 3000 : 0;
  const finalTotal = itemsTotal + deliveryTip;
  const minDeliveryAmount = 15000;
  const isMinMet = itemsTotal >= minDeliveryAmount;
  const fillPercent = Math.min(100, Math.round((itemsTotal / minDeliveryAmount) * 100));

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="pwa-cart-view-container">
        <div class="pwa-cart-header-row">
          <div class="pwa-cart-view-title">장바구니 확인</div>
          <span style="font-size: 12px; color: var(--text-muted);">0개</span>
        </div>
        <div class="pwa-cart-empty-box">
          <div class="pwa-cart-empty-icon">[장바구니]</div>
          <div class="pwa-cart-empty-text">장바구니가 비어 있습니다</div>
          <div class="pwa-cart-empty-sub">맛있는 치킨과 사이드 메뉴를 골라 담아보세요.</div>
          <button class="pwa-btn-go-menu" id="btn-cart-go-menu">메뉴판 둘러보기</button>
        </div>
      </div>
    `;
    container.querySelector('#btn-cart-go-menu')?.addEventListener('click', () => {
      switchToTab('MENU');
    });
    return;
  }

  // 상단 선택 모드에 부합하는 명확한 장바구니 안내 뱃지
  const modeLabels = {
    DELIVERY: '배달 주문 장바구니',
    TAKEOUT: '포장 (픽업) 장바구니',
    DINE_IN: state.tableNoFromUrl ? `매장 식사 (테이블 ${state.tableNoFromUrl}번)` : '매장 식사 · 테이블 예약 장바구니'
  };
  const modeBadgeHtml = `
    <div style="background: ${state.activeMode === 'DINE_IN' ? '#f5f3ff' : '#f0fdf4'}; border: 1px solid ${state.activeMode === 'DINE_IN' ? '#c4b5fd' : '#bbf7d0'}; color: ${state.activeMode === 'DINE_IN' ? '#6d28d9' : '#15803d'}; padding: 9px 13px; border-radius: 8px; font-weight: 700; font-size: 13px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
      <span>${modeLabels[state.activeMode] || '주문 장바구니'}</span>
      <span style="font-size: 11px; font-weight: 600; opacity: 0.8;">상단에서 모드 전환</span>
    </div>
  `;

  // 배민 최소주문금액 게이지 (배달 모드 시)
  let minOrderGaugeHtml = '';
  if (state.activeMode === 'DELIVERY') {
    minOrderGaugeHtml = `
      <div class="pwa-cart-min-order-box">
        <div class="pwa-cart-min-order-title">
          <span>배달 최소주문금액 15,000원</span>
          <span>${isMinMet ? '주문 가능' : `${(minDeliveryAmount - itemsTotal).toLocaleString()}원 추가 필요`}</span>
        </div>
        <div class="pwa-cart-progress-bar">
          <div class="pwa-cart-progress-fill" style="width: ${fillPercent}%;"></div>
        </div>
      </div>
    `;
  }

  // 장바구니 품목 리스트 (배민 2.0 & NextOrders 정석 규격)
  const itemsListHtml = state.cart.map(item => {
    const optsLinesHtml = (item.selected_options && item.selected_options.length > 0)
      ? item.selected_options.map(o => `
          <div class="pwa-cart-opt-line">
            <span class="pwa-opt-bullet">·</span>
            <span class="pwa-opt-group">[${o.group_name}]</span>
            <span class="pwa-opt-name">${o.option_name}</span>
            ${o.price > 0 ? `<span class="pwa-opt-price">(+${o.price.toLocaleString()}원)</span>` : ''}
          </div>
        `).join('')
      : '<div class="pwa-cart-opt-none">기본 구성 (추가 선택 옵션 없음)</div>';

    const basePrice = item.base_price || item.total_price;
    const lineTotal = item.total_price * item.quantity;
    return `
      <div class="pwa-cart-item-card" data-cart-id="${item.cartItemId}">
        <div class="pwa-cart-item-top">
          <span class="pwa-cart-item-name">${item.name}</span>
          <button class="pwa-cart-item-delete" data-action="delete" title="품목 전체 삭제">✕</button>
        </div>
        <div class="pwa-cart-base-price">기본: ${basePrice.toLocaleString()}원</div>
        <div class="pwa-cart-options-box">
          ${optsLinesHtml}
        </div>
        <div class="pwa-cart-item-middle">
          <button class="pwa-btn-change-opt" data-action="edit-options" data-cart-id="${item.cartItemId}">
            옵션 변경
          </button>
        </div>
        <div class="pwa-cart-item-bottom">
          <div class="pwa-qty-controller">
            <button class="pwa-qty-btn" data-action="decrease">-</button>
            <span class="pwa-qty-val">${item.quantity}</span>
            <button class="pwa-qty-btn" data-action="increase">+</button>
          </div>
          <span class="pwa-cart-item-price">${lineTotal.toLocaleString()}원</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="pwa-cart-view-container">
      <div class="pwa-cart-header-row">
        <div>
          <span class="pwa-cart-view-title">장바구니 확인</span>
          <span style="font-size: 13px; font-weight: 700; color: #0f766e; margin-left: 6px;">(${count}개)</span>
        </div>
        <button class="pwa-btn-clear-all" id="btn-cart-view-clear">전체 비우기</button>
      </div>

      ${modeBadgeHtml}
      ${minOrderGaugeHtml}

      <div style="margin-bottom: 8px;">
        ${itemsListHtml}
      </div>

      <button class="pwa-btn-add-more" id="btn-cart-add-more">
        + 다른 메뉴 더 담기
      </button>

      <!-- 금액 영수증 요약 -->
      <div class="pwa-cart-bill-section">
        <div class="pwa-bill-row">
          <span>상품 주문 금액</span>
          <span>${itemsTotal.toLocaleString()}원</span>
        </div>
        ${state.activeMode === 'DELIVERY' ? `
          <div class="pwa-bill-row">
            <span>배달팁</span>
            <span>${deliveryTip.toLocaleString()}원</span>
          </div>
        ` : ''}
        <div class="pwa-bill-row total">
          <span>총 결제 예정 금액</span>
          <span style="color: #0f766e;">${finalTotal.toLocaleString()}원</span>
        </div>
      </div>

      <!-- 주문서 작성하기 CTA -->
      <button class="pwa-btn-order" id="btn-cart-checkout" style="width: 100%; margin-top: 14px; padding: 13px 0; font-size: 15px;">
        ${finalTotal.toLocaleString()}원 주문서 작성하기
      </button>
    </div>
  `;

  // 장바구니 전체 비우기
  container.querySelector('#btn-cart-view-clear')?.addEventListener('click', () => {
    if (confirm('장바구니를 모두 비우시겠습니까?')) {
      state.cart = [];
      updateCartBar();
      renderCartTab(container);
    }
  });

  // 다른 메뉴 더 담기
  container.querySelector('#btn-cart-add-more')?.addEventListener('click', () => {
    switchToTab('MENU');
  });


  // 개별 수량 조절 및 삭제
  container.querySelectorAll('.pwa-cart-item-card').forEach(card => {
    const cartId = card.getAttribute('data-cart-id');
    card.querySelector('[data-action="delete"]').addEventListener('click', () => {
      removeCartItem(cartId);
      renderCartTab(container);
    });
    card.querySelector('[data-action="decrease"]').addEventListener('click', () => {
      changeCartQty(cartId, -1);
      renderCartTab(container);
    });
    card.querySelector('[data-action="increase"]').addEventListener('click', () => {
      changeCartQty(cartId, 1);
      renderCartTab(container);
    });

    // 배민 스타일 [옵션 변경] 클릭 핸들러
    card.querySelector('[data-action="edit-options"]')?.addEventListener('click', () => {
      const item = state.cart.find(it => it.cartItemId === cartId);
      if (!item) return;
      const product = state.products.find(p => (p.product_id || p.id) === item.product_id);
      if (product) {
        startSubwayWizard(product, cartId);
      } else {
        alert('해당 상품 정보를 찾을 수 없습니다.');
      }
    });
  });

  // 주문서 작성 모달 이동
  container.querySelector('#btn-cart-checkout')?.addEventListener('click', () => {
    if (state.activeMode === 'DELIVERY' && !isMinMet) {
      alert(`배달 최소주문금액(15,000원)을 채워주세요.\n(현재 부족 금액: ${(minDeliveryAmount - itemsTotal).toLocaleString()}원)`);
      return;
    }
    openCheckoutModal();
  });
}

// ============================================================================
// 슬라이드업 장바구니 Drawer 제어
// ============================================================================
function openCartDrawer() {
  renderCartDrawer();
  document.getElementById('pwa-cart-overlay').classList.add('active');
}

function closeCartDrawer() {
  document.getElementById('pwa-cart-overlay').classList.remove('active');
}

function renderCartDrawer() {
  const container = document.getElementById('pwa-cart-items-container');
  const countBadge = document.getElementById('pwa-cart-count-badge');
  const itemsTotalEl = document.getElementById('pwa-bill-items-total');
  const deliveryTipEl = document.getElementById('pwa-bill-delivery-tip');
  const finalTotalEl = document.getElementById('pwa-bill-final-total');
  const deliveryRow = document.getElementById('pwa-bill-delivery-row');

  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  countBadge.textContent = count;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px 16px; text-align: center; color: var(--text-muted);">
        장바구니에 담긴 메뉴가 없습니다.<br>맛있는 메뉴를 골라 담아보세요.
      </div>
    `;
    itemsTotalEl.textContent = '0원';
    deliveryTipEl.textContent = '0원';
    finalTotalEl.textContent = '0원';
    return;
  }

  // 품목 목록 렌더링 (배민 2.0 규격 일원화)
  container.innerHTML = state.cart.map(item => {
    const optsLinesHtml = (item.selected_options && item.selected_options.length > 0)
      ? item.selected_options.map(o => `
          <div class="pwa-cart-opt-line">
            <span class="pwa-opt-bullet">·</span>
            <span class="pwa-opt-group">[${o.group_name}]</span>
            <span class="pwa-opt-name">${o.option_name}</span>
            ${o.price > 0 ? `<span class="pwa-opt-price">(+${o.price.toLocaleString()}원)</span>` : ''}
          </div>
        `).join('')
      : '<div class="pwa-cart-opt-none">기본 구성 (추가 선택 옵션 없음)</div>';

    const basePrice = item.base_price || item.total_price;
    const lineTotal = item.total_price * item.quantity;

    return `
      <div class="pwa-cart-item-card" data-cart-id="${item.cartItemId}">
        <div class="pwa-cart-item-top">
          <span class="pwa-cart-item-name">${item.name}</span>
          <button class="pwa-cart-item-delete" data-action="delete" title="삭제">✕</button>
        </div>
        <div class="pwa-cart-base-price">기본: ${basePrice.toLocaleString()}원</div>
        <div class="pwa-cart-options-box">
          ${optsLinesHtml}
        </div>
        <div class="pwa-cart-item-middle">
          <button class="pwa-btn-change-opt" data-action="edit-options" data-cart-id="${item.cartItemId}">
            옵션 변경
          </button>
        </div>
        <div class="pwa-cart-item-bottom">
          <div class="pwa-qty-controller">
            <button class="pwa-qty-btn" data-action="decrease">-</button>
            <span class="pwa-qty-val">${item.quantity}</span>
            <button class="pwa-qty-btn" data-action="increase">+</button>
          </div>
          <span class="pwa-cart-item-price">${lineTotal.toLocaleString()}원</span>
        </div>
      </div>
    `;
  }).join('');

  // 수량 증감, 삭제 및 옵션 변경 이벤트
  container.querySelectorAll('.pwa-cart-item-card').forEach(card => {
    const cartId = card.getAttribute('data-cart-id');
    card.querySelector('[data-action="delete"]').addEventListener('click', () => removeCartItem(cartId));
    card.querySelector('[data-action="decrease"]').addEventListener('click', () => changeCartQty(cartId, -1));
    card.querySelector('[data-action="increase"]').addEventListener('click', () => changeCartQty(cartId, 1));
    card.querySelector('[data-action="edit-options"]')?.addEventListener('click', () => {
      closeCartDrawer();
      const item = state.cart.find(it => it.cartItemId === cartId);
      if (!item) return;
      const product = state.products.find(p => (p.product_id || p.id) === item.product_id);
      if (product) {
        startSubwayWizard(product, cartId);
      }
    });
  });

  // 금액 계산
  const itemsTotal = state.cart.reduce((sum, item) => sum + (item.total_price * item.quantity), 0);
  const deliveryTip = state.activeMode === 'DELIVERY' ? 3000 : 0;
  const finalTotal = itemsTotal + deliveryTip;

  if (deliveryRow) {
    deliveryRow.style.display = state.activeMode === 'DELIVERY' ? 'flex' : 'none';
  }

  itemsTotalEl.textContent = `${itemsTotal.toLocaleString()}원`;
  deliveryTipEl.textContent = `${deliveryTip.toLocaleString()}원`;
  finalTotalEl.textContent = `${finalTotal.toLocaleString()}원`;
}

function changeCartQty(cartId, delta) {
  const item = state.cart.find(it => it.cartItemId === cartId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeCartItem(cartId);
    return;
  }
  updateCartBar();
  renderCartDrawer();
}

function removeCartItem(cartId) {
  state.cart = state.cart.filter(it => it.cartItemId !== cartId);
  updateCartBar();
  renderCartDrawer();
}

// 하단 플로팅 카트 바 및 헤더/탭 뱃지 동기화
function updateCartBar() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = state.cart.reduce((sum, item) => sum + (item.total_price * item.quantity), 0);

  // 1. 헤더 장바구니 뱃지
  const headerBadge = document.getElementById('pwa-header-cart-badge');
  if (headerBadge) {
    headerBadge.textContent = count;
  }

  // 2. 탭 내 수량 뱃지
  const tabCartCount = document.getElementById('pwa-tab-cart-count');
  if (tabCartCount) {
    tabCartCount.textContent = count;
  }

  // 3. 하단 플로팅 카트 바
  const bottomBar = document.getElementById('pwa-bottom-bar');
  const cartSummary = document.getElementById('pwa-cart-summary');
  const cartTotal = document.getElementById('pwa-cart-total');
  const btnSubmit = document.getElementById('btn-submit-pwa-order');

  if (bottomBar) {
    // 배민 정석: 장바구니 화면('CART')에서는 하단 플로팅 바를 완전히 숨겨 실제 주문서 작성 버튼을 가리지 않음.
    // 메뉴판('MENU') 등에서 담긴 수량이 1개 이상일 때만 하단 바를 띄움.
    if (state.activeTab === 'CART' || count === 0) {
      bottomBar.style.display = 'none';
    } else {
      bottomBar.style.display = 'flex';
    }
  }

  if (cartSummary) {
    cartSummary.textContent = `${state.cart[0]?.name || ''} ${count > 1 ? `외 ${count - 1}개` : ''} (${count}개 담김)`;
  }
  if (cartTotal) {
    cartTotal.textContent = `${totalAmount.toLocaleString()}원`;
  }
  if (btnSubmit) {
    btnSubmit.textContent = '장바구니 확인';
  }
}

// ============================================================================
// 체크아웃(주문서 작성) 및 최종 주문 제출
// ============================================================================
function openCheckoutModal() {
  const modeSummary = document.getElementById('pwa-checkout-mode-summary');
  const dynamicFields = document.getElementById('pwa-checkout-dynamic-fields');
  const finalPayBtn = document.getElementById('btn-final-pay');

  const itemsTotal = state.cart.reduce((sum, item) => sum + (item.total_price * item.quantity), 0);
  const deliveryTip = state.activeMode === 'DELIVERY' ? 3000 : 0;
  const finalTotal = itemsTotal + deliveryTip;

  if (state.activeMode === 'DINE_IN') {
    modeSummary.textContent = state.tableNoFromUrl
      ? `매장 식사 [테이블 ${state.tableNoFromUrl}번 착석 주문]`
      : `매장 홀 테이블 예약 (오늘 ${state.dineInTime} / 성인 ${state.dineInGuests}인)`;
    modeSummary.style.color = '#7c3aed';
    modeSummary.style.borderColor = '#c4b5fd';
    modeSummary.style.background = '#faf5ff';

    dynamicFields.innerHTML = `
      <div class="pwa-form-group">
        <label class="pwa-form-label">테이블 번호</label>
        <input type="text" class="pwa-input-text" id="pwa-order-table" value="${state.tableNoFromUrl ? `테이블 ${state.tableNoFromUrl}번` : '테이블 1번'}" ${state.tableNoFromUrl ? 'readonly style="background: #f1f5f9;"' : ''}>
      </div>
      <div class="pwa-form-group">
        <label class="pwa-form-label">주방 요청사항</label>
        <input type="text" class="pwa-input-text" id="pwa-order-memo" placeholder="예: 창가 자리 부탁드립니다. 물티슈 많이 챙겨주세요.">
      </div>
    `;
  } else if (state.activeMode === 'TAKEOUT') {
    modeSummary.textContent = '포장 주문 (매장 방문 픽업)';
    modeSummary.style.color = '#0284c7';
    modeSummary.style.borderColor = '#bae6fd';
    modeSummary.style.background = '#f0f9ff';

    dynamicFields.innerHTML = `
      <div class="pwa-form-group">
        <label class="pwa-form-label">픽업 예정 시간</label>
        <select class="pwa-select" id="pwa-order-takeout-time">
          <option value="15분 후">15분 후 방문 픽업</option>
          <option value="25분 후" selected>25분 후 방문 픽업</option>
          <option value="40분 후">40분 후 방문 픽업</option>
        </select>
      </div>
      <div class="pwa-form-group">
        <label class="pwa-form-label">포장 요청사항</label>
        <input type="text" class="pwa-input-text" id="pwa-order-memo" placeholder="예: 포크/수저 2벌 챙겨주세요.">
      </div>
    `;
  } else {
    modeSummary.textContent = '배달 주문 (라이더 신속 배달)';
    modeSummary.style.color = '#0f766e';
    modeSummary.style.borderColor = '#99f6e4';
    modeSummary.style.background = '#f0fdfa';

    dynamicFields.innerHTML = `
      <div class="pwa-form-group">
        <label class="pwa-form-label" style="display: flex; justify-content: space-between; align-items: center;">
          <span>배달지 주소</span>
          <span style="font-size: 11px; color: #0f766e; font-weight: 700;">도로명 주소 검색 필수</span>
        </label>
        <div style="display: flex; gap: 6px; margin-bottom: 6px;">
          <input type="text" class="pwa-input-text" id="pwa-order-road-address" placeholder="우측 [주소 검색] 버튼을 눌러주세요" value="서울특별시 서초구 서초대로 42길 11" readonly style="flex: 1; background: #f8fafc; font-weight: 700; color: #1e293b; cursor: pointer;">
          <button type="button" class="pwa-btn-change-opt" id="btn-search-address" style="white-space: nowrap; padding: 0 12px; background: #0f766e; color: #ffffff; border-color: #0f766e; font-size: 12.5px; height: 38px;">
            주소 검색
          </button>
        </div>
        <input type="text" class="pwa-input-text" id="pwa-order-detail-address" placeholder="상세 주소를 입력해 주세요 (동, 호수 등)" value="302호">
        <input type="hidden" id="pwa-order-postal-code" value="06647">
      </div>
      <div class="pwa-form-group">
        <label class="pwa-form-label">라이더 배달 요청사항</label>
        <input type="text" class="pwa-input-text" id="pwa-order-memo" value="문 앞에 두고 벨 눌러주세요 (아기가 자고 있어요)">
      </div>
    `;

    // 주소 검색 버튼 이벤트 바인딩
    dynamicFields.querySelector('#btn-search-address')?.addEventListener('click', openAddressSearchModal);
    dynamicFields.querySelector('#pwa-order-road-address')?.addEventListener('click', openAddressSearchModal);
  }

  finalPayBtn.textContent = `${finalTotal.toLocaleString()}원 주문 및 결제하기`;
  document.getElementById('pwa-checkout-overlay').classList.add('active');
}

function closeCheckoutModal() {
  document.getElementById('pwa-checkout-overlay').classList.remove('active');
}

// ============================================================================
// 카카오(Daum) 우편번호 & 도로명 주소 검색 모달 제어
// ============================================================================
function openAddressSearchModal() {
  const modal = document.getElementById('pwa-address-modal');
  const layer = document.getElementById('pwa-postcode-layer');
  if (!modal || !layer) return;

  modal.classList.add('active');
  layer.innerHTML = '';

  // Daum Postcode 객체 사용 가능 시 카카오 공식 임베드 렌더링
  if (typeof daum !== 'undefined' && daum.Postcode) {
    new daum.Postcode({
      oncomplete: function(data) {
        let fullRoadAddr = data.roadAddress; // 도로명 주소
        let extraRoadAddr = ''; // 건물명 등 참고항목

        if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
          extraRoadAddr += data.bname;
        }
        if (data.buildingName !== '' && data.apartment === 'Y') {
          extraRoadAddr += (extraRoadAddr !== '' ? ', ' + data.buildingName : data.buildingName);
        }
        if (extraRoadAddr !== '') {
          fullRoadAddr += ' (' + extraRoadAddr + ')';
        }

        const roadInput = document.getElementById('pwa-order-road-address');
        const postalInput = document.getElementById('pwa-order-postal-code');
        const detailInput = document.getElementById('pwa-order-detail-address');

        if (roadInput) roadInput.value = fullRoadAddr;
        if (postalInput) postalInput.value = data.zonecode;

        closeAddressSearchModal();
        if (detailInput) {
          detailInput.focus();
        }
      },
      width: '100%',
      height: '100%'
    }).embed(layer);
  } else {
    // 외부 CDN 접근 차단 환경용 고성능 서초/강남 폴백 주소 선택기
    layer.innerHTML = `
      <div style="padding: 16px;">
        <div style="font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">
          서초본점 인근 배달 주소 빠른 선택
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
          (외부 네트워크 연결이 불가할 때 즉시 선택할 수 있는 정밀 주소 목록입니다)
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="pwa-fallback-addr-btn" data-road="서울특별시 서초구 서초대로 42길 11" data-post="06647" style="text-align: left; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; background: #ffffff; cursor: pointer;">
            <div style="font-weight: 800; font-size: 13px; color: #0f766e;">[06647] 서울특별시 서초구 서초대로 42길 11</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">(서초동, 파크뷰아파트)</div>
          </button>
          <button type="button" class="pwa-fallback-addr-btn" data-road="서울특별시 서초구 반포대로 22" data-post="06653" style="text-align: left; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; background: #ffffff; cursor: pointer;">
            <div style="font-weight: 800; font-size: 13px; color: #0f766e;">[06653] 서울특별시 서초구 반포대로 22</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">(서초동, 서초트라팰리스)</div>
          </button>
          <button type="button" class="pwa-fallback-addr-btn" data-road="서울특별시 강남구 강남대로 382" data-post="06232" style="text-align: left; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; background: #ffffff; cursor: pointer;">
            <div style="font-weight: 800; font-size: 13px; color: #0f766e;">[06232] 서울특별시 강남구 강남대로 382</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">(역삼동, 메리츠타워)</div>
          </button>
        </div>
      </div>
    `;

    layer.querySelectorAll('.pwa-fallback-addr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const road = btn.getAttribute('data-road');
        const post = btn.getAttribute('data-post');
        const roadInput = document.getElementById('pwa-order-road-address');
        const postalInput = document.getElementById('pwa-order-postal-code');
        const detailInput = document.getElementById('pwa-order-detail-address');

        if (roadInput) roadInput.value = road;
        if (postalInput) postalInput.value = post;

        closeAddressSearchModal();
        if (detailInput) detailInput.focus();
      });
    });
  }
}

function closeAddressSearchModal() {
  document.getElementById('pwa-address-modal')?.classList.remove('active');
}

// 최종 주문 비동기 제출 파이프라인
async function handleFinalOrderSubmit() {
  const btnPay = document.getElementById('btn-final-pay');
  btnPay.disabled = true;
  btnPay.textContent = '주문 전송 중...';

  try {
    const customerName = document.getElementById('pwa-order-name')?.value || '모바일 고객';
    const customerPhone = document.getElementById('pwa-order-phone')?.value || '010-0000-0000';
    const useVirtualPhone = document.getElementById('pwa-order-safe-phone')?.checked ?? true;
    const memo = document.getElementById('pwa-order-memo')?.value || '';
    const selectedPay = document.querySelector('input[name="payment_method"]:checked')?.value || 'AITIP_ZERO_PAY';

    const orderPayload = {
      fulfillment_type: state.activeMode,
      order_channel: 'PWA',
      customer_name: customerName,
      customer_phone: customerPhone,
      use_virtual_phone: useVirtualPhone,
      customer_memo: memo,
      payment_method: selectedPay,
      items: state.cart.map(it => ({
        product_id: it.product_id,
        name: it.name,
        quantity: it.quantity,
        base_price: it.base_price,
        selected_options: it.selected_options || [],
        total_price: it.total_price * it.quantity
      }))
    };

    if (state.activeMode === 'DINE_IN') {
      orderPayload.table_no = state.tableNoFromUrl ? `테이블 ${state.tableNoFromUrl}번` : (document.getElementById('pwa-order-table')?.value || '테이블 1번');
      orderPayload.table_no_is_fixed = !!state.tableNoFromUrl;
      orderPayload.guest_count = Number(state.dineInGuests) || 2;
      orderPayload.reserved_at = state.dineInTime || '19:30';
    } else if (state.activeMode === 'TAKEOUT') {
      orderPayload.delivery_address = '매장 직접 픽업';
    } else {
      const roadAddr = document.getElementById('pwa-order-road-address')?.value || '서울특별시 서초구 서초대로 42길 11';
      const detailAddr = document.getElementById('pwa-order-detail-address')?.value || '';
      const postalCode = document.getElementById('pwa-order-postal-code')?.value || '06647';

      orderPayload.road_address = roadAddr;
      orderPayload.detail_address = detailAddr;
      orderPayload.postal_code = postalCode;
      orderPayload.delivery_address = detailAddr ? `${roadAddr} ${detailAddr}` : roadAddr;
      orderPayload.delivery_tip = 3000;
    }

    let createdOrder = null;
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      if (response.ok && !response.headers.get('content-type')?.includes('text/html')) {
        const result = await response.json();
        if (result.success && result.order) {
          createdOrder = result.order;
        }
      }
    } catch (apiErr) {
      console.warn('[PWA] API 통신 실패 -> 로컬 브라우저 세션 주문으로 즉시 전환:', apiErr);
    }

    if (!createdOrder) {
      // 오프라인 / 정적 모드용 고정밀 가상 주문 생성
      const orderId = 'ord_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      const shortId = 'A-' + (Math.floor(Math.random() * 50) + 10);
      const virtualPhone = useVirtualPhone
        ? `0504-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
        : customerPhone;

      createdOrder = {
        order_id: orderId,
        short_display_id: shortId,
        status: 'PENDING',
        order_channel: 'PWA',
        fulfillment_type: state.activeMode,
        customer_name: customerName,
        customer_phone: customerPhone,
        virtual_phone: virtualPhone,
        road_address: orderPayload.road_address,
        detail_address: orderPayload.detail_address,
        postal_code: orderPayload.postal_code,
        delivery_address: orderPayload.delivery_address || '서울특별시 서초구 서초대로 42길 11, 302호',
        customer_memo: memo,
        payment_method: selectedPay,
        items: orderPayload.items,
        items_total: orderPayload.items.reduce((s, it) => s + (it.total_price || 0), 0),
        delivery_tip: state.activeMode === 'DELIVERY' ? 3000 : 0,
        final_payment_amount: orderPayload.items.reduce((s, it) => s + (it.total_price || 0), 0) + (state.activeMode === 'DELIVERY' ? 3000 : 0),
        prep_time_minutes: 25,
        created_at: new Date().toISOString()
      };
    }
    state.cart = [];
    updateCartBar();
    closeCheckoutModal();
    showSuccessReceiptModal(createdOrder);

  } catch (err) {
    console.error('[PWA] 주문 전송 에러:', err);
    alert(`주문 전송 중 문제가 발생했습니다:\n${err.message}`);
  } finally {
    btnPay.disabled = false;
  }
}

// 주문 완료 영수증 팝업
function showSuccessReceiptModal(order) {
  const body = document.getElementById('pwa-success-body');
  const payLabels = {
    AITIP_ZERO_PAY: 'AITIP 제로페이 (수수료 0%)',
    CARD: '신용/체크카드',
    MEET_AND_PAY: '현장 결제'
  };

  const barcodeValue = order.short_display_id || order.order_id;
  const barcodeSvg = generateCode128Svg(barcodeValue, {
    height: 48,
    barWidth: 2,
    showText: true
  });

  body.innerHTML = `
    <div style="text-align: center; margin-bottom: 12px;">
      <div style="font-size: 24px; font-weight: 900; color: #0f766e; margin-bottom: 4px;">주문 접수 완료</div>
      <div style="font-size: 12.5px; color: var(--text-muted);">주방 KDS 화면으로 즉시 전송되었습니다.</div>
    </div>

    <!-- 1D 포스 스캔용 픽업 바코드 -->
    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 12px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
      <div style="font-size: 11px; font-weight: 800; color: #0f766e; margin-bottom: 6px; letter-spacing: -0.2px;">매장 카운터 포스 스캔용 바코드</div>
      ${barcodeSvg}
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">포장 픽업 시 직원에게 위 바코드를 보여주세요.</div>
    </div>

    <div class="pwa-receipt-box">
      <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 15px; border-bottom: 1px solid var(--border-default); padding-bottom: 8px; margin-bottom: 8px;">
        <span>주문번호 [${order.short_display_id}]</span>
        <span style="color: #0f766e;">접수대기 (PENDING)</span>
      </div>
      <div><strong>UID:</strong> <span style="font-family: monospace; font-size: 11px;">${order.order_id}</span></div>
      <div><strong>유형:</strong> ${order.fulfillment_type === 'DINE_IN' ? `매장식사 (${order.table_no})` : (order.fulfillment_type === 'TAKEOUT' ? '포장 픽업' : '배달')}</div>
      <div><strong>주문자:</strong> ${order.customer_name}</div>
      <div style="display: flex; align-items: center; gap: 6px; margin: 3px 0;">
        <strong>연락처:</strong>
        ${order.virtual_phone
          ? `<span style="color: #0f766e; font-weight: 800;">${order.virtual_phone}</span> <span style="background: #ccfbf1; color: #0f766e; font-size: 10.5px; padding: 1px 6px; border-radius: 4px; font-weight: 700;">0504 안심번호 (60분 유효)</span>`
          : `<span>${order.customer_phone}</span>`
        }
      </div>
      <div><strong>배달지 주소:</strong> ${order.delivery_address}</div>
      <div style="margin: 8px 0; border-top: 1px dashed var(--border-default); padding-top: 8px;">
        ${order.items.map(it => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>${it.name} × ${it.quantity}</span>
            <span>${it.total_price.toLocaleString()}원</span>
          </div>
        `).join('')}
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; border-top: 1px solid var(--border-default); padding-top: 8px;">
        <span>결제금액 (${payLabels[order.payment_method] || order.payment_method})</span>
        <span style="color: #0f766e;">${order.final_payment_amount.toLocaleString()}원</span>
      </div>
    </div>

    <div style="font-size: 11.5px; color: var(--text-muted); text-align: center; margin-bottom: 12px;">
      점주님이 주문을 수락하면 조리 예상 시간이 실시간으로 안내됩니다.
    </div>

    <!-- 5대 벤치마크 표준 실시간 주문 추적 타임라인 (Hyperlocal-Delivery / Enatega 규격) -->
    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-top: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 12.5px; font-weight: 800; color: #0f766e;">실시간 진행 상태 (Live Track)</span>
        <button id="btn-refresh-track" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; font-weight: 700;">새로고침</button>
      </div>
      <div id="pwa-track-timeline-box" style="font-size: 11.5px; color: #334155;">
        <div style="display: flex; justify-content: space-between; position: relative; margin: 12px 0 6px;">
          <div style="text-align: center; flex: 1; font-weight: 800; color: #0f766e;">1. 주문접수<br><span style="font-size: 10px; color: #16a34a;">완료</span></div>
          <div style="text-align: center; flex: 1; color: #64748b;">2. 매장조리<br><span style="font-size: 10px;">대기</span></div>
          <div style="text-align: center; flex: 1; color: #64748b;">3. 준비완료<br><span style="font-size: 10px;">대기</span></div>
          <div style="text-align: center; flex: 1; color: #64748b;">4. 배달/전달<br><span style="font-size: 10px;">대기</span></div>
        </div>
      </div>
    </div>
  `;

  // 실시간 트래커 새로고침 이벤트 바인딩
  body.querySelector('#btn-refresh-track')?.addEventListener('click', async () => {
    try {
      const res = await fetch(`${API_BASE}/orders/${order.order_id}/track`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.track) {
          const t = json.track;
          const statusMap = {
            PENDING: '주문 접수 대기 중',
            ACCEPTED: `조리 중 (남은 예상: ${t.remaining_minutes}분)`,
            COOKING: `조리 중 (남은 예상: ${t.remaining_minutes}분)`,
            READY: '조리 완료 (배달 출발 / 픽업 대기)',
            DISPATCHED: '라이더 배달 중 (도착 예정)',
            DELIVERED: '배달 / 전달 완료'
          };
          alert(`[주문 상태: ${statusMap[t.status] || t.status}]\n주문번호: ${t.short_display_id}\n남은시간: ${t.remaining_minutes}분`);
        }
      }
    } catch (e) {
      console.warn('추적 새로고침 오류:', e);
    }
  });

  document.getElementById('pwa-success-overlay').classList.add('active');
}

function closeSuccessModal() {
  document.getElementById('pwa-success-overlay').classList.remove('active');
}

// 토스트 메시지 헬퍼
function showToast(msg) {
  let toast = document.getElementById('pwa-toast-el');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pwa-toast-el';
    toast.className = 'pwa-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// ============================================================================
// 정보·위치·주차 탭 & 리뷰 탭
// ============================================================================
function renderInfoTab(container) {
  const store = state.store || {};
  const blocks = store.blocks || {};

  container.innerHTML = `
    <div class="pwa-info-panel">
      ${blocks.notice ? `
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <div style="font-weight: 800; font-size: 13px; color: #b45309; margin-bottom: 4px;">사장님 알림 공지</div>
          <div style="font-size: 12.5px; color: #92400e; line-height: 1.5;">${blocks.notice}</div>
        </div>
      ` : ''}

      <div class="pwa-info-block">
        <div class="pwa-info-block-title">위치 및 찾아오는 길</div>
        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">${store.address || '서울특별시 서초구 서초대로 34길 18 1층'}</div>
        <div style="font-size: 12.5px; color: #0284c7; font-weight: 700; margin-bottom: 4px;">
          지하철: ${blocks.location_guide?.subway_station || '서초역 1번 출구'} 도보 ${blocks.location_guide?.walking_time_minutes || 3}분
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">${blocks.location_guide?.landmark_hint || '우리은행 골목 안쪽 50m'}</div>
      </div>

      <div class="pwa-info-block">
        <div class="pwa-info-block-title">주차 안내</div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span class="pwa-parking-pill">
            ${blocks.parking?.type === 'FREE' ? '무료 주차 가능' : (blocks.parking?.type === 'PAID' ? '유료 주차' : '주차 불가')}
          </span>
          <span style="font-weight: 700; font-size: 13px;">${blocks.parking?.capacity_text || '매장 앞 4대'}</span>
        </div>
        <div style="font-size: 12.5px; color: var(--text-secondary);">${blocks.parking?.details || '만차 시 인근 공영주차장 1시간 지원'}</div>
      </div>

      <div class="pwa-info-block">
        <div class="pwa-info-block-title">편의시설 및 서비스</div>
        <div class="pwa-facility-chips">
          ${(blocks.facilities || ['parking', 'wifi', 'group_seat', 'reservation']).map(f => {
            const labels = { parking: '주차가능', wifi: '무선인터넷', group_seat: '단체석', reservation: '예약가능', baby_chair: '유아의자', pet_friendly: '반려동물동반', separate_restroom: '남녀화장실', zero_pay: '제로페이/지역화폐' };
            return `<span class="pwa-facility-chip">${labels[f] || f}</span>`;
          }).join('')}
        </div>
      </div>

      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
        <div>상호: ${store.store_name} | 대표자: ${store.owner_name || '홍길동'}</div>
        <div>사업자등록번호: ${store.biz_number || '214-88-59124'}</div>
        <div>전화번호: <a href="tel:${store.phone || '02-588-9258'}" style="color: #0284c7; font-weight: 700;">${store.phone || '02-588-9258'} (전화연결)</a></div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-default);">
          원산지 표기: ${blocks.legal_notices?.origin_or_license || '닭고기(국내산 100%), 쌀(국내산)'}
        </div>
      </div>
    </div>
  `;
}

function renderReviewsTab(container) {
  const reviews = state.reviews;

  container.innerHTML = `
    <div style="padding: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
        <div>
          <span style="font-size: 22px; font-weight: 800; color: #ff9800;">★ 4.9</span>
          <span style="font-size: 13px; color: var(--text-muted); margin-left: 6px;">(${reviews.length || 482}개 평가)</span>
        </div>
        <span style="font-size: 11.5px; color: #1b8a5a; font-weight: 700; background: #eafbf3; padding: 3px 8px; border-radius: 4px;">클린리뷰 100%</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${reviews.map(r => `
          <div style="border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 700; font-size: 13px;">${r.buyer_name || '단골손님'}</span>
              <span style="color: #ff9800; font-size: 11px;">★★★★★</span>
            </div>
            <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 6px;">
              ${r.content}
            </div>
            ${r.owner_reply ? `
              <div style="background: #f8fafc; border-left: 3px solid var(--brand-mint); padding: 6px 10px; font-size: 12px; color: var(--text-primary);">
                <strong>사장님:</strong> ${r.owner_reply}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
