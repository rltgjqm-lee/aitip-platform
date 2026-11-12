/**
 * ============================================================================
 * AITIP Merchant Portal - TastyPrinter ESC/POS 80mm 주문전표 모달 모듈 (ESM)
 * 준수 규격: DOC-02 (하드웨어 CTI 연동), TastyPrinter main.py 포맷
 * 지원 전표:
 *   1. 주방 조리용 전표 (kitchenview) - 대형 헤더, 메뉴명 2배 강조, 즉시/예약/테이블식사 분기
 *   2. 카운터/고객용 영수증 (expoview) - 세무 증빙, 공급가액/부가세, 안심번호, 결제상세
 * ============================================================================
 */

let currentReceiptOrder = null;
let currentReceiptStore = null;
let currentReceiptMode = 'kitchen';

export function openReceiptModal(order, store, mode = 'kitchen') {
  currentReceiptOrder = order;
  currentReceiptStore = store;
  currentReceiptMode = mode;

  const modal = document.getElementById('modal-print-receipt');
  if (!modal) return;

  const tabKitchen = document.getElementById('tab-print-kitchen');
  const tabCounter = document.getElementById('tab-print-counter');
  if (tabKitchen && tabCounter) {
    if (mode === 'kitchen') {
      tabKitchen.classList.add('active');
      tabCounter.classList.remove('active');
    } else {
      tabCounter.classList.add('active');
      tabKitchen.classList.remove('active');
    }
  }

  renderReceiptContent();
  modal.classList.add('show');
}

export function renderReceiptContent() {
  const box = document.getElementById('receipt-paper-box');
  if (!box || !currentReceiptOrder) return;

  const o = currentReceiptOrder;
  const isDineIn = o.fulfillment_type === 'DINE_IN';
  const isPickup = o.fulfillment_type === 'TAKEOUT';
  const isDelivery = o.fulfillment_type === 'DELIVERY';
  const isScheduled = o.ready_type === 'SCHEDULED';

  const store = currentReceiptStore || {
    store_name: '바른치킨 서초본점',
    biz_number: '214-88-59124',
    owner_name: '홍길동',
    phone: '02-588-5858',
    address: '서울특별시 서초구 서초대로 42길 11'
  };

  if (currentReceiptMode === 'kitchen') {
    let headerBannerHtml = '';
    if (isDineIn) {
      headerBannerHtml = `
        <div class="receipt-kitchen-title" style="background: #e0f2fe; color: #0369a1; padding: 4px;">[★ 매장 식사: ${o.table_no || '홀 테이블'}]</div>
        <div style="text-align: center; font-size: 15px; font-weight: 900; color: #0c4a6e; margin-top: 4px;">
          방문 예약: ${o.reserved_at || '즉시 방문'} (성인 ${o.guest_count || 2}명)
        </div>
      `;
    } else if (isPickup) {
      headerBannerHtml = isScheduled
        ? `
          <div class="receipt-kitchen-title" style="background: #fed7aa; color: #c2410c; padding: 4px;">[★ 포 장 예 약]</div>
          <div style="text-align: center; font-size: 15px; font-weight: 900; color: #9a3412; margin-top: 4px;">
            픽업 예정: ${o.pickup_estimated_at || o.reserved_at || '시간지정'} 픽업
          </div>
        `
        : `<div class="receipt-kitchen-title">[주방 조리 전표]</div><div style="text-align: center; font-size: 14px; font-weight: 700;">[매장 픽업 / 즉시 포장]</div>`;
    } else {
      headerBannerHtml = isScheduled
        ? `
          <div class="receipt-kitchen-title" style="background: #f3e8ff; color: #7e22ce; padding: 4px;">[★ 배 달 예 약]</div>
          <div style="text-align: center; font-size: 15px; font-weight: 900; color: #6b21a8; margin-top: 4px;">
            도착 예정: ${o.reserved_at || '시간지정'} 정시 도착
          </div>
        `
        : `<div class="receipt-kitchen-title">[주방 조리 전표]</div><div style="text-align: center; font-size: 14px; font-weight: 700;">[일반 즉시 배달 주문]</div>`;
    }

    box.innerHTML = `
      ${headerBannerHtml}
      <div class="receipt-order-seq">${o.short_display_id}</div>
      <div class="receipt-row">
        <span>접수: ${new Date(o.created_at).toLocaleTimeString('ko-KR')}</span>
        <span>${isDineIn ? `인원: ${o.guest_count || 2}명` : `조리시간: ${o.prep_time_minutes || 20}분`}</span>
      </div>
      ${(!isDineIn) ? `
        <div class="receipt-row" style="font-size: 12px; margin-top: 2px;">
          <span>${isPickup ? '포장수령' : '배달지'}: ${o.delivery_address}</span>
        </div>
        <div class="receipt-row" style="font-size: 12px;">
          <span>연락처: ${o.virtual_phone ? `${o.virtual_phone} [0504안심]` : (o.customer_phone || '')}</span>
        </div>
      ` : ''}
      <div class="receipt-dashed"></div>
      ${o.items.map(it => `
        <div class="receipt-row bold">
          <span>${it.name}</span>
          <span>× ${it.quantity}</span>
        </div>
        ${(it.selected_options || []).map(opt => `
          <div class="receipt-subrow">
            <span>* ${opt.group_name}: ${opt.option_name}</span>
          </div>
        `).join('')}
      `).join('')}
      <div class="receipt-dashed"></div>
      <div class="receipt-memo-box">
        [조리 및 요청사항]<br>
        ${o.customer_memo || '요청사항 없음 (기본 정량 조리)'}
      </div>
      <div class="receipt-double-dashed"></div>
      <div style="text-align: center; font-size: 11px; color: #555555;">[AITIP CTI KDS ESC/POS 80mm 자동 출력]</div>
    `;
  } else {
    const supplyAmt = Math.round(o.final_payment_amount / 1.1);
    const vatAmt = o.final_payment_amount - supplyAmt;
    let orderTypeDisplay = isDineIn ? `매장식사 (${o.table_no || '홀'})` : isPickup ? '매장포장' : '배달';
    if (isScheduled) orderTypeDisplay += ' (시간예약)';

    box.innerHTML = `
      <div style="text-align: center; font-size: 17px; font-weight: 900; margin-bottom: 4px;">${store.store_name}</div>
      <div style="text-align: center; font-size: 12px; margin-bottom: 8px;">
        대표: ${store.owner_name} | 사업자번호: ${store.biz_number}<br>
        전화: ${store.phone}<br>
        주소: ${store.address}
      </div>
      <div class="receipt-dashed"></div>
      <div class="receipt-row">
        <span>주문번호: ${o.short_display_id} [${orderTypeDisplay}]</span>
        <span>${new Date(o.created_at).toLocaleDateString('ko-KR')}</span>
      </div>
      <div class="receipt-row">
        <span>고객명: ${o.customer_name}</span>
        <span>${o.virtual_phone ? `${o.virtual_phone} [0504안심]` : o.customer_phone}</span>
      </div>
      <div class="receipt-row">
        <span>${isDineIn ? '테이블배정' : '수령지'}: ${isDineIn ? o.table_no : o.delivery_address}</span>
      </div>
      ${isScheduled ? `
        <div class="receipt-row" style="color: #7e22ce; font-weight: 700;">
          <span>예약시간: ${o.reserved_at || o.pickup_estimated_at}</span>
          <span>${isDineIn ? `인원: ${o.guest_count}인` : '예약완료'}</span>
        </div>
      ` : ''}
      <div class="receipt-dashed"></div>
      <div class="receipt-row bold" style="border-bottom: 1px dashed #666; padding-bottom: 4px;">
        <span style="flex: 2;">상품명</span>
        <span style="flex: 1; text-align: center;">수량</span>
        <span style="flex: 1; text-align: right;">금액</span>
      </div>
      ${o.items.map(it => `
        <div class="receipt-row" style="margin-top: 4px;">
          <span style="flex: 2; font-weight: 700;">${it.name}</span>
          <span style="flex: 1; text-align: center;">${it.quantity}</span>
          <span style="flex: 1; text-align: right;">${it.total_price.toLocaleString()}</span>
        </div>
        ${(it.selected_options || []).map(opt => `
          <div class="receipt-subrow" style="font-size: 11px;">
            <span style="flex: 3;">- ${opt.option_name}</span>
            <span style="flex: 1; text-align: right;">+${opt.price.toLocaleString()}</span>
          </div>
        `).join('')}
      `).join('')}
      <div class="receipt-dashed"></div>
      <div class="receipt-row">
        <span>공급가액</span>
        <span>${supplyAmt.toLocaleString()}원</span>
      </div>
      <div class="receipt-row">
        <span>부가세 (VAT 10%)</span>
        <span>${vatAmt.toLocaleString()}원</span>
      </div>
      ${o.delivery_tip > 0 ? `
        <div class="receipt-row">
          <span>배달팁</span>
          <span>${o.delivery_tip.toLocaleString()}원</span>
        </div>
      ` : ''}
      <div class="receipt-dashed"></div>
      <div class="receipt-row bold" style="font-size: 16px;">
        <span>결제금액</span>
        <span style="color: #191f28;">${o.final_payment_amount.toLocaleString()}원</span>
      </div>
      <div class="receipt-row" style="font-size: 12px; color: #64748b;">
        <span>결제수단</span>
        <span>${o.payment_method === 'AITIP_ZERO_PAY' ? 'AITIP 제로페이 (수수료 0%)' : o.payment_method || '신용카드'}</span>
      </div>
      <div class="receipt-double-dashed"></div>
      <div style="text-align: center; font-size: 11px; color: #888888; line-height: 1.4;">
        AITIP 상생 가맹점 영수증 (소상공인 중개수수료 0원)<br>
        감사합니다. 맛있게 드세요!
      </div>
    `;
  }
}

export function setupReceiptEvents() {
  const tabKitchen = document.getElementById('tab-print-kitchen');
  const tabCounter = document.getElementById('tab-print-counter');
  if (tabKitchen && tabCounter) {
    tabKitchen.addEventListener('click', () => {
      tabKitchen.classList.add('active');
      tabCounter.classList.remove('active');
      currentReceiptMode = 'kitchen';
      renderReceiptContent();
    });
    tabCounter.addEventListener('click', () => {
      tabCounter.classList.add('active');
      tabKitchen.classList.remove('active');
      currentReceiptMode = 'counter';
      renderReceiptContent();
    });
  }

  const btnDoPrint = document.getElementById('btn-trigger-print');
  if (btnDoPrint) {
    btnDoPrint.addEventListener('click', () => window.print());
  }
}
