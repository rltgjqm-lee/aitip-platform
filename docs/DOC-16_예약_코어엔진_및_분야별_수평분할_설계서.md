# AITIP 플랫폼 예약 코어 엔진 및 분야별 수평 분할 설계서 (DOC-16)

> **문서 번호**: DOC-16-BOOKING-CORE-ARCHITECTURE  
> **표준 제정일**: 2026년 11월 10일  
> **상태**: Standard / Production Architecture  
> **적용 대상**: `packages/core/booking-engine`, `packages/services/booking-*`

---

## 1. 아키텍처 개요 및 설계 철학

### 1) 핵심 설계 원칙: Core & Extension 분리
- **단일 모놀리스 예약 테이블의 위험성 차단**:
  - 숙박(박/일), 미용(시간/디자이너), 의원(순번/진료과목)을 단일 테이블에 병합 시 발생하는 NULL 필드 범벅 및 스파게티 전역 로직을 원천 차단합니다.
  - 객체지향의 **Class Table Inheritance(클래스 테이블 상속)** 패턴을 데이터베이스와 코드 레이어에 적용합니다.
- **공통 자산 100% 재사용 (Core Engine)**:
  - TypeID 식별자 체계 (`bkg_`), 가용 타임슬롯 생성 알고리즘, 오버부킹 방지 분산 뮤텍스 락, 상태 머신, 카카오 알림톡/0504 안심번호, AITIP 단말기 ESC/POS 전표 출력, PG 결제 및 자동 위약금 계산을 공통 코어로 일원화합니다.
- **분야별 수평 분할 (Horizontal Extension)**:
  - 각 분야(숙박, 이미용, 의원)는 전용 1:1 확장 테이블과 특화 UI를 독립적으로 소유하며, 향후 비즈니스 성장 시 디렉터리 단위로 즉시 독립 별도 앱/리포지토리로 분리(Unbundle)가 가능합니다.

---

## 2. 데이터베이스 스키마 명세 (D1 SQLite)

### 1) 마스터 예약 테이블 (`bookings`)
모든 예약 건이 공통으로 가지는 시간, 고객, 금액, 상태를 보관합니다.

```sql
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,                       -- TypeID: bkg_01m7... (26자 Crockford Base32)
    store_id TEXT NOT NULL,                    -- 가맹점 ID (str_...)
    user_id TEXT NOT NULL,                     -- 고객 ID (usr_...)
    service_domain TEXT NOT NULL,              -- 도메인 구분: 'STAY', 'BEAUTY', 'CLINIC', 'TABLE', 'SPACE'
    
    -- 공통 스케줄 (ISO8601 UTC)
    start_time TEXT NOT NULL,                  -- 예약 시작 시각 (예: 2026-11-15T14:00:00Z)
    end_time TEXT NOT NULL,                    -- 예약 종료 시각 (예: 2026-11-15T15:00:00Z)
    
    -- 공통 상태 머신
    status TEXT NOT NULL DEFAULT 'REQUESTED',  -- REQUESTED, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, NOSHOW
    
    -- 공통 결제/예약금 (단위: 원)
    total_amount INTEGER NOT NULL DEFAULT 0,   -- 총 이용금액
    deposit_amount INTEGER NOT NULL DEFAULT 0, -- 예약금 (노쇼 방지 보증금)
    payment_status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIAL_PAID, FULL_PAID, REFUNDED
    
    -- 취소 및 노쇼 이력
    cancelled_at TEXT,                         -- 취소 시각
    cancel_reason TEXT,                        -- 취소 사유
    penalty_fee INTEGER DEFAULT 0,             -- 부과된 위약금
    refund_amount INTEGER DEFAULT 0,           -- 환불 완료 금액
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    CHECK (service_domain IN ('STAY', 'BEAUTY', 'CLINIC', 'TABLE', 'SPACE')),
    CHECK (status IN ('REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NOSHOW')),
    CHECK (payment_status IN ('UNPAID', 'PARTIAL_PAID', 'FULL_PAID', 'REFUNDED')),
    CHECK (start_time < end_time),
    CHECK (total_amount >= 0),
    CHECK (deposit_amount >= 0),
    CHECK (deposit_amount <= total_amount)
);

CREATE INDEX idx_bookings_store_schedule ON bookings(store_id, start_time, end_time);
CREATE INDEX idx_bookings_user ON bookings(user_id, status);
CREATE INDEX idx_bookings_domain_status ON bookings(service_domain, status);
```

---

### 2) 3대 분야별 1:1 확장 테이블

#### [분야 1] 숙박 전용 확장 (`booking_stay_details`)
```sql
CREATE TABLE booking_stay_details (
    booking_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,                     -- 객실 식별자 (예: 101호, 디럭스룸)
    guest_count INTEGER NOT NULL DEFAULT 2,    -- 투숙객 수
    extra_person_fee INTEGER DEFAULT 0,        -- 추가 인원 요금
    vehicle_number TEXT,                       -- 투숙객 주차 차량번호
    checkin_date TEXT NOT NULL,                -- 입실일 (YYYY-MM-DD)
    checkout_date TEXT NOT NULL,               -- 퇴실일 (YYYY-MM-DD)
    stay_type TEXT NOT NULL DEFAULT 'OVERNIGHT', -- OVERNIGHT(숙박), DAY_USE(대실)
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CHECK (guest_count >= 1),
    CHECK (checkin_date < checkout_date OR (stay_type = 'DAY_USE' AND checkin_date = checkout_date))
);
```

#### [분야 2] 이미용 전용 확장 (`booking_beauty_details`)
```sql
CREATE TABLE booking_beauty_details (
    booking_id TEXT PRIMARY KEY,
    stylist_id TEXT NOT NULL,                  -- 담당 시술자/디자이너 식별자
    treatment_menus TEXT NOT NULL,             -- 시술 항목 JSON (예: [{"name":"남성컷","price":20000,"duration":30}])
    total_duration_minutes INTEGER NOT NULL,   -- 총 소요시간 (합산 분)
    chair_number INTEGER,                      -- 배정된 시술 좌석 번호
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CHECK (total_duration_minutes > 0)
);
```

#### [분야 3] 의원/클리닉 전용 확장 (`booking_clinic_details`)
```sql
CREATE TABLE booking_clinic_details (
    booking_id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,                   -- 진료 의사 식별자
    department_code TEXT NOT NULL,             -- 진료과목 (MED_INTERNAL, ENT, PEDIATRICS, DERMATOLOGY 등)
    is_first_visit INTEGER NOT NULL DEFAULT 0, -- 1:초진, 0:재진
    queue_number INTEGER,                      -- 당일 원내 대기 순번표 (1~999)
    symptom_category TEXT,                     -- 주요 증상/방문 목적
    insurance_type TEXT NOT NULL DEFAULT 'NATIONAL_HEALTH', -- NATIONAL_HEALTH(건보), GENERAL(일반/비급여)
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CHECK (is_first_visit IN (0, 1)),
    CHECK (insurance_type IN ('NATIONAL_HEALTH', 'GENERAL', 'AUTO_ACCIDENT', 'WORKERS_COMP'))
);
```

---

## 3. 공통 예약 코어 엔진 (`packages/core/booking-engine`) 명세

### 1) 가용 타임슬롯 계산기 (`slot-generator.mjs`)
- 매장의 주간 운영시간(`store_hours`) 및 휴무일(`holiday_settings`), 그리고 기존 확정 예약 목록을 입력받아 예약 가능한 시간 구간(슬롯)을 실시간으로 산출합니다.
- 복수 메뉴 선택 시(미용): 소요시간을 누적 합산하여 연속된 여유 슬롯만을 필터링합니다.

### 2) 오버부킹 방지 분산 락 (`slot-locker.mjs`)
- 결제 직전 또는 예약 신청 시점부터 최대 5분(300초)간 해당 자원(룸/디자이너/의사)의 해당 시간대를 임시 점유(Lock)합니다.
- 결제가 완료되면 정식 `CONFIRMED`로 전이되며, 5분 내 미결제 시 자동 락 해제(TTL)됩니다.

### 3) 위약금 및 환불 정책 엔진 (`cancellation.mjs`)
- 이용 시작 시각 대비 취소 신청 시점의 잔여 시간을 계산하여 환불 규정을 자동 적용합니다:
  - 숙박 표준: D-7 이전 100% 환불, D-3 이전 50%, D-1 이전 20%, 당일 취소 위약금 100%(환불 불가).
  - 미용 표준: 예약 2시간 전 100% 환불, 2시간 이내 취소 시 예약금 소멸(노쇼 방지).
  - 의원: 법률상 위약금 부과 금지 (전액 예약금 없음 / 무료 취소).

### 4) 상태 머신 (`state-machine.mjs`)
- 합법적인 상태 전이만 허용:
  - `REQUESTED` $\to$ `CONFIRMED` $\to$ `CHECKED_IN` $\to$ `COMPLETED`
  - `REQUESTED` 또는 `CONFIRMED` $\to$ `CANCELLED`
  - `CONFIRMED` $\to$ `NOSHOW` (노쇼 확정)

### 5) AITIP 단말기(ESC/POS 80mm) 전표 포맷터 (`receipt-builder.mjs`)
- TastyPrinter 및 AITIP 단말기 전용 ESC/POS 바이트 스트림 조립:
  - 숙박: 체크인 전표 (객실 호수, 도어락 비밀번호 안내, 주차 등록증).
  - 미용: 시술 지시서 (담당 디자이너, 시술 메뉴, 고객 요청사항).
  - 의원: **원내 진료 대기표 (대기번호 O번, 담당 원장, 예상 대기인원 O명)**.

---

## 4. 의료법 제27조 준수 원칙 (의원 분야 철칙)

1. **중개 수수료 수취 원천 금지**:
   - 환자 1인당 예약 수수료나 중개 대가를 플랫폼이 취득하는 행위를 시스템적으로 차단합니다 (AITIP의 0% 수수료 모델 적용).
2. **할인 쿠폰 및 포인트 지급 배제**:
   - 의원 예약 건에는 상업적 쿠폰(`cpn_`), 리워드 포인트 적립 로직이 결합되지 않도록 API 레벨에서 차단합니다.
3. **진료비 현장 정산 원칙**:
   - 진료비는 국민건강보험법 규정에 따라 의원 현장에서 진료 완료 후 본인부담금을 직접 결제하는 것을 기본 원칙으로 합니다.

---

## 5. 향후 서비스 분리(Unbundling) 가이드

추후 특정 도메인(예: 숙박 전용 앱)의 독립 법인 분리나 독립 리포지토리 구성 시:
1. `packages/services/booking-stay`를 단독 리포지토리의 루트로 이동.
2. `packages/core/booking-engine`을 내부 npm 패키지(`@aitip/booking-core`)로 배포하여 참조.
3. 데이터베이스 분리 시 `bookings WHERE service_domain = 'STAY'` 및 `booking_stay_details`를 신규 D1 인스턴스로 ETL 분할.
기존 데이터 유실이나 서비스 중단 없이 0% 다운타임 분할이 가능하도록 설계되었습니다.
