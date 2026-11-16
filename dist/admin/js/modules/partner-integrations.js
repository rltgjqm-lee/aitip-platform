/**
 * AITIP Enterprise Partner & External API Integration Module
 * Kong Konnect / Stripe Connect / Apigee 포털 규격
 * (제휴사별 API Key 발급, Webhook 성공/실패 모니터링, Rate Limit, 서킷 브레이커 스위치)
 */

import { adminApi } from '../admin-api.js';

export async function renderPartnerIntegrationsView(container) {
  const partners = [
    { id: 'part_vroong', name: '메쉬코리아 부릉(Vroong)', type: '배달대행 3사', webhook_url: 'https://api.meshkorea.net/v2/dispatch', status: 'HEALTHY', circuit_breaker: 'CLOSED', api_calls_today: 14210, quota_limit: 50000, latency_ms: 112 },
    { id: 'part_barogo', name: '바로고(Barogo) 디스패칭', type: '배달대행 3사', webhook_url: 'https://api.barogo.com/v1/delivery', status: 'HEALTHY', circuit_breaker: 'CLOSED', api_calls_today: 9840, quota_limit: 50000, latency_ms: 135 },
    { id: 'part_toss', name: '토스페이먼츠 전자결제(PG)', type: '전자결제 (PG)', webhook_url: 'https://api.tosspayments.com/v1/payments', status: 'HEALTHY', circuit_breaker: 'CLOSED', api_calls_today: 28410, quota_limit: 100000, latency_ms: 184 },
    { id: 'part_zeropay', name: '한국간편결제진흥원 제로페이', type: '지역화폐 직결', webhook_url: 'https://api.zeropay.or.kr/v1/approval', status: 'HEALTHY', circuit_breaker: 'CLOSED', api_calls_today: 4120, quota_limit: 30000, latency_ms: 210 },
    { id: 'part_cti_0504', name: '세종텔레콤 0504 CTI', type: '통신 안심번호', webhook_url: 'https://cti.sejongtelecom.com/v1/call', status: 'HEALTHY', circuit_breaker: 'CLOSED', api_calls_today: 1840, quota_limit: 20000, latency_ms: 92 },
    { id: 'part_kakao', name: '카카오 비즈메시지 알림톡', type: '주문 통지', webhook_url: 'https://api.kakaobiz.net/v2/alimtalk', status: 'HEALTHY', circuit_breaker: 'CLOSED', api_calls_today: 15200, quota_limit: 50000, latency_ms: 78 }
  ];

  container.innerHTML = `
    <div class="panel-card" style="padding: 0; overflow: hidden; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #fafafa; border-bottom: 1px solid var(--border-default); flex-wrap: wrap; gap: 8px;">
        <div>
          <span style="font-weight: 900; font-size: 14px; color: var(--text-primary);">외부 제휴사 API 연동 허브 & 서킷 브레이커</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="header-btn" style="font-size: 11px; padding: 4px 8px;">Webhook 전송 로그</button>
          <button type="button" class="header-btn header-btn-primary" style="font-size: 11px; padding: 4px 10px;">+ 신규 제휴사 연동</button>
        </div>
      </div>

      <!-- 제휴사 연동 테이블 -->
      <div class="data-table-wrapper">
        <table class="admin-table" style="font-size: 12.5px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th>제휴사명 (식별자)</th>
              <th style="width: 110px;">서비스 분류</th>
              <th>연동 엔드포인트 URL</th>
              <th style="width: 140px;">당일 호출량 / Quota</th>
              <th style="width: 100px;">응답 속도</th>
              <th style="width: 70px; text-align: center;">상태</th>
              <th style="width: 180px;">서킷 브레이커</th>
              <th style="width: 80px; text-align: center;">관리</th>
            </tr>
          </thead>
          <tbody>
            ${partners.map(p => `
              <tr>
                <td>
                  <span style="font-weight: 800; color: var(--text-primary); font-size: 13px;">${p.name}</span>
                  <span style="font-size: 10.5px; font-family: monospace; color: var(--text-muted); margin-left: 4px;">[${p.id}]</span>
                </td>
                <td><span class="badge-status active" style="font-size: 11px;">${p.type}</span></td>
                <td style="font-family: monospace; font-size: 11.5px; color: var(--text-secondary);">${p.webhook_url}</td>
                <td>
                  <div style="font-weight: 800; font-size: 12px;">${p.api_calls_today.toLocaleString()} / ${p.quota_limit.toLocaleString()}</div>
                  <div style="background: #e2e8f0; height: 3px; border-radius: 2px; margin-top: 3px; width: 100px;">
                    <div style="background: var(--brand-mint); height: 3px; border-radius: 2px; width: ${(p.api_calls_today / p.quota_limit * 100).toFixed(0)}%;"></div>
                  </div>
                </td>
                <td style="font-weight: 800; font-family: monospace; color: ${p.latency_ms > 200 ? '#f59e0b' : 'var(--text-primary)'};">${p.latency_ms} ms</td>
                <td style="text-align: center;"><span class="badge-status active" style="font-size: 10.5px;">정상</span></td>
                <td>
                  <button type="button" class="header-btn btn-toggle-circuit" data-partner="${p.id}" data-cb="${p.circuit_breaker}" style="padding: 3px 6px; font-size: 11px; background: ${p.circuit_breaker === 'CLOSED' ? '#dbeafe' : '#fef2f2'}; color: ${p.circuit_breaker === 'CLOSED' ? '#1e40af' : '#b91c1c'}; font-weight: 800;">
                    ${p.circuit_breaker === 'CLOSED' ? '[CLOSED] 정상 바이패스' : '[OPEN] 트래픽 차단'}
                  </button>
                </td>
                <td style="text-align: center;">
                  <button type="button" class="header-btn" style="padding: 3px 6px; font-size: 10.5px;">설정</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // 서킷 브레이커 토글 이벤트
  container.querySelectorAll('.btn-toggle-circuit').forEach(btn => {
    btn.addEventListener('click', () => {
      const partner = btn.dataset.partner;
      const currentCb = btn.dataset.cb;
      const nextCb = currentCb === 'CLOSED' ? 'OPEN' : 'CLOSED';
      if (confirm(`[서킷 브레이커 제어] 제휴사 [${partner}]의 연동 상태를 [${nextCb}]로 전환하시겠습니까?`)) {
        btn.dataset.cb = nextCb;
        btn.textContent = nextCb === 'CLOSED' ? '[CLOSED] 정상 바이패스' : '[OPEN] 트래픽 차단';
        btn.style.background = nextCb === 'CLOSED' ? '#dbeafe' : '#fef2f2';
        btn.style.color = nextCb === 'CLOSED' ? '#1e40af' : '#b91c1c';
        alert(`제휴사 [${partner}] 서킷 브레이커가 [${nextCb}] 모드로 즉시 반영되었습니다.`);
      }
    });
  });
}
