/**
 * AITIP Mart B2B 기관 전용 발주 포털 (ESM)
 * 일반 마트 몰(mart-pwa)과 동일한 반응형 카드·카테고리·3단 탭 UX 위에
 * 기관(경로당·요양시설·복지관·아동센터) 회원 로그인, B2B 공급가·최소수량, 후불 여신 결제를 제공한다.
 */

import { martB2bApi } from './b2b-api.js';
import { getL1List, getL2List, inferCategoryFromProduct } from '/core/shared/mart-categories.js';
import { showToast } from '/core/shared/html.js';

const SESSION_KEY = 'aitip_mart_b2b_facility';
const FACILITY_TYPE_KO = {
  SENIOR_CENTER: '경로당',
  NURSING_HOME: '요양시설',
  WELFARE_CENTER: '종합복지관',
  CHILD_CARE: '지역아동센터',
  INSTITUTION_B2B: '급식·복지시설'
};

let activeFacility = null;
try {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) activeFacility = JSON.parse(saved);
} catch (_) {}

let authMode = 'LOGIN'; // 'LOGIN' | 'REGISTER'
let activeTab = 'SHOP'; // 'SHOP' | 'FLYER' | 'GROUP_BUY' | 'ORDERS'
let selectedCat = 'ALL'; // 'ALL' | '01'..'06' | 'PREP_PROCESSED'
let selectedSubCat = 'ALL';
let searchQuery = '';
let detailProductId = '';
let detailOrderId = '';
let authBanner = null; // { text, tone }
let cartOpen = false;
let paymentMethod = 'FACILITY_POSTPAY';
const cart = new Map(); // product_id -> { product, qty }

function esc(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortOrderNo(orderId = '') {
  const parts = String(orderId || '').split('-');
  if (parts.length >= 2 && /^\d{6}$/.test(parts[parts.length - 2])) {
    return `${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
  }
  return orderId || '-';
}

function getB2bUnitPrice(p = {}) {
  if (Number(p.b2b_price || 0) > 0) return Number(p.b2b_price);
  return Number(p.sale_price || p.regular_price || 0);
}

function getB2bMinQty(p = {}) {
  return Math.max(1, Number(p.b2b_min_qty || 1));
}

function renderAuthScreen(root) {
  root.innerHTML = `
    <header class="pwa-header">
      <div class="pwa-header-top">
        <div class="b2b-header-title">하나로마트 B2B 기관 전용 발주</div>
        <a href="/mart/pwa/" class="pill-btn" style="text-decoration:none;">일반 소비자 몰</a>
      </div>
    </header>
    <div class="b2b-auth-stage">
      <div class="b2b-auth-card">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:16px;">
          <button type="button" class="sub-chip ${authMode === 'LOGIN' ? 'active' : ''}" id="btn-auth-login-tab" style="padding:9px;text-align:center;">기관 로그인</button>
          <button type="button" class="sub-chip ${authMode === 'REGISTER' ? 'active' : ''}" id="btn-auth-reg-tab" style="padding:9px;text-align:center;">기관 회원가입 신청</button>
        </div>

        ${authBanner ? `
          <div style="margin-bottom:12px;padding:9px 12px;border-radius:8px;font-size:12.5px;font-weight:600;background:${authBanner.tone === 'error' ? '#fef2f2' : '#f0fdf4'};color:${authBanner.tone === 'error' ? '#b91c1c' : '#166534'};border:1px solid ${authBanner.tone === 'error' ? '#fecaca' : '#bbf7d0'};">
            ${esc(authBanner.text)}
          </div>
        ` : ''}

        ${authMode === 'LOGIN' ? `
          <form id="form-b2b-login" style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <label class="b2b-label">기관 코드 (FAC UID) 또는 등록 연락처</label>
              <input id="b2b-login-id" class="b2b-input" type="text" placeholder="예: FAC-11-650-01-87391-0001 또는 02-571-8801" required />
            </div>
            <button type="submit" class="btn-add" style="padding:11px;font-size:13.5px;">기관 발주 포털 접속</button>
            <div style="border-top:1px dashed #cbd5e1; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; color:#64748b;">시연용 승인 기관: 서초 양재1동 경로당</span>
              <button type="button" class="sub-chip active" id="btn-demo-b2b-login">원클릭 체험</button>
            </div>
          </form>
        ` : `
          <form id="form-b2b-register" style="display:flex; flex-direction:column; gap:10px;">
            <div>
              <label class="b2b-label">기관명 *</label>
              <input id="reg-name" class="b2b-input" type="text" required placeholder="예: 서초 요양원 / 서초3동 경로당" />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div>
                <label class="b2b-label">기관 유형</label>
                <select id="reg-type" class="b2b-input">
                  <option value="SENIOR_CENTER">경로당</option>
                  <option value="NURSING_HOME">요양시설</option>
                  <option value="WELFARE_CENTER">종합복지관</option>
                  <option value="CHILD_CARE">지역아동센터</option>
                  <option value="INSTITUTION_B2B">기타 급식시설</option>
                </select>
              </div>
              <div>
                <label class="b2b-label">고유번호 / 사업자번호</label>
                <input id="reg-biz" class="b2b-input" type="text" placeholder="214-80-00000" />
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div>
                <label class="b2b-label">담당자명</label>
                <input id="reg-contact" class="b2b-input" type="text" placeholder="홍길동 원장/회장" />
              </div>
              <div>
                <label class="b2b-label">연락처 *</label>
                <input id="reg-phone" class="b2b-input" type="text" required placeholder="02-555-1234" />
              </div>
            </div>
            <div>
              <label class="b2b-label">배송 주소 *</label>
              <input id="reg-addr" class="b2b-input" type="text" required placeholder="서울특별시 서초구 ..." />
            </div>
            <button type="submit" class="btn-add" style="padding:11px;font-size:13.5px;margin-top:4px;">기관 회원 가입 신청</button>
            <div style="font-size:11.5px; color:#64748b;">마트 관리자 승인 시 기관 코드(FAC-...)와 월말 후불 여신 한도가 발급됩니다.</div>
          </form>
        `}
      </div>
    </div>
  `;

  root.querySelector('#btn-auth-login-tab')?.addEventListener('click', () => { authMode = 'LOGIN'; authBanner = null; renderAuthScreen(root); });
  root.querySelector('#btn-auth-reg-tab')?.addEventListener('click', () => { authMode = 'REGISTER'; authBanner = null; renderAuthScreen(root); });

  const doLogin = async (val) => {
    try {
      const isCode = /^FAC-/i.test(val);
      const res = await martB2bApi.login(isCode ? { facility_id: val } : { phone: val });
      authBanner = null;
      activeFacility = res.facility;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(activeFacility));
      await render();
    } catch (err) {
      authBanner = { text: err.message, tone: 'error' };
      renderAuthScreen(root);
    }
  };

  root.querySelector('#form-b2b-login')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = root.querySelector('#b2b-login-id')?.value?.trim() || '';
    if (val) doLogin(val);
  });
  root.querySelector('#btn-demo-b2b-login')?.addEventListener('click', () => doLogin('FAC-11-650-01-87391-0001'));

  root.querySelector('#form-b2b-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await martB2bApi.registerFacility({
        facility_name: root.querySelector('#reg-name')?.value?.trim(),
        facility_type: root.querySelector('#reg-type')?.value,
        biz_reg_no: root.querySelector('#reg-biz')?.value?.trim(),
        contact_name: root.querySelector('#reg-contact')?.value?.trim(),
        phone: root.querySelector('#reg-phone')?.value?.trim(),
        address: root.querySelector('#reg-addr')?.value?.trim()
      });
      authBanner = { text: '기관 회원 가입 신청이 접수되었습니다. 마트 관리자 승인 후 로그인하실 수 있습니다.', tone: 'success' };
      authMode = 'LOGIN';
      renderAuthScreen(root);
    } catch (err) {
      authBanner = { text: err.message, tone: 'error' };
      renderAuthScreen(root);
    }
  });
}

function renderB2bProductGrid(title, list) {
  return `
    <div class="section-block">
      <div class="section-title">
        <span>${esc(title)}</span>
        <span style="font-size:11.5px; color:#64748b;">${list.length}개</span>
      </div>
      <div class="prod-grid">
        ${list.length === 0 ? `<div style="grid-column:1/-1;text-align:center;color:#64748b;padding:24px;">조건에 맞는 B2B 품목이 없습니다.</div>` : list.map(p => {
          const b2bPrice = getB2bUnitPrice(p);
          const regPrice = Number(p.sale_price || p.regular_price || 0);
          const minQ = getB2bMinQty(p);
          const inCart = cart.get(p.id)?.qty || 0;
          const isSoldOut = Number(p.stock_qty ?? 50) <= 0;
          return `
            <div class="prod-card" style="${isSoldOut ? 'opacity:0.65;' : ''}">
              <div class="b2b-clickable" data-pid="${esc(p.id)}" style="cursor:pointer;">
                ${p.image_url
                  ? `<img class="prod-thumb" src="${esc(p.image_url)}" alt="${esc(p.name)}" />`
                  : `<div class="prod-thumb-empty">${p.category_type === 'PREP_PROCESSED' ? '전처리 식자재' : 'B2B 상품'}</div>`
                }
                <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">
                  <span class="badge ${p.category_type === 'PREP_PROCESSED' ? 'badge-promo' : 'badge-b2b'}">
                    ${p.category_type === 'PREP_PROCESSED' ? '전처리' : p.sales_target === 'B2B_ONLY' ? '기관전용' : 'B2B공급'}
                  </span>
                  ${isSoldOut ? `<span class="badge" style="background:#fee2e2;color:#991b1b;">일시품절</span>` : ''}
                  ${minQ > 1 ? `<span class="badge badge-cosell">최소 ${minQ}${esc(p.uom || '개')}</span>` : ''}
                </div>
                <div class="prod-title" style="margin-top:4px;">${esc(p.name)}</div>
                <div class="prod-spec">${esc(p.spec || '-')} · ${esc(p.uom || '개')}</div>
                <div style="margin-top:4px;">
                  ${regPrice > b2bPrice ? `<span style="font-size:11px;color:#94a3b8;text-decoration:line-through;margin-right:4px;">${regPrice.toLocaleString()}원</span>` : ''}
                  <span class="prod-price">${b2bPrice.toLocaleString()}원</span>
                </div>
              </div>
              <button type="button" class="btn-add btn-b2b-add" data-pid="${esc(p.id)}" ${isSoldOut ? 'disabled style="background:#cbd5e1;color:#64748b;cursor:not-allowed;"' : ''}>
                ${isSoldOut ? '일시품절' : inCart > 0 ? `담김 (${inCart})` : (minQ > 1 ? `${minQ}${esc(p.uom || '개')} 담기` : '담기')}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function render() {
  const root = document.getElementById('mart-b2b-root');
  if (!root) return;
  if (!activeFacility) {
    renderAuthScreen(root);
    return;
  }

  const [cfgRes, catRes, gbRes, ordRes] = await Promise.all([
    martB2bApi.getPwaConfig().catch(() => ({ config: {} })),
    martB2bApi.getCatalog(),
    martB2bApi.getGroupBuys(),
    martB2bApi.getOrders()
  ]);

  const cfg = cfgRes.config || {};
  const mart = catRes.mart || {};
  const allProducts = catRes.products || [];
  const promotions = catRes.promotions || [];
  const q = searchQuery.trim().toLowerCase();

  const visibleProducts = allProducts.filter(p => {
    if (p.online_publish_status === 'SUSPENDED') return false;
    if (p.sales_target === 'B2C_ONLY') return false;
    if (selectedCat === 'PREP_PROCESSED') {
      if (p.category_type !== 'PREP_PROCESSED') return false;
    } else if (selectedCat !== 'ALL') {
      const cat = inferCategoryFromProduct(p);
      if (cat.l1 !== selectedCat) return false;
      if (selectedSubCat !== 'ALL' && cat.l2 !== selectedSubCat) return false;
    }
    if (q && !`${p.name} ${p.spec} ${p.barcode}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const b2bGroupBuys = (gbRes.group_buys || []).filter(g =>
    (g.approval_status || 'APPROVED') === 'APPROVED' && g.campaign_type === 'B2B_INSTITUTIONAL'
  );
  const myOrders = (ordRes.orders || []).filter(o => o.facility_id === activeFacility.facility_id);
  const detailProd = detailProductId ? allProducts.find(p => p.id === detailProductId) : null;

  let cartQty = 0;
  let cartSum = 0;
  for (const { product, qty } of cart.values()) {
    cartQty += qty;
    cartSum += getB2bUnitPrice(product) * qty;
  }

  const l1List = getL1List();
  const cats = [
    ['ALL', '전체상품'],
    ...l1List.map(c => [c.code, c.name === '냉장·냉동·유제품' ? '냉장·냉동' : c.name]),
    ['PREP_PROCESSED', '전처리']
  ];
  const l2List = /^[0-9]{2}$/.test(selectedCat) ? getL2List(selectedCat) : [];
  const banners = cfg.flyer_banners || [];
  const facTypeLabel = FACILITY_TYPE_KO[activeFacility.facility_type] || '기관';

  root.innerHTML = `
    <header class="pwa-header">
      <div class="pwa-header-top">
        <div class="b2b-header-title">[${esc(facTypeLabel)}] ${esc(activeFacility.facility_name)}</div>
        <div style="display:flex; gap:5px; align-items:center; flex-shrink:0;">
          <button type="button" class="pill-btn ${activeTab === 'ORDERS' ? 'active' : ''}" data-b2b-tab="ORDERS">내 발주 (${myOrders.length})</button>
          <button type="button" class="pill-btn" id="btn-b2b-logout">로그아웃</button>
        </div>
      </div>
      <div class="search-bar">
        <input id="b2b-search" type="text" value="${esc(searchQuery)}" placeholder="전처리 · 식자재 · 바코드 검색..." />
      </div>
    </header>

    <div class="facility-bar">
      <span><strong>기관코드:</strong> ${esc(activeFacility.facility_id)}</span>
      <span><strong>월말 후불 여신 잔액:</strong> ${Number(activeFacility.credit_balance || 0).toLocaleString()}원</span>
    </div>

    <div class="pwa-nav-tabs">
      <button type="button" class="pwa-nav-tab ${activeTab === 'SHOP' ? 'active' : ''}" data-b2b-tab="SHOP">식자재 장보기</button>
      <button type="button" class="pwa-nav-tab ${activeTab === 'FLYER' ? 'active' : ''}" data-b2b-tab="FLYER">전단 · 특가</button>
      <button type="button" class="pwa-nav-tab ${activeTab === 'GROUP_BUY' ? 'active' : ''}" data-b2b-tab="GROUP_BUY">기관 공동구매 (${b2bGroupBuys.length})</button>
    </div>

    <main>
      ${activeTab === 'SHOP' ? `
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
        ${renderB2bProductGrid(q ? '검색 결과' : 'B2B 기관 공급 식자재', visibleProducts)}
      ` : ''}

      ${activeTab === 'FLYER' ? `
        <div class="section-block">
          <div class="section-title"><span>금주 전단 · 기관 특가</span></div>
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
              <div style="min-width:210px; border:1px solid #fde68a; background:#fffbeb; border-radius:8px; padding:10px;">
                <span class="badge badge-promo">${esc(pr.promo_type)}</span>
                <div style="font-weight:800; font-size:13px; margin-top:4px;">${esc(pr.name)}</div>
                <div style="font-size:11px; color:#92400e; margin-top:3px;">${esc(pr.start_date)} ~ ${esc(pr.end_date)}</div>
              </div>
            `).join('')}
          </div>
        </div>
        ${renderB2bProductGrid('기관 특가 적용 품목', visibleProducts.filter(p => Number(p.b2b_price || 0) > 0 || p.applied_promo_id))}
      ` : ''}

      ${activeTab === 'GROUP_BUY' ? `
        <div class="section-block">
          <div class="section-title"><span>기관 전용 공동구매</span><span style="font-size:11.5px;color:#64748b;">진행 중 ${b2bGroupBuys.length}건</span></div>
          ${b2bGroupBuys.length === 0 ? `<div style="text-align:center;padding:32px;color:#64748b;">진행 중인 기관 공동구매가 없습니다.</div>` : b2bGroupBuys.map(g => {
            const pct = Math.min(100, Math.round((g.current_qty / g.target_qty) * 100));
            return `
              <div class="order-track-card">
                <span class="badge badge-cosell">기관 B2B 공구</span>
                <div style="font-weight:800; font-size:13.5px; margin-top:4px;">${esc(g.title)}</div>
                <div style="font-size:12.5px; margin-top:4px;">
                  <b style="color:#065f46;">${Number(g.unit_price).toLocaleString()}원</b>
                  <span style="text-decoration:line-through; color:#94a3b8; margin-left:6px;">${Number(g.regular_price).toLocaleString()}원</span>
                </div>
                <div style="background:#e2e8f0; height:6px; border-radius:999px; margin:6px 0;">
                  <div style="background:#065f46; height:100%; width:${pct}%; border-radius:999px;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px;">
                  <span>달성률 ${pct}% (${g.current_qty}/${g.target_qty})</span>
                  <button type="button" class="pill-btn btn-b2b-join-gb" data-cid="${esc(g.campaign_id)}" style="background:#065f46;color:#fff;border:none;">공구 1단위 참여</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      ${activeTab === 'ORDERS' ? `
        <div class="section-block">
          <div class="section-title"><span>기관 발주 내역 · 재주문</span><span style="font-size:11.5px;color:#64748b;">총 ${myOrders.length}건</span></div>
          ${myOrders.length === 0 ? `<div style="text-align:center;padding:32px;color:#64748b;">발주 내역이 없습니다.</div>` : myOrders.map(o => `
            <div class="order-track-card">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
                <code title="${esc(o.order_id)}">${esc(shortOrderNo(o.order_id))}</code>
                <span style="font-weight:800;color:#065f46;">${Number(o.total_amount || 0).toLocaleString()}원</span>
              </div>
              <div style="font-size:12.5px;color:#334155;margin:6px 0;">
                ${(o.items || []).map(it => `${esc(it.name)} × ${it.actual_qty ?? it.qty}`).join(', ')}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="badge badge-b2b">${esc(o.status)}</span>
                <div style="display:flex;gap:6px;">
                  <button type="button" class="sub-chip btn-b2b-order-detail" data-oid="${esc(o.order_id)}">상세보기</button>
                  <button type="button" class="sub-chip btn-b2b-reorder" data-oid="${esc(o.order_id)}">이 발주 품목 다시 담기</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <footer style="padding: 18px 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; line-height: 1.7;">
        <div style="font-weight: 800; color: #334155; margin-bottom: 4px;">${esc(mart.mart_name || '하나로마트')} (B2B 기관 전용)</div>
        <div>위탁운영: ${esc(mart.operator_name || '-')} ${mart.manager?.name ? `· 점장: ${esc(mart.manager.name)}` : ''}</div>
        <div>사업자등록번호: ${esc(mart.biz_number || '-')} · 영업시간: ${esc(mart.open_hours || '09:00 ~ 22:00')}</div>
        <div>주소: ${esc(mart.address || '-')}</div>
        <div>고객센터: <a href="tel:${esc(mart.phone || '')}" style="color: #065f46; font-weight: 700; text-decoration: none;">${esc(mart.phone || '-')}</a></div>
      </footer>
    </main>

    ${cartQty > 0 ? `
      <div class="cart-bar">
        <div>
          <div style="font-size:11.5px; color:#cbd5e1;">총 ${cartQty}개 담김</div>
          <div style="font-size:15px; font-weight:800;">${cartSum.toLocaleString()}원</div>
        </div>
        <button type="button" id="btn-b2b-open-cart" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-weight:800;cursor:pointer;">발주서 확인 · 제출</button>
      </div>
    ` : ''}

    ${detailProd ? `
      <div class="modal-bg" id="b2b-detail-bg">
        <div class="modal-sheet">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong>${esc(detailProd.name)}</strong>
            <button type="button" class="sub-chip" id="btn-b2b-close-detail">닫기</button>
          </div>
          ${detailProd.image_url ? `<img src="${esc(detailProd.image_url)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-bottom:10px;" />` : ''}
          <div style="font-size:12.5px;color:#475569;line-height:1.6;">
            <div><b>규격/단위:</b> ${esc(detailProd.spec || '-')} · ${esc(detailProd.uom || '개')}</div>
            <div><b>B2B 공급가:</b> <b style="color:#065f46;">${getB2bUnitPrice(detailProd).toLocaleString()}원</b> (최소 ${getB2bMinQty(detailProd)}${esc(detailProd.uom || '개')})</div>
            ${detailProd.prep_method ? `<div><b>전처리 공정:</b> ${esc(detailProd.prep_method)}</div>` : ''}
          </div>
          <button type="button" class="btn-add btn-b2b-add" data-pid="${esc(detailProd.id)}" style="margin-top:14px;padding:10px;">발주 장바구니 담기</button>
        </div>
      </div>
    ` : ''}

    ${(() => {
      const detailOrd = detailOrderId ? myOrders.find(x => x.order_id === detailOrderId) : null;
      if (!detailOrd) return '';
      const isEditable = detailOrd.status === 'REQUESTED';
      const steps = ['REQUESTED', 'PICKING', 'PACKED', 'DELIVERED'];
      const stepLabels = { REQUESTED: '신규접수', PICKING: '피킹중', PACKED: '포장완료', DELIVERED: '배송완료', CANCELLED: '발주취소' };
      const curIdx = steps.indexOf(detailOrd.status);
      return `
        <div class="modal-bg" id="b2b-order-detail-bg">
          <div class="modal-sheet">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <div>
                <strong style="font-size:15px;">기관 발주 상세</strong>
                <div style="font-size:11.5px;color:#64748b;">${esc(detailOrd.order_id)}</div>
              </div>
              <button type="button" class="sub-chip" id="btn-b2b-close-ord-detail">닫기</button>
            </div>
            ${detailOrd.status === 'CANCELLED' ? `
              <div style="padding:8px 10px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:12px;font-weight:700;margin-bottom:10px;">취소된 발주서입니다.</div>
            ` : `
              <div class="order-steps">
                ${steps.map((st, idx) => `<div class="order-step ${idx < curIdx ? 'done' : (idx === curIdx ? 'current' : '')}">${stepLabels[st]}</div>`).join('')}
              </div>
            `}
            <div style="font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px;line-height:1.6;">
              <div><b>배송 예정일:</b> ${esc(detailOrd.delivery_date || '-')} · <b>상태:</b> ${esc(stepLabels[detailOrd.status] || detailOrd.status)}</div>
              <div><b>결제 구분:</b> ${esc(detailOrd.payment_method || '-')} · <b>총 발주액:</b> <b style="color:#065f46;">${Number(detailOrd.total_amount || 0).toLocaleString()}원</b></div>
              ${detailOrd.memo ? `<div><b>요청사항:</b> ${esc(detailOrd.memo)}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
              ${(detailOrd.items || []).map(it => {
                const pid = it.product_id || it.id || it.name || '';
                const qty = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
                return `
                  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;font-size:12.5px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <strong>${esc(it.name)}</strong>
                      <strong>${(Number(it.unit_price || 0) * qty).toLocaleString()}원</strong>
                    </div>
                    <div style="font-size:11.5px;color:#64748b;margin-top:2px;">
                      단가 ${Number(it.unit_price || 0).toLocaleString()}원 × ${qty}${esc(it.uom || '개')}${it.adjust_reason ? ` (${esc(it.adjust_reason)})` : ''}
                    </div>
                    ${isEditable && pid ? `
                      <div style="display:flex;gap:6px;align-items:center;margin-top:6px;">
                        <input type="number" min="0" step="1" class="b2b-input b2b-ord-qty-input" data-pid="${esc(pid)}" value="${qty}" style="width:78px;padding:5px 8px;font-size:12px;" />
                        <button type="button" class="sub-chip btn-b2b-adj-item" data-oid="${esc(detailOrd.order_id)}" data-pid="${esc(pid)}">수량 변경</button>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
            ${!isEditable && detailOrd.status !== 'CANCELLED' ? `
              <div style="font-size:11.5px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;margin-bottom:10px;">
                피킹 시작 이후에는 발주서 수정·취소가 불가합니다. 변경이 필요하면 마트로 연락해 주세요.
              </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              ${isEditable ? `<button type="button" class="sub-chip" id="btn-b2b-cancel-order" data-oid="${esc(detailOrd.order_id)}" style="color:#b91c1c;border-color:#fecaca;">발주 취소</button>` : '<span></span>'}
              <div style="display:flex;gap:6px;">
                <button type="button" class="sub-chip btn-b2b-reorder" data-oid="${esc(detailOrd.order_id)}">다시 담기</button>
                <button type="button" class="btn-add" id="btn-b2b-ok-ord-detail" style="width:auto;padding:7px 14px;">확인</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })()}

    ${cartOpen ? `
      <div class="modal-bg" id="b2b-cart-bg">
        <div class="modal-sheet">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <strong style="font-size:15px;">기관 B2B 발주서 제출</strong>
            <button type="button" class="sub-chip" id="btn-b2b-close-cart">닫기</button>
          </div>
          ${Array.from(cart.values()).map(({ product, qty }) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <div>
                <strong>${esc(product.name)}</strong>
                <div style="font-size:11.5px;color:#64748b;">${getB2bUnitPrice(product).toLocaleString()}원 × ${qty}${esc(product.uom || '개')}</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button type="button" class="cart-qty-btn btn-b2b-dec" data-pid="${esc(product.id)}">-</button>
                <b>${qty}</b>
                <button type="button" class="cart-qty-btn btn-b2b-inc" data-pid="${esc(product.id)}">+</button>
              </div>
            </div>
          `).join('')}
          <div style="margin-top:12px;">
            <label class="b2b-label">결제 구분</label>
            <select id="b2b-pay-method" class="b2b-input">
              <option value="FACILITY_POSTPAY" ${paymentMethod === 'FACILITY_POSTPAY' ? 'selected' : ''}>기관 월말 후불 여신</option>
              <option value="MUNICIPAL_VOUCHER" ${paymentMethod === 'MUNICIPAL_VOUCHER' ? 'selected' : ''}>지자체 보조금 바우처</option>
              <option value="CARD" ${paymentMethod === 'CARD' ? 'selected' : ''}>기관 · 법인 카드</option>
            </select>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
            <strong style="font-size:16px;color:#065f46;">총 발주액: ${cartSum.toLocaleString()}원</strong>
            <button type="button" class="btn-add" id="btn-b2b-submit" style="width:auto;padding:10px 18px;">발주 확정 전송</button>
          </div>
        </div>
      </div>
    ` : ''}
  `;

  root.querySelector('#btn-b2b-logout')?.addEventListener('click', () => {
    activeFacility = null;
    cart.clear();
    sessionStorage.removeItem(SESSION_KEY);
    render();
  });
  root.querySelectorAll('[data-b2b-tab]').forEach(btn => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.b2bTab || 'SHOP'; render(); });
  });
  root.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => { selectedCat = btn.dataset.cat; selectedSubCat = 'ALL'; render(); });
  });
  root.querySelectorAll('[data-sub]').forEach(btn => {
    btn.addEventListener('click', () => { selectedSubCat = btn.dataset.sub; render(); });
  });
  const searchEl = root.querySelector('#b2b-search');
  searchEl?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    const pos = e.target.selectionStart;
    render().then(() => {
      const next = document.getElementById('b2b-search');
      if (next) {
        next.focus();
        if (typeof pos === 'number') next.setSelectionRange(pos, pos);
      }
    });
  });
  root.querySelectorAll('.b2b-clickable').forEach(el => {
    el.addEventListener('click', () => { detailProductId = el.dataset.pid || ''; render(); });
  });
  root.querySelector('#btn-b2b-close-detail')?.addEventListener('click', () => { detailProductId = ''; render(); });
  root.querySelector('#b2b-detail-bg')?.addEventListener('click', (e) => { if (e.target.id === 'b2b-detail-bg') { detailProductId = ''; render(); } });
  root.querySelectorAll('.btn-b2b-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = allProducts.find(x => x.id === btn.dataset.pid);
      if (!p) return;
      const minQ = getB2bMinQty(p);
      const cur = cart.get(p.id);
      if (!cur) cart.set(p.id, { product: p, qty: minQ });
      else cur.qty += 1;
      detailProductId = '';
      render();
    });
  });
  root.querySelectorAll('.btn-b2b-join-gb').forEach(btn => {
    btn.addEventListener('click', async () => {
      const res = await martB2bApi.joinGroupBuy({ campaign_id: btn.dataset.cid, qty: 1 });
      showToast(`기관 공구 참여 완료 (${res.campaign.current_qty}/${res.campaign.target_qty})`, 'success');
      render();
    });
  });
  root.querySelectorAll('.btn-b2b-order-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      detailOrderId = btn.dataset.oid || '';
      render();
    });
  });
  const closeOrdDetail = () => { detailOrderId = ''; render(); };
  root.querySelector('#btn-b2b-close-ord-detail')?.addEventListener('click', closeOrdDetail);
  root.querySelector('#btn-b2b-ok-ord-detail')?.addEventListener('click', closeOrdDetail);
  root.querySelector('#b2b-order-detail-bg')?.addEventListener('click', (e) => {
    if (e.target.id === 'b2b-order-detail-bg') closeOrdDetail();
  });
  root.querySelectorAll('.btn-b2b-adj-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oid = btn.dataset.oid;
      const pid = btn.dataset.pid;
      const qtyEl = root.querySelector(`.b2b-ord-qty-input[data-pid="${pid}"]`);
      const nextQty = Math.max(0, Number(qtyEl?.value ?? 0));
      await martB2bApi.adjustOrderItem({
        order_id: oid,
        product_id: pid,
        actual_qty: nextQty,
        reason: '기관 발주서 수량 수정'
      });
      await render();
    });
  });
  root.querySelector('#btn-b2b-cancel-order')?.addEventListener('click', async (e) => {
    const oid = e.currentTarget.dataset.oid;
    if (!oid) return;
    await martB2bApi.updateOrderStatus(oid, 'CANCELLED');
    detailOrderId = '';
    await render();
  });
  root.querySelectorAll('.btn-b2b-reorder').forEach(btn => {
    btn.addEventListener('click', () => {
      const ord = myOrders.find(x => x.order_id === btn.dataset.oid);
      if (!ord) return;
      for (const it of ord.items || []) {
        const p = allProducts.find(x => x.id === it.product_id);
        if (!p) continue;
        cart.set(p.id, { product: p, qty: Math.max(getB2bMinQty(p), Number(it.actual_qty ?? it.qty ?? 1)) });
      }
      activeTab = 'SHOP';
      cartOpen = true;
      render();
    });
  });
  root.querySelector('#btn-b2b-open-cart')?.addEventListener('click', () => { cartOpen = true; render(); });
  root.querySelector('#btn-b2b-close-cart')?.addEventListener('click', () => { cartOpen = false; render(); });
  root.querySelector('#b2b-cart-bg')?.addEventListener('click', (e) => { if (e.target.id === 'b2b-cart-bg') { cartOpen = false; render(); } });
  root.querySelector('#b2b-pay-method')?.addEventListener('change', (e) => { paymentMethod = e.target.value; });
  root.querySelectorAll('.btn-b2b-inc').forEach(btn => {
    btn.addEventListener('click', () => { const cur = cart.get(btn.dataset.pid); if (cur) { cur.qty += 1; render(); } });
  });
  root.querySelectorAll('.btn-b2b-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = cart.get(btn.dataset.pid);
      if (!cur) return;
      if (cur.qty - 1 < getB2bMinQty(cur.product)) cart.delete(btn.dataset.pid);
      else cur.qty -= 1;
      render();
    });
  });
  root.querySelector('#btn-b2b-submit')?.addEventListener('click', async () => {
    const items = Array.from(cart.values()).map(({ product, qty }) => ({
      product_id: product.id,
      barcode: product.barcode || '',
      tax_type: product.tax_type || 'TAXABLE',
      name: product.name,
      qty,
      uom: product.uom || '개',
      unit_price: getB2bUnitPrice(product),
      storage_temp: product.storage_temp || 'AMBIENT'
    }));
    await martB2bApi.createOrder({
      order_channel: 'ONLINE',
      offline_source: 'FACILITY_REGULAR',
      customer_type: activeFacility.facility_type || 'SENIOR_CENTER',
      facility_id: activeFacility.facility_id,
      buyer_name: activeFacility.facility_name,
      payment_method: paymentMethod,
      items
    });
    cart.clear();
    cartOpen = false;
    activeTab = 'ORDERS';
    showToast('기관 B2B 발주가 정상 접수되었습니다.', 'success');
    render();
  });
}

document.addEventListener('DOMContentLoaded', render);
