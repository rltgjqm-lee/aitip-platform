# AITIP Booking Clinic Service (의원/클리닉 예약 및 접수 서비스)

- 도메인: `CLINIC` (내과, 이비인후과, 소아과, 한의원, 치과 등)
- 규격: DOC-16
- 핵심 모델: 진료 순번 대기열 큐, 초진/재진 구분(`booking_clinic_details`), 원내 대기표 발권
- 법률 규격: 의료법 제27조 준수 (수수료 0원, 비급여 할인쿠폰 금지, 현장 본인부담금 수납)
- 의존성: `packages/core/booking-engine`
