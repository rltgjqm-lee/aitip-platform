/**
 * AITIP Platform - R2 객체 키 표준 빌더 (ESM)
 * 단일 D1(aitip-core-db) + 2 R2(aitip-media-public / aitip-media-private) 안에서
 * 도메인(mart/food/shared) · 지역(시도-시군구) · 테넌트UID · 항목별로 Prefix를 분리 생성한다.
 */

export function extractRegionCodeFromUid(tenantUid = '') {
  const parts = String(tenantUid || '').trim().split('-');
  if (parts.length >= 3 && /^\d{2}$/.test(parts[1]) && /^\d{3}$/.test(parts[2])) {
    return `${parts[1]}-${parts[2]}`;
  }
  return '00-000';
}

export function buildPublicMediaKey({
  domain = 'MART',
  tenantUid = '',
  itemType = 'products',
  mediaId = '',
  variant = 'orig',
  ext = 'webp'
} = {}) {
  const dom = String(domain || 'MART').toLowerCase() === 'food' ? 'food' : 'mart';
  const region = extractRegionCodeFromUid(tenantUid);
  const safeTenant = String(tenantUid || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeType = String(itemType || 'products').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeVar = variant === 'thumb' ? 'thumb' : 'orig';
  return `${dom}/${region}/${safeTenant}/${safeType}/${mediaId}_${safeVar}.${ext}`;
}

export function buildSharedMediaKey({ kind = 'common-pool', key = '', ext = 'webp' } = {}) {
  const safeKey = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (kind === 'barcode') return `shared/barcode/${safeKey}.${ext}`;
  return `shared/common-pool/${safeKey}.${ext}`;
}

export function buildPrivateEvidenceKey({
  domain = 'MART',
  tenantUid = '',
  evidenceType = 'delivery',
  mediaId = '',
  yyyymm = '',
  ext = 'webp'
} = {}) {
  const dom = String(domain || 'MART').toLowerCase() === 'food' ? 'food' : 'mart';
  const region = extractRegionCodeFromUid(tenantUid);
  const safeTenant = String(tenantUid || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  const ym = yyyymm || new Date().toISOString().slice(0, 7);
  return `private/${dom}/${region}/${safeTenant}/${evidenceType}/${ym}/${mediaId}.${ext}`;
}
