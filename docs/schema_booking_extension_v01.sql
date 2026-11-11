-- ============================================================================
-- AITIP 플랫폼 예약 코어 및 3대 수평분할(숙박, 이미용, 의원) D1 스키마 확장
-- 준수 규격: DOC-00, DOC-04, DOC-16 (Core & Extension 아키텍처)
-- ============================================================================

-- 1. 공통 마스터 예약 테이블
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    service_domain TEXT NOT NULL,
    
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    total_amount INTEGER NOT NULL DEFAULT 0,
    deposit_amount INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    
    cancelled_at TEXT,
    cancel_reason TEXT,
    penalty_fee INTEGER DEFAULT 0,
    refund_amount INTEGER DEFAULT 0,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    CHECK (id GLOB 'bkg_[0-9a-km-z]{26}'),
    CHECK (service_domain IN ('STAY', 'BEAUTY', 'CLINIC', 'TABLE', 'SPACE')),
    CHECK (status IN ('REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NOSHOW')),
    CHECK (payment_status IN ('UNPAID', 'PARTIAL_PAID', 'FULL_PAID', 'REFUNDED')),
    CHECK (start_time < end_time),
    CHECK (total_amount >= 0),
    CHECK (deposit_amount >= 0),
    CHECK (deposit_amount <= total_amount)
);

CREATE INDEX IF NOT EXISTS idx_bookings_store_schedule ON bookings(store_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_domain_status ON bookings(service_domain, status);

-- 2. 숙박(STAY) 전용 1:1 확장 테이블
CREATE TABLE IF NOT EXISTS booking_stay_details (
    booking_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    guest_count INTEGER NOT NULL DEFAULT 2,
    extra_person_fee INTEGER DEFAULT 0,
    vehicle_number TEXT,
    checkin_date TEXT NOT NULL,
    checkout_date TEXT NOT NULL,
    stay_type TEXT NOT NULL DEFAULT 'OVERNIGHT',
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CHECK (guest_count >= 1),
    CHECK (stay_type IN ('OVERNIGHT', 'DAY_USE'))
);

CREATE INDEX IF NOT EXISTS idx_stay_room_date ON booking_stay_details(room_id, checkin_date, checkout_date);

-- 3. 이미용(BEAUTY) 전용 1:1 확장 테이블
CREATE TABLE IF NOT EXISTS booking_beauty_details (
    booking_id TEXT PRIMARY KEY,
    stylist_id TEXT NOT NULL,
    treatment_menus TEXT NOT NULL,
    total_duration_minutes INTEGER NOT NULL,
    chair_number INTEGER,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CHECK (total_duration_minutes > 0)
);

CREATE INDEX IF NOT EXISTS idx_beauty_stylist ON booking_beauty_details(stylist_id);

-- 4. 의원/클리닉(CLINIC) 전용 1:1 확장 테이블
CREATE TABLE IF NOT EXISTS booking_clinic_details (
    booking_id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,
    department_code TEXT NOT NULL,
    is_first_visit INTEGER NOT NULL DEFAULT 0,
    queue_number INTEGER,
    symptom_category TEXT,
    insurance_type TEXT NOT NULL DEFAULT 'NATIONAL_HEALTH',
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CHECK (is_first_visit IN (0, 1)),
    CHECK (insurance_type IN ('NATIONAL_HEALTH', 'GENERAL', 'AUTO_ACCIDENT', 'WORKERS_COMP'))
);

CREATE INDEX IF NOT EXISTS idx_clinic_doctor ON booking_clinic_details(doctor_id, queue_number);
