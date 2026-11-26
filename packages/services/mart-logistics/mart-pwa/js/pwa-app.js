/**
 * AITIP Mart Dedicated PWA Controller (ESM)
 * DOC-19 기준: 일반 소비자 기본 몰 + 큰글씨 옵션 + 기관(FAC-*) 전환 + 관리자 6대 블록 동적 렌더링
 */

import { martPwaApi } from './pwa-api.js';
import { evaluateCartPromotions } from './pwa-promo-engine.js';
import { getL1List, getL2List, inferCategoryFromProduct } from '../../js/utils/mart-categories.js';
import { initPortalAuthGate } from '/core/shared/portal-auth-gate.js';

let persona = new URLSearchParams(location.search).get('mode') === 'facility' ? 'B2B_FACILITY' : 'B2C_CONSUMER'; // 'B2C_CONSUMER' | 'B2B_FACILITY'
let largeText = false;
let pwaTab = 'SHOP'; // 'SHOP' | 'ORDERS'
let detailProductId = '';
let selectedCat = 'ALL'; // 'ALL' | '01'..'06' | 'PROMO_ONLY' | 'PREP_PROCESSED'
let selectedSubCat = 'ALL'; // 'ALL' | L2 code
let searchQuery = '';
let cartOpen = false;
let deliveryMode = 'LOCAL_DELIVERY'; // 'LOCAL_DELIVERY' | 'STORE_PICKUP'
let stockoutPolicy = 'PARTIAL_REFUND';
let paymentMethod = 'CARD';
let selectedCard = 'ALL';
const cart = new Map(); // product_id -> { product, qty }

function esc(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCartTotals() {
  return evaluateCartPromotions(Array.from(cart.values()), { selectedCard });
}

async function render() {
  const root = document.getElementById('mart-pwa-root');
  if (!root) return;
  root.className = `pwa-shell${largeText ? ' large-text' : ''}`;

  const [cfgRes, catRes, martsRes, gbRes, ordersRes] = await Promise.all([
    martPwaApi.getPwaConfig(),
    martPwaApi.getCatalog(),
    martPwaApi.getMarts(),
    martPwaApi.getGroupBuys(),
    martPwaApi.getOrders().catch(() => ({ orders: [] }))
  ]);

  const cfg = cfgRes.config || {};
  const mart = catRes.mart || {};
  const products = catRes.products || [];
  const promotions = catRes.promotions || [];
  const marts = martsRes.marts || [];
  const groupBuys = gbRes.group_buys || [];
  const orders = ordersRes.orders || [];
  const detailProduct = detailProductId ? products.find(p => p.id === detailProductId) : null;
  const blocks = (cfg.blocks || []).filter(b => b.enabled).sort((a, b) => Number(a.order) - Number(b.order));

  const q = searchQuery.trim().toLowerCase();
  const visibleProducts = products.filter(p => {
    if (p.online_publish_status === 'SUSPENDED') return false;
    if (p.payment_scope === 'POS_ONLY' && cfg.pos_only_policy === 'HIDE') return false;
    if (!q && p.online_publish_status === 'SEARCH_ONLY') return false;
    if (persona === 'B2C_CONSUMER' && (p.category_type === 'PREP_PROCESSED' || p.sales_target === 'B2B_ONLY')) return false;
    if (persona === 'B2B_FACILITY' && p.sales_target === 'B2C_ONLY') return false;
    if (selectedCat === 'PROMO_ONLY') {
      if (!p.applied_promo_id && !(Number(p.sale_price || 0) < Number(p.regular_price || 0))) return false;
    } else if (selectedCat === 'PREP_PROCESSED') {
      if (p.category_type !== 'PREP_PROCESSED') return false;
    } else if (selectedCat !== 'ALL') {
      const cat = inferCategoryFromProduct(p);
      if (cat.l1 !== selectedCat) return false;
      if (selectedSubCat !== 'ALL' && cat.l2 !== selectedSubCat) return false;
    }
    if (q && !`${p.name} ${p.spec} ${p.barcode}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const totals = getCartTotals();

  const approvedGroupBuys = groupBuys.filter(g => {
    if ((g.approval_status || 'APPROVED') !== 'APPROVED') return false;
    if (persona === 'B2C_CONSUMER' && g.campaign_type === 'B2B_INSTITUTIONAL') return false;
    return true;
  });

  const renderGroupBuySection = () => `
    <div class="section-block">
      <div class="section-title">
        <span>${persona === 'B2B_FACILITY' ? '우리동네 · 기관 공동구매' : '우리동네 공동구매'}</span>
        <span style="font-size:11.5px;color:#64748b;">진행 중 ${approvedGroupBuys.length}건</span>
      </div>
      ${approvedGroupBuys.length === 0 ? `
        <div style="text-align:center;padding:36px 12px;color:#64748b;font-size:13px;">현재 진행 중인 공동구매가 없습니다.</div>
      ` : approvedGroupBuys.map(g => {
        const pct = Math.min(100, Math.round((g.current_qty / g.target_qty) * 100));
        return `
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-bottom: 8px;">
            <span class="badge badge-cosell">${g.campaign_type === 'B2B_INSTITUTIONAL' ? '기관 공구' : '주민 공구'}</span>
            <div style="font-weight: 800; font-size: 13px; margin-top: 4px;">${esc(g.title)}</div>
            <div style="font-size: 12px; margin-top: 4px;">
              <b style="color:#065f46;">${Number(g.unit_price).toLocaleString()}원</b>
              <span style="text-decoration:line-through;color:#94a3b8;margin-left:6px;">${Number(g.regular_price).toLocaleString()}원</span>
            </div>
            <div style="background:#e2e8f0; height:6px; border-radius:999px; margin:6px 0;">
              <div style="background:#065f46; height:100%; width:${pct}%; border-radius:999px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px;">
              <span>달성률 ${pct}% (${g.current_qty}/${g.target_qty})</span>
              <button type="button" class="pill-btn btn-join-gb" data-cid="${esc(g.campaign_id)}" style="background:#065f46;color:#fff;border:none;">공구 1개 참여</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const blockHtmlMap = {
    STATUS_BANNER: () => {
      const cls = cfg.store_status === 'PREP_BREAK' ? 'break' : cfg.store_status === 'CLOSED' ? 'closed' : '';
      const statusTxt = cfg.store_status === 'OPEN'
        ? `정상 영업 중 · 당일 배송 마감 ${esc(cfg.cutoff_time || '14:00')}`
        : cfg.store_status === 'PREP_BREAK'
          ? '전처리·피킹 집중 시간으로 예약 주문만 접수 중'
          : '금일 영업 종료 (익일 배송 예약 가능)';
      return `
        <div class="status-banner ${cls}">
          <strong>${statusTxt}</strong>
          ${cfg.notice_text ? `<div style="margin-top: 3px;">${esc(cfg.notice_text)}</div>` : ''}
        </div>
      `;
    },
    FLYER_CAROUSEL: () => {
      const banners = Array.isArray(cfg.flyer_banners) ? cfg.flyer_banners : [];
      return `
      <div class="section-block">
        <div class="section-title"><span>금주의 전단 · 반짝 특가</span><span style="font-size:11.5px;color:#065f46;">${promotions.length}건 진행중</span></div>
        ${banners.length > 0 ? `
          <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:6px;">
            ${banners.map(b => `
              <a href="${esc(b.image_url)}" target="_blank" style="min-width:160px; max-width:200px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; display:block; background:#fff;">
                <img src="${esc(b.image_url)}" alt="${esc(b.title || '전단 이미지')}" style="width:100%; height:110px; object-fit:cover; display:block;" />
              </a>
            `).join('')}
          </div>
        ` : ''}
        <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;">
          ${promotions.map(pr => `
            <div style="min-width: 210px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px; padding: 10px;">
              <span class="badge badge-promo">${esc(pr.promo_type)}</span>
              <div style="font-weight: 800; font-size: 13px; margin-top: 4px;">${esc(pr.name)}</div>
              <div style="font-size: 11px; color: #92400e; margin-top: 3px;">${esc(pr.start_date)} ~ ${esc(pr.end_date)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    },
    CATEGORY_GRID: () => {
      const l1List = getL1List();
      const cats = [
        ['ALL', '전체상품'],
        ...l1List.map(c => [c.code, c.name === '냉장·냉동·유제품' ? '냉장·냉동' : c.name]),
        ['PROMO_ONLY', '금주 특가']
      ];
      if (persona === 'B2B_FACILITY') cats.push(['PREP_PROCESSED', '기관 전처리']);
      const l2List = /^[0-9]{2}$/.test(selectedCat) ? getL2List(selectedCat) : [];
      return `
        <div class="section-block">
          <div class="quick-grid">
            ${cats.map(([k, lbl]) => `
              <button type="button" class="quick-chip ${selectedCat === k ? 'active' : ''}" data-cat="${k}">${esc(lbl)}</button>
            `).join('')}
          </div>
          ${l2List.length > 0 ? `
            <div class="sub-cat-row">
              <button type="button" class="sub-chip ${selectedSubCat === 'ALL' ? 'active' : ''}" data-sub="ALL">전체</button>
              ${l2List.map(sub => `
                <button type="button" class="sub-chip ${selectedSubCat === sub.code ? 'active' : ''}" data-sub="${sub.code}">${esc(sub.name)}</button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    },
    PROMO_SHELF: (blk) => {
      const fids = Array.isArray(blk?.featured_product_ids) ? blk.featured_product_ids : [];
      const ov = blk?.shelf_overrides || {};
      const applyOv = (p) => (ov[p.id]?.shelf_price > 0 ? { ...p, sale_price: Number(ov[p.id].shelf_price) } : p);
      const list = (!q && fids.length > 0)
        ? fids.map(id => visibleProducts.find(p => p.id === id)).filter(Boolean).map(applyOv)
        : visibleProducts.filter(p => p.applied_promo_id || Number(p.sale_price || 0) < Number(p.regular_price || 0)).slice(0, 4);
      const finalList = list.length > 0 ? list : visibleProducts.slice(0, 4);
      return renderProductGrid(blk?.title || '1+1 · 골라담기 · 행사 상품', finalList, cfg);
    },
    CURATED_SHELF: (blk) => {
      const fids = Array.isArray(blk?.featured_product_ids) ? blk.featured_product_ids : [];
      const ov = blk?.shelf_overrides || {};
      const applyOv = (p) => (ov[p.id]?.shelf_price > 0 ? { ...p, sale_price: Number(ov[p.id].shelf_price) } : p);
      const list = (!q && fids.length > 0)
        ? fids.map(id => visibleProducts.find(p => p.id === id)).filter(Boolean).map(applyOv)
        : visibleProducts;
      return renderProductGrid(q ? `검색 결과 (${visibleProducts.length}건)` : (blk?.title || '우리동네 추천 진열대'), list, cfg);
    },
    CO_SELL_AND_GROUP_BUY: () => ''
  };

  root.innerHTML = `
    <header class="pwa-header">
      <div class="pwa-header-top">
        <select class="pwa-mart-select" aria-label="단골 마트 선택">
          ${marts.map(m => `<option value="${esc(m.mart_id)}">${esc(m.mart_name)}</option>`).join('')}
        </select>
        <div style="display:flex; gap:5px; align-items:center; flex-shrink:0;">
          <button type="button" id="btn-header-orders" class="pill-btn ${pwaTab === 'ORDERS' ? 'active' : ''}" data-pwa-tab="ORDERS">
            내 주문 (${orders.length})
          </button>
        </div>
      </div>
      <div class="search-bar">
        <input id="pwa-search-input" type="text" value="${esc(searchQuery)}" placeholder="전단 특가 · 매장 상품 검색..." />
      </div>
    </header>

    ${persona === 'B2B_FACILITY' ? `
      <div class="facility-bar">
        <strong>기관 발주 모드: 서초 양재1동 경로당 (FAC-11-650-01-87391-0001)</strong>
        <div>보조금 잔액 450,000원 · 월말 후불 여신 가능 · 전처리 품목 노출됨</div>
      </div>
    ` : ''}

    <div class="pwa-nav-tabs">
      <button type="button" class="pwa-nav-tab ${pwaTab === 'SHOP' ? 'active' : ''}" data-pwa-tab="SHOP">장보기</button>
      <button type="button" class="pwa-nav-tab ${pwaTab === 'FLYER' ? 'active' : ''}" data-pwa-tab="FLYER">전단</button>
      <button type="button" class="pwa-nav-tab ${pwaTab === 'GROUP_BUY' ? 'active' : ''}" data-pwa-tab="GROUP_BUY">공동구매 (${approvedGroupBuys.length})</button>
    </div>

    <main>
      ${pwaTab === 'ORDERS'
        ? renderOrdersView(orders)
        : pwaTab === 'GROUP_BUY'
          ? renderGroupBuySection()
          : pwaTab === 'FLYER'
            ? (['FLYER_CAROUSEL', 'PROMO_SHELF'].map(id => {
                const blk = blocks.find(b => b.id === id) || { id };
                return blockHtmlMap[id] ? blockHtmlMap[id](blk) : '';
              }).join(''))
            : blocks
                .filter(b => !['FLYER_CAROUSEL', 'PROMO_SHELF'].includes(b.id))
                .map(b => (blockHtmlMap[b.id] ? blockHtmlMap[b.id](b) : ''))
                .join('')
      }
      <footer style="padding: 18px 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; line-height: 1.7;">
        <div style="font-weight: 800; color: #334155; margin-bottom: 4px;">${esc(mart.mart_name || '하나로마트')}</div>
        <div>위탁운영: ${esc(mart.operator_name || '-')} ${mart.manager?.name ? `· 점장: ${esc(mart.manager.name)}` : ''}</div>
        <div>사업자등록번호: ${esc(mart.biz_number || '-')} · 영업시간: ${esc(mart.open_hours || '09:00 ~ 22:00')}</div>
        <div>주소: ${esc(mart.address || '-')}</div>
        <div>고객센터: <a href="tel:${esc(mart.phone || '')}" style="color: #065f46; font-weight: 700; text-decoration: none;">${esc(mart.phone || '-')}</a></div>
      </footer>
    </main>

    ${totals.totalQty > 0 ? `
      <div class="cart-bar">
        <div>
          <div style="font-size: 11.5px; color: #cbd5e1;">총 ${totals.totalQty}개 담김</div>
          <div style="font-size: 15px; font-weight: 800;">${totals.grandTotal.toLocaleString()}원</div>
        </div>
        <button type="button" id="btn-open-cart" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-weight:800;cursor:pointer;">장바구니 · 주문</button>
      </div>
    ` : ''}

    ${detailProduct ? renderProductDetailModal(detailProduct, cfg) : ''}
    ${cartOpen ? renderCartDrawer(totals) : ''}
  `;

  bindEvents(root, { products, orders });
}

function renderProductGrid(title, list, cfg) {
  return `
    <div class="section-block">
      <div class="section-title"><span>${esc(title)}</span></div>
      <div class="prod-grid">
        ${list.map(p => {
          const isPosOnly = p.payment_scope === 'POS_ONLY';
          const isSoldOut = Number(p.stock_qty ?? 50) <= Number(p.safety_stock ?? 5);
          const disabled = isPosOnly || isSoldOut || cfg.store_status === 'CLOSED';
          return `
            <div class="prod-card">
              <div>
                <div class="prod-thumb prod-clickable" data-detail-pid="${esc(p.id)}">
                  ${p.image_url
                    ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" />`
                    : (p.category_type === 'FRESH' ? '신선농수산' : p.category_type === 'PREP_PROCESSED' ? '전처리규격' : '표준상품')
                  }
                </div>
                <div style="margin-top:6px;">
                  ${isPosOnly ? `<span class="badge badge-pos">매장 현장결제 전용</span>` : ''}
                  ${isSoldOut ? `<span class="badge badge-pos">일시품절</span>` : ''}
                  ${p.category_type === 'FRESH' ? `<span class="badge badge-fresh">오늘 신선</span>` : ''}
                  ${p.applied_promo_name ? `<span class="badge badge-promo">${esc(p.applied_promo_name)}</span>` : ''}
                  ${(p.promo_limit_per_person || p.limit_per_person) ? `<span class="badge badge-promo">1인 ${p.promo_limit_per_person || p.limit_per_person}한정</span>` : ''}
                </div>
                <div class="prod-title prod-clickable" data-detail-pid="${esc(p.id)}" style="margin-top:4px;">${esc(p.name)}</div>
                <div class="prod-spec">${esc(p.spec)} · ${esc(p.uom)}</div>
              </div>
              <div>
                <div class="prod-price">${Number(p.sale_price || p.regular_price || 0).toLocaleString()}원</div>
                <button type="button" class="btn-add" data-pid="${esc(p.id)}" ${disabled ? 'disabled' : ''}>
                  ${isPosOnly ? '현장 전용가' : isSoldOut ? '품절' : '담기'}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCartDrawer(totals) {
  return `
    <div class="cart-drawer" id="cart-drawer-bg">
      <div class="cart-sheet">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="font-size:16px;">이원 장바구니 & 주문서</strong>
          <button type="button" id="btn-close-cart" style="border:none;background:none;font-size:16px;cursor:pointer;">닫기</button>
        </div>

        <div style="margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;">수령 방식</label>
          <select id="sel-delivery-mode" style="width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:6px;margin-top:4px;">
            <option value="LOCAL_DELIVERY" ${deliveryMode === 'LOCAL_DELIVERY' ? 'selected' : ''}>우리동네 마트 당일배송 (온도대 분리 박싱 · 배송비 1회)</option>
            <option value="STORE_PICKUP" ${deliveryMode === 'STORE_PICKUP' ? 'selected' : ''}>매장 픽업 (방문 수령 · 배송비 0원)</option>
          </select>
        </div>

        <div style="margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;">세일상품 품절 시 처리 옵션</label>
          <select id="sel-stockout-policy" style="width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:6px;margin-top:4px;">
            <option value="PARTIAL_REFUND" ${stockoutPolicy === 'PARTIAL_REFUND' ? 'selected' : ''}>품절 상품만 제외 후 부분환불 (권장)</option>
            <option value="ALLOW_SUBSTITUTE" ${stockoutPolicy === 'ALLOW_SUBSTITUTE' ? 'selected' : ''}>동일 가격대 유사 상품 대체</option>
            <option value="CONTACT_FIRST" ${stockoutPolicy === 'CONTACT_FIRST' ? 'selected' : ''}>0504 안심번호/알림톡 연락 후 결정</option>
          </select>
        </div>

        <div style="margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;">결제 수단</label>
          <select id="sel-pay-method" style="width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:6px;margin-top:4px;">
            <option value="CARD" ${paymentMethod === 'CARD' ? 'selected' : ''}>온라인 카드 · 간편결제</option>
            ${persona === 'B2B_FACILITY' ? `
              <option value="FACILITY_POSTPAY" ${paymentMethod === 'FACILITY_POSTPAY' ? 'selected' : ''}>기관 월말 후불 정산 (세금계산서)</option>
              <option value="MUNICIPAL_VOUCHER" ${paymentMethod === 'MUNICIPAL_VOUCHER' ? 'selected' : ''}>지자체 보조금 · 바우처 결제</option>
            ` : ''}
          </select>
        </div>

        ${paymentMethod === 'CARD' ? `
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:700;">제휴 카드 선택 (카드별 행사 자동 적용)</label>
            <select id="sel-card-brand" style="width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:6px;margin-top:4px;">
              <option value="ALL" ${selectedCard === 'ALL' ? 'selected' : ''}>일반 카드 (카드 전용 할인 미적용)</option>
              <option value="NH" ${selectedCard === 'NH' ? 'selected' : ''}>NH농협카드</option>
              <option value="KB" ${selectedCard === 'KB' ? 'selected' : ''}>KB국민카드</option>
              <option value="SHINHAN" ${selectedCard === 'SHINHAN' ? 'selected' : ''}>신한카드</option>
              <option value="SAMSUNG" ${selectedCard === 'SAMSUNG' ? 'selected' : ''}>삼성카드</option>
            </select>
          </div>
        ` : ''}

        <div style="border-top:1px solid #e2e8f0;padding-top:10px;margin-bottom:12px;font-size:13px;">
          ${(totals.lines || []).map(line => `
            <div style="padding:6px 0;border-bottom:1px dashed #e2e8f0;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span style="font-weight:700;">${esc(line.product.name)}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                  <button type="button" class="cart-qty-btn btn-cart-dec" data-pid="${esc(line.product.id)}">-</button>
                  <span style="min-width:20px;text-align:center;font-weight:700;">${line.qty}</span>
                  <button type="button" class="cart-qty-btn btn-cart-inc" data-pid="${esc(line.product.id)}">+</button>
                  <b style="min-width:68px;text-align:right;">${line.lineTotal.toLocaleString()}원</b>
                </div>
              </div>
              ${(line.appliedBadge || line.lineDiscount > 0 || line.promoNote) ? `
                <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-top:3px;">
                  <span style="color:${line.appliedBadge ? '#047857' : '#b45309'};">${esc(line.appliedBadge || line.promoNote)}</span>
                  ${line.lineDiscount > 0 ? `<span style="color:#dc2626;font-weight:700;">-${line.lineDiscount.toLocaleString()}원</span>` : ''}
                </div>
              ` : ''}
            </div>
          `).join('')}
          ${totals.totalDiscount > 0 ? `
            <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#64748b;margin-top:8px;">
              <span>상품 합계</span>
              <span>${totals.subtotalBeforeDiscount.toLocaleString()}원</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#dc2626;font-weight:700;margin-top:4px;">
              <span>행사 · 묶음 할인</span>
              <span>-${totals.totalDiscount.toLocaleString()}원</span>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;margin-top:8px;color:#065f46;">
            <span>결제 예정 금액</span>
            <span>${totals.grandTotal.toLocaleString()}원</span>
          </div>
        </div>

        <button type="button" id="btn-submit-pwa-order" class="btn-add" style="padding:12px;font-size:14px;">주문 접수하기</button>
      </div>
    </div>
  `;
}

function renderProductDetailModal(p, cfg) {
  const cat = inferCategoryFromProduct(p);
  const isPosOnly = p.payment_scope === 'POS_ONLY';
  const isSoldOut = Number(p.stock_qty ?? 50) <= Number(p.safety_stock ?? 5);
  const disabled = isPosOnly || isSoldOut || cfg.store_status === 'CLOSED';
  const tempKo = p.storage_temp === 'REFRIGERATED' ? '냉장 (0~5℃)' : p.storage_temp === 'FROZEN' ? '냉동 (-18℃ 이하)' : '상온';
  const taxKo = p.tax_type === 'EXEMPT' ? '면세 (농·축·수산)' : '과세';
  return `
    <div class="cart-drawer" id="detail-modal-bg">
      <div class="cart-sheet" style="max-height:86vh; overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong style="font-size:15px;">상품 상세 정보</strong>
          <button type="button" id="btn-close-detail" style="border:none;background:none;font-size:16px;cursor:pointer;">닫기</button>
        </div>
        <div style="width:100%;height:200px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:12px;">
          ${p.image_url
            ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" style="max-width:100%;max-height:100%;object-fit:contain;" />`
            : `<span style="color:#94a3b8;font-size:13px;">등록된 이미지가 없습니다</span>`
          }
        </div>
        <div style="font-size:11.5px;color:#64748b;margin-bottom:4px;">${esc(cat.path)}</div>
        <div style="font-size:17px;font-weight:800;color:#0f172a;">${esc(p.name)}</div>
        <div style="font-size:12.5px;color:#475569;margin-top:4px;">규격: ${esc(p.spec || '-')} · 단위: ${esc(p.uom || '개')} · 보관: ${tempKo} · ${taxKo}</div>
        ${p.applied_promo_name ? `
          <div style="margin-top:10px;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;">
            <strong>적용 행사:</strong> ${esc(p.applied_promo_name)}
            ${(p.promo_card_targets || []).length > 0 ? ` · 카드: ${esc(p.promo_card_targets.join(', '))}` : ''}
            ${(p.promo_limit_per_person || p.limit_per_person) ? ` · 1인 ${p.promo_limit_per_person || p.limit_per_person}한정` : ''}
          </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
          <div>
            ${Number(p.regular_price || 0) > Number(p.sale_price || p.regular_price || 0)
              ? `<div style="font-size:12px;color:#94a3b8;text-decoration:line-through;">${Number(p.regular_price).toLocaleString()}원</div>`
              : ''}
            <div style="font-size:19px;font-weight:800;color:#065f46;">${Number(p.sale_price || p.regular_price || 0).toLocaleString()}원</div>
          </div>
          <button type="button" id="btn-detail-add-cart" class="btn-add" data-pid="${esc(p.id)}" style="width:auto;padding:10px 22px;font-size:14px;" ${disabled ? 'disabled' : ''}>
            ${isPosOnly ? '매장 현장결제 전용' : isSoldOut ? '일시품절' : '장바구니 담기'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderOrdersView(orders = []) {
  const STEPS = [
    { key: 'REQUESTED', label: '주문접수' },
    { key: 'PICKING', label: '매장피킹' },
    { key: 'BOXING', label: '온도별포장' },
    { key: 'DELIVERED', label: '배송완료' }
  ];
  const stepIndex = (st = '') => {
    if (st === 'DELIVERED' || st === 'COMPLETED') return 3;
    if (st === 'BOXING' || st === 'DISPATCHED') return 2;
    if (st === 'PICKING') return 1;
    return 0;
  };
  return `
    <div class="section-block">
      <div class="section-title"><span>내 주문내역 · 실시간 배송추적</span><span style="font-size:11.5px;color:#64748b;">총 ${orders.length}건</span></div>
      ${orders.length === 0 ? `
        <div style="text-align:center;padding:36px 12px;color:#64748b;font-size:13px;">접수된 주문이 없습니다.</div>
      ` : orders.map(o => {
        const curIdx = stepIndex(o.status);
        const oidParts = String(o.order_id || '').split('-');
        const shortNo = oidParts.length >= 2 && /^\d{6}$/.test(oidParts[oidParts.length - 2])
          ? `${oidParts[oidParts.length - 2]}-${oidParts[oidParts.length - 1]}`
          : (o.order_id || '-');
        const cleanBuyer = String(o.buyer_name || '주문').replace(/\s*\((?:PWA 주문|PWA 발주)\)\s*/g, '').trim();
        return `
          <div class="order-track-card">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
              <code style="color:#475569;" title="${esc(o.order_id)}">${esc(shortNo)}</code>
              <span style="font-weight:800;color:#065f46;">${Number(o.total_amount || 0).toLocaleString()}원</span>
            </div>
            <div style="font-size:13px;font-weight:700;margin-top:4px;color:#0f172a;">${esc(cleanBuyer || '주문')}</div>
            <div class="order-steps">
              ${STEPS.map((st, idx) => `
                <div class="order-step ${idx < curIdx ? 'done' : idx === curIdx ? 'current' : ''}">${st.label}</div>
              `).join('')}
            </div>
            <div style="font-size:12px;color:#475569;margin-bottom:8px;">
              ${(o.items || []).map(it => `${esc(it.name)} × ${it.actual_qty ?? it.qty}`).join(', ')}
            </div>
            <button type="button" class="sub-chip btn-reorder-items" data-oid="${esc(o.order_id)}" style="width:100%;padding:7px;text-align:center;">이 주문 품목 다시 담기</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function bindEvents(root, { products = [], orders = [] } = {}) {
  root.querySelectorAll('[data-pwa-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      pwaTab = btn.dataset.pwaTab || 'SHOP';
      render();
    });
  });
  root.querySelectorAll('.prod-clickable').forEach(el => {
    el.addEventListener('click', () => {
      detailProductId = el.dataset.detailPid || '';
      render();
    });
  });
  root.querySelector('#btn-close-detail')?.addEventListener('click', () => {
    detailProductId = '';
    render();
  });
  root.querySelector('#detail-modal-bg')?.addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal-bg') { detailProductId = ''; render(); }
  });
  root.querySelectorAll('.btn-reorder-items').forEach(btn => {
    btn.addEventListener('click', () => {
      const ord = orders.find(x => x.order_id === btn.dataset.oid);
      if (!ord) return;
      for (const it of ord.items || []) {
        const prod = products.find(p => p.id === it.product_id);
        if (!prod) continue;
        const cur = cart.get(prod.id) || { product: prod, qty: 0 };
        cur.qty += Number(it.actual_qty ?? it.qty ?? 1);
        cart.set(prod.id, cur);
      }
      pwaTab = 'SHOP';
      cartOpen = true;
      render();
    });
  });
  root.querySelector('#btn-toggle-large')?.addEventListener('click', () => {
    largeText = !largeText;
    render();
  });
  root.querySelector('#btn-toggle-persona')?.addEventListener('click', () => {
    persona = persona === 'B2C_CONSUMER' ? 'B2B_FACILITY' : 'B2C_CONSUMER';
    render();
  });
  root.querySelector('#pwa-search-input')?.addEventListener('input', async (e) => {
    searchQuery = e.target.value;
    const pos = e.target.selectionStart;
    await render();
    const el = document.getElementById('pwa-search-input');
    if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  });
  root.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCat = btn.dataset.cat;
      selectedSubCat = 'ALL';
      render();
    });
  });
  root.querySelectorAll('.sub-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSubCat = btn.dataset.sub;
      render();
    });
  });
  root.querySelectorAll('.btn-add[data-pid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cat = await martPwaApi.getCatalog();
      const prod = (cat.products || []).find(x => x.id === btn.dataset.pid);
      if (!prod) return;
      const cur = cart.get(prod.id) || { product: prod, qty: 0 };
      const limit = Number(prod.promo_limit_per_person || prod.limit_per_person || 0);
      if (limit > 0 && cur.qty + 1 > limit) {
        showPwaToast(`1인 ${limit}개 한정 상품입니다.`, 'warn');
        return;
      }
      cur.qty += 1;
      cart.set(prod.id, cur);
      render();
    });
  });
  root.querySelectorAll('.btn-join-gb').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martPwaApi.joinGroupBuy({ campaign_id: btn.dataset.cid, qty: 1 });
      render();
    });
  });
  root.querySelector('#btn-open-cart')?.addEventListener('click', () => { cartOpen = true; render(); });
  root.querySelector('#btn-close-cart')?.addEventListener('click', () => { cartOpen = false; render(); });
  root.querySelector('#sel-delivery-mode')?.addEventListener('change', e => { deliveryMode = e.target.value; });
  root.querySelector('#sel-stockout-policy')?.addEventListener('change', e => { stockoutPolicy = e.target.value; });
  root.querySelector('#sel-pay-method')?.addEventListener('change', e => { paymentMethod = e.target.value; render(); });
  root.querySelector('#sel-card-brand')?.addEventListener('change', e => { selectedCard = e.target.value; render(); });
  root.querySelectorAll('.btn-cart-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = cart.get(btn.dataset.pid);
      if (!cur) return;
      if (cur.qty <= 1) cart.delete(btn.dataset.pid);
      else cur.qty -= 1;
      render();
    });
  });
  root.querySelectorAll('.btn-cart-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = cart.get(btn.dataset.pid);
      if (!cur) return;
      const limit = Number(cur.product.promo_limit_per_person || cur.product.limit_per_person || 0);
      if (limit > 0 && cur.qty + 1 > limit) {
        showPwaToast(`1인 ${limit}개 한정 상품입니다.`, 'warn');
        return;
      }
      cur.qty += 1;
      render();
    });
  });
  root.querySelector('#btn-submit-pwa-order')?.addEventListener('click', async () => {
    const totals = getCartTotals();
    const items = (totals.lines || []).map(line => ({
      product_id: line.product.id,
      barcode: line.product.barcode || '',
      tax_type: line.product.tax_type || 'TAXABLE',
      name: line.product.name,
      qty: line.qty,
      uom: line.product.uom,
      unit_price: line.qty > 0 ? Math.round(line.lineTotal / line.qty) : line.unitPrice,
      promo_discount: line.lineDiscount,
      storage_temp: line.product.storage_temp || 'AMBIENT'
    }));
    await martPwaApi.createOrder({
      order_channel: 'ONLINE',
      customer_type: persona === 'B2B_FACILITY' ? 'SENIOR_CENTER' : 'INDIVIDUAL',
      facility_id: persona === 'B2B_FACILITY' ? 'FAC-11-650-01-87391-0001' : 'B2C-PWA-USER',
      buyer_name: persona === 'B2B_FACILITY' ? '서초 양재1동 경로당' : '일반 고객',
      delivery_mode: deliveryMode,
      stockout_policy: stockoutPolicy,
      payment_method: paymentMethod,
      card_brand: paymentMethod === 'CARD' ? selectedCard : '',
      promo_discount_total: totals.totalDiscount,
      items
    });
    cart.clear();
    cartOpen = false;
    pwaTab = 'ORDERS';
    showPwaToast('주문이 정상 접수되었습니다. 내 주문내역에서 진행 상태를 확인하세요.', 'success');
    render();
  });
}

function showPwaToast(message, tone = 'info') {
  const prev = document.getElementById('mart-pwa-toast');
  if (prev) prev.remove();
  const colors = {
    success: { bg: '#065f46', border: '#10b981' },
    warn:    { bg: '#92400e', border: '#fbbf24' },
    info:    { bg: '#0f172a', border: '#38bdf8' }
  };
  const c = colors[tone] || colors.info;
  const el = document.createElement('div');
  el.id = 'mart-pwa-toast';
  el.style.cssText = `position:fixed;top:16px;right:16px;z-index:2000;background:${c.bg};color:#fff;padding:11px 16px;border-radius:10px;border-left:4px solid ${c.border};box-shadow:0 10px 25px rgba(15,23,42,0.25);font-size:13px;font-weight:600;max-width:340px;line-height:1.45;`;
  el.textContent = String(message || '');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function connectMartPwaRealtime() {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
  let pingTimer = null;
  let opened = false;
  try {
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${location.host}/ws/realtime`);
    ws.addEventListener('open', () => {
      opened = true;
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'aitip/marts/+/pwa-config' }));
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'aitip/marts/+/catalog' }));
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'aitip/marts/+/orders' }));
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 30000);
    });
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.topic && document.activeElement?.id !== 'pwa-search-input') {
          render();
        }
      } catch (_) {}
    });
    ws.addEventListener('close', () => {
      if (pingTimer) clearInterval(pingTimer);
      if (opened) setTimeout(connectMartPwaRealtime, 5000);
    });
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  initPortalAuthGate({
    title: '하나로마트 몰 (PWA) 로그인',
    badgeText: 'NH',
    badgeColor: '#007749',
    allowedRoles: ['MART_ADMIN', 'MART_PICKER', 'SUPER_ADMIN'],
    headerSelector: null,
    placeholderEmail: '이메일 입력',
    onAuthenticated: () => {
      render();
      connectMartPwaRealtime();
    }
  });
});
