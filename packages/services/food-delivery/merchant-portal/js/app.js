/**
 * ============================================================================
 * AITIP Merchant Portal Main Application Controller (ESM)
 * 6대 소스(SwadKart, TastyPrinter, Enatega, NextOrders, Hyperlocal, 배달의민족) 통합 규격
 * 아키텍처: 단일 모놀리스 해체 -> 8개 도메인별 ESM 서브모듈 오케스트레이션
 * ============================================================================
 */
import { merchantApi } from './api.js';
import { setupReceiptEvents } from './modules/receipt.js';
import { renderKdsOrders, playOrderChime, initKdsFilterListeners } from './modules/kds.js';
import {
  renderMenuGroupBlocks,
  handleSaveEditMenu,
  handleDeleteMenuFromModal,
  renderCategoryDropdowns,
  updateSubcategoryDropdown,
  handleCreateCategory,
  handleCreateMenu,
  renderOptionGroups,
  handleCreateOptionGroup,
  renderPwaSimulator
} from './modules/menu.js';
import {
  renderStoreMeta,
  renderStoreInfoForm,
  startQuickPause,
  stopQuickPause,
  renderStoreHoursTable,
  renderHolidaySettings,
  handleCreateCustomClosure,
  handleSaveStoreInfo
} from './modules/store.js';
import {
  renderDeliverySettings,
  renderDeliveryRegions,
  renderTipRulesTable
} from './modules/delivery.js';
import { renderReviews, initReviewFilterListeners } from './modules/reviews.js';
import { setupSettlementTabs, renderSettlementCalendar } from './modules/settlement.js';
import { renderCoupons } from './modules/coupons.js';
import { renderDineInWorkspace } from './modules/dinein.js';
import { renderStoreBlockEditor } from './modules/store-blocks.js';

// 중앙 상태 관리
const state = {
  currentView: 'view-kds',
  store: null,
  storeHours: [],
  holidaySettings: null,
  upcomingMajorHoliday: null,
  settlementOverview: null,
  pauseTimer: null,
  pauseSecondsRemaining: 0,
  categories: [],
  optionGroups: [],
  reviews: [],
  coupons: [],
  products: [],
  liveOrders: [],
  tables: [],
  dineInReservations: [],
  deliveryRegions: ['서초1동', '서초2동', '서초3동', '서초4동', '역삼1동', '방배본동', '반포1동'],
  deliveryTipRules: [
    { min: 15000, max: 30000, tip: 3000 },
    { min: 30000, max: 50000, tip: 2000 },
    { min: 50000, max: 99999999, tip: 0 }
  ]
};

// 뷰 맵핑 타이틀
const VIEW_TITLES = {
  'view-dinein-workspace': '실시간 홀·테이블 예약 관리',
  'view-kds': '실시간 주문 접수 (KDS)',
  'view-order-history': '주문 내역 조회',
  'view-menu-workspace': '메뉴판 통합 관리 (대분류 · 메뉴 일체형 트리)',
  'view-option-manage': '옵션 그룹 설정',
  'view-store-workspace': '가게 운영 및 배달·픽업 설정',
  'view-promotions': '가게 쿠폰 및 리뷰이벤트 관리',
  'view-reviews': '고객 리뷰 관리',
  'view-settlement': '일별 정산 내역 및 세무 증빙'
};

// 1. DOM 초기 로드
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupGlobalControls();
  setupStoreTabs();
  setupSettlementTabs();
  setupReceiptEvents();
  initReviewFilterListeners(state);
  initKdsFilterListeners(state);
  await refreshAllData();
  initKdsLiveSync();
});

// KDS 실시간 주문 자동 폴링 및 브라우저 간 동기화 (BroadcastChannel + 5초 주기 Live Polling)
function initKdsLiveSync() {
  // 1) BroadcastChannel 즉시 수신 (동일 기기/브라우저 PWA 주문 1ms 즉시 연동)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const orderChannel = new BroadcastChannel('aitip_food_orders');
      orderChannel.onmessage = (event) => {
        if (event.data?.type === 'NEW_ORDER' && event.data.order) {
          const newOrder = event.data.order;
          if (!Array.isArray(state.liveOrders)) {
            state.liveOrders = [];
          }
          if (!state.liveOrders.some(o => o.order_id === newOrder.order_id)) {
            state.liveOrders.unshift(newOrder);
            renderKdsOrders(state);
            playOrderChime();
          }
        }
      };
    }
  } catch (bcErr) {
    console.warn('[KDS] BroadcastChannel 초기화 실패:', bcErr);
  }

  // 2) 5초 주기 백그라운드 폴링 (서버에 들어온 신규 주문 실시간 감지)
  setInterval(async () => {
    try {
      const latestOrders = await merchantApi.getLiveOrders();
      if (Array.isArray(latestOrders) && latestOrders.length > 0) {
        const prevFirstId = state.liveOrders?.[0]?.order_id;
        const newFirstId = latestOrders[0]?.order_id;
        
        // 새로운 주문이 최상단에 추가되었거나 주문 수량이 변경된 경우
        if (newFirstId && newFirstId !== prevFirstId) {
          state.liveOrders = latestOrders;
          renderKdsOrders(state);
          playOrderChime();
        } else if (latestOrders.length !== (state.liveOrders?.length || 0)) {
          state.liveOrders = latestOrders;
          renderKdsOrders(state);
        }
      }
    } catch (pollErr) {
      // 조용히 무시 (네트워크 일시 지연 등)
    }
  }, 5000);
}

// 2. 전체 데이터 새로고침 및 모듈 렌더러 호출
async function refreshAllData() {
  try {
    const [storeData, menuData, hoursData, holidayData, settlementData, ordersData, reviewsData, deliveryRulesData, couponsData, tablesData, dineinData] = await Promise.all([
      merchantApi.getStoreInfo(),
      merchantApi.getMenuCatalog(),
      merchantApi.getStoreHours().catch(() => null),
      merchantApi.getHolidaySettings().catch(() => null),
      merchantApi.getSettlementOverview(2026, 11).catch(() => null),
      merchantApi.getLiveOrders().catch(() => []),
      merchantApi.getReviews().catch(() => []),
      merchantApi.getDeliveryRules().catch(() => null),
      merchantApi.getCoupons().catch(() => []),
      merchantApi.getDineInTables().catch(() => []),
      merchantApi.getDineInReservations().catch(() => [])
    ]);

    state.store = storeData;
    if (Array.isArray(tablesData)) {
      state.tables = tablesData;
    }
    if (Array.isArray(dineinData)) {
      state.dineInReservations = dineinData;
    }
    if (menuData) {
      if (Array.isArray(menuData.categories) && menuData.categories.length > 0) {
        state.categories = menuData.categories;
      }
      if (Array.isArray(menuData.option_groups)) {
        state.optionGroups = menuData.option_groups;
      }
      if (Array.isArray(menuData.products)) {
        state.products = menuData.products;
      }
    }
    if (Array.isArray(ordersData)) {
      state.liveOrders = ordersData;
    }
    if (Array.isArray(reviewsData)) {
      state.reviews = reviewsData;
    }
    if (Array.isArray(couponsData)) {
      state.coupons = couponsData;
    }
    if (deliveryRulesData) {
      if (Array.isArray(deliveryRulesData.regions)) {
        state.deliveryRegions = deliveryRulesData.regions;
      }
      if (Array.isArray(deliveryRulesData.tip_rules)) {
        state.deliveryTipRules = deliveryRulesData.tip_rules;
      }
    }
    if (Array.isArray(hoursData)) {
      state.storeHours = hoursData;
    }
    if (holidayData) {
      state.holidaySettings = holidayData.settings;
      state.upcomingMajorHoliday = holidayData.upcoming_major;
    }
    if (settlementData) {
      state.settlementOverview = settlementData;
    }

    renderAllViews();
    if (state.store?.store_operation_type === 'DINE_IN_CENTRIC') {
      switchView('view-dinein-workspace');
    }
  } catch (err) {
    console.error('[App] 데이터 동기화 완료 (로컬 모드):', err);
    renderAllViews();
    if (state.store?.store_operation_type === 'DINE_IN_CENTRIC') {
      switchView('view-dinein-workspace');
    }
  }
}

function renderAllViews() {
  reorderSidebarNav(state.store?.nav_order, state.store?.store_operation_type);
  initSidebarSortable(state);
  renderStoreMeta(state.store);
  renderDineInWorkspace(state);
  renderKdsOrders(state);
  renderMenuGroupBlocks(state);
  renderCategoryDropdowns(state);
  renderDeliverySettings(state);
  renderStoreInfoForm(state.store);
  renderStoreBlockEditor(state);
  renderStoreHoursTable(state.storeHours);
  renderHolidaySettings(state.holidaySettings);
  renderSettlementCalendar(state.settlementOverview);
  renderOptionGroups(state);
  renderReviews(state);
  renderCoupons(state);

  // 사이드바 홀 예약 카운트 뱃지 동기화
  const dineInBadge = document.getElementById('badge-dinein-count');
  if (dineInBadge && Array.isArray(state.dineInReservations)) {
    const activeCount = state.dineInReservations.filter(r => r.status === 'WAITING' || r.status === 'CONFIRMED').length;
    dineInBadge.textContent = `${activeCount}건`;
  }
}

// 2-2. 점포 운영 형태(배달전문 vs 홀중심 vs 복합) 및 점주 커스텀 사이드바 순서 동적 재배치
export function reorderSidebarNav(navOrder, opType) {
  const navContainer = document.querySelector('.sidebar-menu');
  if (!navContainer) return;

  // 5대 기능 그룹 단위 원자적(Atomic) 순서 정의 (라벨과 버튼 일체형 이동)
  // 홀/매장 중심형: 주문관리 -> 가게관리 -> 메뉴관리 -> 마케팅·혜택 -> 정산관리
  const DINE_IN_GROUPS = [
    'group-orders',
    'group-store',
    'group-menu',
    'group-marketing',
    'group-settlement'
  ];

  // 배달 전문형: 주문관리 -> 메뉴관리 -> 가게관리 -> 마케팅·혜택 -> 정산관리
  const DELIVERY_GROUPS = [
    'group-orders',
    'group-menu',
    'group-store',
    'group-marketing',
    'group-settlement'
  ];

  // 점주가 커스텀 정렬한 navOrder가 있으면 최우선 적용, 없으면 매장 형태별 프리셋 적용
  const targetGroups = (Array.isArray(navOrder) && navOrder.length > 0)
    ? navOrder
    : ((opType === 'DINE_IN_CENTRIC') ? DINE_IN_GROUPS : DELIVERY_GROUPS);

  const groupMap = new Map();
  navContainer.querySelectorAll('.sidebar-nav-group').forEach(el => {
    const gid = el.getAttribute('data-group-id');
    if (gid) groupMap.set(gid, el);
  });

  targetGroups.forEach(gid => {
    const el = groupMap.get(gid);
    if (el) navContainer.appendChild(el);
  });
}

// 2-3. 오픈소스 SortableJS 기반 사이드바 관리자 메뉴 드래그 앤 드롭 초기화
export function initSidebarSortable(state) {
  const navContainer = document.querySelector('.sidebar-menu');
  if (!navContainer || typeof window.Sortable === 'undefined') return;

  if (navContainer._sortableInstance) {
    navContainer._sortableInstance.destroy();
  }

  navContainer._sortableInstance = new window.Sortable(navContainer, {
    handle: '.group-drag-handle',
    draggable: '.sidebar-nav-group',
    animation: 180,
    ghostClass: 'sidebar-group-ghost',
    chosenClass: 'sidebar-group-chosen',
    onEnd: async () => {
      const currentOrder = Array.from(navContainer.querySelectorAll('.sidebar-nav-group'))
        .map(el => el.getAttribute('data-group-id'))
        .filter(Boolean);

      if (state.store) {
        state.store.nav_order = currentOrder;
      }

      try {
        await merchantApi.updateStoreNavOrder(currentOrder);
      } catch (err) {
        console.warn('[Sortable] 사이드바 순서 저장 경고:', err);
      }
    }
  });
}

// 3. 사이드바 내비게이션 바인딩 및 뷰 전환 컨트롤러
export function switchView(targetView) {
  const navItems = document.querySelectorAll('.sidebar-menu .nav-item');
  const targetItem = document.querySelector(`.sidebar-menu .nav-item[data-view="${targetView}"]`);
  if (!targetItem) return;

  navItems.forEach(n => n.classList.remove('active'));
  targetItem.classList.add('active');

  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const activeSec = document.getElementById(targetView);
  if (activeSec) activeSec.classList.add('active');

  state.currentView = targetView;
  const crumb = document.getElementById('crumb-current-view');
  if (crumb) crumb.textContent = VIEW_TITLES[targetView] || '';
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar-menu .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      if (targetView) switchView(targetView);
    });
  });
}

// 4. 가게 관리 4단 탭 전환 바인딩
function setupStoreTabs() {
  const tabBasic = document.getElementById('tab-store-basic');
  const tabHours = document.getElementById('tab-store-hours');
  const tabDelivery = document.getElementById('tab-store-delivery');
  const tabPickup = document.getElementById('tab-store-pickup');

  const panelBasic = document.getElementById('panel-store-basic');
  const panelHours = document.getElementById('panel-store-hours');
  const panelDelivery = document.getElementById('panel-store-delivery');
  const panelPickup = document.getElementById('panel-store-pickup');

  if (tabBasic && tabHours && tabDelivery && tabPickup && panelBasic && panelHours && panelDelivery && panelPickup) {
    const tabs = [tabBasic, tabHours, tabDelivery, tabPickup];
    const panels = [panelBasic, panelHours, panelDelivery, panelPickup];

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.style.display = 'none');
        tab.classList.add('active');
        panels[i].style.display = 'block';
      });
    });
  }
}

// 5. 상단 컨트롤러 및 모달 제어
function setupGlobalControls() {
  // 모달 제어 (메뉴 / 대분류 / PWA 프리뷰)
  const openMenuModalBtn = document.getElementById('btn-open-create-menu');
  const menuModal = document.getElementById('modal-create-menu');
  const openCatModalBtn = document.getElementById('btn-open-create-category');
  const catModal = document.getElementById('modal-create-category');
  const btnOpenPwa = document.getElementById('btn-open-pwa-preview');
  const pwaModal = document.getElementById('modal-pwa-preview');
  const closeModalBtns = document.querySelectorAll('.btn-close-modal');

  if (openMenuModalBtn && menuModal) {
    openMenuModalBtn.addEventListener('click', () => {
      renderCategoryDropdowns(state);
      menuModal.classList.add('show');
    });
  }

  if (openCatModalBtn && catModal) {
    openCatModalBtn.addEventListener('click', () => catModal.classList.add('show'));
  }

  if (btnOpenPwa && pwaModal) {
    btnOpenPwa.addEventListener('click', () => {
      renderPwaSimulator(state);
      pwaModal.classList.add('show');
    });
  }

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });

  // 메뉴 상세수정 모달 저장 / 삭제
  const btnSaveEdit = document.getElementById('btn-save-edit-menu');
  if (btnSaveEdit) {
    btnSaveEdit.addEventListener('click', () => handleSaveEditMenu(state));
  }

  const btnDeleteEdit = document.getElementById('btn-delete-menu-modal');
  if (btnDeleteEdit) {
    btnDeleteEdit.addEventListener('click', () => handleDeleteMenuFromModal(state));
  }

  // 상세수정 모달 스케줄 토글 & 요일칩
  const editSchedCheck = document.getElementById('edit-menu-check-schedule');
  const editSchedBox = document.getElementById('edit-menu-schedule-box');
  if (editSchedCheck && editSchedBox) {
    editSchedCheck.addEventListener('change', (e) => {
      editSchedBox.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  const editDayChips = document.querySelectorAll('#edit-menu-schedule-days .schedule-day-chip');
  editDayChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
    });
  });

  // 상세수정 모달 이미지 URL 입력 시 미리보기 반영
  const editImgInput = document.getElementById('edit-image-url');
  const editImgPreview = document.getElementById('edit-image-preview');
  if (editImgInput && editImgPreview) {
    editImgInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) editImgPreview.src = val;
    });
  }

  // 사진 업로드 & 실시간 미리보기
  const dropZone = document.getElementById('image-drop-zone');
  const fileInput = document.getElementById('menu-file-input');
  const previewImg = document.getElementById('image-preview');
  const placeholder = document.getElementById('image-placeholder');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (re) => {
          if (previewImg && placeholder) {
            previewImg.src = re.target.result;
            previewImg.classList.add('show');
            placeholder.style.display = 'none';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // 대분류 셀렉트 체인 이벤트 (소분류 동적 변경)
  const catSelect = document.getElementById('menu-input-category');
  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      updateSubcategoryDropdown(e.target.value, state);
    });
  }

  // 신규 대분류 등록 제출
  const submitCatBtn = document.getElementById('btn-submit-create-category');
  if (submitCatBtn) {
    submitCatBtn.addEventListener('click', () => handleCreateCategory(state));
  }

  // 신규 메뉴 등록 제출
  const submitMenuBtn = document.getElementById('btn-submit-create-menu');
  if (submitMenuBtn) {
    submitMenuBtn.addEventListener('click', () => handleCreateMenu(state));
  }

  // SwadKart FEAT-7 메뉴 스케줄 토글 & 요일칩 선택
  const scheduleCheck = document.getElementById('menu-check-schedule');
  const scheduleBox = document.getElementById('menu-schedule-box');
  if (scheduleCheck && scheduleBox) {
    scheduleCheck.addEventListener('change', (e) => {
      scheduleBox.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  const dayChips = document.querySelectorAll('#menu-schedule-days .schedule-day-chip');
  dayChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
    });
  });

  // 긴급 일시중지 바 (30분 / 60분 / 즉시 재개)
  const btnPause30 = document.getElementById('btn-pause-30');
  const btnPause60 = document.getElementById('btn-pause-60');
  const btnPauseResume = document.getElementById('btn-pause-resume');

  if (btnPause30) btnPause30.addEventListener('click', () => startQuickPause(state, 30));
  if (btnPause60) btnPause60.addEventListener('click', () => startQuickPause(state, 60));
  if (btnPauseResume) btnPauseResume.addEventListener('click', () => stopQuickPause(state));

  // 1) 영업시간 방식 (매일 동일 vs 요일별)
  const radioHoursDaily = document.getElementById('radio-hours-daily');
  const radioHoursCustom = document.getElementById('radio-hours-custom');
  const boxHoursDaily = document.getElementById('box-hours-daily');
  const boxHoursCustom = document.getElementById('box-hours-custom');

  if (radioHoursDaily && radioHoursCustom && boxHoursDaily && boxHoursCustom) {
    radioHoursDaily.addEventListener('change', () => {
      boxHoursDaily.style.display = 'block';
      boxHoursCustom.style.display = 'none';
    });
    radioHoursCustom.addEventListener('change', () => {
      boxHoursDaily.style.display = 'none';
      boxHoursCustom.style.display = 'block';
    });
  }

  // 브레이크타임 체크박스
  const checkDailyBreak = document.getElementById('check-daily-break');
  const wrapDailyBreak = document.getElementById('wrap-daily-break');
  if (checkDailyBreak && wrapDailyBreak) {
    checkDailyBreak.addEventListener('change', (e) => {
      wrapDailyBreak.style.display = e.target.checked ? 'inline-flex' : 'none';
    });
  }

  // 2) 정기 휴무일 (연중무휴 vs 요일별 휴무)
  const radioClosedNone = document.getElementById('radio-closed-none');
  const radioClosedWeekly = document.getElementById('radio-closed-weekly');
  const boxWeeklyClosedChips = document.getElementById('box-weekly-closed-chips');

  if (radioClosedNone && radioClosedWeekly && boxWeeklyClosedChips) {
    radioClosedNone.addEventListener('change', () => {
      boxWeeklyClosedChips.style.display = 'none';
      document.querySelectorAll('#regular-closed-day-chips .schedule-day-chip').forEach(c => c.classList.remove('active'));
    });
    radioClosedWeekly.addEventListener('change', () => {
      boxWeeklyClosedChips.style.display = 'block';
    });
  }

  const closedDayChips = document.querySelectorAll('#regular-closed-day-chips .schedule-day-chip');
  closedDayChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
    });
  });

  // 3) 공휴일 정상영업 체크박스
  const checkHolidayOpen = document.getElementById('check-holiday-open');
  if (checkHolidayOpen) {
    checkHolidayOpen.addEventListener('change', async (e) => {
      try {
        await merchantApi.updateHolidaySettings({ auto_holiday_closed: !e.target.checked });
      } catch (err) {
        alert('공휴일 정책 변경 실패: ' + err.message);
      }
    });
  }

  // 개인사정 임시휴무 등록 폼 토글 및 제출
  const btnToggleClosure = document.getElementById('btn-toggle-custom-closure');
  const boxCustomClosure = document.getElementById('box-create-custom-closure');
  const btnCancelClosure = document.getElementById('btn-cancel-custom-closure');
  const btnSubmitClosure = document.getElementById('btn-submit-custom-closure');

  if (btnToggleClosure && boxCustomClosure) {
    btnToggleClosure.addEventListener('click', () => {
      boxCustomClosure.style.display = boxCustomClosure.style.display === 'none' ? 'block' : 'none';
    });
  }
  if (btnCancelClosure && boxCustomClosure) {
    btnCancelClosure.addEventListener('click', () => {
      boxCustomClosure.style.display = 'none';
    });
  }
  if (btnSubmitClosure) {
    btnSubmitClosure.addEventListener('click', () => handleCreateCustomClosure(state.holidaySettings));
  }

  // 배달지역 추가
  const btnAddRegion = document.getElementById('btn-add-region');
  const selectDong = document.getElementById('select-dong-add');
  if (btnAddRegion && selectDong) {
    btnAddRegion.addEventListener('click', () => {
      const dong = selectDong.value;
      if (dong && !state.deliveryRegions.includes(dong)) {
        state.deliveryRegions.push(dong);
        renderDeliveryRegions(state);
      }
    });
  }

  // 배달팁 구간 추가
  const btnAddTipRule = document.getElementById('btn-add-tip-rule');
  if (btnAddTipRule) {
    btnAddTipRule.addEventListener('click', () => {
      state.deliveryTipRules.push({ min: 50000, max: 70000, tip: 1000 });
      renderTipRulesTable(state);
    });
  }

  // 가게 정보 및 배달/픽업 전체 저장
  const btnSaveStoreAll = document.getElementById('btn-save-store-all');
  if (btnSaveStoreAll) {
    btnSaveStoreAll.addEventListener('click', async () => {
      await handleSaveStoreInfo(state, {
        onDeliverySaved: () => renderDeliverySettings(state)
      });
    });
  }

  // KDS 주문 알림음 테스트
  const btnTestSound = document.getElementById('btn-test-sound');
  if (btnTestSound) {
    btnTestSound.addEventListener('click', () => playOrderChime());
  }

  // Enatega 옵션 그룹 생성 모달 바인딩
  const btnOpenCreateOpt = document.getElementById('btn-open-create-option-group');
  const modalCreateOpt = document.getElementById('modal-create-option-group');
  if (btnOpenCreateOpt && modalCreateOpt) {
    btnOpenCreateOpt.addEventListener('click', () => modalCreateOpt.classList.add('show'));
  }

  const btnSubmitCreateOpt = document.getElementById('btn-submit-create-option-group');
  if (btnSubmitCreateOpt) {
    btnSubmitCreateOpt.addEventListener('click', () => handleCreateOptionGroup(state));
  }

  // 점포 운영 형태 (배달전문 vs 홀중심 vs 복합) 라디오 변경 리스너
  const opTypeRadios = document.querySelectorAll('input[name="radio-store-op-type"]');
  opTypeRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      const newType = e.target.value;
      if (state.store) {
        state.store.store_operation_type = newType;
        state.store.nav_order = null;
      }
      reorderSidebarNav(null, newType);
      try {
        await merchantApi.updateStoreType(newType);
      } catch (err) {
        console.warn('운영 형태 저장 경고:', err);
      }
    });
  });
}
