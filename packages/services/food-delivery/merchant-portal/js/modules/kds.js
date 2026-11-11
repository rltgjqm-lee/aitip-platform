/**
 * ============================================================================
 * AITIP Merchant Portal - 실시간 KDS 주문 접수 및 요식업 예약 통합 모듈 (ESM)
 * 준수 규격: DOC-02, DOC-08, DOC-10, NextOrders TimeType, TastyPrinter ESC/POS
 * 지원 기능:
 *   1. 즉시 배달 / 즉시 포장
 *   2. 시간 예약 배달 (Scheduled Delivery) - NextOrders 규격
 *   3. 시간 예약 포장 (Scheduled Takeout)
 *   4. 매장 식사 / 테이블 예약 (Dine-in / Table Reservation) - D1 DINE_IN 연동
 *   5. 피크타임 자체 배달 vs 배달 대행 하이브리드 디스패치
 * ============================================================================
 */
import { merchantApi } from '../api.js';
import { openReceiptModal } from './receipt.js';

let currentKdsFilter = 'ALL';

export function playOrderChime() {
  const check = document.getElementById('check-kds-sound');
  if (check && !check.checked) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime);
      gain2.gain.setValueAtTime(0.2, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.5);
    }, 120);
  } catch (e) {
    console.warn('[Audio] 차임벨 재생 경고:', e);
  }
}

export function setKdsFilter(filter, state) {
  currentKdsFilter = filter;
  renderKdsOrders(state);
}

export function renderKdsOrders(state) {
  const container = document.getElementById('kds-orders-container');
  const countBadge = document.getElementById('badge-kds-count');
  if (!container) return;

  container.innerHTML = '';
  const orders = Array.isArray(state.liveOrders) ? state.liveOrders : [];
  const pendingOrders = orders.filter(o => o.status === 'PENDING');

  if (countBadge) {
    countBadge.textContent = `${pendingOrders.length}건 대기`;
  }

  // 상단 실시간 관제 카운터 집계
  const selfDeliveringCount = orders.filter(o => o.delivery_method === 'SELF' && o.delivery_status === 'SELF_DELIVERING').length;
  const agencyDeliveringCount = orders.filter(o => o.delivery_method === 'AGENCY' && o.delivery_status && o.delivery_status !== 'DELIVERED').length;
  const prepCount = orders.filter(o => o.status === 'ACCEPTED' && (!o.delivery_status || o.delivery_status === 'WAITING_ACCEPT' || o.delivery_status === 'COOKING')).length;
  const scheduledCount = orders.filter(o => o.ready_type === 'SCHEDULED' && o.fulfillment_type !== 'DINE_IN' && o.status !== 'COMPLETED').length;
  const dineInCount = orders.filter(o => o.fulfillment_type === 'DINE_IN' && o.status !== 'COMPLETED').length;

  const elSelfCount = document.getElementById('kds-count-self');
  const elAgencyCount = document.getElementById('kds-count-agency');
  const elPrepCount = document.getElementById('kds-count-prep');
  const elScheduledCount = document.getElementById('kds-count-scheduled');
  const elDineInCount = document.getElementById('kds-count-dinein');

  if (elSelfCount) elSelfCount.textContent = selfDeliveringCount;
  if (elAgencyCount) elAgencyCount.textContent = agencyDeliveringCount;
  if (elPrepCount) elPrepCount.textContent = prepCount;
  if (elScheduledCount) elScheduledCount.textContent = scheduledCount;
  if (elDineInCount) elDineInCount.textContent = dineInCount;

  // 4단 서브필터 적용
  let filteredOrders = orders;
  if (currentKdsFilter === 'IMMEDIATE') {
    filteredOrders = orders.filter(o => o.ready_type !== 'SCHEDULED' && o.fulfillment_type !== 'DINE_IN');
  } else if (currentKdsFilter === 'SCHEDULED') {
    filteredOrders = orders.filter(o => o.ready_type === 'SCHEDULED' && o.fulfillment_type !== 'DINE_IN');
  } else if (currentKdsFilter === 'DINE_IN') {
    filteredOrders = orders.filter(o => o.fulfillment_type === 'DINE_IN');
  }

  // 4단 필터 탭 활성 클래스 갱신
  document.querySelectorAll('#kds-filter-buttons button').forEach(btn => {
    btn.className = (btn.getAttribute('data-kds-filter') === currentKdsFilter)
      ? 'btn btn-primary btn-sm'
      : 'btn btn-secondary btn-sm';
  });

  if (filteredOrders.length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #8b95a1; background: #fff; border-radius: 8px; border: 1px solid #e5e8eb;">해당 조건의 실시간 주문 및 예약 건이 없습니다.</div>`;
    return;
  }

  filteredOrders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'kds-card';
    card.id = `card-${order.order_id}`;

    const isPending = order.status === 'PENDING';
    const isAccepted = order.status === 'ACCEPTED';
    const isCompleted = order.status === 'COMPLETED';

    const isDineIn = order.fulfillment_type === 'DINE_IN';
    const isPickup = order.fulfillment_type === 'TAKEOUT';
    const isDelivery = order.fulfillment_type === 'DELIVERY';
    const isScheduled = order.ready_type === 'SCHEDULED';

    const distMeters = order.distance_meters || 0;
    const isNear = distMeters > 0 && distMeters <= 800;
    const estProfit = order.estimated_profit || Math.round(order.final_payment_amount * 0.55);

    // 유형별 태그 배지 생성
    let typeTagHtml = '';
    if (isDineIn) {
      typeTagHtml = `<span class="tag" style="background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 12px; margin-right: 6px;">★ 매장 식사 [${order.table_no || '홀 테이블'}]</span>`;
    } else if (isPickup) {
      typeTagHtml = isScheduled
        ? `<span class="tag" style="background: #fed7aa; color: #c2410c; font-weight: 800; font-size: 12px; margin-right: 6px;">★ 포장 예약 (${order.pickup_estimated_at || '시간지정'} 픽업)</span>`
        : `<span class="tag tag-pickup" style="margin-right: 6px; font-weight: 700;">매장 픽업(포장)</span>`;
    } else {
      typeTagHtml = isScheduled
        ? `<span class="tag" style="background: #f3e8ff; color: #7e22ce; font-weight: 800; font-size: 12px; margin-right: 6px;">★ 배달 예약 (${order.reserved_at || '시간지정'} 도착)</span>`
        : `<span class="tag tag-mint" style="margin-right: 6px; font-weight: 700;">배달 주문</span>`;
    }

    card.innerHTML = `
      <div class="kds-card-header">
        <div>
          ${typeTagHtml}
          <span class="kds-order-num">${order.short_display_id}</span>
        </div>
        <span class="kds-order-time">${new Date(order.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="kds-card-body">
        
        ${isScheduled ? `
          <div style="background: #faf5ff; border: 1px dashed #c084fc; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="color: #6b21a8; font-size: 13px;">[요식업 예약 지정 건]</strong>
              <div style="font-size: 12.5px; color: #7e22ce; font-weight: 700; margin-top: 2px;">
                ${order.scheduled_display || (isDineIn ? `${order.reserved_at} 테이블 방문` : `${order.reserved_at || order.pickup_estimated_at} 도착 예정`)}
              </div>
            </div>
            <span class="tag" style="background: #7e22ce; color: #fff; font-size: 11px; font-weight: 700;">조리 권장 알람 연동</span>
          </div>
        ` : ''}

        <div class="kds-meta-row">
          <span class="label">${isDineIn ? '테이블/인원' : isPickup ? '수령 방식' : '배달지'}</span>
          <span class="val">
            ${isDineIn ? `<strong>${order.table_no || '지정 테이블'}</strong> (성인 ${order.guest_count || 2}명)` : order.delivery_address}
            ${(!isPickup && !isDineIn) ? `<span class="tag ${isNear ? 'tag-success' : 'tag-neutral'}" style="margin-left: 6px; font-size: 11px;">거리 ${distMeters}m (${isNear ? '초근거리' : '일반'})</span>` : ''}
          </span>
        </div>
        <div class="kds-meta-row">
          <span class="label">고객 연락처</span>
          <span class="val">
            ${order.virtual_phone
              ? `<strong style="color: #0f766e; font-size: 13.5px;">${order.virtual_phone}</strong> <span class="tag tag-mint" style="font-size: 10px; font-weight: 700; margin-left: 4px;">0504 안심번호 (60분)</span>`
              : `<strong>${order.customer_phone || '010-0000-0000'}</strong>`
            }
          </span>
        </div>
        <div class="kds-meta-row">
          <span class="label">고객 요청</span>
          <span class="val" style="color: #c25e00;">${order.customer_memo || '없음'}</span>
        </div>
        
        <div class="kds-items-box">
          ${order.items.map(it => `
            <div class="kds-item-title">
              <span>${it.name} × ${it.quantity}</span>
              <span>${it.total_price.toLocaleString()}원</span>
            </div>
            <div class="kds-item-options">
              ${(it.selected_options || []).map(opt => `• ${opt.group_name}: ${opt.option_name} (+${opt.price.toLocaleString()}원)`).join('<br>')}
            </div>
          `).join('')}
        </div>

        <div class="kds-meta-row" style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e5e8eb;">
          <div>
            <span class="label" style="font-weight: 700;">총 결제금액</span>
            <div style="font-size: 11.5px; color: #059669; font-weight: 600;">실 공헌이익: ${estProfit.toLocaleString()}원</div>
          </div>
          <span class="val" style="font-size: 16px; font-weight: 800; color: #191f28;">${order.final_payment_amount.toLocaleString()}원</span>
        </div>
      </div>
      <div class="kds-card-footer">
        ${isPending ? `
          <div style="font-size: 12px; font-weight: 600; color: #4e5968; margin-bottom: 6px;">
            ${isDineIn ? '테이블 예약 조리 준비시간 선택' : isPickup ? '픽업 준비 예상시간 선택' : '배달 조리 예상시간 선택'}
          </div>
          <div class="time-selection-btns" id="time-btns-${order.order_id}">
            <button class="time-btn" data-time="10">10분</button>
            <button class="time-btn" data-time="15">15분</button>
            <button class="time-btn active" data-time="20">20분</button>
            <button class="time-btn" data-time="25">25분</button>
            <button class="time-btn" data-time="30">30분</button>
          </div>
          <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 14px; font-weight: 700;" data-accept="${order.order_id}">
            ${isDineIn ? '테이블 예약 수락 & 주방 전표 인쇄' : isScheduled ? '예약 수락 & 주방 전표 인쇄' : '주문 수락 & 주방 전표 인쇄'}
          </button>
        ` : isAccepted ? `
          <div style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 10px;">
              <span class="tag tag-success" style="font-size: 13px; padding: 6px 12px;">
                ${isDineIn ? (order.delivery_status === 'SEATED' ? '고객 착석 식사 중' : '테이블 예약 확정') : `조리중 (${order.prep_time_minutes || 20}분 설정)`}
              </span>
              <button class="btn btn-secondary btn-sm" data-reprint="${order.order_id}">전표/영수증 인쇄</button>
            </div>

            ${isDineIn ? `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; margin-top: 6px;">
                <div style="font-size: 12px; color: #166534; font-weight: 700; margin-bottom: 6px;">
                  ${order.table_no} 테이블 현장 관리
                </div>
                ${order.delivery_status !== 'SEATED' ? `
                  <button class="btn btn-primary btn-sm" style="width: 100%; padding: 8px;" data-dinein-seat="${order.order_id}">
                    고객 방문 확인 (테이블 착석)
                  </button>
                ` : `
                  <button class="btn btn-secondary btn-sm" style="width: 100%; padding: 8px; color: #15803d; border-color: #86efac;" data-dinein-complete="${order.order_id}">
                    식사 완료 및 퇴장 처리
                  </button>
                `}
              </div>
            ` : isPickup ? `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-top: 6px;">
                <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">포장 완료 시 손님께 알림톡 발송</div>
                <button class="btn btn-primary btn-sm" style="width: 100%; padding: 8px;" data-pickup-ready="${order.order_id}">
                  포장 조리완료 (손님 픽업 호출)
                </button>
              </div>
            ` : `
              <!-- 피크타임 하이브리드 배송 디스패치 제어기 -->
              <div class="delivery-dispatch-box" style="margin-top: 8px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 12px; font-weight: 700; color: #1e293b;">배송 디스패치 채널 선택:</span>
                  ${isNear ? '<span class="tag tag-success" style="font-size: 10.5px;">800m 이내 자체배달 추천</span>' : ''}
                </div>
                
                ${order.delivery_method === 'SELF' ? `
                  <div style="background: #ecfdf5; padding: 8px 10px; border-radius: 4px; border: 1px solid #a7f3d0; margin-bottom: 6px;">
                    <div style="font-size: 12px; color: #065f46; font-weight: 700;">점주/직원 직접 배송 진행중 (대행비 0원)</div>
                    <div style="font-size: 11px; color: #047857;">상태: ${order.delivery_status === 'SELF_DELIVERING' ? '출발 완료 (배송중)' : '출발 대기'}</div>
                  </div>
                  <button class="btn btn-primary btn-sm" style="width: 100%; background: #059669; border-color: #059669;" data-self-complete="${order.order_id}">
                    직접 배달 완료 (수령 확인)
                  </button>
                ` : order.delivery_method === 'AGENCY' ? `
                  <div style="background: #eff6ff; padding: 8px 10px; border-radius: 4px; border: 1px solid #bfdbfe; margin-bottom: 6px;">
                    <div style="font-size: 12px; color: #1e40af; font-weight: 700;">배달대행사 위탁 완료 (바로고/부릉/생각대로)</div>
                    <div style="font-size: 11px; color: #2563eb;">라이더 배차 대기 중 (호출 상태: DISPATCH_REQUESTED)</div>
                  </div>
                  <button class="btn btn-secondary btn-sm" style="width: 100%;" disabled>라이더 픽업 대기중...</button>
                ` : `
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" style="flex: 1; border-color: #10b981; color: #047857; font-weight: 700;" data-dispatch-self="${order.order_id}">
                      자체 직접 배달 (3,500원 절감)
                    </button>
                    <button class="btn btn-secondary btn-sm" style="flex: 1; border-color: #3b82f6; color: #1d4ed8; font-weight: 700;" data-dispatch-agency="${order.order_id}">
                      배달대행사 호출 (위탁)
                    </button>
                  </div>
                `}
              </div>
            `}
          </div>
        ` : `
          <div style="text-align: center; color: #8b95a1; font-size: 13px; font-weight: 600; padding: 6px;">
            ${isDineIn ? '식사 완료 (퇴장됨)' : '배달/픽업 완료된 주문건입니다.'}
          </div>
        `}
      </div>
    `;

    container.appendChild(card);

    // 이벤트 리스너 바인딩
    const timeBtns = card.querySelectorAll(`#time-btns-${order.order_id} .time-btn`);
    timeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        timeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const acceptBtn = card.querySelector(`[data-accept="${order.order_id}"]`);
    if (acceptBtn) {
      acceptBtn.addEventListener('click', async () => {
        const activeTimeBtn = card.querySelector(`#time-btns-${order.order_id} .time-btn.active`);
        const prepTime = activeTimeBtn ? Number(activeTimeBtn.getAttribute('data-time')) : 20;
        try {
          await merchantApi.acceptOrder(order.order_id, prepTime);
          order.status = 'ACCEPTED';
          order.prep_time_minutes = prepTime;
          renderKdsOrders(state);
          openReceiptModal(order, state.store, 'kitchen');
        } catch (err) {
          alert('주문 수락 실패: ' + err.message);
        }
      });
    }

    const reprintBtn = card.querySelector(`[data-reprint="${order.order_id}"]`);
    if (reprintBtn) {
      reprintBtn.addEventListener('click', () => {
        openReceiptModal(order, state.store, 'kitchen');
      });
    }

    // 매장 식사 (DINE_IN) 테이블 착석 확인
    const dineInSeatBtn = card.querySelector(`[data-dinein-seat="${order.order_id}"]`);
    if (dineInSeatBtn) {
      dineInSeatBtn.addEventListener('click', async () => {
        try {
          await merchantApi.updateDineInStatus(order.order_id, { status: 'SEATED' });
          order.delivery_status = 'SEATED';
          renderKdsOrders(state);
          alert(`${order.table_no} 고객 착석이 확인되었습니다.`);
        } catch (err) {
          alert('착석 처리 실패: ' + err.message);
        }
      });
    }

    // 매장 식사 (DINE_IN) 식사 완료 및 퇴장 처리
    const dineInCompleteBtn = card.querySelector(`[data-dinein-complete="${order.order_id}"]`);
    if (dineInCompleteBtn) {
      dineInCompleteBtn.addEventListener('click', async () => {
        if (confirm(`${order.table_no} 고객의 식사 완료 및 테이블 퇴장 처리를 진행하시겠습니까?`)) {
          try {
            await merchantApi.updateDineInStatus(order.order_id, { status: 'COMPLETED' });
            order.delivery_status = 'DINE_COMPLETED';
            order.status = 'COMPLETED';
            renderKdsOrders(state);
            alert(`${order.table_no} 식사 완료 처리가 정상 완료되었습니다.`);
          } catch (err) {
            alert('완료 처리 실패: ' + err.message);
          }
        }
      });
    }

    // 포장 조리 완료 (고객 호출)
    const pickupReadyBtn = card.querySelector(`[data-pickup-ready="${order.order_id}"]`);
    if (pickupReadyBtn) {
      pickupReadyBtn.addEventListener('click', async () => {
        try {
          await merchantApi.completeOrder(order.order_id);
          order.status = 'COMPLETED';
          renderKdsOrders(state);
          alert('손님께 [포장 조리완료 - 카운터 픽업 요청] 카카오 알림톡이 발송되었습니다.');
        } catch (err) {
          alert('처리 실패: ' + err.message);
        }
      });
    }

    // 자체 배달 디스패치
    const dispatchSelfBtn = card.querySelector(`[data-dispatch-self="${order.order_id}"]`);
    if (dispatchSelfBtn) {
      dispatchSelfBtn.addEventListener('click', async () => {
        if (confirm(`'${order.delivery_address}' 건을 점주 직접 배송으로 전환하시겠습니까? (대행비 0원)`)) {
          try {
            await merchantApi.updateDeliveryMethod(order.order_id, {
              delivery_method: 'SELF',
              status: 'IN_TRANSIT'
            });
            order.delivery_method = 'SELF';
            order.delivery_status = 'SELF_DELIVERING';
            renderKdsOrders(state);
          } catch (err) {
            alert('자체 배달 전환 실패: ' + err.message);
          }
        }
      });
    }

    // 대행사 배차 호출
    const dispatchAgencyBtn = card.querySelector(`[data-dispatch-agency="${order.order_id}"]`);
    if (dispatchAgencyBtn) {
      dispatchAgencyBtn.addEventListener('click', async () => {
        if (confirm(`배달대행사(바로고/부릉/생각대로)에 라이더 배차를 요청하시겠습니까?`)) {
          try {
            await merchantApi.updateDeliveryMethod(order.order_id, {
              delivery_method: 'AGENCY'
            });
            order.delivery_method = 'AGENCY';
            order.delivery_status = 'RIDER_REQUESTED';
            renderKdsOrders(state);
          } catch (err) {
            alert('대행사 배차 요청 실패: ' + err.message);
          }
        }
      });
    }

    // 자체 배달 완료
    const selfCompleteBtn = card.querySelector(`[data-self-complete="${order.order_id}"]`);
    if (selfCompleteBtn) {
      selfCompleteBtn.addEventListener('click', async () => {
        if (confirm(`고객 수령 및 직접 배달 완료 처리를 진행하시겠습니까?`)) {
          try {
            await merchantApi.updateDeliveryMethod(order.order_id, {
              delivery_method: 'SELF',
              status: 'COMPLETED'
            });
            order.status = 'COMPLETED';
            order.delivery_status = 'DELIVERED';
            renderKdsOrders(state);
          } catch (err) {
            alert('완료 처리 실패: ' + err.message);
          }
        }
      });
    }
  });
}

export function initKdsFilterListeners(state) {
  const filterBtns = document.querySelectorAll('#kds-filter-buttons button');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-kds-filter');
      setKdsFilter(filter, state);
    });
  });
}
