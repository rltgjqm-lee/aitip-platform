/**
 * ============================================================================
 * AITIP Core Booking Engine - 취소 위약금 및 환불액 계산기 (ESM)
 * 준수 규격: DOC-16
 * 정책:
 *   - STAY (숙박): D-7 이전 100% 환불, D-3 50%, D-1 20%, 당일 0%
 *   - BEAUTY (미용): 2시간 전 100% 환불, 2시간 이내 취소 시 예약금 몰수
 *   - CLINIC (의원): 의료법상 위약금 0% (전액 무료 취소)
 * ============================================================================
 */

export function calculateCancellationPenalty(booking, cancelDate = new Date()) {
  const { service_domain, start_time, total_amount, deposit_amount } = booking;
  const startTimeMs = new Date(start_time).getTime();
  const cancelTimeMs = new Date(cancelDate).getTime();
  const diffHours = (startTimeMs - cancelTimeMs) / (1000 * 60 * 60);

  // 1. 의원/클리닉: 의료법에 따라 위약금 부과 원천 금지
  if (service_domain === 'CLINIC') {
    return {
      penalty_fee: 0,
      refund_amount: total_amount,
      policy_applied: 'CLINIC_NO_PENALTY'
    };
  }

  // 2. 이미용: 2시간 전 100% 환불, 2시간 이내 노쇼 방지 예약금 몰수
  if (service_domain === 'BEAUTY') {
    if (diffHours >= 2) {
      return {
        penalty_fee: 0,
        refund_amount: total_amount,
        policy_applied: 'BEAUTY_FREE_CANCEL'
      };
    } else {
      const penalty = deposit_amount > 0 ? deposit_amount : Math.floor(total_amount * 0.2);
      return {
        penalty_fee: penalty,
        refund_amount: Math.max(0, total_amount - penalty),
        policy_applied: 'BEAUTY_DEPOSIT_FORFEIT'
      };
    }
  }

  // 3. 숙박: 일자별 차등 환불
  if (service_domain === 'STAY') {
    const diffDays = diffHours / 24;
    if (diffDays >= 7) {
      return { penalty_fee: 0, refund_amount: total_amount, policy_applied: 'STAY_D7_100' };
    } else if (diffDays >= 3) {
      const penalty = Math.floor(total_amount * 0.5);
      return { penalty_fee: penalty, refund_amount: total_amount - penalty, policy_applied: 'STAY_D3_50' };
    } else if (diffDays >= 1) {
      const penalty = Math.floor(total_amount * 0.8);
      return { penalty_fee: penalty, refund_amount: total_amount - penalty, policy_applied: 'STAY_D1_20' };
    } else {
      return { penalty_fee: total_amount, refund_amount: 0, policy_applied: 'STAY_SAME_DAY_0' };
    }
  }

  // 기본 기본 정책 (24시간 전 100%)
  if (diffHours >= 24) {
    return { penalty_fee: 0, refund_amount: total_amount, policy_applied: 'STANDARD_24H_FREE' };
  }
  const defaultPenalty = Math.floor(total_amount * 0.3);
  return {
    penalty_fee: defaultPenalty,
    refund_amount: Math.max(0, total_amount - defaultPenalty),
    policy_applied: 'STANDARD_LATE_FEE'
  };
}
