/**
 * ============================================================================
 * AITIP Master Admin - Module 01: Master BI Dashboard (ESM)
 * Design Standard: DOC-18 Chapter 10 (AITIP Official White & Mint Master Dashboard)
 * ============================================================================
 */

export function renderMasterDashboard(container, data) {
  if (!container || !data) return;

  const m = data.metrics || {};
  const multi = m.multi_asset_today || {};
  const orders = data.recent_orders || [];
  const gateways = data.gateways_health || [];

  container.innerHTML = `
    <!-- Top 4 Primary Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card accent-mint">
        <div class="metric-label">당일 전국 총 거래액 (GMV)</div>
        <div class="metric-value-row">
          <span class="metric-value">${(m.total_gmv_today || 0).toLocaleString()}원</span>
        </div>
        <div class="metric-sub">
          <span class="trend-up">▲ 14.8%</span>
          <span>전주 동요일 대비 증가</span>
        </div>
      </div>

      <div class="metric-card accent-mint">
        <div class="metric-label">당일 총 인입 주문수</div>
        <div class="metric-value-row">
          <span class="metric-value">${(m.total_orders_today || 0).toLocaleString()}건</span>
        </div>
        <div class="metric-sub">
          <span>배달 72% · 포장 18% · 홀식사 10%</span>
        </div>
      </div>

      <div class="metric-card accent-mint">
        <div class="metric-label">실시간 활성 스마트 단말기</div>
        <div class="metric-value-row">
          <span class="metric-value">${m.active_terminals || 0}대</span>
          <span style="font-size: 13px; font-weight: 700; color: var(--brand-mint-text);">가동률 ${m.terminal_uptime_rate || 0}%</span>
        </div>
        <div class="metric-sub">
          <span>전국 350대 중 342대 MQTT 온라인</span>
        </div>
      </div>

      <div class="metric-card accent-orange">
        <div class="metric-label">전국 가맹점 및 심사 대기</div>
        <div class="metric-value-row">
          <span class="metric-value">${m.active_merchants || 0}개소</span>
          <span class="badge-status pending">심사대기 ${m.pending_approvals || 0}건</span>
        </div>
        <div class="metric-sub">
          <span>치킨/외식 280 · 하나로마트 48</span>
        </div>
      </div>
    </div>

    <!-- Dashboard Content Row: Multi-Asset Breakdown vs Gateway Health -->
    <div class="dashboard-row">
      <!-- Left: Multi-Asset Settlement Share -->
      <div class="panel-card">
        <div class="panel-header">
          <span class="panel-title">다중 자산 결제 수단별 점유율 (Multi-Asset Engine)</span>
          <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">오늘 00:00 ~ 현재</span>
        </div>
        <div class="panel-body">
          <div class="asset-bar-group">
            <div class="asset-bar-item">
              <div class="asset-bar-header">
                <span style="color: #1E40AF;">신용·체크카드 (기본 PG망)</span>
                <span>${(multi.credit_card?.amount || 0).toLocaleString()}원 (${multi.credit_card?.share_pct || 0}%)</span>
              </div>
              <div class="asset-progress-bg">
                <div class="asset-progress-fill fill-card" style="width: ${multi.credit_card?.share_pct || 0}%;"></div>
              </div>
            </div>

            <div class="asset-bar-item">
              <div class="asset-bar-header">
                <span style="color: var(--brand-mint-text);">지자체 지역화폐 (서울페이/경기지역화폐/온누리)</span>
                <span>${(multi.local_currency?.amount || 0).toLocaleString()}원 (${multi.local_currency?.share_pct || 0}%)</span>
              </div>
              <div class="asset-progress-bg">
                <div class="asset-progress-fill fill-local" style="width: ${multi.local_currency?.share_pct || 0}%;"></div>
              </div>
            </div>

            <div class="asset-bar-item">
              <div class="asset-bar-header">
                <span style="color: #b45309;">카드사 포인트 복합결제 (신한/현대/KB)</span>
                <span>${(multi.card_points?.amount || 0).toLocaleString()}원 (${multi.card_points?.share_pct || 0}%)</span>
              </div>
              <div class="asset-progress-bg">
                <div class="asset-progress-fill fill-point" style="width: ${multi.card_points?.share_pct || 0}%;"></div>
              </div>
            </div>

            <div class="asset-bar-item">
              <div class="asset-bar-header">
                <span style="color: #6B21A8;">스테이블 코인 (Web3 / USDT / USDC)</span>
                <span>${(multi.stablecoin?.amount || 0).toLocaleString()}원 (${multi.stablecoin?.share_pct || 0}%)</span>
              </div>
              <div class="asset-progress-bg">
                <div class="asset-progress-fill fill-coin" style="width: ${multi.stablecoin?.share_pct || 0}%;"></div>
              </div>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 12px; background: var(--slate-bg); border-radius: var(--radius-sm); font-size: 12px; color: var(--text-body);">
            * <strong>정산 원칙</strong>: 원가 기반 실비 정산 체계로, 카드사 우대 수수료(0.5~1.5%)와 온체인 가스비가 1원 단위로 자동 분리 대사됩니다.
          </div>
        </div>
      </div>

      <!-- Right: Third-Party Gateway Health Check -->
      <div class="panel-card">
        <div class="panel-header">
          <span class="panel-title">외부 연동 허브 헬스체크 (6대 Gateway)</span>
          <span class="system-status-indicator" style="font-size: 11px;">
            <span class="status-dot"></span>전 게이트웨이 정상
          </span>
        </div>
        <div class="panel-body" style="padding: 10px 20px;">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${gateways.map(g => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--slate-border);">
                <div>
                  <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">${g.name}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${g.category}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 11.5px; color: var(--text-muted); font-family: monospace;">${g.latency_ms}ms</span>
                  <span class="badge-status active">정상</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom: Nationwide Live Order Stream -->
    <div class="panel-card">
      <div class="panel-header">
        <span class="panel-title">전국 실시간 주문 스트림 (Live Orders)</span>
        <button class="header-btn" id="btn-refresh-orders" style="font-size: 12px; padding: 4px 10px;">새로고침</button>
      </div>
      <div class="data-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>주문번호</th>
              <th>가맹점명</th>
              <th>주문형태</th>
              <th>결제금액</th>
              <th>결제자산</th>
              <th>진행상태</th>
              <th>인입시각</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => {
              const statusMap = {
                ACCEPTED: { text: '주문접수', cls: 'active' },
                COOKING: { text: '조리중', cls: 'pending' },
                DELIVERING: { text: '배달중', cls: 'active' },
                COMPLETED: { text: '완료됨', cls: 'active' }
              };
              const st = statusMap[o.status] || { text: o.status, cls: 'pending' };
              return `
                <tr>
                  <td style="font-weight: 800; color: var(--brand-mint-text);">${o.id}</td>
                  <td style="font-weight: 700;">${o.store_name}</td>
                  <td><span style="background: var(--slate-bg); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700;">${o.fulfillment}</span></td>
                  <td style="font-weight: 800;">${o.amount.toLocaleString()}원</td>
                  <td>${o.asset}</td>
                  <td><span class="badge-status ${st.cls}">${st.text}</span></td>
                  <td style="color: var(--text-muted); font-size: 12px;">${o.created_at}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
