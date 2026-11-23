// Cloudflare Pages Serverless Function for /api/admin/*
import martData from '../mart/mart_data.json';
import storeData from '../food/store_data.json';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-role, x-tenant-id',
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

  if (subPath === 'dashboard') {
    const foodOrders = Array.isArray(storeData.orders) ? storeData.orders : [];
    const martOrders = Array.isArray(martData.orders) ? martData.orders : [];
    return jsonRes({
      success: true,
      total_orders: foodOrders.length + martOrders.length,
      mart_count: (martData.marts || []).length || 1,
      store_count: 1
    });
  }
  if (subPath === 'orders/live') {
    return jsonRes({
      success: true,
      orders: [...(storeData.orders || []), ...(martData.orders || [])]
    });
  }
  if (subPath === 'marts') {
    return jsonRes({ success: true, marts: martData.marts || [] });
  }
  if (subPath === 'stores') {
    return jsonRes({ success: true, stores: storeData.store ? [storeData.store] : [] });
  }
  if (subPath === 'stores/status') {
    return jsonRes({ success: true, ...body });
  }
  if (subPath === 'onboarding') {
    return jsonRes({ success: true, applications: [] });
  }
  if (subPath.startsWith('onboarding/')) {
    return jsonRes({ success: true, ...body });
  }
  if (subPath.startsWith('org/')) {
    return jsonRes({ success: true, org: { id: body.id || `org_${Date.now()}`, ...body } });
  }
  if (subPath === 'cs/disputes') {
    return jsonRes({ success: true, disputes: [], total: 0 });
  }
  if (subPath.startsWith('cs/')) {
    return jsonRes({ success: true, ...body });
  }
  if (subPath === 'points/ledger') {
    return jsonRes({ success: true, ledger: [], policy: {} });
  }
  if (subPath.startsWith('points/')) {
    return jsonRes({ success: true, ...body });
  }
  if (subPath === 'promotions' || subPath === 'zones' || subPath === 'policies') {
    return jsonRes({ success: true, items: [], data: body });
  }
  if (subPath === 'audit-logs') {
    return jsonRes({ success: true, logs: [] });
  }
  if (subPath === 'reviews/blind-queue') {
    return jsonRes({ success: true, queue: [] });
  }
  if (subPath === 'reviews/decide' || subPath === 'payouts/decide') {
    return jsonRes({ success: true, ...body });
  }
  if (subPath === 'payouts') {
    return jsonRes({ success: true, payouts: [] });
  }
  if (subPath === 'mart/group-buys/decide') {
    const list = Array.isArray(martData.group_buys) ? martData.group_buys : [];
    const target = list.find(g => g.campaign_id === body.campaign_id) || { campaign_id: body.campaign_id };
    return jsonRes({
      success: true,
      campaign: {
        ...target,
        approval_status: body.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        status: body.decision === 'APPROVED' ? 'OPEN' : 'REJECTED'
      }
    });
  }
  if (subPath === 'mart/co-sell-products') {
    return jsonRes({
      success: true,
      item: {
        id: `mrt_cosell_${Date.now()}`,
        ...body,
        shared_catalog_scope: 'NATIONWIDE_CO_SELL',
        mart_approval_status: 'PENDING_MART'
      }
    }, 201);
  }

  return jsonRes({ success: false, error: `Unknown admin endpoint: /api/admin/${subPath}` }, 404);
}
