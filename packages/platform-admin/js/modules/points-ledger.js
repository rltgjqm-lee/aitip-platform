/**
 * AITIP Platform Admin - Zero-PII 포인트 원장 & 어뷰징 관제 (ESM)
 * 고객 개인정보 없이 customer_uid(cust_...) 기준 서버 원장 관리
 */

import { adminApi } from '../admin-api.js';

export async function renderPointsLedgerView(container) {
  if (!container) return;
  const res = await adminApi.getPointLedger();
  const policy = res.policy || {};
  const ledger = res.ledger || [];
  const balances = res.balances || {};
  const totalLiability = Number(res.total_liability || 0);

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        <div class="panel-card" style="padding: 16px;">
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 700;">총 포인트 발행 잔액 (플랫폼 충당부채)</div>
          <div style="font-size: 22px; font-weight: 900; margin-top: 6px; color: #0f172a;">${totalLiability.toLocaleString()} P</div>
        </div>
        <div class="panel-card" style="padding: 16px;">
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 700;">활성 포인트 보유 고객 UID</div>
          <div style="font-size: 22px; font-weight: 900; margin-top: 6px; color: #0f172a;">${Object.keys(balances).length}명</div>
        </div>
        <div class="panel-card" style="padding: 16px;">
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 700;">기본 적립률 / 최소 사용</div>
          <div style="font-size: 22px; font-weight: 900; margin-top: 6px; color: #059669;">${policy.earn_rate_pct ?? 1}% / ${Number(policy.min_use_points ?? 1000).toLocaleString()}P</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="panel-card" style="padding: 18px;">
          <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">포인트 운영 정책 (어뷰징 방지 포함)</div>
          <form id="form-point-policy" style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">실결제 적립률 (%)</label>
                <input id="pt-earn-rate" type="number" step="0.1" value="${policy.earn_rate_pct ?? 1.0}" style="width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">최소 사용 (P)</label>
                <input id="pt-min-use" type="number" value="${policy.min_use_points ?? 1000}" style="width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">유효기간 (일)</label>
                <input id="pt-expiry-days" type="number" value="${policy.expiry_days ?? 365}" style="width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
              <input id="pt-require-hash" type="checkbox" ${policy.require_hash_auth !== false ? 'checked' : ''} />
              단방향 해시 인증 기반 1인 1 UID 적립 제한 (무단 캐시 초기화 어뷰징 차단)
            </label>
            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="header-btn" style="background: #0f172a; color: #ffffff; padding: 7px 14px; font-weight: 700;">정책 저장</button>
            </div>
          </form>
        </div>

        <div class="panel-card" style="padding: 18px;">
          <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">고객 UID 기준 수동 지급 / 어뷰징 회수</div>
          <form id="form-point-adjust" style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">고객 UID (cust_...)</label>
                <input id="pt-adj-uid" type="text" value="cust_01jcb_pwa_88412" style="width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-family: monospace; font-size: 12px;" />
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">증감 포인트 (+/-)</label>
                <input id="pt-adj-delta" type="number" value="1000" style="width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 8px;">
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">부담 주체</label>
                <select id="pt-adj-bearer" style="width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px;">
                  <option value="PLATFORM">본사 부담</option>
                  <option value="MERCHANT">가맹점 분담</option>
                </select>
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">사유 메모</label>
                <input id="pt-adj-memo" type="text" placeholder="예: CS 지연 보상 지급" style="width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="header-btn" style="background: #059669; color: #ffffff; padding: 7px 14px; font-weight: 700;">원장 반영</button>
            </div>
          </form>
        </div>
      </div>

      <div class="panel-card" style="padding: 16px;">
        <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">서버 포인트 원장 (Zero-PII Ledger)</div>
        <div class="data-table-wrapper">
          <table class="admin-table" style="font-size: 12.5px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>원장 TX</th>
                <th>고객 UID</th>
                <th>유형</th>
                <th>부담 주체</th>
                <th style="text-align: right;">변동</th>
                <th style="text-align: right;">변동 후 잔액</th>
                <th>사유</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.map(tx => `
                <tr>
                  <td><code>${tx.tx_id}</code></td>
                  <td><code>${tx.customer_uid}</code></td>
                  <td><span class="badge-status default">${tx.type}</span></td>
                  <td>${tx.bearer === 'MERCHANT' ? '가맹점' : '본사(플랫폼)'}</td>
                  <td style="text-align: right; font-weight: 800; color: ${tx.delta >= 0 ? '#059669' : '#dc2626'};">
                    ${tx.delta >= 0 ? '+' : ''}${Number(tx.delta).toLocaleString()} P
                  </td>
                  <td style="text-align: right; font-weight: 700;">${Number(tx.balance_after).toLocaleString()} P</td>
                  <td>${tx.memo || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const policyForm = container.querySelector('#form-point-policy');
  if (policyForm) {
    policyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await adminApi.updatePointPolicy({
        earn_rate_pct: Number(container.querySelector('#pt-earn-rate')?.value || 1),
        min_use_points: Number(container.querySelector('#pt-min-use')?.value || 1000),
        expiry_days: Number(container.querySelector('#pt-expiry-days')?.value || 365),
        require_hash_auth: Boolean(container.querySelector('#pt-require-hash')?.checked)
      });
      await renderPointsLedgerView(container);
    });
  }

  const adjForm = container.querySelector('#form-point-adjust');
  if (adjForm) {
    adjForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await adminApi.adjustCustomerPoints({
        customer_uid: container.querySelector('#pt-adj-uid')?.value?.trim(),
        delta: Number(container.querySelector('#pt-adj-delta')?.value || 0),
        bearer: container.querySelector('#pt-adj-bearer')?.value,
        memo: container.querySelector('#pt-adj-memo')?.value
      });
      await renderPointsLedgerView(container);
    });
  }
}
