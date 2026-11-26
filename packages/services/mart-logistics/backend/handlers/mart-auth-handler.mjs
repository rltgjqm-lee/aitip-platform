/**
 * AITIP Mart API - Auth Domain Handler (ESM)
 * 담당 엔드포인트: /auth/login, /auth/me, /auth/extend, /auth/logout
 */

import {
  buildSessionCookieHeader,
  buildClearSessionCookieHeader
} from '../../../../core/shared/auth-crypto.mjs';
import {
  getClientIp,
  loginWithPassword,
  extendSession,
  revokeSession
} from '../mart-auth-guard.mjs';

export async function handleMartAuthRoutes({
  request,
  env,
  method,
  subPath,
  body,
  hasD1,
  authCtx,
  isHttps,
  jsonRes
}) {
  if (subPath === 'auth/login' && method === 'POST') {
    if (!hasD1) return jsonRes({ success: false, error: 'D1 데이터베이스 바인딩이 필요합니다.' }, 503);
    const result = await loginWithPassword(env.DB, {
      email: body?.email,
      password: body?.password,
      userAgent: request.headers.get('User-Agent') || '',
      ipAddress: getClientIp(request)
    });
    if (!result.ok) return jsonRes({ success: false, error: result.error }, result.status || 401);
    return jsonRes(
      {
        success: true,
        user: result.user,
        expires_at: result.expires_at,
        remaining_seconds: result.remaining_seconds
      },
      200,
      { 'Set-Cookie': buildSessionCookieHeader(result.token, { secure: isHttps }) }
    );
  }

  if (subPath === 'auth/me' && method === 'GET') {
    if (!authCtx) {
      return jsonRes({ success: true, authenticated: false, user: null, expires_at: null, remaining_seconds: 0 });
    }
    return jsonRes({
      success: true,
      authenticated: true,
      user: authCtx.user,
      expires_at: authCtx.expires_at,
      remaining_seconds: authCtx.remaining_seconds
    });
  }

  if (subPath === 'auth/extend' && method === 'POST') {
    if (!hasD1) return jsonRes({ success: false, error: 'D1 데이터베이스 바인딩이 필요합니다.' }, 503);
    if (!authCtx) return jsonRes({ success: false, error: '로그인이 필요합니다.' }, 401);
    const extended = await extendSession(env.DB, authCtx, { ipAddress: getClientIp(request) });
    if (!extended.ok) return jsonRes({ success: false, error: extended.error }, extended.status || 401);
    return jsonRes(
      {
        success: true,
        user: extended.user,
        expires_at: extended.expires_at,
        remaining_seconds: extended.remaining_seconds
      },
      200,
      { 'Set-Cookie': buildSessionCookieHeader(authCtx.token, { secure: isHttps }) }
    );
  }

  if (subPath === 'auth/logout' && method === 'POST') {
    if (hasD1 && authCtx) {
      await revokeSession(env.DB, authCtx, { ipAddress: getClientIp(request) });
    }
    return jsonRes(
      { success: true },
      200,
      { 'Set-Cookie': buildClearSessionCookieHeader({ secure: isHttps }) }
    );
  }

  return null;
}
