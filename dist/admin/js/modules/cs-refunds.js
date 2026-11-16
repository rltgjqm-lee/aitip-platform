/**
 * AITIP Platform Admin - Zero-PII CS 분쟁·환불 & 고객 UID 관제 (ESM)
 * Search-First + Server Pagination 원칙 준수 (나열식 드롭다운 제거)
 * 개인정보(이름·전화번호·주소)를 서버에 저장하지 않고 order_id(ord_...) + customer_uid(cust_...)로만 처리
 */

import { adminApi } from '../admin-api.js';

let searchQuery = '';
let orderPage = 1;
const orderLimit = 5;

export async function renderCsRefundsView(container) {
  if (!container) return;
  const res = await adminApi.getCsDisputes({ q: searchQuery, page: orderPage, limit: orderLimit });
  const disputes = res.disputes || [];
  const blacklisted = new Set(res.blacklisted_uids || []);
  const recentOrders = res.recent_orders || [];
  const ordersTotal = Number(res.orders_total || recentOrders.length || 0);
  const totalPages = Math.max(1, Math.ceil(ordersTotal / orderLimit));

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="panel-card" style="padding: 16px 20px; background: #f8fafc; border: 1px solid var(--border-default);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 14px; font-weight: 900; color: var(--text-primary);">Zero-PII 주문 분쟁·환불 & 고객 UID 관제</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              서버에 고객 개인정보(전화번호·주소·이름)를 저장하지 않으며, 검색 기반(Search-First)으로 주문 UID(ord_) 및 익명 고객 UID(cust_)를 조회해 처리합니다.
            </div>
          </div>
          <span class="badge-status success" style="font-size: 11px;">Zero-PII · Search-First</span>
        </div>
      </div>

      <div id="cs-action-error" style="display: none; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; font-size: 12.5px; font-weight: 700;"></div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="panel-card" style="padding: 18px;">
          <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">주문 검색 (Search-First) & 즉시 PG 환불</div>

          <!-- 검색 바 -->
          <div style="display: flex; gap: 6px; margin-bottom: 8px;">
            <input id="cs-order-search-input" type="text" value="${searchQuery}" placeholder="주문 UID(ord_...), 전표(A-53), 고객 UID(cust_...) 검색" style="flex: 1; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
            <button type="button" id="btn-cs-order-search" class="header-btn" style="background: #0f172a; color: #ffffff; padding: 7px 12px; font-size: 12px;">검색</button>
          </div>

          <!-- 서버 페이징 검색 결과 -->
          <div style="border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px; overflow: hidden;">
            <div style="max-height: 145px; overflow-y: auto; divide-y: 1px solid #f1f5f9;">
              ${recentOrders.length === 0 ? '<div style="padding: 12px; font-size: 12px; color: var(--text-muted); text-align: center;">검색 결과가 없습니다.</div>' : recentOrders.map(o => `
                <button type="button" class="btn-pick-cs-order" data-orderid="${o.order_id}" data-uid="${o.customer_uid}" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; border: none; border-bottom: 1px solid #f1f5f9; background: #ffffff; cursor: pointer; font-size: 12px; text-align: left;">
                  <span><b>${o.short_display_id || '-'}</b> · <code>${o.order_id}</code></span>
                  <span>${Number(o.amount || 0).toLocaleString()}원 (${o.status})</span>
                </button>
              `).join('')}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8fafc; font-size: 11px; color: var(--text-muted);">
              <span>검색 결과 ${ordersTotal}건 (${orderPage} / ${totalPages}쪽)</span>
              <div style="display: flex; gap: 4px;">
                <button type="button" id="btn-cs-order-prev" class="header-btn" style="padding: 2px 8px; font-size: 11px;" ${orderPage <= 1 ? 'disabled' : ''}>이전</button>
                <button type="button" id="btn-cs-order-next" class="header-btn" style="padding: 2px 8px; font-size: 11px;" ${orderPage >= totalPages ? 'disabled' : ''}>다음</button>
              </div>
            </div>
          </div>

          <form id="form-cs-refund" style="display: flex; flex-direction: column; gap: 10px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">선택된 주문 UID (ord_...)</label>
              <input id="cs-order-id" type="text" required value="${recentOrders[0]?.order_id || ''}" placeholder="위 검색 결과에서 주문을 클릭하거나 ord_... 직접 입력" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px; font-family: monospace; font-size: 12px;" />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">고객 UID (cust_...)</label>
                <input id="cs-customer-uid" type="text" value="${recentOrders[0]?.customer_uid || 'cust_01jcb_pwa_88412'}" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px; font-family: monospace; font-size: 12px;" />
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">환불 금액 (원)</label>
                <input id="cs-refund-amount" type="number" min="0" value="3000" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
              <div>
                <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">사유 코드</label>
                <select id="cs-reason-code" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;">
                  <option value="PARTIAL_COMP">부분 환불 보상</option>
                  <option value="FULL_CANCEL">전액 취소/환불</option>
                  <option value="DELIVERY_DELAY">배달 지연 보상</option>
                </select>
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">CS 처리 메모 (개인정보 입력 금지)</label>
                <input id="cs-memo" type="text" placeholder="예: 배달 지연으로 배달비 환불 처리" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
              <button type="submit" class="header-btn" style="background: #0f172a; color: #ffffff; padding: 8px 14px; font-weight: 700;">PG 환불 실행</button>
            </div>
          </form>
        </div>

        <div class="panel-card" style="padding: 18px;">
          <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">악성 클레임 UID 블랙리스트 관리</div>
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <input id="cs-blacklist-input" type="text" placeholder="차단/해제할 cust_... 입력" style="flex: 1; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px; font-family: monospace; font-size: 12px;" />
            <button type="button" id="btn-cs-blacklist-toggle" class="header-btn" style="background: #dc2626; color: #ffffff; padding: 7px 12px; font-weight: 700;">차단 토글</button>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">현재 차단된 고객 UID (${blacklisted.size}건)</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${Array.from(blacklisted).length === 0 ? '<span style="font-size: 12px; color: var(--text-muted);">차단된 UID가 없습니다.</span>' : Array.from(blacklisted).map(uid => `
              <span class="badge-status danger" style="display: inline-flex; align-items: center; gap: 6px; font-family: monospace; font-size: 11.5px;">
                ${uid}
                <button type="button" class="btn-unblock-uid" data-uid="${uid}" style="border: none; background: transparent; color: inherit; cursor: pointer; font-weight: 900;">해제</button>
              </span>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel-card" style="padding: 16px;">
        <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">분쟁·환불 처리 이력 (${disputes.length}건)</div>
        <div class="data-table-wrapper">
          <table class="admin-table" style="font-size: 12.5px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>접수 ID</th>
                <th>주문 UID</th>
                <th>고객 UID</th>
                <th>사유</th>
                <th style="text-align: right;">환불액</th>
                <th style="text-align: center;">상태</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              ${disputes.map(d => `
                <tr>
                  <td><code>${d.dispute_id}</code></td>
                  <td><code>${d.order_id}</code></td>
                  <td><code>${d.customer_uid}</code></td>
                  <td>${d.reason_label || d.reason_code}</td>
                  <td style="text-align: right; font-weight: 700;">${Number(d.refunded_amount || d.requested_amount || 0).toLocaleString()}원</td>
                  <td style="text-align: center;">
                    <span class="badge-status ${d.status === 'REFUNDED' ? 'success' : 'warning'}">${d.status}</span>
                  </td>
                  <td>${d.memo || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const showErr = (msg) => {
    const el = container.querySelector('#cs-action-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  };

  container.querySelector('#btn-cs-order-search')?.addEventListener('click', async () => {
    searchQuery = container.querySelector('#cs-order-search-input')?.value?.trim() || '';
    orderPage = 1;
    await renderCsRefundsView(container);
  });

  container.querySelector('#btn-cs-order-prev')?.addEventListener('click', async () => {
    if (orderPage > 1) {
      orderPage -= 1;
      await renderCsRefundsView(container);
    }
  });

  container.querySelector('#btn-cs-order-next')?.addEventListener('click', async () => {
    if (orderPage < totalPages) {
      orderPage += 1;
      await renderCsRefundsView(container);
    }
  });

  container.querySelectorAll('.btn-pick-cs-order').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderInput = container.querySelector('#cs-order-id');
      const uidInput = container.querySelector('#cs-customer-uid');
      if (orderInput) orderInput.value = btn.dataset.orderid || '';
      if (uidInput && btn.dataset.uid) uidInput.value = btn.dataset.uid;
    });
  });

  container.querySelector('#form-cs-refund')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await adminApi.executeOrderRefund({
        order_id: container.querySelector('#cs-order-id')?.value?.trim(),
        customer_uid: container.querySelector('#cs-customer-uid')?.value?.trim(),
        refund_amount: Number(container.querySelector('#cs-refund-amount')?.value || 0),
        reason_code: container.querySelector('#cs-reason-code')?.value,
        memo: container.querySelector('#cs-memo')?.value
      });
      await renderCsRefundsView(container);
    } catch (err) {
      showErr(err.message);
    }
  });

  container.querySelector('#btn-cs-blacklist-toggle')?.addEventListener('click', async () => {
    const val = container.querySelector('#cs-blacklist-input')?.value?.trim();
    if (!val) return;
    try {
      await adminApi.toggleCustomerBlacklist(val);
      await renderCsRefundsView(container);
    } catch (err) {
      showErr(err.message);
    }
  });

  container.querySelectorAll('.btn-unblock-uid').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await adminApi.toggleCustomerBlacklist(btn.getAttribute('data-uid'));
        await renderCsRefundsView(container);
      } catch (err) {
        showErr(err.message);
      }
    });
  });
}
