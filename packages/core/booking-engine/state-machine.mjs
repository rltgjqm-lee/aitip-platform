/**
 * ============================================================================
 * AITIP Core Booking Engine - 예약 상태 머신 (ESM)
 * 준수 규격: DOC-16
 * 상태 전이: REQUESTED -> CONFIRMED -> CHECKED_IN -> COMPLETED
 *           REQUESTED / CONFIRMED -> CANCELLED
 *           CONFIRMED -> NOSHOW
 * ============================================================================
 */

export const BOOKING_STATUS = {
  REQUESTED: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NOSHOW: 'NOSHOW'
};

const ALLOWED_TRANSITIONS = {
  REQUESTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NOSHOW'],
  CHECKED_IN: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NOSHOW: []
};

/**
 * 상태 전이 가능 여부 검증
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
export function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

/**
 * 상태 전이 강제 검증 함수 (실패 시 예외 발생)
 * @param {string} fromStatus
 * @param {string} toStatus
 */
export function assertTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(`[BookingStateMachine] 잘못된 상태 전이: ${fromStatus} -> ${toStatus}`);
  }
}
