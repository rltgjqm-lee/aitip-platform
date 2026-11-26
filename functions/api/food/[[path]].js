// Cloudflare Pages Serverless Function for /api/food/*
// 완전 동기화: DOC-02, DOC-07, DOC-14, DOC-15, DOC-18 (food-service.mjs 100% 매핑)
import storeData from './store_data.json';
import { authenticateRequest } from '../../../packages/services/mart-logistics/backend/mart-auth-guard.mjs';

function buildCorsHeaders(request) {
  const origin = request?.headers?.get?.('Origin') || '';
  const headers = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8'
  };
  if (origin) headers['Access-Control-Allow-Credentials'] = 'true';
  return headers;
}

function isPublicFoodEndpoint(method, subPath) {
  const m = String(method || 'GET').toUpperCase();
  const p = String(subPath || '').replace(/^\/+|\/+$/g, '');
  if (m === 'GET' && [
    'store', 'store/hours', 'delivery-rules', 'delivery-regions',
    'menu', 'menus', 'categories', 'options', 'option-groups',
    'coupons', 'reviews', 'store-blocks', 'holidays', 'public-feed'
  ].includes(p)) {
    return true;
  }
  if (m === 'GET' && p.startsWith('orders/') && p.endsWith('/track')) return true;
  if (m === 'POST' && p === 'orders') return true;
  return false;
}

export async function onRequest(context) {
  const { request, params, env } = context;
  const corsHeaders = buildCorsHeaders(request);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const pathSegments = params.path || [];
  const subPath = pathSegments.join('/');
  const hasD1 = Boolean(env?.DB && typeof env.DB.prepare === 'function');

  if (hasD1 && !isPublicFoodEndpoint(method, subPath)) {
    const authCtx = await authenticateRequest(env.DB, request);
    if (!authCtx?.user) {
      return new Response(JSON.stringify({ success: false, error: '가맹점 관리자 로그인이 필요합니다.' }), { status: 401, headers: corsHeaders });
    }
    if (authCtx.role !== 'SUPER_ADMIN') {
      return new Response(JSON.stringify({ success: false, error: '접근 권한이 없습니다.' }), { status: 403, headers: corsHeaders });
    }
  }

  // 1. 매장 기본 정보
  if (subPath === 'store' || subPath === 'store/') {
    if (method === 'GET') {
      return new Response(JSON.stringify(storeData.store), { headers: corsHeaders });
    }
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: true, store: { ...storeData.store, ...body } }), { headers: corsHeaders });
    }
  }

  // 1-1. 주간 영업시간 (store_hours)
  if (subPath === 'store/hours') {
    if (method === 'GET') {
      return new Response(JSON.stringify(storeData.store_hours || []), { headers: corsHeaders });
    }
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: true, hours: body.hours || body }), { headers: corsHeaders });
    }
  }

  // 1-2. 배달팁 구간 규칙 (delivery-rules)
  if (subPath === 'store/delivery-rules') {
    if (method === 'GET') {
      return new Response(JSON.stringify(storeData.store.delivery_tip_rules || []), { headers: corsHeaders });
    }
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: true, rules: body }), { headers: corsHeaders });
    }
  }

  // 1-3. 휴무일 설정 (holidays)
  if (subPath === 'store/holidays') {
    if (method === 'GET') {
      return new Response(JSON.stringify(storeData.holiday_settings || {
        auto_close_national_holidays: true,
        closed_holiday_names: ['설날', '추석'],
        custom_closures: []
      }), { headers: corsHeaders });
    }
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: true, settings: body }), { headers: corsHeaders });
    }
  }

  // 2. 3단 메뉴 카탈로그
  if (subPath === 'menu') {
    return new Response(JSON.stringify({
      categories: storeData.categories,
      products: storeData.products,
      option_groups: storeData.option_groups
    }), { headers: corsHeaders });
  }

  // 3. 고객 리뷰
  if (subPath === 'reviews') {
    return new Response(JSON.stringify(storeData.reviews || []), { headers: corsHeaders });
  }

  // 4. 가게 할인 쿠폰
  if (subPath === 'coupons') {
    if (method === 'GET') {
      return new Response(JSON.stringify(storeData.coupons || [
        { coupon_id: 'cpn_01welcome', name: '첫주문 2,000원 할인', discount_amount: 2000, min_order_amount: 20000, is_active: true }
      ]), { headers: corsHeaders });
    }
    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: true, coupon: { coupon_id: 'cpn_' + Date.now().toString(36), ...body } }), { status: 201, headers: corsHeaders });
    }
  }

  // 5. 실시간 KDS 주문 목록 및 신규 발주
  if (subPath === 'orders') {
    if (method === 'GET') {
      return new Response(JSON.stringify(storeData.live_orders || []), { headers: corsHeaders });
    }
    if (method === 'POST') {
      const orderPayload = await request.json().catch(() => ({}));
      const orderId = 'ord_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      const shortId = 'A-' + (Math.floor(Math.random() * 50) + 10);
      const virtualPhone = orderPayload.virtual_phone || (orderPayload.use_virtual_phone ? `0504-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}` : (orderPayload.customer_phone || '010-0000-0000'));
      
      const items = Array.isArray(orderPayload.items) ? orderPayload.items : [];
      const calcItemsTotal = Number(orderPayload.items_total) > 0
        ? Number(orderPayload.items_total)
        : items.reduce((s, it) => s + (Number(it.total_price) || (Number(it.base_price || it.price || 0) * (Number(it.quantity) || 1))), 0);
      const calcTip = (orderPayload.fulfillment_type === 'DELIVERY')
        ? (Number(orderPayload.delivery_tip) || 3000)
        : 0;
      const calcFinal = (Number(orderPayload.final_payment_amount) > 0)
        ? Number(orderPayload.final_payment_amount)
        : (calcItemsTotal + calcTip);

      const createdOrder = {
        order_id: orderId,
        short_display_id: shortId,
        status: 'PENDING',
        order_channel: orderPayload.order_channel || 'PWA',
        fulfillment_type: orderPayload.fulfillment_type || 'DELIVERY',
        customer_name: orderPayload.customer_name || '고객',
        customer_phone: orderPayload.customer_phone || '',
        virtual_phone: virtualPhone,
        road_address: orderPayload.road_address || '',
        detail_address: orderPayload.detail_address || '',
        postal_code: orderPayload.postal_code || '',
        delivery_address: orderPayload.delivery_address || '서울특별시 서초구 서초대로 42길 11, 302호',
        customer_memo: orderPayload.customer_memo || '',
        payment_method: orderPayload.payment_method || 'AITIP_ZERO_PAY',
        items: items,
        items_total: calcItemsTotal,
        delivery_tip: calcTip,
        final_payment_amount: calcFinal,
        rider_dispatch_status: 'WAITING_ACCEPT',
        kitchen_ticket_printed: false,
        prep_time_minutes: 25,
        created_at: new Date().toISOString()
      };
      return new Response(JSON.stringify({ success: true, order: createdOrder }), { status: 201, headers: corsHeaders });
    }
  }

  // 5-1. 주문 실시간 추적 (orders/:id/track)
  const trackMatch = subPath.match(/^orders\/([^/]+)\/track$/);
  if (trackMatch && method === 'GET') {
    const orderId = trackMatch[1];
    const live = (storeData.live_orders || []).find(o => o.order_id === orderId);
    return new Response(JSON.stringify({
      success: true,
      track: {
        order_id: orderId,
        short_display_id: live?.short_display_id || 'A-45',
        status: live?.status || 'PENDING',
        remaining_minutes: 20,
        rider_dispatch_status: live?.rider_dispatch_status || 'WAITING_ACCEPT'
      }
    }), { headers: corsHeaders });
  }

  // 5-2. KDS 주문 접수/완료 액션
  const acceptMatch = subPath.match(/^orders\/([^/]+)\/accept$/);
  if (acceptMatch && method === 'POST') {
    return new Response(JSON.stringify({
      success: true,
      order_id: acceptMatch[1],
      status: 'ACCEPTED',
      kitchen_ticket_printed: true
    }), { headers: corsHeaders });
  }

  // 6. 홀 테이블 현황 및 예약 (Dine-in)
  if (subPath === 'dinein/tables') {
    return new Response(JSON.stringify({
      total_tables: 8,
      tables: [
        { table_no: 1, capacity: 4, status: 'OCCUPIED', current_order: 'A-42' },
        { table_no: 2, capacity: 4, status: 'AVAILABLE', current_order: null },
        { table_no: 3, capacity: 2, status: 'RESERVED', reservation_time: '19:30' },
        { table_no: 4, capacity: 6, status: 'AVAILABLE', current_order: null }
      ]
    }), { headers: corsHeaders });
  }

  if (subPath === 'dinein/reservations') {
    return new Response(JSON.stringify([
      { reservation_id: 'res_01', customer_name: '이수민', guests: 4, reserved_time: '19:30', status: 'CONFIRMED' }
    ]), { headers: corsHeaders });
  }

  // 7. 정산 대사 원장 (D1 merchant_daily_bi_snapshots 규격)
  if (subPath === 'settlement') {
    const historicalSnapshots = [
      { business_date: '2026-11-01', order_count: 24, gross_sales: 580000, delivery_tips: 72000, pg_fees: 16300, net_payout: 635700, payout_status: 'COMPLETED', payout_date: '2026-11-02' },
      { business_date: '2026-11-02', order_count: 16, gross_sales: 382000, delivery_tips: 45000, pg_fees: 10675, net_payout: 416325, payout_status: 'COMPLETED', payout_date: '2026-11-03' },
      { business_date: '2026-11-03', order_count: 18, gross_sales: 425000, delivery_tips: 51000, pg_fees: 11900, net_payout: 464100, payout_status: 'COMPLETED', payout_date: '2026-11-04' },
      { business_date: '2026-11-04', order_count: 15, gross_sales: 360000, delivery_tips: 42000, pg_fees: 10050, net_payout: 391950, payout_status: 'COMPLETED', payout_date: '2026-11-05' },
      { business_date: '2026-11-05', order_count: 19, gross_sales: 458000, delivery_tips: 54000, pg_fees: 12800, net_payout: 499200, payout_status: 'COMPLETED', payout_date: '2026-11-06' },
      { business_date: '2026-11-06', order_count: 28, gross_sales: 685000, delivery_tips: 81000, pg_fees: 19150, net_payout: 746850, payout_status: 'COMPLETED', payout_date: '2026-11-09' },
      { business_date: '2026-11-07', order_count: 32, gross_sales: 792000, delivery_tips: 93000, pg_fees: 22125, net_payout: 862875, payout_status: 'COMPLETED', payout_date: '2026-11-09' },
      { business_date: '2026-11-08', order_count: 29, gross_sales: 710000, delivery_tips: 84000, pg_fees: 19850, net_payout: 774150, payout_status: 'COMPLETED', payout_date: '2026-11-09' },
      { business_date: '2026-11-09', order_count: 18, gross_sales: 428000, delivery_tips: 54000, pg_fees: 12050, net_payout: 469950, payout_status: 'PENDING', payout_date: '2026-11-10' }
    ];

    let totalGrossSales = 0;
    let totalPgFees = 0;
    let totalNetPayout = 0;
    let totalOrders = 0;
    for (const r of historicalSnapshots) {
      totalGrossSales += (r.gross_sales + r.delivery_tips);
      totalPgFees += r.pg_fees;
      totalNetPayout += r.net_payout;
      totalOrders += r.order_count;
    }

    const cardSales = Math.round(totalGrossSales * 0.70);
    const otherSales = Math.round(totalGrossSales * 0.20);
    const cashSales = totalGrossSales - cardSales - otherSales;
    const calcTax = (amt) => {
      const supply = Math.round(amt / 1.1);
      return { total: amt, supply, vat: amt - supply };
    };

    return new Response(JSON.stringify({
      year: 2026,
      month: 11,
      total_gross_sales: totalGrossSales,
      total_pg_fees: totalPgFees,
      total_net_payout: totalNetPayout,
      total_orders: totalOrders,
      daily_records: historicalSnapshots,
      tax_report: {
        card: calcTax(cardSales),
        cash: calcTax(cashSales),
        other: calcTax(otherSales),
        total: calcTax(totalGrossSales)
      }
    }), { headers: corsHeaders });
  }

  // 8. 국세청 홈택스 표준 부가세 CSV 다운로드
  if (subPath === 'settlement/tax-csv') {
    const csvContent = '\uFEFF과세구분,공급가액(원),부가가치세(원),합계금액(원),국세청_전자신고항목\n' +
      '1. 신용카드 매출전표 발행분,3436364,343636,3780000,신용카드·현금영수증 발행분\n' +
      '2. 현금영수증 발행분,490909,49091,540000,신용카드·현금영수증 발행분\n' +
      '3. 기타 매출(정기결제/모바일간편결제),981818,98182,1080000,기타(정규영수증 외 매출분)\n' +
      '합계,4909091,490909,5400000,과세표준 및 매출세액 합계';
    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="hometax_vat_report_2026_11.csv"'
      }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    service: 'AITIP Food Delivery Serverless Edge API',
    endpoints: ['/store', '/menu', '/reviews', '/orders', '/settlement', '/settlement/tax-csv', '/dinein/*']
  }), { headers: corsHeaders });
}
