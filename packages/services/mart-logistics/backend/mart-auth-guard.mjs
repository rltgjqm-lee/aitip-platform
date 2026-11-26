/**
 * AITIP Mart Logistics - Auth, RBAC & Multi-Tenant Guard Module (ESM)
 * - 세션 유효시간: 기본 1시간 (3,600초) + 명시적 세션 연장(extendSession) 지원
 * - RBAC 역할: SUPER_ADMIN | MART_ADMIN | MART_PICKER | B2B_ORG
 * - 멀티테넌트 격리: 일반 마트 계정은 세션의 user.mart_id 강제 고정, SUPER_ADMIN만 지점 전환 허용
 * - R2 미디어 보호: 전용 객체는 소유 mart_id 또는 SUPER_ADMIN만 수정/삭제, SHARED 삭제는 SUPER_ADMIN 전용
 */

import {
  DEFAULT_SESSION_COOKIE_NAME,
  DEFAULT_SESSION_TTL_SECONDS,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  parseCookies,
  nextAuthUid
} from '../../../core/shared/auth-crypto.mjs';

export const SESSION_TTL_SECONDS = DEFAULT_SESSION_TTL_SECONDS; // 3600초 (1시간)

export function getClientIp(request) {
  return (
    request?.headers?.get?.('CF-Connecting-IP') ||
    request?.headers?.get?.('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function extractSessionToken(request) {
  const authHeader = request?.headers?.get?.('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookieHeader = request?.headers?.get?.('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  return cookies[DEFAULT_SESSION_COOKIE_NAME] || '';
}

export async function recordAuditLog(db, {
  userId = null,
  martId = null,
  action,
  targetType = null,
  targetId = null,
  detail = null,
  ipAddress = null
} = {}) {
  if (!db || typeof db.prepare !== 'function' || !action) return false;
  await db.prepare(`
    INSERT INTO auth_audit_logs (
      id, user_id, mart_id, action, target_type, target_id, detail_json, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    nextAuthUid('aud'),
    userId,
    martId,
    String(action),
    targetType,
    targetId,
    detail ? JSON.stringify(detail) : null,
    ipAddress,
    Date.now()
  ).run().catch(() => {});
  return true;
}

export async function loginWithPassword(db, { email, password, userAgent = '', ipAddress = '' } = {}) {
  const normEmail = String(email || '').trim().toLowerCase();
  const plain = String(password || '');
  if (!normEmail || !plain) {
    return { ok: false, status: 400, error: '이메일과 비밀번호를 입력해 주세요.' };
  }

  const user = await db.prepare(
    'SELECT id, email, display_name, password_hash, role, mart_id, status FROM platform_users WHERE lower(email) = ? LIMIT 1'
  ).bind(normEmail).first();

  if (!user || user.status !== 'ACTIVE') {
    await recordAuditLog(db, {
      userId: user?.id || null,
      martId: user?.mart_id || null,
      action: 'LOGIN_FAILED',
      targetType: 'USER',
      targetId: normEmail,
      detail: { reason: user ? `STATUS_${user.status}` : 'USER_NOT_FOUND' },
      ipAddress
    });
    return { ok: false, status: 401, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  const valid = await verifyPassword(plain, user.password_hash);
  if (!valid) {
    await recordAuditLog(db, {
      userId: user.id,
      martId: user.mart_id || null,
      action: 'LOGIN_FAILED',
      targetType: 'USER',
      targetId: user.id,
      detail: { reason: 'INVALID_PASSWORD' },
      ipAddress
    });
    return { ok: false, status: 401, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const sessionId = nextAuthUid('ses');
  const rawToken = generateSessionToken();
  const tokenHash = await hashSessionToken(rawToken);

  await db.batch([
    db.prepare(`
      INSERT INTO auth_sessions (
        id, user_id, token_hash, role, mart_id, user_agent, ip_address, expires_at, revoked_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `).bind(
      sessionId, user.id, tokenHash, user.role, user.mart_id || null,
      String(userAgent || '').slice(0, 240), String(ipAddress || '').slice(0, 64),
      expiresAt, now
    ),
    db.prepare('UPDATE platform_users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, user.id)
  ]);

  await recordAuditLog(db, {
    userId: user.id,
    martId: user.mart_id || null,
    action: 'LOGIN_SUCCESS',
    targetType: 'SESSION',
    targetId: sessionId,
    detail: { ttl_seconds: SESSION_TTL_SECONDS },
    ipAddress
  });

  return {
    ok: true,
    token: rawToken,
    session_id: sessionId,
    expires_at: expiresAt,
    remaining_seconds: SESSION_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      mart_id: user.mart_id || null
    }
  };
}

export async function authenticateRequest(db, request) {
  if (!db || typeof db.prepare !== 'function') return null;
  const rawToken = extractSessionToken(request);
  if (!rawToken) return null;

  const tokenHash = await hashSessionToken(rawToken);
  const now = Date.now();
  const row = await db.prepare(`
    SELECT
      s.id AS session_id,
      s.user_id,
      s.role AS session_role,
      s.mart_id AS session_mart_id,
      s.expires_at,
      s.revoked_at,
      u.email,
      u.display_name,
      u.role AS user_role,
      u.mart_id AS user_mart_id,
      u.status AS user_status
    FROM auth_sessions s
    INNER JOIN platform_users u ON u.id = s.user_id
    WHERE s.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();

  if (!row || row.revoked_at || row.user_status !== 'ACTIVE' || Number(row.expires_at) <= now) {
    return null;
  }

  const remainingSeconds = Math.max(0, Math.floor((Number(row.expires_at) - now) / 1000));
  return {
    token: rawToken,
    session_id: row.session_id,
    expires_at: Number(row.expires_at),
    remaining_seconds: remainingSeconds,
    role: row.user_role,
    user: {
      id: row.user_id,
      email: row.email,
      display_name: row.display_name,
      role: row.user_role,
      mart_id: row.user_mart_id || null
    }
  };
}

export async function extendSession(db, authCtx, { ipAddress = '' } = {}) {
  if (!db || !authCtx?.session_id) {
    return { ok: false, status: 401, error: '유효한 로그인 세션이 없습니다.' };
  }
  const now = Date.now();
  const nextExpiresAt = now + SESSION_TTL_SECONDS * 1000;
  const res = await db.prepare(`
    UPDATE auth_sessions
    SET expires_at = ?
    WHERE id = ? AND revoked_at IS NULL AND expires_at > ?
  `).bind(nextExpiresAt, authCtx.session_id, now).run();

  if (!res?.meta?.changes) {
    return { ok: false, status: 401, error: '만료되었거나 종료된 세션입니다. 다시 로그인해 주세요.' };
  }

  await recordAuditLog(db, {
    userId: authCtx.user.id,
    martId: authCtx.user.mart_id || null,
    action: 'SESSION_EXTENDED',
    targetType: 'SESSION',
    targetId: authCtx.session_id,
    detail: { ttl_seconds: SESSION_TTL_SECONDS, expires_at: nextExpiresAt },
    ipAddress
  });

  return {
    ok: true,
    session_id: authCtx.session_id,
    expires_at: nextExpiresAt,
    remaining_seconds: SESSION_TTL_SECONDS,
    user: authCtx.user
  };
}

export async function revokeSession(db, authCtx, { ipAddress = '' } = {}) {
  if (!db || !authCtx?.session_id) return false;
  const now = Date.now();
  await db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE id = ?')
    .bind(now, authCtx.session_id).run();
  await recordAuditLog(db, {
    userId: authCtx.user.id,
    martId: authCtx.user.mart_id || null,
    action: 'LOGOUT',
    targetType: 'SESSION',
    targetId: authCtx.session_id,
    ipAddress
  });
  return true;
}

export function resolveTenantMartId(authCtx, request, fallbackMartId = 'MRT-11-650-01-47121-0001') {
  const url = request?.url ? new URL(request.url) : null;
  const requestedMartId = (
    request?.headers?.get?.('X-Mart-Id') ||
    url?.searchParams?.get('mart_id') ||
    ''
  ).trim();

  if (authCtx?.user) {
    if (authCtx.role === 'SUPER_ADMIN') {
      return requestedMartId || authCtx.user.mart_id || fallbackMartId;
    }
    return authCtx.user.mart_id || fallbackMartId;
  }

  return requestedMartId || fallbackMartId;
}

export function isPublicMartEndpoint(method, subPath) {
  const m = String(method || 'GET').toUpperCase();
  const p = String(subPath || '').replace(/^\/+|\/+$/g, '');

  if (p === 'auth/login' && m === 'POST') return true;
  if (p === 'auth/logout' && m === 'POST') return true;
  if (p === 'auth/me' && m === 'GET') return true;

  // 소비자 PWA 공개 읽기 및 주문/공구 참여
  if (m === 'GET' && (p === 'catalog' || p === 'pwa/config' || p === 'group-buys')) return true;
  if (m === 'GET' && p.startsWith('media/public/')) return true;
  if (m === 'POST' && (p === 'orders' || p === 'group-buys/join')) return true;

  return false;
}

export function checkMartApiAccess(method, subPath, authCtx) {
  const m = String(method || 'GET').toUpperCase();
  const p = String(subPath || '').replace(/^\/+|\/+$/g, '');

  if (isPublicMartEndpoint(m, p)) {
    return { allowed: true };
  }

  if (!authCtx?.user) {
    return { allowed: false, status: 401, error: '로그인이 필요합니다. (세션 만료 또는 미인증)' };
  }

  const role = authCtx.role;
  if (role === 'SUPER_ADMIN') return { allowed: true };

  if (p === 'auth/extend' && m === 'POST') {
    return { allowed: true };
  }

  // 슈퍼관리자 전용 영역
  if (p === 'marts' || (m === 'DELETE' && p.startsWith('media/shared'))) {
    return { allowed: false, status: 403, error: '슈퍼관리자 권한이 필요합니다.' };
  }

  // 마트 현장 피커 허용 영역
  const pickerAllowed = (
    (m === 'GET' && (p === 'orders' || p === 'picking' || p === 'boxing' || p === 'profile' || p === 'media/shared' || p === 'haccp/search' || p === 'haccp/proxy-image')) ||
    (m === 'POST' && (p === 'orders/status' || p === 'orders/adjust' || p === 'haccp/batch'))
  );
  if (role === 'MART_PICKER') {
    return pickerAllowed
      ? { allowed: true }
      : { allowed: false, status: 403, error: '피킹 담당자 권한으로 접근할 수 없는 기능입니다.' };
  }

  // 마트 관리자 허용 영역
  if (role === 'MART_ADMIN') {
    return { allowed: true };
  }

  // B2B 기관 담당자 허용 영역
  if (role === 'B2B_ORG') {
    const b2bAllowed = (m === 'GET' && (p === 'orders' || p === 'profile'));
    return b2bAllowed
      ? { allowed: true }
      : { allowed: false, status: 403, error: '기관 담당자 권한으로 접근할 수 없는 기능입니다.' };
  }

  return { allowed: false, status: 403, error: '접근 권한이 없습니다.' };
}

export function canModifyMediaObject(authCtx, mediaRow, { isDelete = false } = {}) {
  if (!authCtx?.user) return false;
  if (authCtx.role === 'SUPER_ADMIN') return true;
  if (!mediaRow) return false;

  const isShared = String(mediaRow.domain || '').toUpperCase() === 'SHARED'
    || String(mediaRow.r2_object_key || '').startsWith('shared/');

  if (isShared) {
    return !isDelete && authCtx.role === 'MART_ADMIN';
  }
  return authCtx.role === 'MART_ADMIN' && mediaRow.tenant_id === authCtx.user.mart_id;
}
