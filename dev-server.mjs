import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foodService } from './packages/services/food-delivery/backend/food-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8989;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
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
          const overview = foodService.getSettlementOverview({ year, month });
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

      // 5) 실시간 주문 (KDS)
      if (pathname === '/api/food/orders/live' && method === 'GET') {
        return sendJson(res, 200, foodService.getLiveOrders());
      }

      // 5-1) 신규 주문 생성 (PWA / 모바일 웹): POST /api/food/orders
      if (pathname === '/api/food/orders' && method === 'POST') {
        const body = await parseJsonBody(req);
        const newOrder = foodService.createOrder(body);
        return sendJson(res, 201, { success: true, order: newOrder });
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
        return sendJson(res, 200, { success: true, order: accepted });
      }

      // 6-1) 라이더 배차 상태 변경: /api/food/orders/:id/rider-status
      const riderStatusMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/rider-status$/);
      if (riderStatusMatch && method === 'PATCH') {
        const orderId = riderStatusMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateRiderStatus(orderId, body.rider_dispatch_status);
        return sendJson(res, 200, { success: true, order: updatedOrder });
      }

      // 6-2) 하이브리드 배달 방식 (자체 배달 vs 대행 호출): /api/food/orders/:id/delivery-method
      const deliveryMethodMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/delivery-method$/);
      if (deliveryMethodMatch && method === 'PATCH') {
        const orderId = deliveryMethodMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateDeliveryMethod(orderId, body);
        return sendJson(res, 200, { success: true, order: updatedOrder });
      }

      // 6-3) 매장 식사(DINE_IN) 테이블 착석/완료: /api/food/orders/:id/dine-in-status
      const dineInStatusMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/dine-in-status$/);
      if (dineInStatusMatch && method === 'PATCH') {
        const orderId = dineInStatusMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateDineInStatus(orderId, body);
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

  // 2. 루트 허브 대시보드
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AITIP 로컬 개발 관제 센터 (:8989)</title>
  <style>
    :root {
      --primary: #0284c7;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .header { text-align: center; margin-bottom: 40px; }
    .badge { background: #10b981; color: #064e3b; font-weight: 800; font-size: 13px; padding: 4px 12px; border-radius: 9999px; display: inline-block; margin-bottom: 12px; }
    h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 8px; }
    p { color: var(--text-muted); font-size: 15px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; max-width: 900px; width: 100%; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 28px; text-decoration: none; color: inherit; transition: all 0.2s ease; display: flex; flex-direction: column; justify-content: space-between; }
    .card:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: 0 12px 24px -8px rgba(2, 132, 199, 0.3); }
    .card-top { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
    .card-icon { font-size: 36px; }
    .card h2 { font-size: 20px; font-weight: 700; }
    .card-desc { color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    .card-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; width: fit-content; }
    .badge-mart { background: #dcfce7; color: #166534; }
    .badge-food { background: #ffedd5; color: #9a3412; }
    .footer { margin-top: 40px; text-align: center; font-size: 13px; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">● 포트 8989 정상 가동중</span>
    <h1>AITIP 플랫폼 서비스 관제 허브</h1>
    <p>소상공인 외식업 본체 코어와 단위농협 하나로마트 유통망 통합 런처</p>
  </div>
  <div class="grid">
    <a href="/mart/" class="card">
      <div>
        <div class="card-top">
          <span class="card-icon">🛒</span>
          <div>
            <h2>단위농협 하나로마트 포털</h2>
            <span class="card-badge badge-mart">유통 / 피킹 / 결품 정정</span>
          </div>
        </div>
        <p class="card-desc">0.1초 아침 엑셀 시세 패치, 매대 동선별 통합 피킹 지시서, 결품 부분취소 & 듀얼 영수증 시뮬레이터</p>
      </div>
      <div style="color: #22c55e; font-weight: 700; font-size: 14px;">포털 열기 ➔</div>
    </a>
    <a href="/food/" class="card">
      <div>
        <div class="card-top">
          <span class="card-icon">🍕</span>
          <div>
            <h2>소상공인 치킨집 매장 포털</h2>
            <span class="card-badge badge-food">외식업 본체 코어 (90%)</span>
          </div>
        </div>
        <p class="card-desc">복합 옵션 트리 메뉴판, 주방 KDS 주문 접수, 조리 예상시간 선택, 딩동 음성 알림 및 원클릭 라이더 호출</p>
      </div>
      <div style="color: #f97316; font-weight: 700; font-size: 14px;">포털 열기 ➔</div>
    </a>
  </div>
  <div class="footer">
    AITIP Platform · Cloudflare D1 Architecture (278 Integrity Tests Passed) · Local Port 8989
  </div>
</body>
</html>`);
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
  if (pathname === '/mart') {
    res.writeHead(302, { 'Location': '/mart/' });
    res.end();
    return;
  }

  // 3-1. 고객 전용 모바일 PWA 정적 파일 서빙 (/food/pwa/*)
  if (pathname.startsWith('/food/pwa')) {
    let subpath = pathname.replace(/^\/food\/pwa\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'food-delivery', 'customer-pwa', subpath);
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AITIP Dev Server] Running at http://localhost:${PORT}`);
  console.log(`[AITIP Hub]        http://localhost:${PORT}/`);
  console.log(`[Mart Portal]      http://localhost:${PORT}/mart/`);
  console.log(`[Food Portal]      http://localhost:${PORT}/food/`);
});
