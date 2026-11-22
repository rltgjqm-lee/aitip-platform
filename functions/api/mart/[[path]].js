// Cloudflare Pages Serverless Function for /api/mart/*
import martData from './mart_data.json';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

export async function onRequest(context) {
  const { request, params } = context;
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const subPath = (params.path || []).join('/').replace(/\/+$/, '');
  const body = (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')
    ? await request.json().catch(() => ({}))
    : {};

  if (subPath === 'profile') {
    if (method === 'GET') return jsonRes({ success: true, mart: martData.mart });
    if (method === 'PATCH') return jsonRes({ success: true, mart: { ...martData.mart, ...body } });
  }
  if (subPath === 'staff') {
    if (method === 'GET') return jsonRes({ success: true, staff: martData.staff || [] });
    return jsonRes({ success: true, staff: body });
  }
  if (subPath === 'catalog') {
    return jsonRes({
      success: true,
      mart: martData.mart,
      products: martData.products || [],
      promotions: martData.promotions || [],
      promo_types: martData.promo_types || []
    });
  }
  if (subPath === 'products' || subPath === 'products/approve') {
    return jsonRes({ success: true, item: body }, method === 'POST' ? 201 : 200);
  }
  if (subPath === 'products/bulk-grid') {
    return jsonRes({ success: true, updated_count: Array.isArray(body?.updates) ? body.updates.length : 0 });
  }
  if (subPath === 'promotions') {
    return jsonRes({ success: true, promotion: { id: body.id || `mpr_${Date.now()}`, ...body } }, method === 'POST' ? 201 : 200);
  }
  if (subPath === 'promo-types') {
    return jsonRes({ success: true, promo_types: martData.promo_types || [] });
  }
  if (subPath === 'orders') {
    if (method === 'GET') return jsonRes({ success: true, orders: martData.orders || [] });
    const d = String(body.delivery_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(2, 8);
    return jsonRes({ success: true, order: { order_id: `ORD-11-650-01-47121-0001-${d}-${String(Date.now()).slice(-4)}`, ...body, status: 'REQUESTED' } }, 201);
  }
  if (subPath === 'orders/status' || subPath === 'orders/adjust') {
    return jsonRes({ success: true, ...body });
  }
  if (subPath === 'picking' || subPath === 'boxing' || subPath === 'settlements') {
    return jsonRes({ success: true, items: [], rows: [], orders: martData.orders || [], totals: {} });
  }
  if (subPath === 'pwa/config') {
    return jsonRes({ success: true, mart: martData.mart, config: martData.pwa_config || {} });
  }
  if (subPath === 'pwa/control') {
    return jsonRes({ success: true, config: { ...(martData.pwa_config || {}), ...body } });
  }
  if (subPath === 'marts') {
    return jsonRes({ success: true, marts: martData.marts || [] });
  }
  if (subPath === 'group-buys') {
    if (method === 'GET') return jsonRes({ success: true, group_buys: martData.group_buys || [] });
    return jsonRes({ success: true, campaign: { campaign_id: `mgb_${Date.now()}`, ...body, approval_status: 'PENDING_ADMIN' } }, 201);
  }
  if (subPath === 'group-buys/join') {
    return jsonRes({ success: true, campaign_id: body.campaign_id });
  }
  if (subPath === 'facilities') {
    return jsonRes({ success: true, facilities: martData.facilities || [] });
  }
  if (subPath === 'facilities/register') {
    const name = String(body.facility_name || '').trim();
    const phone = String(body.phone || '').trim();
    const address = String(body.address || '').trim();
    if (!name || !phone || !address) {
      return jsonRes({ success: false, error: '기관명, 연락처, 배송 주소를 모두 입력해 주세요.' }, 400);
    }
    return jsonRes({
      success: true,
      facility: {
        request_id: `fapp_${Date.now()}`,
        facility_id: '',
        facility_name: name,
        facility_type: body.facility_type || 'SENIOR_CENTER',
        phone,
        address,
        status: 'PENDING_APPROVAL'
      }
    }, 201);
  }
  if (subPath === 'facilities/decide') {
    return jsonRes({ success: true, facility: { ...body } });
  }
  if (subPath === 'b2b/login') {
    const list = Array.isArray(martData.facilities) ? martData.facilities : [];
    const fid = String(body.facility_id || '').trim().toUpperCase();
    const normPhone = String(body.phone || '').replace(/[^0-9]/g, '');
    const found = list.find(f =>
      (fid && String(f.facility_id || '').toUpperCase() === fid)
      || (normPhone && String(f.phone || '').replace(/[^0-9]/g, '') === normPhone)
    );
    if (!found) return jsonRes({ success: false, error: '등록된 기관 정보를 찾을 수 없습니다.' }, 400);
    if (found.status === 'PENDING_APPROVAL') return jsonRes({ success: false, error: '마트 관리자 승인 대기 중인 기관입니다.' }, 400);
    if (found.status === 'REJECTED') return jsonRes({ success: false, error: '가입이 반려된 기관입니다.' }, 400);
    return jsonRes({ success: true, facility: found });
  }
  if (subPath === 'prices/batch') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    return jsonRes({
      success: true,
      batch_id: `upl_${Date.now()}`,
      success_count: rows.length,
      error_count: 0,
      synced_suspended_count: 0,
      errors: []
    });
  }
  if (subPath === 'prices/history') {
    return jsonRes({ success: true, history: martData.upload_history || [] });
  }
  if (subPath === 'prices/rollback') {
    return jsonRes({ success: true, batch_id: body.batch_id, restored_count: 0, rolled_back_at: new Date().toISOString() });
  }

  return jsonRes({ success: false, error: `Unknown mart endpoint: /api/mart/${subPath}` }, 404);
}
