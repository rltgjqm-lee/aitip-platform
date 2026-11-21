/**
 * AITIP Mart Portal Controller (ESM)
 * 위탁(대행) 운영 5대 메뉴 라우팅:
 *  1. catalog  : 상품 · 전처리 · 할인전단
 *  2. orders   : 주문 · 예약 · 기관 발주
 *  3. picking  : 피킹 & 결품 정정 (2단계 확장 예정)
 *  4. boxing   : 박싱(합포장) & 순회 배송 (2단계 확장 예정)
 *  5. settle   : 위탁 정산 & 보조금 대사 (2단계 확장 예정)
 */

import { renderMartInfoView } from './modules/mart-info.js';
import { renderMartCatalogView } from './modules/catalog.js';
import { renderMartPrepView } from './modules/prep-catalog.js';
import { renderMartFlyerView } from './modules/flyer-promo.js';
import { renderMartOrdersView } from './modules/orders.js';
import { renderMartPickingView } from './modules/picking.js';
import { renderMartBoxingView } from './modules/boxing.js';
import { renderMartSettlementView } from './modules/settlement.js';
import { renderMartPwaControlView } from './modules/pwa-control.js';

let currentView = 'catalog';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-group-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const grp = btn.closest('.nav-group');
      if (!grp) return;
      const collapsed = grp.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
  });

  document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      currentView = item.getAttribute('data-view') || 'catalog';
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      const crumb = document.getElementById('current-crumb');
      if (crumb) crumb.textContent = item.textContent.trim();
      renderCurrentView();
    });
  });

  renderCurrentView();
  connectMartPortalRealtime();
});

function connectMartPortalRealtime() {
  try {
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${location.host}/ws/realtime`);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'aitip/marts/+/orders' }));
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'aitip/marts/+/catalog' }));
    });
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg?.topic) return;
        const hasOpenDrawer = Boolean(document.querySelector('.mc-drawer-backdrop'));
        if (hasOpenDrawer) return;
        if (msg.topic.endsWith('/orders') && ['orders', 'orders-online', 'orders-offline', 'picking', 'boxing', 'settle'].includes(currentView)) {
          renderCurrentView();
        } else if (msg.topic.endsWith('/catalog') && ['catalog', 'flyer', 'pwa-control'].includes(currentView)) {
          renderCurrentView();
        }
      } catch (_) {}
    });
    ws.addEventListener('close', () => setTimeout(connectMartPortalRealtime, 5000));
  } catch (_) {}
}

async function renderCurrentView() {
  const container = document.getElementById('mart-main-container');
  if (!container) return;

  if (currentView === 'mart-info') {
    await renderMartInfoView(container);
  } else if (currentView === 'catalog') {
    await renderMartCatalogView(container);
  } else if (currentView === 'prep') {
    await renderMartPrepView(container);
  } else if (currentView === 'flyer') {
    await renderMartFlyerView(container);
  } else if (currentView === 'orders' || currentView === 'orders-online') {
    await renderMartOrdersView(container, 'ONLINE');
  } else if (currentView === 'orders-offline') {
    await renderMartOrdersView(container, 'OFFLINE');
  } else if (currentView === 'picking') {
    await renderMartPickingView(container);
  } else if (currentView === 'boxing') {
    await renderMartBoxingView(container);
  } else if (currentView === 'settle') {
    await renderMartSettlementView(container);
  } else if (currentView === 'pwa-control') {
    await renderMartPwaControlView(container);
  }
}
