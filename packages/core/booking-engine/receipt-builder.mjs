/**
 * ============================================================================
 * AITIP Core Booking Engine - 단말기(ESC/POS 80mm) 예약 전표 포맷터 (ESM)
 * 준수 규격: DOC-16, DOC-02 (TastyPrinter 하드웨어 CTI 연동)
 * 분야별(숙박 체크인증, 미용 시술표, 의원 대기표) 텍스트 전표 템플릿 조립
 * ============================================================================
 */

export function buildBookingReceipt(booking, extensionDetails, store) {
  const { service_domain, id, start_time, total_amount, deposit_amount } = booking;
  const storeName = store?.store_name || 'AITIP 제휴 가맹점';
  const startLocal = new Date(start_time).toLocaleString('ko-KR');

  let body = '';

  if (service_domain === 'STAY') {
    body = [
      `[숙박 체크인 확인증]`,
      `------------------------------------------`,
      `예약번호 : ${id}`,
      `객실배정 : ${extensionDetails.room_id || '현장배정'}`,
      `투숙인원 : 성인 ${extensionDetails.guest_count || 2}명`,
      `입실일자 : ${extensionDetails.checkin_date}`,
      `퇴실일자 : ${extensionDetails.checkout_date}`,
      `차량번호 : ${extensionDetails.vehicle_number || '미등록'}`,
      `------------------------------------------`,
      `결제총액 : ${Number(total_amount).toLocaleString()}원`,
      `이용안내 : 입실 15:00 / 퇴실 익일 11:00`
    ].join('\n');
  } else if (service_domain === 'BEAUTY') {
    body = [
      `[헤어/뷰티 시술 전표]`,
      `------------------------------------------`,
      `예약번호 : ${id}`,
      `예약일시 : ${startLocal}`,
      `담당스태프: ${extensionDetails.stylist_id || '지정 없음'}`,
      `시술소요 : 약 ${extensionDetails.total_duration_minutes || 30}분`,
      `시술메뉴 : ${extensionDetails.treatment_menus || '현장 상담'}`,
      `------------------------------------------`,
      `결제예정 : ${Number(total_amount).toLocaleString()}원`,
      `예약보증 : ${Number(deposit_amount).toLocaleString()}원 (선결제 완료)`
    ].join('\n');
  } else if (service_domain === 'CLINIC') {
    body = [
      `==========================================`,
      `             진 료  대 기 표              `,
      `==========================================`,
      `대기순번 : [ ${extensionDetails.queue_number || '1'}번 ]`,
      `------------------------------------------`,
      `접수번호 : ${id}`,
      `진료일시 : ${startLocal}`,
      `담당의사 : ${extensionDetails.doctor_id || '진료의'} 원장`,
      `진료과목 : ${extensionDetails.department_code || '일반진료'}`,
      `환자구분 : ${extensionDetails.is_first_visit ? '초진 (신규)' : '재진'}`,
      `보험구분 : 국민건강보험`,
      `------------------------------------------`,
      `* 호출 시 진료실 앞 대기석으로 이동해 주세요.`
    ].join('\n');
  }

  return [
    `==========================================`,
    `           ${storeName}           `,
    `==========================================`,
    body,
    `------------------------------------------`,
    `발행일시 : ${new Date().toLocaleString('ko-KR')}`,
    `플랫폼   : AITIP 상생 예약 네트워크 (수수료 0%)`,
    `==========================================`
  ].join('\n');
}
