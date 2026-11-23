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
import { renderMartChannelAssignView } from './modules/channel-assign.js';
import { renderMartDailyPriceView } from './modules/daily-price.js';
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

function showMartOrderToast(order = {}) {
  const prev = document.getElementById('mart-realtime-toast');
  if (prev) prev.remove();
  const el = document.createElement('div');
  el.id = 'mart-realtime-toast';
  el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:1200;background:#0f172a;color:#fff;padding:12px 16px;border-radius:10px;border-left:4px solid #22c55e;box-shadow:0 10px 25px rgba(15,23,42,0.25);font-size:13px;line-height:1.4;';
  const buyer = String(order.buyer_name || '신규 고객').replace(/</g, '&lt;');
  const amt = Number(order.total_amount || 0).toLocaleString();
  el.innerHTML = `<div style="font-weight:800;color:#4ade80;">[신규 주문 접수]</div><div style="margin-top:2px;">${buyer} · ${amt}원</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function connectMartPortalRealtime() {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
  let pingTimer = null;
  let opened = false;
  try {
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${location.host}/ws/realtime`);
    ws.addEventListener('open', () => {
      opened = true;
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'aitip/marts/+/orders' }));
      ws.send(JSON.stringify({ type: 'subscribe', topic: 'aitip/marts/+/catalog' }));
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 30000);
    });
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg?.topic) return;
        if (msg.topic.endsWith('/orders') && msg.payload?.event === 'ORDER_CREATED') {
          showMartOrderToast(msg.payload?.order);
        }
        const hasOpenDrawer = Boolean(document.querySelector('.mc-drawer-backdrop'));
        if (hasOpenDrawer) return;
        if (msg.topic.endsWith('/orders') && ['orders', 'orders-online', 'orders-offline', 'picking', 'boxing', 'settle'].includes(currentView)) {
          renderCurrentView();
        } else if (msg.topic.endsWith('/catalog') && ['catalog', 'channel-assign', 'daily-price', 'flyer', 'pwa-control'].includes(currentView)) {
          renderCurrentView();
        }
      } catch (_) {}
    });
    ws.addEventListener('close', () => {
      if (pingTimer) clearInterval(pingTimer);
      if (opened) setTimeout(connectMartPortalRealtime, 5000);
    });
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
  } else if (currentView === 'channel-assign') {
    await renderMartChannelAssignView(container);
  } else if (currentView === 'daily-price') {
    await renderMartDailyPriceView(container);
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
