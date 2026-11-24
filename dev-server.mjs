import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foodService } from './packages/services/food-delivery/backend/food-service.mjs';
import { martService } from './packages/services/mart-logistics/backend/mart-service.mjs';
import { mqttBridge } from './packages/core/realtime/mqtt-bridge.mjs';
import { ensureAdminState, saveAdminState, handleAdminApiRequest } from './packages/platform-admin/backend/admin-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present (without overriding existing env vars)
const ENV_PATH = path.join(__dirname, '.env');
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIdx = trimmed.indexOf('=');
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

const PORT = 8989;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Helper: JSON 요청 바디 파싱
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}


const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS 프리플라이트
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. API 헬스체크
  if (pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'UP',
      platform: 'AITIP-Platform',
      port: PORT,
      timestamp: new Date().toISOString(),
      services: {
        'food-delivery': 'ACTIVE',
        'mart-logistics': 'ACTIVE',
        'core-backbone': 'ACTIVE'
      }
    });
  }

  // --------------------------------------------------------------------------
  // 1-0. 플랫폼 슈퍼관리자 실데이터 직결 API (/api/admin/*)
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/admin/')) {
    const handled = await handleAdminApiRequest({ req, res, url, pathname, method, parseJsonBody, sendJson, foodService });
    if (handled !== false) return;
  }

  // --------------------------------------------------------------------------
  // 1-1. 외식업(Food Delivery) 백엔드 REST API
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/food/')) {
    try {
      // 1) 매장 정보
      if (pathname === '/api/food/store') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getStoreInfo());
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = foodService.updateStoreInfo(body);
          return sendJson(res, 200, { success: true, store: updated });
        }
      }

      // 1-1) 7일 요일별 영업시간 & 브레이크타임 (DOC-05 / schema_aitip_v01.sql 규격)
      if (pathname === '/api/food/store/hours') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getStoreHours());
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = foodService.updateStoreHours(body.hours || body);
          return sendJson(res, 200, { success: true, hours: updated });
        }
      }

      // 1-1-1) 배달 지역 및 배달팁 구간 영속화
      if (pathname === '/api/food/store/delivery-rules') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getDeliveryRules());
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = foodService.updateDeliveryRules(body);
          return sendJson(res, 200, { success: true, ...updated });
        }
      }

      // 1-2) 국경일 자동휴무 및 명절 원클릭 프리셋
      if (pathname === '/api/food/store/holidays') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getHolidaySettings());
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = foodService.updateHolidaySettings(body);
          return sendJson(res, 200, { success: true, ...updated });
        }
      }

      // 1-3) 개인사유 임시휴무 등록
      if (pathname === '/api/food/store/holidays/custom') {
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const item = foodService.addCustomClosure(body);
          return sendJson(res, 201, { success: true, closure: item });
        }
      }

      const customClosureMatch = pathname.match(/^\/api\/food\/store\/holidays\/custom\/([^/]+)$/);
      if (customClosureMatch && method === 'DELETE') {
        const closureId = customClosureMatch[1];
        const deleted = foodService.deleteCustomClosure(closureId);
        return sendJson(res, 200, { success: deleted });
      }

      // 1-4) 정산 대사 원장 및 부가세 세무 증빙 (D1 규격 실측 집계)
      if (pathname === '/api/food/settlement') {
        if (method === 'GET') {
          const year = Number(url.searchParams.get('year')) || 2026;
          const month = Number(url.searchParams.get('month')) || 11;
          const overview = foodService.getSettlementOverview({ year, month, policy: ensureAdminState().systemPolicies });
          return sendJson(res, 200, overview);
        }
      }

      // 1-5) 홈택스 표준 부가세 신고용 CSV 실물 다운로드
      if (pathname === '/api/food/settlement/tax-csv') {
        if (method === 'GET') {
          const year = Number(url.searchParams.get('year')) || 2026;
          const month = Number(url.searchParams.get('month')) || 11;
          const csvText = foodService.exportTaxCsv({ year, month });
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="hometax_vat_report_${year}_${month}.csv"`,
          });
          return res.end(csvText);
        }
      }

      // 2) 3단 메뉴 카탈로그
      if (pathname === '/api/food/menu') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getMenuCatalog());
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const newProduct = foodService.createMenuItem(body);
          return sendJson(res, 201, { success: true, product: newProduct });
        }
      }

      // 2-0-a) 메뉴 일괄 등록: POST /api/food/menu/bulk
      if (pathname === '/api/food/menu/bulk' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = foodService.createMenuItemsBulk(body.items);
        return sendJson(res, 201, { success: true, ...result });
      }

      // 2-0) 상품 이미지 업로드 (로컬 data/uploads 저장 · 상용 R2 호환 계약)
      if (pathname === '/api/food/upload-image' && method === 'POST') {
        const body = await parseJsonBody(req);
        const dataUrl = String(body.dataUrl || '');
        const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
          return sendJson(res, 400, { error: '지원하지 않는 이미지 형식입니다. (PNG/JPG/WebP/GIF)' });
        }
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
          return sendJson(res, 413, { error: '이미지 크기는 최대 5MB까지 업로드 가능합니다.' });
        }
        const uploadsDir = path.join(__dirname, 'packages', 'services', 'food-delivery', 'backend', 'data', 'uploads');
        fs.mkdirSync(uploadsDir, { recursive: true });
        const fileName = `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
        return sendJson(res, 201, { success: true, image_url: `/api/food/uploads/${fileName}` });
      }

      // 2-0-1) 업로드 이미지 정적 서빙
      const uploadMatch = pathname.match(/^\/api\/food\/uploads\/([A-Za-z0-9_.-]+)$/);
      if (uploadMatch && method === 'GET') {
        const safeName = path.basename(uploadMatch[1]);
        const filePath = path.join(__dirname, 'packages', 'services', 'food-delivery', 'backend', 'data', 'uploads', safeName);
        if (!fs.existsSync(filePath)) {
          return sendJson(res, 404, { error: '이미지를 찾을 수 없습니다.' });
        }
        const ext = path.extname(safeName).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
        return res.end(fs.readFileSync(filePath));
      }

      // 2-1) 카테고리 추가: POST /api/food/categories
      if (pathname === '/api/food/categories' && method === 'POST') {
        const body = await parseJsonBody(req);
        const newCategory = foodService.createCategory(body);
        return sendJson(res, 201, { success: true, category: newCategory });
      }

      // 2-2) 옵션그룹 추가: POST /api/food/option-groups
      if (pathname === '/api/food/option-groups' && method === 'POST') {
        const body = await parseJsonBody(req);
        const newGroup = foodService.createOptionGroup(body);
        return sendJson(res, 201, { success: true, option_group: newGroup });
      }

      // 3) 메뉴 가격 수정: /api/food/menu/:id/price
      const priceMatch = pathname.match(/^\/api\/food\/menu\/([^/]+)\/price$/);
      if (priceMatch && method === 'PATCH') {
        const productId = priceMatch[1];
        const body = await parseJsonBody(req);
        const updated = foodService.updateMenuItemPrice(productId, body.price, body.discounted_price);
        return sendJson(res, 200, { success: true, product: updated });
      }

      // 4) 메뉴 판매 상태 수정: /api/food/menu/:id/status
      const statusMatch = pathname.match(/^\/api\/food\/menu\/([^/]+)\/status$/);
      if (statusMatch && method === 'PATCH') {
        const productId = statusMatch[1];
        const body = await parseJsonBody(req);
        const updated = foodService.updateMenuItemStatus(productId, body.status);
        return sendJson(res, 200, { success: true, product: updated });
      }

      // 4-1) 메뉴 전체 수정 / 삭제: PUT / DELETE /api/food/menu/:id
      const menuItemMatch = pathname.match(/^\/api\/food\/menu\/([^/]+)$/);
      if (menuItemMatch && method === 'PUT') {
        const productId = menuItemMatch[1];
        const body = await parseJsonBody(req);
        const updated = foodService.updateMenuItem(productId, body);
        return sendJson(res, 200, { success: true, product: updated });
      }
      if (menuItemMatch && method === 'DELETE') {
        const productId = menuItemMatch[1];
        const removed = foodService.deleteMenuItem(productId);
        return sendJson(res, 200, { success: true, deleted_id: removed.product_id });
      }

      // 5) 실시간 주문 (KDS)
      if (pathname === '/api/food/orders/live' && method === 'GET') {
        return sendJson(res, 200, foodService.getLiveOrders());
      }

      // 5-0-0) 가맹점 공동 프로모션 참여 동의(Opt-in/Opt-out) API
      if (pathname === '/api/food/promotions/joint' && method === 'GET') {
        const adminState = ensureAdminState();
        const storeId = url.searchParams.get('store_id') || foodService.getStoreInfo()?.store_id || 'STR-11-650-01-56162-0001';
        const optOuts = new Set(adminState.merchantPromoOptOuts?.[storeId] || []);
        const list = (adminState.platformCoupons || [])
          .filter(c => c.status === 'ACTIVE')
          .map(c => ({ ...c, opted_in: !optOuts.has(c.id) }));
        return sendJson(res, 200, { success: true, store_id: storeId, promotions: list });
      }

      if (pathname === '/api/food/promotions/opt-in' && method === 'POST') {
        const body = await parseJsonBody(req);
        const adminState = ensureAdminState();
        const storeId = body?.store_id || foodService.getStoreInfo()?.store_id || 'STR-11-650-01-56162-0001';
        const couponId = body?.coupon_id;
        if (!couponId) return sendJson(res, 400, { error: 'coupon_id가 필요합니다.' });
        const list = adminState.merchantPromoOptOuts[storeId] || [];
        const idx = list.indexOf(couponId);
        let optedIn;
        if (idx >= 0) {
          list.splice(idx, 1);
          optedIn = true;
        } else {
          list.push(couponId);
          optedIn = false;
        }
        adminState.merchantPromoOptOuts[storeId] = list;
        saveAdminState();
        return sendJson(res, 200, { success: true, store_id: storeId, coupon_id: couponId, opted_in: optedIn });
      }

      // 5-0) 소비자 PWA 공개 피드 (배너·공지·점검모드·Zero-PII 포인트 잔액·적용가능 쿠폰): GET /api/food/public-feed
      if (pathname === '/api/food/public-feed' && method === 'GET') {
        const custUid = url.searchParams.get('customer_uid') || '';
        const storeId = url.searchParams.get('store_id') || foodService.getStoreInfo()?.store_id || 'STR-11-650-01-56162-0001';
        const adminState = ensureAdminState();
        const activeBanners = (adminState?.banners || []).filter(b => b.active);
        const optOuts = new Set(adminState?.merchantPromoOptOuts?.[storeId] || []);
        const platformCoupons = (adminState?.platformCoupons || []).filter(c => c.status === 'ACTIVE' && !optOuts.has(c.id));
        const merchantCoupons = typeof foodService.getCoupons === 'function' ? foodService.getCoupons() : [];
        const pointBalance = custUid && adminState?.pointLedger
          ? adminState.pointLedger
              .filter(tx => tx.customer_uid === custUid)
              .reduce((sum, tx) => sum + Number(tx.delta || 0), 0)
          : 0;
        return sendJson(res, 200, {
          success: true,
          customer_uid: custUid,
          point_balance: Math.max(0, pointBalance),
          banners: activeBanners,
          platform_coupons: platformCoupons,
          merchant_coupons: merchantCoupons,
          maintenance_mode: Boolean(adminState?.systemPolicies?.maintenance_mode),
          maintenance_notice: adminState?.systemPolicies?.maintenance_notice || ''
        });
      }

      // 5-1) 신규 주문 생성 (PWA / 모바일 웹): POST /api/food/orders
      if (pathname === '/api/food/orders' && method === 'POST') {
        const body = await parseJsonBody(req);
        const adminState = ensureAdminState();
        if (adminState?.systemPolicies?.maintenance_mode) {
          return sendJson(res, 503, { error: adminState.systemPolicies.maintenance_notice || '시스템 점검 중입니다.' });
        }
        if (body?.customer_uid && adminState?.blacklistedUids?.has(body.customer_uid)) {
          return sendJson(res, 403, { error: '이용이 제한된 고객 식별자(UID)입니다.' });
        }

        // 4자 프로모션 중복 규칙 검증 및 부담 주체 스냅샷 (플랫폼/제휴 1개 + 가맹점 1개 + 포인트)
        const ap = body?.applied_promotions || {};
        const itemsSubtotal = Array.isArray(body?.items)
          ? body.items.reduce((s, it) => s + (Number(it.total_price) || (Number(it.price || 0) * (Number(it.quantity) || 1))), 0)
          : 0;
        let platformDiscount = 0;
        let allianceDiscount = 0;
        let merchantDiscount = 0;
        let pointUsed = 0;

        if (ap.platform_coupon_id) {
          const pc = (adminState.platformCoupons || []).find(c => c.id === ap.platform_coupon_id && c.status === 'ACTIVE');
          if (pc && itemsSubtotal >= Number(pc.min_order_amount || 0)) {
            const amt = Number(pc.discount_amount || 0);
            const pRatio = Number(pc.cost_split?.platform ?? 100) / 100;
            const aRatio = Number(pc.cost_split?.alliance ?? 0) / 100;
            const mRatio = Number(pc.cost_split?.merchant ?? 0) / 100;
            platformDiscount += Math.round(amt * pRatio);
            allianceDiscount += Math.round(amt * aRatio);
            merchantDiscount += Math.round(amt * mRatio);
          }
        }
        if (ap.merchant_coupon_id && typeof foodService.getCoupons === 'function') {
          const mc = foodService.getCoupons().find(c => (c.id === ap.merchant_coupon_id || c.coupon_id === ap.merchant_coupon_id));
          if (mc && itemsSubtotal >= Number(mc.min_order_amount || 0)) {
            merchantDiscount += Number(mc.discount_amount || 0);
          }
        }
        if (Number(ap.point_used || 0) > 0 && body?.customer_uid) {
          const currBal = (adminState.pointLedger || [])
            .filter(t => t.customer_uid === body.customer_uid)
            .reduce((s, t) => s + Number(t.delta || 0), 0);
          pointUsed = Math.min(Math.max(0, currBal), Math.floor(Number(ap.point_used)));
          if (pointUsed > 0) {
            adminState.pointLedger.unshift({
              tx_id: `ptx_use_${Date.now()}`,
              customer_uid: body.customer_uid,
              order_id: 'pending',
              delta: -pointUsed,
              balance_after: currBal - pointUsed,
              type: 'USE_ORDER',
              bearer: 'PLATFORM',
              memo: '주문 포인트 사용 차감',
              created_at: new Date().toISOString()
            });
          }
        }

        const totalDiscount = platformDiscount + allianceDiscount + merchantDiscount + pointUsed;
        if (totalDiscount > 0) {
          body.discount_amount = totalDiscount;
        }

        const newOrder = foodService.createOrder(body);
        newOrder.applied_promotions = {
          platform_coupon_id: ap.platform_coupon_id || null,
          merchant_coupon_id: ap.merchant_coupon_id || null,
          platform_discount: platformDiscount,
          alliance_discount: allianceDiscount,
          merchant_discount: merchantDiscount,
          point_used: pointUsed,
          total_discount: totalDiscount
        };
        if (body?.customer_uid) {
          newOrder.customer_uid = body.customer_uid;
        }
        foodService.saveData();

        // 실결제 비례 포인트 자동 적립 (Zero-PII 원장)
        const earnRate = Number(adminState?.pointPolicy?.earn_rate_pct || 0);
        const earned = body?.customer_uid && earnRate > 0
          ? Math.floor((Number(newOrder.final_payment_amount || 0) * earnRate) / 100)
          : 0;
        if (earned > 0 && adminState?.pointLedger) {
          const prevBal = adminState.pointLedger
            .filter(t => t.customer_uid === body.customer_uid)
            .reduce((s, t) => s + Number(t.delta || 0), 0);
          adminState.pointLedger.unshift({
            tx_id: `ptx_${Date.now()}`,
            customer_uid: body.customer_uid,
            order_id: newOrder.order_id,
            delta: earned,
            balance_after: Math.max(0, prevBal) + earned,
            type: 'EARN_ORDER',
            bearer: 'PLATFORM',
            memo: `주문(${newOrder.short_display_id}) ${earnRate}% 자동 적립`,
            created_at: new Date().toISOString()
          });
          saveAdminState();
        } else if (pointUsed > 0) {
          saveAdminState();
        }

        // DOC-17 제4장: 실시간 MQTT 중추망 브로드캐스트 발행 (0.01초 단말기/KDS 직결)
        const storeId = newOrder.store_id || foodService.getStoreInfo()?.store_id || 'STR-11-650-01-56162-0001';
        mqttBridge.publish(`aitip/stores/${storeId}/orders`, newOrder);

        return sendJson(res, 201, { success: true, order: newOrder, earned_points: earned });
      }

      // 5-1-1) CTI 모의 전화 인입 테스트용 API: POST /api/food/telephony/simulate
      if (pathname === '/api/food/telephony/simulate' && method === 'POST') {
        const body = await parseJsonBody(req);
        const callerPhone = body.caller_phone || '010-5882-9258';
        const deviceId = body.device_id || 'DEV-CTI-882910';
        const telephonyEvent = {
          device_id: deviceId,
          caller_phone: callerPhone,
          call_time: new Date().toISOString(),
          ring_count: body.ring_count || 1,
          line_no: body.line_no || 1,
          customer_name: body.customer_name || '단골손님 (홍길동)',
          recent_orders: foodService.getLiveOrders().slice(0, 3)
        };
        mqttBridge.publish(`aitip/devices/${deviceId}/telephony`, telephonyEvent);
        return sendJson(res, 200, { success: true, event: telephonyEvent });
      }

      // 5-2) 실시간 주문 추적 조회 (PWA 고객용): GET /api/food/orders/:id/track
      const trackMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/track$/);
      if (trackMatch && method === 'GET') {
        const orderId = trackMatch[1];
        const trackData = foodService.getOrderTrack(orderId);
        if (!trackData) {
          return sendJson(res, 404, { success: false, error: '주문 내역을 찾을 수 없습니다.' });
        }
        return sendJson(res, 200, { success: true, track: trackData });
      }

      // 5-3) 단일 주문 상세 조회: GET /api/food/orders/:id
      const singleOrderMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)$/);
      if (singleOrderMatch && method === 'GET') {
        const orderId = singleOrderMatch[1];
        const order = foodService.getOrderById(orderId);
        if (!order) {
          return sendJson(res, 404, { success: false, error: '주문 내역을 찾을 수 없습니다.' });
        }
        return sendJson(res, 200, { success: true, order });
      }

      // 6) 주문 수락: /api/food/orders/:id/accept
      const acceptMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/accept$/);
      if (acceptMatch && method === 'POST') {
        const orderId = acceptMatch[1];
        const body = await parseJsonBody(req);
        const accepted = foodService.acceptOrder(orderId, body.prep_time_minutes);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || accepted);
        return sendJson(res, 200, { success: true, order: accepted });
      }

      // 6-0) 주문 완료 처리: /api/food/orders/:id/complete
      const completeMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/complete$/);
      if (completeMatch && method === 'POST') {
        const orderId = completeMatch[1];
        const completed = foodService.completeOrder(orderId);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || completed);
        return sendJson(res, 200, { success: true, order: completed });
      }

      // 6-1) 라이더 배차 상태 변경: /api/food/orders/:id/rider-status
      const riderStatusMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/rider-status$/);
      if (riderStatusMatch && method === 'PATCH') {
        const orderId = riderStatusMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateRiderStatus(orderId, body.rider_dispatch_status);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || updatedOrder);
        return sendJson(res, 200, { success: true, order: updatedOrder });
      }

      // 6-2) 하이브리드 배달 방식 (자체 배달 vs 대행 호출): /api/food/orders/:id/delivery-method
      const deliveryMethodMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/delivery-method$/);
      if (deliveryMethodMatch && method === 'PATCH') {
        const orderId = deliveryMethodMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateDeliveryMethod(orderId, body);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || updatedOrder);
        return sendJson(res, 200, { success: true, order: updatedOrder });
      }

      // 6-3) 매장 식사(DINE_IN) 테이블 착석/완료: /api/food/orders/:id/dine-in-status
      const dineInStatusMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/dine-in-status$/);
      if (dineInStatusMatch && method === 'PATCH') {
        const orderId = dineInStatusMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateDineInStatus(orderId, body);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || updatedOrder);
        return sendJson(res, 200, { success: true, order: updatedOrder });
      }

      // 6-4) 매장 사이드바 메뉴 순서 저장: PUT /api/food/store/nav-order
      if (pathname === '/api/food/store/nav-order' && method === 'PUT') {
        const body = await parseJsonBody(req);
        const result = foodService.updateStoreNavOrder(body.nav_order);
        return sendJson(res, 200, { success: true, store: result.store });
      }

      // 6-5) 매장 운영 형태(배달전문 vs 홀중심 vs 복합): PUT /api/food/store/operation-type
      if (pathname === '/api/food/store/operation-type' && method === 'PUT') {
        const body = await parseJsonBody(req);
        const result = foodService.updateStoreType(body.store_operation_type);
        return sendJson(res, 200, { success: true, store: result.store });
      }

      // 6-5b) 5대 업종 공통 가맹점 메타 블록 (주차/위치/시설/공지): PUT /api/food/store/blocks
      if (pathname === '/api/food/store/blocks' && method === 'PUT') {
        const body = await parseJsonBody(req);
        const result = foodService.updateStoreBlocks(body);
        return sendJson(res, 200, result);
      }

      // 6-6) 매장 식사(홀) 테이블 현황: GET /api/food/dinein/tables
      if (pathname === '/api/food/dinein/tables' && method === 'GET') {
        return sendJson(res, 200, foodService.getDineInTables());
      }

      // 6-7) 홀 예약 목록: GET /api/food/dinein/reservations
      if (pathname === '/api/food/dinein/reservations' && method === 'GET') {
        return sendJson(res, 200, foodService.getDineInReservations());
      }

      // 6-8) 홀 예약 승인(확정): POST /api/food/dinein/reservations/:id/confirm
      const resConfirmMatch = pathname.match(/^\/api\/food\/dinein\/reservations\/([^/]+)\/confirm$/);
      if (resConfirmMatch && method === 'POST') {
        const resId = resConfirmMatch[1];
        const result = foodService.confirmDineInReservation(resId);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 6-9) 홀 고객 착석(SEATED): POST /api/food/dinein/reservations/:id/seat
      const resSeatMatch = pathname.match(/^\/api\/food\/dinein\/reservations\/([^/]+)\/seat$/);
      if (resSeatMatch && method === 'POST') {
        const resId = resSeatMatch[1];
        const body = await parseJsonBody(req).catch(() => ({}));
        const result = foodService.seatDineInReservation(resId, body.table_no);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 6-10) 식사 완료 및 퇴장(COMPLETED): POST /api/food/dinein/reservations/:id/complete
      const resCompleteMatch = pathname.match(/^\/api\/food\/dinein\/reservations\/([^/]+)\/complete$/);
      if (resCompleteMatch && method === 'POST') {
        const resId = resCompleteMatch[1];
        const body = await parseJsonBody(req).catch(() => ({}));
        const result = foodService.completeDineInReservation(resId, body.table_no);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 6-11) 예약 거절/취소: POST /api/food/dinein/reservations/:id/cancel
      const resCancelMatch = pathname.match(/^\/api\/food\/dinein\/reservations\/([^/]+)\/cancel$/);
      if (resCancelMatch && method === 'POST') {
        const resId = resCancelMatch[1];
        const body = await parseJsonBody(req).catch(() => ({}));
        const result = foodService.cancelDineInReservation(resId, body.reason);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 7) 고객 리뷰 목록: GET /api/food/reviews
      if (pathname === '/api/food/reviews' && method === 'GET') {
        return sendJson(res, 200, foodService.getReviews());
      }

      // 7-1) 리뷰 사장님 답글: POST /api/food/reviews/:id/reply
      const reviewReplyMatch = pathname.match(/^\/api\/food\/reviews\/([^/]+)\/reply$/);
      if (reviewReplyMatch && method === 'POST') {
        const reviewId = reviewReplyMatch[1];
        const body = await parseJsonBody(req);
        const updatedReview = foodService.replyReview(reviewId, body.reply);
        return sendJson(res, 200, { success: true, review: updatedReview });
      }

      // 7-2) DOC-12 악성 리뷰 24시간 임시 블라인드 소명: POST /api/food/reviews/:id/blind
      const reviewBlindMatch = pathname.match(/^\/api\/food\/reviews\/([^/]+)\/blind$/);
      if (reviewBlindMatch && method === 'POST') {
        const reviewId = reviewBlindMatch[1];
        const body = await parseJsonBody(req);
        const updatedReview = foodService.requestReviewBlind(reviewId, body.reason);
        return sendJson(res, 200, { success: true, review: updatedReview });
      }

      // 8) 가게 쿠폰 목록 및 신규 발행: /api/food/coupons
      if (pathname === '/api/food/coupons') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getCoupons());
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const newCoupon = foodService.createCoupon(body);
          return sendJson(res, 201, { success: true, coupon: newCoupon });
        }
      }

      return sendJson(res, 404, { error: 'Unknown food API endpoint' });
    } catch (apiErr) {
      return sendJson(res, 400, { error: apiErr.message });
    }
  }

  // 2. 루트 허브 대시보드 (packages/hub/index.html 단일 SSOT 서빙)
  if (pathname === '/' || pathname === '/index.html') {
    serveStatic(path.join(__dirname, 'packages', 'hub', 'index.html'), res);
    return;
  }

  // Trailing slash redirect for base paths
  if (pathname === '/food/pwa') {
    res.writeHead(302, { 'Location': '/food/pwa/' });
    res.end();
    return;
  }
  if (pathname === '/food') {
    res.writeHead(302, { 'Location': '/food/' });
    res.end();
    return;
  }
  if (pathname === '/admin') {
    res.writeHead(302, { 'Location': '/admin/' });
    res.end();
    return;
  }
  if (pathname === '/mart') {
    res.writeHead(302, { 'Location': '/mart/' });
    res.end();
    return;
  }

  // 3-0. 전사 공용 코어 ESM 모듈 서빙 (/core/*)
  if (pathname.startsWith('/core/')) {
    const subpath = pathname.replace(/^\/core\//, '');
    const filePath = path.join(__dirname, 'packages', 'core', subpath);
    serveStatic(filePath, res);
    return;
  }

  // --------------------------------------------------------------------------
  // 2-0. 하나로마트 위탁(대행) 운영 백엔드 API (/api/mart/*)
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/mart/')) {
    try {
      if (pathname === '/api/mart/profile' && method === 'GET') {
        return sendJson(res, 200, { success: true, mart: martService.getMartProfile() });
      }
      if (pathname === '/api/mart/profile' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const mart = martService.updateMartProfile(body || {});
        return sendJson(res, 200, { success: true, mart });
      }
      if (pathname === '/api/mart/staff' && method === 'GET') {
        return sendJson(res, 200, { success: true, staff: martService.getStaff() });
      }
      if (pathname === '/api/mart/staff' && (method === 'POST' || method === 'PATCH')) {
        const body = await parseJsonBody(req);
        const staff = martService.saveStaff(body || {});
        return sendJson(res, method === 'POST' ? 201 : 200, { success: true, staff });
      }
      if (pathname === '/api/mart/staff' && method === 'DELETE') {
        const body = await parseJsonBody(req);
        const removed = martService.deleteStaff(body?.staff_id);
        return sendJson(res, 200, { success: true, removed });
      }
      if (pathname === '/api/mart/catalog' && method === 'GET') {
        return sendJson(res, 200, { success: true, ...martService.getCatalog() });
      }
      if (pathname === '/api/mart/products' && method === 'POST') {
        const body = await parseJsonBody(req);
        const item = martService.addProduct(body);
        return sendJson(res, 201, { success: true, product: item });
      }
      if (pathname === '/api/mart/products' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const item = martService.updateProduct(body || {});
        return sendJson(res, 200, { success: true, product: item });
      }
      if (pathname === '/api/mart/products/bulk-grid' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const result = martService.bulkUpdateProducts(body?.updates || []);
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/import/preview' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = martService.previewFlyerImport(body?.raw_text || '');
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/import' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = martService.bulkImport(body?.mode || 'FLYER', body?.raw_text || '');
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/promotions' && method === 'POST') {
        const body = await parseJsonBody(req);
        const promotion = martService.createPromotion(body);
        return sendJson(res, 201, { success: true, promotion });
      }
      if (pathname === '/api/mart/promotions' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const promotion = martService.updatePromotion(body || {});
        return sendJson(res, 200, { success: true, promotion });
      }
      if (pathname === '/api/mart/promotions' && method === 'DELETE') {
        const body = await parseJsonBody(req);
        const result = martService.deletePromotion(body?.id);
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/promo-types' && method === 'GET') {
        return sendJson(res, 200, { success: true, promo_types: martService.getPromoTypes() });
      }
      if (pathname === '/api/mart/promo-types' && (method === 'POST' || method === 'PATCH')) {
        const body = await parseJsonBody(req);
        const result = martService.savePromoType(body || {});
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/promo-types' && method === 'DELETE') {
        const body = await parseJsonBody(req);
        const result = martService.deletePromoType(body?.code);
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/orders' && method === 'GET') {
        return sendJson(res, 200, { success: true, orders: martService.getOrders() });
      }
      if (pathname === '/api/mart/orders' && method === 'POST') {
        const body = await parseJsonBody(req);
        const order = martService.createOrder(body);
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/orders', { event: 'ORDER_CREATED', order });
        return sendJson(res, 201, { success: true, order });
      }
      if (pathname === '/api/mart/orders/status' && method === 'POST') {
        const body = await parseJsonBody(req);
        const order = martService.updateOrderStatus(body?.order_id, body?.status);
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/orders', { event: 'ORDER_STATUS', order });
        return sendJson(res, 200, { success: true, order });
      }
      if (pathname === '/api/mart/picking' && method === 'GET') {
        const deliveryDate = url.searchParams.get('delivery_date') || '';
        return sendJson(res, 200, { success: true, ...martService.getPickingSummary(deliveryDate) });
      }
      if (pathname === '/api/mart/orders/adjust' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = martService.adjustOrderItem(body || {});
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/orders', { event: 'ORDER_ADJUSTED', ...result });
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/boxing' && method === 'GET') {
        const deliveryDate = url.searchParams.get('delivery_date') || '';
        return sendJson(res, 200, { success: true, ...martService.getBoxingManifest(deliveryDate) });
      }
      if (pathname === '/api/mart/settlements' && method === 'GET') {
        return sendJson(res, 200, { success: true, ...martService.getSettlementSummary(ensureAdminState().systemPolicies) });
      }
      if (pathname === '/api/mart/pwa/config' && method === 'GET') {
        return sendJson(res, 200, { success: true, ...martService.getPwaConfig() });
      }
      if (pathname === '/api/mart/pwa/control' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const config = martService.updatePwaControl(body || {});
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/pwa-config', { event: 'PWA_CONFIG_UPDATED', config });
        return sendJson(res, 200, { success: true, config });
      }
      if (pathname === '/api/mart/marts' && method === 'GET') {
        return sendJson(res, 200, { success: true, marts: martService.getMarts() });
      }
      if (pathname === '/api/mart/group-buys' && method === 'GET') {
        return sendJson(res, 200, { success: true, group_buys: martService.getGroupBuys() });
      }
      if (pathname === '/api/mart/group-buys' && method === 'POST') {
        const body = await parseJsonBody(req);
        const campaign = martService.createGroupBuy(body || {});
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/catalog', { event: 'GROUP_BUY_CREATED', campaign });
        return sendJson(res, 201, { success: true, campaign });
      }
      if (pathname === '/api/mart/products/approve' && method === 'POST') {
        const body = await parseJsonBody(req);
        const item = martService.decideMartProductApproval(body || {});
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/catalog', { event: 'PRODUCT_APPROVED', item });
        return sendJson(res, 200, { success: true, item });
      }
      if (pathname === '/api/admin/mart/group-buys/decide' && method === 'POST') {
        const body = await parseJsonBody(req);
        const campaign = martService.decideGroupBuy(body || {});
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/catalog', { event: 'GROUP_BUY_DECIDED', campaign });
        return sendJson(res, 200, { success: true, campaign });
      }
      if (pathname === '/api/admin/mart/co-sell-products' && method === 'POST') {
        const body = await parseJsonBody(req);
        const item = martService.createCoSellProduct(body || {});
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/catalog', { event: 'CO_SELL_PROPOSED', item });
        return sendJson(res, 201, { success: true, item });
      }
      if (pathname === '/api/mart/group-buys/join' && method === 'POST') {
        const body = await parseJsonBody(req);
        const campaign = martService.joinGroupBuy(body || {});
        return sendJson(res, 200, { success: true, campaign });
      }
      if (pathname === '/api/mart/media/upload' && method === 'POST') {
        const body = await parseJsonBody(req);
        const media = martService.saveMediaWebp(body || {});
        return sendJson(res, 201, { success: true, ...media });
      }
      if (pathname === '/api/mart/media/shared' && method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();
        const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || 40)), 100);
        const items = [];
        const seen = new Set();
        const pushItem = (it) => {
          if (!it.image_url || seen.has(it.image_url)) return;
          seen.add(it.image_url);
          items.push(it);
        };
        for (const m of (martService.data?.media_objects || [])) {
          const name = String(m.original_file_name || '').replace(/\.[^.]+$/, '');
          if (!q || name.toLowerCase().includes(q)) {
            pushItem({ media_id: m.id, image_url: m.cdn_url, label: name || '공용 이미지', source: 'SHARED_POOL' });
          }
        }
        for (const p of (martService.data?.products || [])) {
          if (!p.image_url) continue;
          const label = [p.name, p.spec && p.spec !== '-' ? p.spec : ''].filter(Boolean).join(' ');
          if (!q || label.toLowerCase().includes(q)) {
            pushItem({ media_id: p.media_id || '', image_url: p.image_url, label, source: 'MART_PRODUCT' });
          }
        }
        if (q) {
          for (const b of martService.lookupSharedBarcode({ q, limit })) {
            if (!b.image_url) continue;
            const spec = b.spec && b.spec !== '-' ? ` (${b.spec})` : '';
            pushItem({ media_id: b.id || '', image_url: b.image_url, label: `${b.name}${spec}`, barcode: b.barcode, source: 'SHARED_BARCODE' });
          }
        }
        return sendJson(res, 200, { success: true, items: items.slice(0, limit) });
      }
      if (pathname === '/api/mart/haccp/search' && method === 'GET') {
        const q = url.searchParams.get('q') || '';
        const barcode = url.searchParams.get('barcode') || '';
        const limit = Number(url.searchParams.get('limit') || 50);
        const categoryHint = url.searchParams.get('category_hint') || '';
        const cached = martService.lookupSharedBarcode({ q, barcode, limit, categoryHint });
        if (cached.length > 0) return sendJson(res, 200, { success: true, source: 'shared_barcode_catalog', items: cached, item: cached[0] });
        const items = await martService.searchHaccpProducts({ q, barcode });
        return sendJson(res, 200, { success: true, source: 'haccp_live', items, item: items[0] || null });
      }
      if ((pathname === '/api/mart/catalog/barcode' || pathname.startsWith('/api/mart/catalog/barcode/')) && method === 'GET') {
        const pathBc = pathname.startsWith('/api/mart/catalog/barcode/') ? pathname.slice('/api/mart/catalog/barcode/'.length) : '';
        const barcode = pathBc || url.searchParams.get('barcode') || '';
        const q = url.searchParams.get('q') || '';
        const limit = Number(url.searchParams.get('limit') || 50);
        const categoryHint = url.searchParams.get('category_hint') || '';
        const items = martService.lookupSharedBarcode({ q, barcode, limit, categoryHint });
        return sendJson(res, 200, { success: true, source: 'shared_barcode_catalog', items, item: items[0] || null });
      }
      if (pathname === '/api/mart/catalog/barcodes/lookup' && method === 'POST') {
        const body = await parseJsonBody(req);
        const map = martService.lookupSharedBarcodesBatch(body?.barcodes || []);
        return sendJson(res, 200, { success: true, source: 'shared_barcode_catalog', count: Object.keys(map).length, items_by_barcode: map });
      }
      if (pathname.startsWith('/api/mart/media/public/shared/barcode/') && method === 'GET') {
        const filename = path.basename(pathname);
        const filePath = path.join(__dirname, 'scratch', 'haccp_webp', filename);
        serveStatic(filePath, res);
        return;
      }
      if (pathname === '/api/mart/haccp/proxy-image' && method === 'GET') {
        const src = String(url.searchParams.get('url') || '').trim();
        if (!/^https?:\/\//i.test(src)) return sendJson(res, 400, { success: false, error: '유효한 외부 이미지 URL이 필요합니다.' });
        let imgRes;
        try {
          imgRes = await fetch(src, { signal: AbortSignal.timeout(8000) });
        } catch (err) {
          return sendJson(res, 502, { success: false, error: `외부 이미지 서버 연결 실패: ${err?.message || 'timeout'}` });
        }
        if (!imgRes.ok) return sendJson(res, 502, { success: false, error: `외부 이미지 다운로드 실패 (${imgRes.status})` });
        const contentType = String(imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!contentType.startsWith('image/')) {
          return sendJson(res, 400, { success: false, error: "이미지 파일 주소가 아닙니다. '링크 주소 복사'가 아니라 사진 위 우클릭 -> '이미지 주소 복사'를 사용하거나 '이미지 복사' 후 Ctrl+V를 눌러 주세요." });
        }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
        res.end(buf);
        return;
      }
      if (pathname === '/api/mart/haccp/import-image' && method === 'POST') {
        const body = await parseJsonBody(req);
        const media = await martService.importExternalImageToMedia(body || {});
        return sendJson(res, 201, { success: true, ...media });
      }
      if (pathname === '/api/mart/facilities' && method === 'GET') {
        return sendJson(res, 200, { success: true, facilities: martService.getFacilities() });
      }
      if (pathname === '/api/mart/facilities/register' && method === 'POST') {
        const body = await parseJsonBody(req);
        const facility = martService.registerFacility(body || {});
        return sendJson(res, 201, { success: true, facility });
      }
      if (pathname === '/api/mart/facilities/decide' && method === 'POST') {
        const body = await parseJsonBody(req);
        const facility = martService.decideFacility(body || {});
        return sendJson(res, 200, { success: true, facility });
      }
      if (pathname === '/api/mart/b2b/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const facility = martService.loginFacility(body || {});
        return sendJson(res, 200, { success: true, facility });
      }
      if (pathname === '/api/mart/prices/batch' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = martService.applyDailyPriceBatch(body || {});
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/catalog', { event: 'PRICES_BATCH_UPDATED', ...result });
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/prices/history' && method === 'GET') {
        return sendJson(res, 200, { success: true, history: martService.getUploadHistory() });
      }
      if (pathname === '/api/mart/prices/rollback' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = martService.rollbackUploadBatch(body?.batch_id);
        mqttBridge.publish('aitip/marts/MRT-11-650-01-47121-0001/catalog', { event: 'PRICES_ROLLED_BACK', ...result });
        return sendJson(res, 200, { success: true, ...result });
      }
      return sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 3-1. 고객 전용 모바일 PWA 정적 파일 서빙 (/food/pwa/*)
  if (pathname.startsWith('/food/pwa')) {
    let subpath = pathname.replace(/^\/food\/pwa\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'food-delivery', 'customer-pwa', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 3-0-1. 마트 상품 WebP 미디어 정적 서빙 (/mart/media/* -> R2 호환 로컬 버킷)
  if (pathname.startsWith('/mart/media/')) {
    const subpath = pathname.replace(/^\/mart\/media\/?/, '');
    const filePath = path.join(__dirname, 'packages', 'services', 'mart-logistics', 'backend', 'media', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 3-0-2. 마트 B2B 기관 전용 발주 포털 정적 파일 서빙 (/mart/b2b/*)
  if (pathname.startsWith('/mart/b2b')) {
    let subpath = pathname.replace(/^\/mart\/b2b\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'mart-logistics', 'mart-b2b', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 3-0. 마트 전용 소비자 모바일 PWA 정적 파일 서빙 (/mart/pwa/*)
  if (pathname.startsWith('/mart/pwa')) {
    let subpath = pathname.replace(/^\/mart\/pwa\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'mart-logistics', 'mart-pwa', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 3. 마트 포털 정적 파일 서빙 (/mart/*)
  if (pathname.startsWith('/mart')) {
    let subpath = pathname.replace(/^\/mart\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'mart-logistics', 'mart-portal', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 4. 소상공인 요식업 포털 정적 파일 서빙 (/food/*)
  if (pathname.startsWith('/food')) {
    let subpath = pathname.replace(/^\/food\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'food-delivery', 'merchant-portal', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 5. 플랫폼 마스터 관리자 포털 정적 파일 서빙 (/admin/*)
  if (pathname.startsWith('/admin')) {
    let subpath = pathname.replace(/^\/admin\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'platform-admin', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 기타 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

function serveStatic(filePath, res) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 File Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// DOC-17: RFC 6455 WebSocket / MQTT 브릿지 핸드셰이크 처리
server.on('upgrade', (req, socket, head) => {
  mqttBridge.handleUpgrade(req, socket, head);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AITIP Dev Server] Running at http://localhost:${PORT}`);
  console.log(`[AITIP Hub]        http://localhost:${PORT}/`);
  console.log(`[Mart Portal]      http://localhost:${PORT}/mart/`);
  console.log(`[Food Portal]      http://localhost:${PORT}/food/`);
});
