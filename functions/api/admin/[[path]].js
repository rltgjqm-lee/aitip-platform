// Cloudflare Pages Serverless Function for /api/admin/*
import martData from '../mart/mart_data.json';
import storeData from '../food/store_data.json';
import { authenticateRequest } from '../../../packages/services/mart-logistics/backend/mart-auth-guard.mjs';

function buildCorsHeaders(request) {
  const origin = request?.headers?.get?.('Origin') || '';
  const headers = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-role, x-tenant-id',
    'Content-Type': 'application/json; charset=utf-8'
  };
  if (origin) headers['Access-Control-Allow-Credentials'] = 'true';
  return headers;
}

export async function onRequest(context) {
  const { request, params, env } = context;
  const corsHeaders = buildCorsHeaders(request);
  const jsonRes = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: corsHeaders });
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const subPath = (params.path || []).join('/').replace(/\/+$/, '');
  const body = (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')
    ? await request.json().catch(() => ({}))
    : {};
  const hasD1 = Boolean(env?.DB && typeof env.DB.prepare === 'function');

  if (hasD1) {
    const authCtx = await authenticateRequest(env.DB, request);
    if (!authCtx?.user) {
      return jsonRes({ success: false, error: '슈퍼관리자 로그인이 필요합니다.' }, 401);
    }
    if (authCtx.role !== 'SUPER_ADMIN') {
      return jsonRes({ success: false, error: '슈퍼관리자 권한이 필요합니다.' }, 403);
    }
  }

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
    let marts = Array.isArray(martData.marts) ? martData.marts : [];
    if (hasD1) {
      const [mRes, oRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM mart_suppliers ORDER BY created_at DESC').all().catch(() => null),
        env.DB.prepare('SELECT mart_id, COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS gmv FROM orders GROUP BY mart_id').all().catch(() => null)
      ]);
      if (mRes?.results?.length) {
        const orderStats = new Map((oRes?.results || []).map(r => [r.mart_id, r]));
        marts = mRes.results.map(m => {
          const st = orderStats.get(m.id) || { cnt: 0, gmv: 0 };
          return {
            ...m,
            name: m.mart_name || m.name || '하나로마트',
            rep_name: m.operator_name || '-',
            devices_cnt: Number(m.devices_cnt ?? 1),
            today_orders: Number(st.cnt || 0),
            today_gmv: Number(st.gmv || 0)
          };
        });
      }
    }
    const normalizedMarts = marts.map(m => ({
      ...m,
      name: m.name || m.mart_name || '하나로마트',
      rep_name: m.rep_name || m.operator_name || '-',
      biz_number: m.biz_number || '-',
      phone: m.phone || '-',
      devices_cnt: Number(m.devices_cnt ?? 1),
      today_orders: Number(m.today_orders ?? 0),
      today_gmv: Number(m.today_gmv ?? 0)
    }));
    return jsonRes({ success: true, marts: normalizedMarts });
  }
  if (subPath === 'stores') {
    const foodOrders = Array.isArray(storeData.orders) ? storeData.orders : [];
    const foodGmv = foodOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const stores = storeData.store
      ? [{
          ...storeData.store,
          name: storeData.store.name || storeData.store.store_name || '가맹점',
          rep_name: storeData.store.rep_name || storeData.store.owner_name || '-',
          biz_number: storeData.store.biz_number || '-',
          phone: storeData.store.phone || '-',
          devices_cnt: Number(storeData.store.devices_cnt ?? 1),
          today_orders: Number(storeData.store.today_orders ?? foodOrders.length),
          today_gmv: Number(storeData.store.today_gmv ?? foodGmv)
        }]
      : [];
    return jsonRes({ success: true, stores });
  }
  if (subPath === 'devices') {
    return jsonRes({ success: true, devices: [] });
  }
  if (subPath === 'payments/transactions') {
    return jsonRes({ success: true, transactions: [] });
  }
  if (subPath === 'agencies') {
    return jsonRes({ success: true, agencies: [] });
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
    if (hasD1) {
      const res = await env.DB.prepare(`
        SELECT
          a.id, a.user_id, u.email AS actor_email, u.display_name AS actor_name, u.role AS actor_role,
          a.mart_id, a.action, a.target_type, a.target_id, a.detail_json, a.ip_address, a.created_at
        FROM auth_audit_logs a
        LEFT JOIN platform_users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT 100
      `).all().catch(() => null);
      const logs = (res?.results || []).map(r => ({
        ...r,
        detail: r.detail_json ? (() => { try { return JSON.parse(r.detail_json); } catch (_) { return r.detail_json; } })() : null,
        created_at_iso: r.created_at ? new Date(Number(r.created_at)).toISOString() : ''
      }));
      return jsonRes({ success: true, logs });
    }
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
