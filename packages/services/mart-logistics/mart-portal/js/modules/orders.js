/**
 * AITIP Mart Portal - 4. 주문 관리 (온라인 주문내역 / 오프라인 주문 입력·출력) 모듈 (ESM)
 * 하이브리드 UI: 배민 B마트 상태 KPI 스트립 + Medusa 주문상세/타임라인 드로어 + 결품·수량 가감 정정
 */

import { martApi } from '../api.js';
import { openMartPrintModal } from './mart-receipt.js';
import { downloadExcelCsv, readCsvOrTextFile, parseDelimitedRows } from '../utils/excel-csv.js';
import { formatShortOrderNo } from '../utils/order-format.js';
import { paginateArray, renderMartPaginationHtml, bindMartPaginationEvents } from '../utils/pagination.js';
import { esc, bindStopPropagation } from '../utils/html.js';

const BUYER_LABEL = {
  INDIVIDUAL: '일반 소비자',
  SENIOR_CENTER: '경로당',
  ELDERLY_CARE: '독거노인(돌봄)',
  INSTITUTION_B2B: '복지·공공기관(B2B)'
};

const SOURCE_LABEL = {
  PWA: '온라인 PWA',
  PHONE: '전화 주문',
  KAKAO_FAX: '카톡 · 팩스',
  WALK_IN: '매장 방문 수기',
  FACILITY_REGULAR: '기관 정기발주'
};

const STATUS_META = {
  REQUESTED: { label: '신규 접수', pill: 'mc-pill-amber', next: 'PICKING', nextLabel: '피킹 시작' },
  PICKING:   { label: '피킹 중',   pill: 'mc-pill-blue',  next: 'PACKED',  nextLabel: '포장 완료' },
  PACKED:    { label: '포장 완료', pill: 'mc-pill-green', next: 'DELIVERED', nextLabel: '배송 완료' },
  DELIVERED: { label: '배송 완료', pill: 'mc-pill-gray',  next: '',        nextLabel: '' }
};

let searchQuery = '';
let dateFilter = '';
let statusFilter = 'ALL'; // 'ALL' | 'REQUESTED' | 'PICKING' | 'PACKED' | 'DELIVERED'
let currentPage = 1;
let pageSize = 10;
let drawerMode = 'NONE'; // 'NONE' | 'DETAIL' | 'CREATE_OFFLINE'
let selectedOrderId = '';
let draftItems = [];

export async function renderMartOrdersView(container, channel = 'ONLINE', opts = {}) {
  if (!container) return;
  const [ordRes, catRes, profRes] = await Promise.all([
    martApi.getOrders(),
    martApi.getCatalog(),
    martApi.getProfile()
  ]);

  const allOrders = ordRes.orders || [];
  const products = catRes.products || [];
  const mart = profRes.mart || {};
  const isOffline = channel === 'OFFLINE';

  const channelOrders = allOrders.filter(o => (o.order_channel || 'OFFLINE') === channel);
  const counts = {
    ALL: channelOrders.length,
    REQUESTED: channelOrders.filter(o => o.status === 'REQUESTED').length,
    PICKING: channelOrders.filter(o => o.status === 'PICKING').length,
    PACKED: channelOrders.filter(o => o.status === 'PACKED').length,
    DELIVERED: channelOrders.filter(o => o.status === 'DELIVERED').length
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = channelOrders.filter(o => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (dateFilter && String(o.delivery_date || '') !== dateFilter) return false;
    if (q) {
      const hay = `${o.order_id} ${formatShortOrderNo(o.order_id)} ${o.buyer_name} ${(o.items || []).map(i => i.name).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const pageInfo = paginateArray(filtered, currentPage, pageSize);
  currentPage = pageInfo.page;

  const selectedOrder = selectedOrderId ? channelOrders.find(o => o.order_id === selectedOrderId) : null;
  const draftTotal = draftItems.reduce((s, it) => s + Number(it.unit_price || 0) * Number(it.qty || 1), 0);

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- 상단 페이지 헤더 -->
      <div class="mc-page-header">
        <div class="mc-title-wrap">
          <h1>${isOffline ? '오프라인 주문 (수기 · 전표출력)' : '온라인 주문내역 (PWA)'}</h1>
          <span class="mc-count-pill">총 ${channelOrders.length}건</span>
        </div>
        <div class="mc-header-actions">
          ${isOffline ? `
            <button type="button" class="mc-btn-secondary" id="btn-open-bulk-po">발주서 일괄 등록</button>
            <button type="button" class="mc-btn-primary" id="btn-open-offline-drawer">+ 오프라인 주문 입력</button>
          ` : ''}
        </div>
      </div>

      <!-- 배민 B마트 스타일 클릭형 KPI 상태 스트립 -->
      <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px;">
        ${[
          { key: 'ALL', label: '전체 주문', val: counts.ALL, tone: '#0f172a' },
          { key: 'REQUESTED', label: '신규 접수', val: counts.REQUESTED, tone: '#b45309' },
          { key: 'PICKING', label: '피킹 중', val: counts.PICKING, tone: '#0369a1' },
          { key: 'PACKED', label: '포장 완료', val: counts.PACKED, tone: '#007749' },
          { key: 'DELIVERED', label: '배송 완료', val: counts.DELIVERED, tone: '#64748b' }
        ].map(k => `
          <button type="button" class="btn-ord-kpi" data-status="${k.key}" style="text-align: left; padding: 12px 14px; border-radius: 10px; cursor: pointer; background: ${statusFilter === k.key ? '#f0fdf4' : '#ffffff'}; border: 1.5px solid ${statusFilter === k.key ? '#007749' : '#e5e7eb'}; transition: all 0.15s;">
            <div style="font-size: 12px; font-weight: 700; color: #64748b;">${k.label}</div>
            <div style="font-size: 20px; font-weight: 800; color: ${k.tone}; margin-top: 2px; font-variant-numeric: tabular-nums;">${k.val}건</div>
          </button>
        `).join('')}
      </div>

      <!-- 주문 목록 카드 -->
      <div class="mc-surface">
        <div class="mc-filter-bar">
          <div class="mc-filter-controls">
            <input id="ord-search-q" class="mc-search" type="text" value="${esc(searchQuery)}" placeholder="주문번호 · 수요처 · 품목 검색" />
            <input id="ord-date-filter" class="erp-input" type="date" value="${esc(dateFilter)}" style="width: 150px;" title="배송 예정일 필터" />
            ${(searchQuery || dateFilter || statusFilter !== 'ALL') ? `<button type="button" id="btn-ord-reset-filter" class="mc-btn-secondary">초기화</button>` : ''}
          </div>
          <div style="font-size: 12px; color: #64748b;">
            조회 ${filtered.length}건 · [상세보기] 또는 행 클릭 시 결품·수량 정정 및 상세 처리
          </div>
        </div>

        <div class="mc-table-wrap">
          <table class="mc-table">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>수주 경로 · 수요처</th>
                <th>품목 요약</th>
                <th>배송 예정일</th>
                <th style="text-align: right;">결제 금액</th>
                <th style="text-align: center;">상태</th>
                <th style="text-align: right;">처리 · 출력</th>
              </tr>
            </thead>
            <tbody>
              ${pageInfo.paged.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 48px 16px; color: #64748b;">조건에 맞는 주문 내역이 없습니다.</td></tr>
              ` : pageInfo.paged.map(o => {
                const sm = STATUS_META[o.status] || { label: o.status, pill: 'mc-pill-gray', next: '', nextLabel: '' };
                const sourceText = SOURCE_LABEL[o.offline_source] || o.offline_source || o.order_channel;
                const cleanBuyer = String(o.buyer_name || '').replace(/\s*\((?:PWA 주문|PWA 발주)\)\s*/g, '').trim();
                const buyerType = BUYER_LABEL[o.customer_type] || o.customer_type || '';
                const showBuyerType = buyerType && !cleanBuyer.includes(buyerType) && cleanBuyer !== '일반 고객';
                return `
                  <tr class="mc-ord-row" data-id="${esc(o.order_id)}" style="cursor: pointer;">
                    <td><span class="mc-prod-code" style="color: #334155;" title="${esc(o.order_id)}">${esc(formatShortOrderNo(o.order_id))}</span></td>
                    <td>
                      <div><span class="mc-pill mc-pill-gray">${esc(sourceText)}</span></div>
                      <div style="font-weight: 700; color: #0f172a; margin-top: 4px;">${esc(cleanBuyer || '-')}</div>
                      ${showBuyerType ? `<div style="font-size: 11.5px; color: #64748b;">${esc(buyerType)}</div>` : ''}
                    </td>
                    <td style="max-width: 260px;">
                      <div style="color: #0f172a;">${(o.items || []).map(it => {
                        const effQty = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
                        return `${esc(it.name)} × ${effQty}${esc(it.uom || '개')}`;
                      }).join(', ')}</div>
                    </td>
                    <td style="white-space: nowrap;">${esc(o.delivery_date || '-')}</td>
                    <td class="mc-num"><strong>${Number(o.total_amount || 0).toLocaleString()}원</strong></td>
                    <td style="text-align: center;"><span class="mc-pill ${sm.pill}">${esc(sm.label)}</span></td>
                    <td class="mc-stop-prop" style="text-align: right; white-space: nowrap;">
                      <button type="button" class="mc-row-edit-btn btn-ord-detail" data-id="${esc(o.order_id)}">상세보기</button>
                      <button type="button" class="mc-row-edit-btn btn-print-order" data-id="${esc(o.order_id)}" style="margin-left: 4px;">전표출력</button>
                      ${sm.next ? `
                        <button type="button" class="mc-btn-primary btn-mart-order-next" data-id="${esc(o.order_id)}" data-next="${sm.next}" style="height: 30px; padding: 0 10px; font-size: 12px; margin-left: 4px;">${sm.nextLabel}</button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${renderMartPaginationHtml(pageInfo, 'ord')}
      </div>

      ${drawerMode === 'DETAIL' && selectedOrder ? `
        <div class="mc-drawer-backdrop" id="mc-ord-backdrop">
          <div class="mc-drawer" style="width: 560px;">
            <div class="mc-drawer-header">
              <div>
                <h2>주문 상세 · 결품/수량 정정</h2>
                <div class="mc-prod-code" style="margin-top: 2px;">${esc(selectedOrder.order_id)}</div>
              </div>
              <button type="button" class="mc-drawer-close" id="btn-close-ord-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <!-- 섹션 1: 수요처 & 요약 -->
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>수요처 · 배송 정보</span>
                  <span class="mc-pill ${(STATUS_META[selectedOrder.status] || {}).pill || 'mc-pill-gray'}">${(STATUS_META[selectedOrder.status] || {}).label || selectedOrder.status}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px;">
                  <div><span style="color: #64748b;">수요처:</span> <strong>${esc(selectedOrder.buyer_name)}</strong></div>
                  <div><span style="color: #64748b;">구분:</span> ${esc(BUYER_LABEL[selectedOrder.customer_type] || selectedOrder.customer_type)}</div>
                  <div><span style="color: #64748b;">경로:</span> ${esc(SOURCE_LABEL[selectedOrder.offline_source] || selectedOrder.offline_source || selectedOrder.order_channel)}</div>
                  <div><span style="color: #64748b;">배송예정:</span> ${esc(selectedOrder.delivery_date || '-')}</div>
                  <div style="grid-column: 1 / -1;"><span style="color: #64748b;">요청사항:</span> ${esc(selectedOrder.memo || '없음')}</div>
                </div>
              </div>

              <!-- 섹션 2: 품목별 결품(0개)/수량 가감 정정 -->
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>주문 품목 · 확정 수량 정정</span>
                  <strong style="color: #007749; font-size: 14px;">합계 ${Number(selectedOrder.total_amount || 0).toLocaleString()}원</strong>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${(selectedOrder.items || []).map(it => {
                    const pid = it.product_id || it.id || it.name || '';
                    const effQty = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
                    return `
                      <div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <strong>${esc(it.name)}</strong>
                          <span style="font-weight: 700;">${Number(it.unit_price || 0).toLocaleString()}원 × ${effQty}${esc(it.uom || '개')} = ${(Number(it.unit_price || 0) * effQty).toLocaleString()}원</span>
                        </div>
                        ${pid ? `
                          <div style="display: flex; gap: 6px; align-items: center; margin-top: 8px; flex-wrap: wrap;">
                            <input type="number" min="0" value="${effQty}" class="erp-input adj-qty-input" data-pid="${esc(pid)}" style="width: 72px; height: 30px; font-size: 12px;" />
                            <input type="text" value="${esc(it.adjust_reason || '')}" placeholder="정정 사유 (예: 재고 부족으로 수량 변경)" class="erp-input adj-reason-input" data-pid="${esc(pid)}" style="flex: 1; min-width: 140px; height: 30px; font-size: 12px;" />
                            <button type="button" class="mc-btn-secondary btn-adj-apply" data-oid="${esc(selectedOrder.order_id)}" data-pid="${esc(pid)}" style="height: 30px; padding: 0 10px; font-size: 12px;">정정</button>
                            <button type="button" class="mc-btn-secondary btn-adj-oos" data-oid="${esc(selectedOrder.order_id)}" data-pid="${esc(pid)}" style="height: 30px; padding: 0 10px; font-size: 12px; color: #b91c1c; border-color: #fecaca;">결품(0)</button>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- 섹션 3: Medusa 스타일 처리 타임라인 -->
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">처리 타임라인</div>
                <div style="display: flex; justify-content: space-between; gap: 6px;">
                  ${['REQUESTED', 'PICKING', 'PACKED', 'DELIVERED'].map(st => {
                    const order = ['REQUESTED', 'PICKING', 'PACKED', 'DELIVERED'];
                    const activeIdx = order.indexOf(selectedOrder.status);
                    const curIdx = order.indexOf(st);
                    const done = curIdx <= activeIdx;
                    return `
                      <div style="flex: 1; text-align: center; padding: 8px 4px; border-radius: 8px; font-size: 11.5px; font-weight: 700; background: ${done ? '#dcfce7' : '#f1f5f9'}; color: ${done ? '#166534' : '#94a3b8'};">
                        ${(STATUS_META[st] || {}).label || st}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer" style="justify-content: space-between;">
              <button type="button" class="mc-btn-secondary btn-print-order" data-id="${esc(selectedOrder.order_id)}">전표 · 명세표 출력</button>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="mc-btn-secondary" id="btn-cancel-ord-drawer">닫기</button>
                ${(STATUS_META[selectedOrder.status] || {}).next ? `
                  <button type="button" class="mc-btn-primary btn-mart-order-next" data-id="${esc(selectedOrder.order_id)}" data-next="${STATUS_META[selectedOrder.status].next}">
                    ${STATUS_META[selectedOrder.status].nextLabel}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      ${drawerMode === 'CREATE_OFFLINE' ? `
        <div class="mc-drawer-backdrop" id="mc-ord-backdrop">
          <div class="mc-drawer mc-drawer--wide">
            <div class="mc-drawer-header">
              <h2>오프라인 다품목 주문 입력</h2>
              <button type="button" class="mc-drawer-close" id="btn-close-ord-drawer">×</button>
            </div>
            <div class="mc-drawer-body mc-drawer-grid-2">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">수요처 · 결제 · 배송</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div>
                    <label class="erp-field-label">수주 경로</label>
                    <select id="mo-source" class="erp-input">
                      <option value="PHONE">전화 주문</option>
                      <option value="KAKAO_FAX">카톡 · 팩스</option>
                      <option value="WALK_IN">매장 방문 수기</option>
                      <option value="FACILITY_REGULAR">기관 정기발주</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">수요처 구분</label>
                    <select id="mo-buyer-type" class="erp-input">
                      <option value="SENIOR_CENTER">경로당</option>
                      <option value="INSTITUTION_B2B">복지·공공기관(B2B)</option>
                      <option value="ELDERLY_CARE">독거노인(돌봄)</option>
                      <option value="INDIVIDUAL">일반 소비자</option>
                    </select>
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">수요처명 / 성명 *</label>
                    <input id="mo-buyer-name" class="erp-input" type="text" placeholder="예: 서초3동 경로당" />
                  </div>
                  <div>
                    <label class="erp-field-label">결제 수단</label>
                    <select id="mo-pay-method" class="erp-input">
                      <option value="FACILITY_POSTPAY">기관 월말 후불</option>
                      <option value="MUNICIPAL_VOUCHER">지자체 보조금 · 바우처</option>
                      <option value="CASH_POS">현장 현금 · 카드 결제</option>
                      <option value="BANK_TRANSFER">무통장 입금</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">배송 예정일</label>
                    <input id="mo-date" class="erp-input" type="date" value="${new Date().toISOString().slice(0, 10)}" />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">비고 / 요청사항</label>
                    <input id="mo-memo" class="erp-input" type="text" placeholder="예: 오후 2시 전 도착 요청" />
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">품목 담기</div>
                <div style="display: grid; grid-template-columns: 1fr 72px 96px auto; gap: 8px; align-items: end;">
                  <div>
                    <label class="erp-field-label">품목 선택</label>
                    <select id="mo-product" class="erp-input">
                      ${products.map(p => `<option value="${esc(p.id)}" data-name="${esc(p.name)}" data-uom="${esc(p.uom)}" data-price="${p.sale_price ?? p.regular_price ?? 0}" data-temp="${p.storage_temp || 'AMBIENT'}">${esc(p.name)} (${Number(p.sale_price ?? p.regular_price ?? 0).toLocaleString()}원/${esc(p.uom)})</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">수량</label>
                    <input id="mo-qty" class="erp-input" type="number" min="1" value="1" />
                  </div>
                  <div>
                    <label class="erp-field-label">단가</label>
                    <input id="mo-price" class="erp-input" type="number" min="0" value="${Number(products[0]?.sale_price ?? products[0]?.regular_price ?? 0)}" />
                  </div>
                  <button type="button" id="btn-add-draft-item" class="mc-btn-secondary" style="height: 36px;">+ 담기</button>
                </div>

                <div id="mo-draft-list" style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto;">
                  ${draftItems.map((it, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12.5px;">
                      <span><strong>${esc(it.name)}</strong> × ${it.qty}${esc(it.uom)} (@${Number(it.unit_price).toLocaleString()}원)</span>
                      <div style="display: flex; gap: 8px; align-items: center;">
                        <b>${(it.qty * it.unit_price).toLocaleString()}원</b>
                        <button type="button" class="mc-btn-secondary btn-remove-draft" data-idx="${idx}" style="height: 24px; padding: 0 8px; font-size: 11px;">삭제</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-ord-drawer">취소</button>
              <button type="button" id="btn-submit-offline-order" class="mc-btn-primary" ${draftItems.length === 0 ? 'disabled' : ''}>
                오프라인 주문 접수 (${draftTotal.toLocaleString()}원)
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      ${drawerMode === 'BULK_PO' ? `
        <div class="mc-drawer-backdrop" id="mc-ord-backdrop">
          <div class="mc-drawer" style="width: 580px;">
            <div class="mc-drawer-header">
              <h2>수요처 발주서 일괄 등록</h2>
              <button type="button" class="mc-drawer-close" id="btn-close-ord-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">발주 기본 설정</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                  <div>
                    <label class="erp-field-label">수주 경로</label>
                    <select id="bpo-source" class="erp-input">
                      <option value="FACILITY_REGULAR">기관 정기발주</option>
                      <option value="KAKAO_FAX">카톡 · 팩스</option>
                      <option value="PHONE">전화 주문</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">수요처 구분</label>
                    <select id="bpo-buyer-type" class="erp-input">
                      <option value="SENIOR_CENTER">경로당</option>
                      <option value="INSTITUTION_B2B">복지·공공기관(B2B)</option>
                      <option value="ELDERLY_CARE">독거노인(돌봄)</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">결제 수단</label>
                    <select id="bpo-pay" class="erp-input">
                      <option value="FACILITY_POSTPAY">기관 월말 후불</option>
                      <option value="MUNICIPAL_VOUCHER">지자체 보조금 · 바우처</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>발주서 엑셀(CSV) 서식 · 표 입력</span>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="mc-btn-secondary" id="btn-dl-po-template" style="height: 28px; padding: 0 10px; font-size: 12px;">엑셀 서식 다운로드</button>
                    <button type="button" class="mc-btn-secondary" id="btn-fill-bulk-po" style="height: 28px; padding: 0 10px; font-size: 12px;">발주서 샘플 채우기</button>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                  <label class="mc-btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer;">
                    CSV / TXT 파일 불러오기
                    <input id="file-po-csv" type="file" accept=".csv,.tsv,.txt" style="display: none;" />
                  </label>
                  <span style="font-size: 12px; color: #64748b;">수요처·배송일별로 자동 묶음 접수됩니다.</span>
                </div>
                <textarea id="txt-bulk-po" rows="7" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: var(--font-mono); font-size: 12px;" placeholder="수요처명 [탭/콤마] 품목명 [탭/콤마] 수량 [탭/콤마] 단가 [탭/콤마] 배송예정일(YYYY-MM-DD)"></textarea>
                <div id="bpo-error" style="display: none; margin-top: 8px; font-size: 12px; color: #b91c1c; font-weight: 600;"></div>
              </div>
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>파싱 미리보기</span>
                  <span id="bpo-preview-count" class="mc-pill mc-pill-gray">0건 인식</span>
                </div>
                <div id="bpo-import-preview" style="max-height: 180px; overflow: auto; font-size: 12px; color: #64748b;">데이터를 입력하거나 파일을 선택하면 미리보기가 표시됩니다.</div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-ord-drawer">취소</button>
              <button type="button" class="mc-btn-primary" id="btn-run-bulk-po">발주서 일괄 접수</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // KPI 상태 스트립 클릭
  container.querySelectorAll('.btn-ord-kpi').forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilter = btn.dataset.status;
      currentPage = 1;
      renderMartOrdersView(container, channel);
    });
  });

  // 검색 및 날짜 필터
  container.querySelector('#ord-search-q')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    currentPage = 1;
    renderMartOrdersView(container, channel, { focusId: 'ord-search-q', cursorPos: e.target.selectionStart });
  });
  container.querySelector('#ord-date-filter')?.addEventListener('change', (e) => {
    dateFilter = e.target.value;
    currentPage = 1;
    renderMartOrdersView(container, channel);
  });
  container.querySelector('#btn-ord-reset-filter')?.addEventListener('click', () => {
    searchQuery = '';
    dateFilter = '';
    statusFilter = 'ALL';
    currentPage = 1;
    renderMartOrdersView(container, channel);
  });
  bindMartPaginationEvents(container, {
    prefix: 'ord',
    totalPages: pageInfo.totalPages,
    onPageChange: (nextP) => { currentPage = nextP; renderMartOrdersView(container, channel); },
    onSizeChange: (nextSz) => { pageSize = nextSz; currentPage = 1; renderMartOrdersView(container, channel); }
  });
  bindStopPropagation(container);
  if (opts.focusId) {
    const el = container.querySelector(`#${opts.focusId}`);
    if (el) {
      el.focus();
      if (typeof opts.cursorPos === 'number' && typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(opts.cursorPos, opts.cursorPos);
      }
    }
  }

  // 드로어 열기/닫기
  container.querySelectorAll('.mc-ord-row, .btn-ord-detail').forEach(el => {
    el.addEventListener('click', () => {
      selectedOrderId = el.dataset.id;
      drawerMode = 'DETAIL';
      renderMartOrdersView(container, channel);
    });
  });
  container.querySelector('#btn-open-offline-drawer')?.addEventListener('click', () => {
    drawerMode = 'CREATE_OFFLINE';
    renderMartOrdersView(container, channel);
  });
  container.querySelector('#btn-open-bulk-po')?.addEventListener('click', () => {
    drawerMode = 'BULK_PO';
    renderMartOrdersView(container, channel);
  });
  const renderPoPreview = () => {
    const raw = container.querySelector('#txt-bulk-po')?.value || '';
    const rows = parseDelimitedRows(raw).filter(c => c.length >= 3 && c[0] && c[0] !== '수요처명' && c[1]);
    const cntEl = container.querySelector('#bpo-preview-count');
    const prevEl = container.querySelector('#bpo-import-preview');
    if (cntEl) cntEl.textContent = `${rows.length}행 인식`;
    if (prevEl) {
      if (rows.length === 0) {
        prevEl.innerHTML = '데이터를 입력하거나 파일을 선택하면 미리보기가 표시됩니다.';
      } else {
        prevEl.innerHTML = `
          <table class="mc-table" style="font-size: 11.5px;">
            <thead><tr><th>수요처명</th><th>품목명</th><th style="text-align:right;">수량</th><th style="text-align:right;">단가</th><th>배송일</th></tr></thead>
            <tbody>
              ${rows.slice(0, 20).map(c => `<tr><td><b>${esc(c[0])}</b></td><td>${esc(c[1])}</td><td class="mc-num">${Number(c[2] || 1)}</td><td class="mc-num">${Number(c[3] || 0).toLocaleString()}원</td><td>${esc(c[4] || '-')}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
    }
  };
  container.querySelector('#txt-bulk-po')?.addEventListener('input', renderPoPreview);
  container.querySelector('#btn-dl-po-template')?.addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadExcelCsv(
      'mart_purchase_order_template.csv',
      ['수요처명', '품목명', '수량', '단가', '배송예정일'],
      [
        ['서초3동 경로당', '돼지고기 (불고기용)', 3, 4900, today],
        ['서초3동 경로당', '양파 (깐양파)', 2, 4900, today],
        ['반포1동 복지관', '국내산 세척당근(특)', 5, 2980, today]
      ]
    );
  });
  container.querySelector('#file-po-csv')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvOrTextFile(file);
    const ta = container.querySelector('#txt-bulk-po');
    if (ta) ta.value = text;
    renderPoPreview();
  });
  container.querySelector('#btn-fill-bulk-po')?.addEventListener('click', () => {
    const ta = container.querySelector('#txt-bulk-po');
    const today = new Date().toISOString().slice(0, 10);
    if (ta) {
      ta.value = `서초3동 경로당\t돼지고기 (불고기용)\t3\t4900\t${today}\n서초3동 경로당\t양파 (깐양파)\t2\t4900\t${today}\n반포1동 복지관\t국내산 세척당근(특)\t5\t2980\t${today}`;
    }
    renderPoPreview();
  });
  container.querySelector('#btn-run-bulk-po')?.addEventListener('click', async () => {
    const raw = container.querySelector('#txt-bulk-po')?.value?.trim();
    const errEl = container.querySelector('#bpo-error');
    if (!raw) {
      if (errEl) { errEl.textContent = '발주서 표 데이터를 입력하세요.'; errEl.style.display = 'block'; }
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const groups = new Map();
    for (const cols of parseDelimitedRows(raw)) {
      if (cols.length < 3 || !cols[0] || !cols[1] || cols[0] === '수요처명') continue;
      const [buyerName, itemName, qtyStr, priceStr, dateStr] = cols;
      const dDate = dateStr || today;
      const key = `${buyerName}__${dDate}`;
      const prod = products.find(p => p.name === itemName || p.name.includes(itemName));
      const item = {
        product_id: prod?.id || `custom_${Date.now()}`,
        name: prod?.name || itemName,
        qty: Math.max(1, Number(qtyStr || 1)),
        uom: prod?.uom || '개',
        unit_price: priceStr !== undefined && priceStr !== '' ? Math.max(0, Number(priceStr)) : Number(prod?.sale_price ?? prod?.regular_price ?? 0),
        storage_temp: prod?.storage_temp || 'AMBIENT'
      };
      if (!groups.has(key)) groups.set(key, { buyer_name: buyerName, delivery_date: dDate, items: [] });
      groups.get(key).items.push(item);
    }
    if (groups.size === 0) {
      if (errEl) { errEl.textContent = '유효한 발주 행이 없습니다. (수요처명, 품목명, 수량 필수)'; errEl.style.display = 'block'; }
      return;
    }
    const source = container.querySelector('#bpo-source')?.value || 'FACILITY_REGULAR';
    const buyerType = container.querySelector('#bpo-buyer-type')?.value || 'SENIOR_CENTER';
    const payMethod = container.querySelector('#bpo-pay')?.value || 'FACILITY_POSTPAY';
    for (const grp of groups.values()) {
      await martApi.createOrder({
        order_channel: 'OFFLINE',
        offline_source: source,
        customer_type: buyerType,
        buyer_name: grp.buyer_name,
        payment_method: payMethod,
        delivery_date: grp.delivery_date,
        memo: '발주서 일괄 접수',
        items: grp.items
      });
    }
    drawerMode = 'NONE';
    await renderMartOrdersView(container, channel);
  });
  const closeDrawer = () => {
    drawerMode = 'NONE';
    selectedOrderId = '';
    renderMartOrdersView(container, channel);
  };
  container.querySelector('#btn-close-ord-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#btn-cancel-ord-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#mc-ord-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-ord-backdrop') closeDrawer();
  });

  // 결품 / 실수량 정정
  container.querySelectorAll('.btn-adj-apply').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oid = btn.dataset.oid;
      const pid = btn.dataset.pid;
      const qtyEl = container.querySelector(`.adj-qty-input[data-pid="${pid}"]`);
      const reasonEl = container.querySelector(`.adj-reason-input[data-pid="${pid}"]`);
      await martApi.adjustOrderItem({
        order_id: oid,
        product_id: pid,
        actual_qty: Math.max(0, Number(qtyEl?.value ?? 0)),
        reason: reasonEl?.value?.trim() || '수량 정정'
      });
      await renderMartOrdersView(container, channel);
    });
  });
  container.querySelectorAll('.btn-adj-oos').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.adjustOrderItem({
        order_id: btn.dataset.oid,
        product_id: btn.dataset.pid,
        actual_qty: 0,
        reason: '현장 결품 처리'
      });
      await renderMartOrdersView(container, channel);
    });
  });

  // 오프라인 주문 입력
  container.querySelector('#mo-product')?.addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    const priceInput = container.querySelector('#mo-price');
    if (priceInput && opt) priceInput.value = opt.dataset.price || 0;
  });
  const renderDraftListInPlace = () => {
    const listEl = container.querySelector('#mo-draft-list');
    const submitBtn = container.querySelector('#btn-submit-offline-order');
    const total = draftItems.reduce((s, it) => s + Number(it.unit_price || 0) * Number(it.qty || 1), 0);
    if (listEl) {
      listEl.innerHTML = draftItems.map((it, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12.5px;">
          <span><strong>${esc(it.name)}</strong> × ${it.qty}${esc(it.uom)} (@${Number(it.unit_price).toLocaleString()}원)</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <b>${(it.qty * it.unit_price).toLocaleString()}원</b>
            <button type="button" class="mc-btn-secondary btn-remove-draft" data-idx="${idx}" style="height: 24px; padding: 0 8px; font-size: 11px;">삭제</button>
          </div>
        </div>
      `).join('');
      listEl.querySelectorAll('.btn-remove-draft').forEach(btn => {
        btn.addEventListener('click', () => {
          draftItems.splice(Number(btn.dataset.idx), 1);
          renderDraftListInPlace();
        });
      });
    }
    if (submitBtn) {
      submitBtn.disabled = draftItems.length === 0;
      submitBtn.textContent = `오프라인 주문 접수 (${total.toLocaleString()}원)`;
    }
  };

  container.querySelector('#btn-add-draft-item')?.addEventListener('click', () => {
    const sel = container.querySelector('#mo-product');
    const opt = sel?.options[sel.selectedIndex];
    if (!opt) return;
    draftItems.push({
      product_id: sel.value,
      name: opt.dataset.name || '상품',
      qty: Math.max(1, Number(container.querySelector('#mo-qty')?.value ?? 1)),
      uom: opt.dataset.uom || '개',
      unit_price: Math.max(0, Number(container.querySelector('#mo-price')?.value ?? 0)),
      storage_temp: opt.dataset.temp || 'AMBIENT'
    });
    renderDraftListInPlace();
  });
  container.querySelectorAll('.btn-remove-draft').forEach(btn => {
    btn.addEventListener('click', () => {
      draftItems.splice(Number(btn.dataset.idx), 1);
      renderDraftListInPlace();
    });
  });
  container.querySelector('#btn-submit-offline-order')?.addEventListener('click', async () => {
    const buyerEl = container.querySelector('#mo-buyer-name');
    const buyerName = buyerEl?.value?.trim();
    if (!buyerName) {
      if (buyerEl) {
        buyerEl.style.borderColor = '#dc2626';
        buyerEl.focus();
      }
      return;
    }
    if (draftItems.length === 0) return;
    await martApi.createOrder({
      order_channel: 'OFFLINE',
      offline_source: container.querySelector('#mo-source')?.value || 'PHONE',
      customer_type: container.querySelector('#mo-buyer-type')?.value || 'SENIOR_CENTER',
      buyer_name: buyerName,
      payment_method: container.querySelector('#mo-pay-method')?.value || 'FACILITY_POSTPAY',
      delivery_date: container.querySelector('#mo-date')?.value,
      memo: container.querySelector('#mo-memo')?.value?.trim() || '',
      items: draftItems
    });
    draftItems = [];
    drawerMode = 'NONE';
    await renderMartOrdersView(container, channel);
  });

  // 출력 & 상태 전환
  container.querySelectorAll('.btn-print-order').forEach(btn => {
    btn.addEventListener('click', () => {
      const ord = allOrders.find(o => o.order_id === btn.dataset.id);
      if (ord) openMartPrintModal(ord, mart, isOffline ? 'SLIP_80MM' : 'A4_STATEMENT');
    });
  });
  container.querySelectorAll('.btn-mart-order-next').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.updateOrderStatus(btn.dataset.id, btn.dataset.next);
      await renderMartOrdersView(container, channel);
    });
  });
}
