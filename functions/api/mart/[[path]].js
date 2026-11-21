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
    return jsonRes({ success: true, order: { order_id: `mord_${Date.now()}`, ...body, status: 'REQUESTED' } }, 201);
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

  return jsonRes({ success: false, error: `Unknown mart endpoint: /api/mart/${subPath}` }, 404);
}
