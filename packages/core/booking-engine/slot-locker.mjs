/**
 * ============================================================================
 * AITIP Core Booking Engine - 오버부킹 방지 분산 뮤텍스 락 (ESM)
 * 준수 규격: DOC-16
 * 결제 진행 중 동시 예약 시도를 방지하는 TTL 기반 메모리/D1 락 엔진
 * ============================================================================
 */

class SlotLocker {
  constructor(defaultTtlSeconds = 300) {
    this.defaultTtl = defaultTtlSeconds * 1000;
    this.locks = new Map(); // key -> { expireAt, owner }
  }

  /**
   * 락 키 생성 (가맹점 + 자원ID + 시작시각)
   */
  _buildKey(storeId, resourceId, startTime) {
    return `lock:${storeId}:${resourceId}:${startTime}`;
  }

  /**
   * 슬롯 락 획득 시도
   * @param {string} storeId
   * @param {string} resourceId (roomId, stylistId, doctorId 등)
   * @param {string} startTime
   * @param {string} ownerToken (세션ID 또는 임시 식별자)
   * @param {number} [ttlMs]
   * @returns {boolean} 성공 여부
   */
  acquire(storeId, resourceId, startTime, ownerToken, ttlMs = this.defaultTtl) {
    const key = this._buildKey(storeId, resourceId, startTime);
    const now = Date.now();
    const existing = this.locks.get(key);

    if (existing && existing.expireAt > now && existing.owner !== ownerToken) {
      return false; // 타인이 이미 선점 중
    }

    this.locks.set(key, {
      expireAt: now + ttlMs,
      owner: ownerToken
    });
    return true;
  }

  /**
   * 슬롯 락 해제
   * @param {string} storeId
   * @param {string} resourceId
   * @param {string} startTime
   * @param {string} ownerToken
   */
  release(storeId, resourceId, startTime, ownerToken) {
    const key = this._buildKey(storeId, resourceId, startTime);
    const existing = this.locks.get(key);
    if (existing && existing.owner === ownerToken) {
      this.locks.delete(key);
      return true;
    }
    return false;
  }

  /**
   * 만료된 락 정리 (GC)
   */
  cleanExpired() {
    const now = Date.now();
    for (const [key, val] of this.locks.entries()) {
      if (val.expireAt <= now) {
        this.locks.delete(key);
      }
    }
  }
}

export const slotLocker = new SlotLocker();
