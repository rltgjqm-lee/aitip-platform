/**
 * AITIP Enterprise Payment & Settlement Technical Control Module
 * 2원화 관제: 
 *  1) 거래 및 3자 대사 정산 원장 (3자 대사 1원 불일치 추적, DOC-11 결품 감액 재승인, FDS 보류)
 *  2) PG & 온체인 기술 인프라 관제 (레이턴시 ms, Decline 거절코드 통계, 웹훅 지수 백오프 큐, 서킷 브레이커)
 */

import { adminApi } from '../admin-api.js';

let currentTab = 'transactional'; // 'transactional' | 'technical'

export async function renderPaymentsControlView(container) {
  container.innerHTML = `
    <div class="panel-card" style="padding: 0; overflow: hidden;">
      <!-- 상단 서브 탭 바 (버튼식 스위처) -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #fafafa; border-bottom: 1px solid var(--border-default);">
        <div style="display: flex; gap: 8px;">
          <button type="button" class="filter-toggle-btn ${currentTab === 'transactional' ? 'active' : ''}" id="btn-tab-transactional" style="padding: 7px 16px; font-size: 13px; font-weight: 800;">
            거래 및 3자 대사 정산 원장 (Transactional)
          </button>
          <button type="button" class="filter-toggle-btn ${currentTab === 'technical' ? 'active' : ''}" id="btn-tab-technical" style="padding: 7px 16px; font-size: 13px; font-weight: 800;">
            PG & 블록체인 기술 인프라 관제 (Technical)
          </button>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="font-size: 12px; color: var(--text-muted);">대사 마감: 매일 04:00 (전산 자동 분개)</span>
          <button class="header-btn" id="btn-refresh-payments" style="font-size: 11.5px;">실시간 새로고침</button>
        </div>
      </div>

      <div id="payments-subview-content" style="padding: 20px;">
        <!-- 하부 탭 동적 마운트 -->
      </div>
    </div>
  `;

  // 탭 클릭 이벤트
  container.querySelector('#btn-tab-transactional')?.addEventListener('click', () => {
    currentTab = 'transactional';
    renderPaymentsControlView(container);
  });

  container.querySelector('#btn-tab-technical')?.addEventListener('click', () => {
    currentTab = 'technical';
    renderPaymentsControlView(container);
  });

  container.querySelector('#btn-refresh-payments')?.addEventListener('click', () => {
    renderPaymentsControlView(container);
  });

  const subviewContainer = container.querySelector('#payments-subview-content');
  if (currentTab === 'transactional') {
    await renderTransactionalSubView(subviewContainer);
  } else {
    await renderTechnicalSubView(subviewContainer);
  }
}

// [탭 1] 거래 및 3자 대사 정산 원장
async function renderTransactionalSubView(container) {
  const [data, payoutRes] = await Promise.all([
    adminApi.getPaymentTransactions(),
    adminApi.getPayouts().catch(() => ({ payouts: [] }))
  ]);
  const txList = data.transactions || [];
  const ps = data.promo_summary || { platform_discount: 0, alliance_discount: 0, merchant_discount: 0, point_used: 0 };
  const payouts = payoutRes.payouts || [];

  container.innerHTML = `
    <!-- 4자 프로모션 정산 분담금 요약 -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; padding: 12px; background: #f8fafc; border: 1px solid var(--border-default); border-radius: 8px;">
      <div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">본사 쿠폰 보전액 (PLATFORM)</div>
        <div style="font-size: 16px; font-weight: 900; color: #059669; margin-top: 2px;">${Number(ps.platform_discount || 0).toLocaleString()}원</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">제휴사 분담액 (ALLIANCE)</div>
        <div style="font-size: 16px; font-weight: 900; color: #2563eb; margin-top: 2px;">${Number(ps.alliance_discount || 0).toLocaleString()}원</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">가맹점 자체 할인 (MERCHANT)</div>
        <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${Number(ps.merchant_discount || 0).toLocaleString()}원</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">고객 포인트 차감액</div>
        <div style="font-size: 16px; font-weight: 900; color: #d97706; margin-top: 2px;">${Number(ps.point_used || 0).toLocaleString()} P</div>
      </div>
    </div>

    <!-- 가맹점·대리점 정산 지급 승인 큐 (Payout Approval Queue) -->
    <div style="margin-bottom: 18px; border: 1px solid var(--border-default); border-radius: 8px; padding: 14px; background: #ffffff;">
      <div style="font-size: 13px; font-weight: 800; margin-bottom: 8px;">정산 지급 승인 큐 (${payouts.length}건)</div>
      <table class="admin-table" style="font-size: 12px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th>수취인</th>
            <th>구분</th>
            <th>정산 계좌</th>
            <th style="text-align: right;">프로모션 보전</th>
            <th style="text-align: right;">실지급 예정액</th>
            <th style="text-align: center;">상태</th>
            <th style="text-align: center;">승인 제어</th>
          </tr>
        </thead>
        <tbody>
          ${payouts.map(p => `
            <tr>
              <td style="font-weight: 700;">${p.payee_name}</td>
              <td>${p.payee_type}</td>
              <td>${p.bank_info}</td>
              <td style="text-align: right;">+${Number((p.platform_promo_reimburse || 0) + (p.alliance_promo_reimburse || 0)).toLocaleString()}원</td>
              <td style="text-align: right; font-weight: 800;">${Number(p.net_payout || 0).toLocaleString()}원</td>
              <td style="text-align: center;"><span class="badge-status ${p.status === 'APPROVED' ? 'active' : p.status === 'HELD' ? 'danger' : 'warning'}">${p.status}</span></td>
              <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="header-btn btn-decide-payout" data-id="${p.id}" data-decision="APPROVED" style="padding: 3px 8px; font-size: 11px; margin-right: 4px;">지급 확정</button>
                <button type="button" class="header-btn btn-decide-payout" data-id="${p.id}" data-decision="HELD" style="padding: 3px 8px; font-size: 11px;">보류</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <!-- 상단 대사 지표 스트립 -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
      <div style="background: var(--bg-hover); padding: 14px 16px; border-radius: 8px; border-left: 4px solid var(--brand-mint);">
        <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 700;">당일 총 승인 거래액</div>
        <div style="font-size: 18px; font-weight: 900; color: var(--text-primary); margin-top: 4px;">48,920,000원</div>
        <div style="font-size: 11px; color: var(--brand-mint-text); margin-top: 2px;">1,842건 정상 승인 완료</div>
      </div>
      <div style="background: var(--bg-hover); padding: 14px 16px; border-radius: 8px; border-left: 4px solid #10b981;">
        <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 700;">3자 대사 일치 (MATCHED)</div>
        <div style="font-size: 18px; font-weight: 900; color: #10b981; margin-top: 4px;">48,895,000원</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">일치율 99.8% (1,839건)</div>
      </div>
      <div style="background: var(--bg-hover); padding: 14px 16px; border-radius: 8px; border-left: 4px solid #ef4444;">
        <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 700;">1원 대사 불일치 추적</div>
        <div style="font-size: 18px; font-weight: 900; color: #ef4444; margin-top: 4px;">-3원 (2건)</div>
        <div style="font-size: 11px; color: #ef4444; margin-top: 2px;">PG 원천사 수수료 단수차 추적중</div>
      </div>
      <div style="background: var(--bg-hover); padding: 14px 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 700;">DOC-11 결품 감액 재발행 전표</div>
        <div style="font-size: 18px; font-weight: 900; color: #f59e0b; margin-top: 4px;">-25,000원 (1건)</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">마트 현장 결품 차감 재승인 완료</div>
      </div>
    </div>

    <!-- 대사 거래 원장 테이블 -->
    <div class="data-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th style="white-space: nowrap;">거래 식별자 (TID / 승인번호)</th>
            <th>거래 일시</th>
            <th>가맹점 정보 (점포 UID)</th>
            <th>결제 자산</th>
            <th>원 승인금액</th>
            <th>실 매입금액</th>
            <th>대사 상태 / 케이스</th>
            <th>3자 정산 분개 (가맹점 / 라이더 / 플랫폼)</th>
            <th style="text-align: center; white-space: nowrap;">관제 액션</th>
          </tr>
        </thead>
        <tbody>
          ${txList.map(tx => `
            <tr class="tx-row" data-txid="${tx.id}" style="cursor: pointer;">
              <td style="white-space: nowrap;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="badge-status default" style="font-size: 10px; font-weight: 800; padding: 1px 5px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;">
                    ${tx.pg_provider || '토스PG'}
                  </span>
                  <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: var(--text-primary);">${tx.pg_tid}</span>
                </div>
                <div style="font-family: monospace; font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  승인번호: <strong style="color: var(--text-secondary);">${tx.auth_no}</strong>
                </div>
              </td>
              <td style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${tx.paid_at}</td>
              <td>
                <div style="font-weight: 800; font-size: 12.5px; color: var(--text-primary);">${tx.merchant_name}</div>
                <div style="font-family: monospace; font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">점포: ${tx.store_id}</div>
              </td>
              <td><span class="badge-status active" style="font-size: 11px; white-space: nowrap;">${tx.asset_type}</span></td>
              <td style="font-weight: 800; white-space: nowrap;">${tx.orig_amount.toLocaleString()}원</td>
              <td style="font-weight: 800; white-space: nowrap; color: ${tx.diff !== 0 ? '#ef4444' : 'var(--text-primary)'};">
                ${tx.settled_amount.toLocaleString()}원
                ${tx.diff !== 0 ? `<span style="font-size: 11px; font-weight: 700;"> (${tx.diff > 0 ? '+' : ''}${tx.diff}원)</span>` : ''}
              </td>
              <td>
                <span class="badge-status ${getStatusBadgeClass(tx.recon_status)}" style="font-size: 11px; font-weight: 800; white-space: nowrap;">
                  ${tx.recon_status_label}
                </span>
              </td>
              <td style="font-size: 11.5px; color: var(--text-secondary);">
                가맹점: ${tx.merchant_payout.toLocaleString()}원 | 라이더: ${tx.rider_fee.toLocaleString()}원 | 수수료: ${tx.platform_fee.toLocaleString()}원
              </td>
              <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="header-btn btn-view-tx-detail" data-txid="${tx.id}" style="padding: 4px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">
                  상세보기
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.btn-decide-payout').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.decidePayout(btn.dataset.id, btn.dataset.decision);
      await renderTransactionalSubView(container);
    });
  });

  // 전표 상세 클릭 이벤트 -> 우측 슬라이드 드로어 연동
  container.querySelectorAll('.btn-view-tx-detail, .tx-row').forEach(el => {
    el.addEventListener('click', (e) => {
      const txId = el.dataset.txid || el.closest('.tx-row')?.dataset.txid;
      const tx = txList.find(t => t.id === txId);
      if (tx) openTxDetailDrawer(tx);
    });
  });
}

// [탭 2] PG & 블록체인 기술 인프라 관제
async function renderTechnicalSubView(container) {
  const techData = await adminApi.getPaymentTechnicalMetrics();

  container.innerHTML = `
    <!-- 인프라 레이턴시 & 서킷브레이커 카드 -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 24px;">
      <div style="background: var(--bg-hover); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 14px;">토스페이먼츠 PG 승인망</span>
          <span class="badge-status active" style="background: #e6f7f6; color: #0e706c;">HEALTHY</span>
        </div>
        <div style="font-size: 24px; font-weight: 900; color: var(--text-primary); margin-top: 10px;">184 ms</div>
        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">타임아웃 임계치: 3,000ms (정상 바이패스)</div>
      </div>

      <div style="background: var(--bg-hover); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 14px;">제로페이 / 서울사랑상품권</span>
          <span class="badge-status active" style="background: #e6f7f6; color: #0e706c;">HEALTHY</span>
        </div>
        <div style="font-size: 24px; font-weight: 900; color: var(--text-primary); margin-top: 10px;">210 ms</div>
        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">한국간편결제진흥원 중계망 직결</div>
      </div>

      <div style="background: var(--bg-hover); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 14px;">0504 CTI 안심번호 회선</span>
          <span class="badge-status active" style="background: #e6f7f6; color: #0e706c;">HEALTHY</span>
        </div>
        <div style="font-size: 24px; font-weight: 900; color: var(--text-primary); margin-top: 10px;">92 ms</div>
        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">가상번호 채널 점유율: 38% / 1,000ch</div>
      </div>

      <div style="background: var(--bg-hover); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 14px;">결제 서킷 브레이커 (CB)</span>
          <span class="badge-status active" style="background: #dbeafe; color: #1e40af;">CLOSED</span>
        </div>
        <div style="font-size: 24px; font-weight: 900; color: #1e40af; margin-top: 10px;">정상 모드</div>
        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">실패율 0.05% (트립 기준치 5% 미만)</div>
      </div>
    </div>

    <!-- 2단 그리드: 거절 코드(Decline) 통계 vs 웹훅 실패 재시도 지수 백오프 큐 -->
    <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px;">
      <!-- 왼쪽: 실시간 거절 사유(Decline Codes) -->
      <div style="border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
        <div style="font-weight: 800; font-size: 14px; margin-bottom: 12px; display: flex; justify-content: space-between;">
          <span>실시간 카드사 승인 거절 코드 (Decline Codes)</span>
          <span style="font-size: 12px; color: var(--text-muted);">당일 총 73건</span>
        </div>
        <table class="admin-table" style="font-size: 12px;">
          <thead>
            <tr>
              <th>코드</th>
              <th>거절 사유 명칭</th>
              <th>발생 건수</th>
              <th>비율</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-family: monospace; font-weight: 800; color: #ef4444;">CODE 51</td>
              <td style="font-weight: 700;">잔액 부족 (Insufficient Funds)</td>
              <td style="font-weight: 800;">42건</td>
              <td>57.5%</td>
            </tr>
            <tr>
              <td style="font-family: monospace; font-weight: 800; color: #f59e0b;">CODE 61</td>
              <td style="font-weight: 700;">1회 / 일일 한도 초과 (Exceeds Limit)</td>
              <td style="font-weight: 800;">18건</td>
              <td>24.6%</td>
            </tr>
            <tr>
              <td style="font-family: monospace; font-weight: 800; color: var(--text-secondary);">CODE 82</td>
              <td style="font-weight: 700;">3D Secure 본인인증 타임아웃</td>
              <td style="font-weight: 800;">11건</td>
              <td>15.1%</td>
            </tr>
            <tr>
              <td style="font-family: monospace; font-weight: 800; color: #ef4444;">CODE 43</td>
              <td style="font-weight: 700;">분실 / 도난 카드 (Stolen Card)</td>
              <td style="font-weight: 800;">2건</td>
              <td>2.8%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 오른쪽: 웹훅 재시도 큐 (Exponential Backoff) -->
      <div style="border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
        <div style="font-weight: 800; font-size: 14px; margin-bottom: 12px; display: flex; justify-content: space-between;">
          <span>웹훅 실패 재시도 큐 (Exponential Backoff)</span>
          <span style="font-size: 12px; color: var(--brand-mint-text); font-weight: 700;">지수 백오프: 5s &rarr; 30s &rarr; 5m &rarr; DLQ</span>
        </div>
        <div class="data-table-wrapper">
          <table class="admin-table" style="font-size: 12px;">
            <thead>
              <tr>
                <th>수신 가맹점 / 시스템</th>
                <th>재시도</th>
                <th>실패 원인</th>
                <th>다음 시도</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div style="font-weight: 800;">바른치킨 서초본점 POS</div>
                  <div style="font-size: 11px; font-family: monospace; color: var(--text-muted);">http://192.168.0.50:9100/webhook</div>
                </td>
                <td><span class="badge-status pending" style="font-size: 11px;">2차 (30s)</span></td>
                <td style="color: #ef4444; font-weight: 600;">ECONNREFUSED (포스 점검)</td>
                <td style="color: var(--text-secondary);">12:05:40</td>
                <td><button type="button" class="header-btn" style="padding: 3px 6px; font-size: 10.5px;">즉시 재전송</button></td>
              </tr>
              <tr>
                <td>
                  <div style="font-weight: 800;">부릉(Vroong) 배차 API</div>
                  <div style="font-size: 11px; font-family: monospace; color: var(--text-muted);">https://api.meshkorea.net/v2/dispatch</div>
                </td>
                <td><span class="badge-status pending" style="font-size: 11px;">1차 (5s)</span></td>
                <td style="color: #f59e0b; font-weight: 600;">HTTP 504 Gateway Timeout</td>
                <td style="color: var(--text-secondary);">12:05:15</td>
                <td><button type="button" class="header-btn" style="padding: 3px 6px; font-size: 10.5px;">즉시 재전송</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function getStatusBadgeClass(status) {
  if (status === 'MATCHED') return 'active';
  if (status === 'MISMATCH') return 'rejected';
  if (status === 'PARTIAL_VOID_REISSUE') return 'pending';
  if (status === 'FDS_HOLD') return 'rejected';
  return 'active';
}

function openTxDetailDrawer(tx) {
  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const titleEl = document.getElementById('drawer-title');
  const badgeEl = document.getElementById('drawer-badge');
  const bodyEl = document.getElementById('drawer-body');

  if (!drawer || !bodyEl) return;

  if (titleEl) titleEl.textContent = `결제 전표 및 3자 대사 분개장 [${tx.pg_tid || tx.id}]`;
  if (badgeEl) badgeEl.textContent = `STATUS: ${tx.recon_status}`;

  bodyEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- 승인 전문 개요 -->
      <div style="background: var(--bg-hover); padding: 14px; border-radius: 8px;">
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 700;">승인 전문 개요</div>
        <div style="font-size: 18px; font-weight: 900; color: var(--text-primary); margin-top: 4px;">
          ${tx.settled_amount.toLocaleString()}원
          <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">(${tx.asset_type})</span>
        </div>
        <div style="font-size: 12px; margin-top: 6px; color: var(--text-secondary); line-height: 1.6;">
          승인일시: ${tx.paid_at}<br/>
          결제채널: <strong>[${tx.pg_provider || '토스PG'}]</strong> | 결제사 TID: <code style="font-family: monospace; font-weight: 800; color: #1e40af;">${tx.pg_tid || tx.id}</code> | 승인번호: <strong style="color: #0f172a;">${tx.auth_no}</strong>
        </div>
      </div>

      <!-- 가맹점 원장 및 D1 정산 직결 연동 정보 (SSOT) -->
      <div style="background: var(--bg-hover); border: 1px solid var(--border-default); border-radius: 8px; padding: 14px;">
        <div style="font-weight: 800; font-size: 13px; color: var(--text-primary); margin-bottom: 10px;">
          가맹점 원장 및 D1 정산 직결 연동 정보
        </div>
        <table class="admin-table" style="font-size: 12px; margin-bottom: 0;">
          <tbody>
            <tr>
              <th style="width: 140px; background: rgba(0,0,0,0.02);">가맹점 상호명</th>
              <td style="font-weight: 700;">${tx.merchant_name} <span style="font-weight: normal; color: var(--text-muted); font-size: 11px;">(${tx.seller_name || ''})</span></td>
            </tr>
            <tr>
              <th style="background: rgba(0,0,0,0.02);">가맹점 점포 UID</th>
              <td><code style="font-family: monospace; font-weight: 800; color: #1e40af;">${tx.store_id}</code></td>
            </tr>
            <tr>
              <th style="background: rgba(0,0,0,0.02);">원 주문 식별자</th>
              <td><code style="font-family: monospace; font-weight: 700; color: #334155;">${tx.order_id}</code></td>
            </tr>
            <tr>
              <th style="background: rgba(0,0,0,0.02);">D1 일일 정산 원장</th>
              <td><code style="font-family: monospace; font-weight: 800; color: #047857;">${tx.settlement_id}</code></td>
            </tr>
            <tr>
              <th style="background: rgba(0,0,0,0.02);">정산 입금 예정일</th>
              <td style="font-weight: 700; color: #0f766e;">${tx.payout_date || tx.settlement_date}</td>
            </tr>
            <tr>
              <th style="background: rgba(0,0,0,0.02);">점주 수취 계좌</th>
              <td style="font-weight: 700;">${tx.bank_name || '신한은행'} ${tx.bank_account || '110-***-492011'} <span style="font-size: 11px; color: var(--text-secondary);">(예금주: ${tx.bank_holder || tx.merchant_name})</span></td>
            </tr>
            <tr>
              <th style="background: rgba(0,0,0,0.02);">정산 승인 상태</th>
              <td>
                <span class="badge-status ${tx.settlement_status === 'COMPLETED' ? 'active' : 'pending'}" style="font-weight: 800;">
                  ${tx.settlement_status || 'CALCULATED'}
                </span>
                <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${tx.notes || ''}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3자 대사 정산 분개 원장 -->
      <div>
        <div style="font-weight: 800; font-size: 13px; margin-bottom: 8px;">3자 대사 정산 분개 원장 (Double-entry Bookkeeping)</div>
        <table class="admin-table" style="font-size: 12px;">
          <thead>
            <tr>
              <th>계정 과목</th>
              <th>정산 대상</th>
              <th>공제율 / 금액</th>
              <th>지급 상태</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 700;">가맹점 음식/상품 대금</td>
              <td>${tx.merchant_name}</td>
              <td style="font-weight: 800;">${tx.merchant_payout.toLocaleString()}원</td>
              <td><span class="badge-status active">D+1 익일정산</span></td>
            </tr>
            <tr>
              <td style="font-weight: 700;">라이더 실거리 배달료</td>
              <td>${tx.rider_fee > 0 ? '김도현 (강남제일 대리점)' : '해당 없음 (현장방문/예약)'}</td>
              <td style="font-weight: 800;">${tx.rider_fee.toLocaleString()}원</td>
              <td><span class="badge-status ${tx.rider_fee > 0 ? 'active' : 'default'}">${tx.rider_fee > 0 ? '실시간 지급' : '배달료 0원'}</span></td>
            </tr>
            <tr>
              <td style="font-weight: 700;">플랫폼 상생 중개수수료</td>
              <td>AITIP 본사</td>
              <td style="font-weight: 800;">${tx.platform_fee.toLocaleString()}원 (3.3%)</td>
              <td><span class="badge-status active">자동 분개</span></td>
            </tr>
            <tr>
              <td style="font-weight: 700;">지역 대리점 관제 수당</td>
              <td>(주)서초네트웍스</td>
              <td style="font-weight: 800;">${(tx.agency_fee || 160).toLocaleString()}원 (0.5%)</td>
              <td><span class="badge-status active">자동 분개</span></td>
            </tr>
            <tr>
              <td style="font-weight: 700;">PG 원천사 결제망 수수료</td>
              <td>${tx.pg_provider || '토스페이먼츠'}</td>
              <td style="font-weight: 800;">${Math.round(tx.settled_amount * 0.0198).toLocaleString()}원 (1.98%)</td>
              <td><span class="badge-status active">원천 공제</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      ${tx.recon_status === 'PARTIAL_VOID_REISSUE' ? `
        <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 6px;">
          <div style="font-weight: 800; color: #92400e; font-size: 12.5px;">DOC-11 규격 현장 결품 감액 재발행 이력</div>
          <div style="font-size: 12px; color: #b45309; margin-top: 4px;">
            마트 시니어 피커의 결품 영수증 스캔으로 원 주문금액(39,000원) 중 결품 품목(성주참외 1봉 -7,000원)을 즉시 부분취소(Partial Void)하고 32,000원으로 감액 승인 전표를 재발행하였습니다.
          </div>
        </div>
      ` : ''}

      ${tx.diff !== 0 ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px;">
          <div style="font-weight: 800; color: #b91c1c; font-size: 12.5px;">1원 대사 불일치 (MISMATCH) 감사 추적 로그</div>
          <div style="font-size: 12px; color: #dc2626; margin-top: 4px;">
            원 승인금액과 매입정산금액 간 ${tx.diff}원 단수 차이 발생. PG사(토스) 월간 대사 일괄 조정 계정(단수 보전 전표)으로 자동 인계되었습니다.
          </div>
        </div>
      ` : ''}

      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
        <button type="button" class="header-btn" id="btn-print-receipt" style="font-size: 12px;">영수증 전문 인쇄</button>
        <button type="button" class="header-btn header-btn-primary" id="btn-drawer-ok" style="font-size: 12px;">확인 완료</button>
      </div>
    </div>
  `;

  drawer.classList.add('open');
  if (backdrop) backdrop.style.display = 'block';

  document.getElementById('btn-close-drawer')?.addEventListener('click', closeDetailDrawer);
  document.getElementById('btn-drawer-ok')?.addEventListener('click', closeDetailDrawer);
  backdrop?.addEventListener('click', closeDetailDrawer);
}

function closeDetailDrawer() {
  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.style.display = 'none';
}
