// Cloudflare Pages Serverless Function Entry Router for /api/mart/* (ESM)
// 모놀리스 방지: 인증/미디어/커머스 도메인별 ESM 핸들러에 위임
import martData from './mart_data.json';
import { MartD1Adapter } from '../../../packages/services/mart-logistics/backend/mart-d1-adapter.mjs';
import {
  authenticateRequest,
  resolveTenantMartId,
  checkMartApiAccess
} from '../../../packages/services/mart-logistics/backend/mart-auth-guard.mjs';
import { handleMartAuthRoutes } from '../../../packages/services/mart-logistics/backend/handlers/mart-auth-handler.mjs';
import { handleMartMediaRoutes } from '../../../packages/services/mart-logistics/backend/handlers/mart-media-handler.mjs';
import { handleMartCommerceRoutes } from '../../../packages/services/mart-logistics/backend/handlers/mart-commerce-handler.mjs';

function buildCorsHeaders(request) {
  const origin = request?.headers?.get?.('Origin') || '';
  const headers = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Mart-Id',
    'Content-Type': 'application/json; charset=utf-8'
  };
  if (origin) headers['Access-Control-Allow-Credentials'] = 'true';
  return headers;
}

let _d1Seeded = false;

export async function onRequest(context) {
  const { request, params, env } = context;
  const corsHeaders = buildCorsHeaders(request);
  const jsonRes = (data, status = 200, extraHeaders = {}) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, ...extraHeaders } });

  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const subPath = (params.path || []).join('/').replace(/\/+$/, '');
  const body = (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')
    ? await request.json().catch(() => ({}))
    : {};

  const isHttps = new URL(request.url).protocol === 'https:';
  const hasD1 = Boolean(env?.DB && typeof env.DB.prepare === 'function');
  const authCtx = hasD1 ? await authenticateRequest(env.DB, request) : null;

  const authRes = await handleMartAuthRoutes({
    request, env, method, subPath, body, hasD1, authCtx, isHttps, jsonRes
  });
  if (authRes) return authRes;

  if (hasD1) {
    const access = checkMartApiAccess(method, subPath, authCtx);
    if (!access.allowed) {
      return jsonRes({ success: false, error: access.error }, access.status || 401);
    }
  }

  const tenantMartId = resolveTenantMartId(
    authCtx,
    request,
    env?.DEFAULT_MART_ID || martData.mart?.mart_id || 'MRT-11-650-01-47121-0001'
  );

  let d1 = null;
  if (hasD1) {
    d1 = new MartD1Adapter(env, tenantMartId);
    if (!_d1Seeded) {
      await d1.seedIfEmpty(martData);
      _d1Seeded = true;
    }
  }

  const ctx = { request, env, method, subPath, body, d1, martData, tenantMartId, jsonRes };
  try {
    const commerceRes = await handleMartCommerceRoutes(ctx);
    if (commerceRes) return commerceRes;

    const mediaRes = await handleMartMediaRoutes(ctx);
    if (mediaRes) return mediaRes;

    return jsonRes({ success: false, error: `Unknown mart endpoint: /api/mart/${subPath}` }, 404);
  } catch (err) {
    const status = Number(err?.status || 500);
    return jsonRes({ success: false, error: err?.message || '서버 처리 중 오류가 발생했습니다.' }, status);
  }
}
