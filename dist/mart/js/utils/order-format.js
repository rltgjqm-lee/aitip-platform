/**
 * AITIP Mart Portal - 주문번호 축약 포맷터 (ESM)
 * 내부 DB/API/data-id에서는 전체 UID(ORD-...-YYMMDD-SEQ)를 유지하고,
 * 화면 표출에서는 읽기 쉬운 YYMMDD-SEQ 형태로 축약한다.
 */

export function formatShortOrderNo(orderId = '') {
  const s = String(orderId || '').trim();
  const parts = s.split('-');
  if (parts.length >= 2 && /^\d{6}$/.test(parts[parts.length - 2])) {
    return `${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
  }
  return s || '-';
}
