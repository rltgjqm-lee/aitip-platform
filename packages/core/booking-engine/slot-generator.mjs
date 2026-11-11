/**
 * ============================================================================
 * AITIP Core Booking Engine - 가용 타임슬롯 생성기 (ESM)
 * 준수 규격: DOC-16
 * 운영시간, 브레이크타임, 기존 확정 예약, 요구 소요시간을 기반으로 가용 슬롯 계산
 * ============================================================================
 */

/**
 * 2개 시간 구간 중첩(Overlap) 여부 판정
 * [s1, e1) vs [s2, e2)
 */
export function isOverlapping(startA, endA, startB, endB) {
  const sa = new Date(startA).getTime();
  const ea = new Date(endA).getTime();
  const sb = new Date(startB).getTime();
  const eb = new Date(endB).getTime();
  return Math.max(sa, sb) < Math.min(ea, eb);
}

/**
 * 특정 일자의 가용 타임 슬롯 리스트 생성
 * @param {Object} options
 * @param {string} options.dateStr - YYYY-MM-DD
 * @param {string} options.openTime - '09:00'
 * @param {string} options.closeTime - '18:00'
 * @param {string} [options.breakStart] - '12:00'
 * @param {string} [options.breakEnd] - '13:00'
 * @param {number} [options.slotIntervalMinutes=30] - 기본 슬롯 간격 (분)
 * @param {number} [options.requiredDurationMinutes=30] - 시술/서비스 총 소요시간 (분)
 * @param {Array<{start_time: string, end_time: string}>} [options.existingBookings=[]] - 기존 예약 목록
 * @returns {Array<{start_time: string, end_time: string, is_available: boolean}>}
 */
export function generateAvailableSlots(options) {
  const {
    dateStr,
    openTime,
    closeTime,
    breakStart,
    breakEnd,
    slotIntervalMinutes = 30,
    requiredDurationMinutes = 30,
    existingBookings = []
  } = options;

  const slots = [];
  const [openHour, openMin] = openTime.split(':').map(Number);
  const [closeHour, closeMin] = closeTime.split(':').map(Number);

  const dayStart = new Date(`${dateStr}T${openTime}:00`);
  const dayEnd = new Date(`${dateStr}T${closeTime}:00`);

  let current = new Date(dayStart);

  while (current < dayEnd) {
    const slotStart = new Date(current);
    const slotEnd = new Date(current.getTime() + requiredDurationMinutes * 60 * 1000);

    // 영업 종료 시각을 넘는 슬롯은 제외
    if (slotEnd > dayEnd) break;

    const slotStartStr = slotStart.toISOString();
    const slotEndStr = slotEnd.toISOString();

    let isBlocked = false;

    // 브레이크타임 중첩 검사
    if (breakStart && breakEnd) {
      const bStart = new Date(`${dateStr}T${breakStart}:00`).toISOString();
      const bEnd = new Date(`${dateStr}T${breakEnd}:00`).toISOString();
      if (isOverlapping(slotStartStr, slotEndStr, bStart, bEnd)) {
        isBlocked = true;
      }
    }

    // 기존 확정 예약과의 중첩 검사
    if (!isBlocked) {
      for (const eb of existingBookings) {
        if (isOverlapping(slotStartStr, slotEndStr, eb.start_time, eb.end_time)) {
          isBlocked = true;
          break;
        }
      }
    }

    slots.push({
      start_time: slotStartStr,
      end_time: slotEndStr,
      is_available: !isBlocked
    });

    // 다음 슬롯으로 전진
    current = new Date(current.getTime() + slotIntervalMinutes * 60 * 1000);
  }

  return slots;
}
