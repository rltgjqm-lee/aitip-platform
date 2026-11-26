/**
 * AITIP Platform - Auth Crypto & Session Cookie Utilities (ESM)
 * 순수 Web Crypto API 기반 (Cloudflare Workers & Node 20+ 공용, 외부 의존성 0)
 * - 비밀번호 해시: PBKDF2-SHA256 (100,000 iterations — Cloudflare Workers 최대 지원치)
 * - 세션 토큰: 32바이트 CSPRNG base64url + DB 저장용 SHA-256 해시
 */

const PBKDF2_ALGO = 'pbkdf2_sha256';
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

export const DEFAULT_SESSION_COOKIE_NAME = 'aitip_sid';
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60; // 1시간 (3,600초)

let _authUidSeq = 0;

export function nextAuthUid(prefix = 'usr') {
  _authUidSeq = (_authUidSeq + 1) % 10000;
  return `${prefix}_${Date.now()}_${String(_authUidSeq).padStart(4, '0')}`;
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '').trim();
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derivePbkdf2(password, saltBytes, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(password)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const plain = String(password || '');
  if (plain.length < 8) {
    throw new Error('비밀번호는 최소 8자 이상이어야 합니다.');
  }
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const derived = await derivePbkdf2(plain, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ALGO}$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

export async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 4 || parts[0] !== PBKDF2_ALGO) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 100000) return false;
  const salt = hexToBytes(parts[2]);
  const expected = hexToBytes(parts[3]);
  if (!salt || !expected) return false;
  const actual = await derivePbkdf2(String(password || ''), salt, iterations);
  return timingSafeEqual(actual, expected);
}

export function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function hashSessionToken(token) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(token || '')));
  return bytesToHex(new Uint8Array(digest));
}

export function parseCookies(cookieHeader = '') {
  const out = {};
  const raw = String(cookieHeader || '');
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function buildSessionCookieHeader(token, {
  name = DEFAULT_SESSION_COOKIE_NAME,
  maxAgeSeconds = DEFAULT_SESSION_TTL_SECONDS,
  secure = true
} = {}) {
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearSessionCookieHeader({
  name = DEFAULT_SESSION_COOKIE_NAME,
  secure = true
} = {}) {
  const parts = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
