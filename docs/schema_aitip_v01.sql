-- ============================================================================
-- AITIP 통합 데이터베이스 스키마 (Cloudflare D1 / SQLite)
-- 파일: docs/schema_aitip_v01.sql
-- 버전: 0.2.0-draft (2026-11-07)
-- 상태: 초안. 검증 범위는 scripts/test_schema_integrity.py 실행 결과(로컬 Python sqlite3)에 한정.
--       Cloudflare D1 실환경 검증은 아직 하지 않음.
--
-- 변경 이력
--   0.2.0  orders.display_code(TEXT) -> display_seq(INTEGER). 표시 문자열(A-01 등)은 앱에서 생성.
--          store_members 중복 방지: 복합 UNIQUE(NULL 비교로 무력화됨) -> 부분 유니크 인덱스 2개.
--          settlements: seller_type 일치 CHECK, net = total - fee CHECK, (판매자, 정산일) 유니크.
--          display_counters: seller_type / seller_id 접두사 일치 CHECK, last_seq >= 0.
--          전화번호·정산계좌·배송주소 평문 컬럼 제거 -> *_enc(암호문) + *_hmac(검색용).
--          녹음·사진 컬럼: 공개 URL -> R2 비공개 객체 키(*_object_key).
--          FK 자식 컬럼과 주요 조회 경로에 인덱스 추가.
--          모든 CHECK에 이름 부여(위반 메시지로 원인 식별 가능).
--   0.1.x  최초 초안.
-- ============================================================================
-- [공통 규칙]
-- * ID: TypeID = 소문자 접두사 + '_' + Crockford Base32 26자 (첫 글자 0~7, i/l/o/u 제외).
--   4자 접두사(xxx_) -> 30자, call_ -> 31자.
-- * 시각: Unix epoch 밀리초(INTEGER), 서버 수신 시각. UUIDv7 내장 시각과 다를 수 있음(단말 시계 오차).
-- * *_enc : AES-256-GCM 암호문(base64). AAD = '<테이블>:<행 id>:<컬럼명>'. 키 버전 = pii_key_ver.
-- * *_hmac: HMAC-SHA256(서버 비밀키, 정규화 값)의 소문자 hex 64자. 비밀키 없는 SHA-256은 금지.
--           HMAC 키 회전 시 전체 재계산 절차가 필요함(별도 정의 예정).
-- * 부분 인덱스의 "WHERE x IS NOT NULL": SQLite는 NULL끼리 중복으로 보지 않으므로 없어도 동작은 같다.
--   "해당 판매자 유형의 행에만 적용"이라는 의도를 드러내려고 명시한다.
-- * DB가 강제하지 못해 서버(Workers)가 강제해야 하는 규칙:
--   품목 합계 = orders.total_amount, 결제 합계 = orders.total_amount,
--   SUBSIDY 결제는 FOOD_SUPPLY 주문에만 허용, facility_members 발주 권한(can_order, ACTIVE) 확인.
-- * PRAGMA foreign_keys: 로컬 SQLite는 연결마다 켜야 함. D1은 기본 강제로 알려져 있으나 실환경 확인 필요.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- [1] 신원·거버넌스
-- ============================================================================

CREATE TABLE users (
    id          TEXT PRIMARY KEY
                CONSTRAINT chk_users_id CHECK (length(id) = 30 AND id GLOB 'usr_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    phone_enc   TEXT NOT NULL,
    phone_hmac  TEXT NOT NULL
                CONSTRAINT chk_users_phone_hmac CHECK (length(phone_hmac) = 64 AND phone_hmac NOT GLOB '*[^0-9a-f]*'),
    pii_key_ver INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_users_key_ver CHECK (pii_key_ver >= 1),
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'CUSTOMER'
                CONSTRAINT chk_users_role CHECK (role IN (
                    'SUPER_ADMIN', 'HQ_DEV_OPS', 'HQ_SALES_OPS', 'HQ_MERCHANT_OPS', 'HQ_FINANCE_OPS', 'HQ_LOGISTICS_OPS',
                    'AGENCY_MASTER', 'AGENCY_MANAGER', 'AGENCY_OPERATOR', 'FIELD_ENGINEER', 'SALES_REP',
                    'STORE_OWNER', 'MART_MANAGER', 'SENIOR_ORG_MANAGER', 'CONSIGNMENT_PICKER',
                    'COMMERCIAL_RIDER', 'SENIOR_COURIER', 'COURIER', 'CUSTOMER'
                )),
    status      TEXT NOT NULL DEFAULT 'ACTIVE'
                CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'BLOCKED', 'DORMANT')),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_users_phone_hmac ON users (phone_hmac);

CREATE TABLE organizations (
    id                 TEXT PRIMARY KEY
                       CONSTRAINT chk_organizations_id CHECK (length(id) = 30 AND id GLOB 'org_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    name               TEXT NOT NULL,
    biz_reg_no         TEXT NOT NULL UNIQUE,
    manager_phone_enc  TEXT NOT NULL,
    manager_phone_hmac TEXT NOT NULL
                       CONSTRAINT chk_organizations_phone_hmac CHECK (length(manager_phone_hmac) = 64 AND manager_phone_hmac NOT GLOB '*[^0-9a-f]*'),
    pii_key_ver        INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_organizations_key_ver CHECK (pii_key_ver >= 1),
    road_address       TEXT NOT NULL,
    is_active          INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_organizations_active CHECK (is_active IN (0, 1)),
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
);

CREATE TABLE work_teams (
    id         TEXT PRIMARY KEY
               CONSTRAINT chk_work_teams_id CHECK (length(id) = 30 AND id GLOB 'biz_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    org_id     TEXT NOT NULL REFERENCES organizations(id)
               CONSTRAINT chk_work_teams_org_id CHECK (length(org_id) = 30 AND org_id GLOB 'org_*'),
    team_name  TEXT NOT NULL,
    team_type  TEXT NOT NULL DEFAULT 'DELIVERY'
               CONSTRAINT chk_work_teams_type CHECK (team_type IN ('DELIVERY', 'PACKING', 'INSPECTION')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_work_teams_org ON work_teams (org_id);

-- 배송 참여자(어르신·자활근로자). 주민등록번호는 어떤 형태로도 저장하지 않음.
-- [미해결] 상업 라이더(사업단 비소속)와 2인 1조는 아직 표현하지 못함.
CREATE TABLE workers (
    id              TEXT PRIMARY KEY
                    CONSTRAINT chk_workers_id CHECK (length(id) = 30 AND id GLOB 'wrk_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    user_id         TEXT NOT NULL REFERENCES users(id)
                    CONSTRAINT chk_workers_user_id CHECK (length(user_id) = 30 AND user_id GLOB 'usr_*'),
    work_team_id    TEXT NOT NULL REFERENCES work_teams(id)
                    CONSTRAINT chk_workers_team_id CHECK (length(work_team_id) = 30 AND work_team_id GLOB 'biz_*'),
    worker_badge_no TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'ACTIVE'
                    CONSTRAINT chk_workers_status CHECK (status IN ('ACTIVE', 'PAUSED', 'RETIRED')),
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    CONSTRAINT uq_workers_team_user UNIQUE (work_team_id, user_id)
);
CREATE INDEX idx_workers_user ON workers (user_id);

-- ============================================================================
-- [2] 판매자·수요시설
-- ============================================================================

CREATE TABLE stores (
    id                  TEXT PRIMARY KEY
                        CONSTRAINT chk_stores_id CHECK (length(id) = 30 AND id GLOB 'str_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    business_name       TEXT NOT NULL,
    biz_reg_no          TEXT NOT NULL UNIQUE,
    food_license_no     TEXT,
    store_category      TEXT NOT NULL,
    business_day_cutoff TEXT NOT NULL DEFAULT '04:00'
                        CONSTRAINT chk_stores_cutoff CHECK (business_day_cutoff GLOB '[01][0-9]:[0-5][0-9]' OR business_day_cutoff GLOB '2[0-3]:[0-5][0-9]'),
    phone_enc           TEXT NOT NULL,
    phone_hmac          TEXT NOT NULL
                        CONSTRAINT chk_stores_phone_hmac CHECK (length(phone_hmac) = 64 AND phone_hmac NOT GLOB '*[^0-9a-f]*'),
    pii_key_ver         INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_stores_key_ver CHECK (pii_key_ver >= 1),
    road_address        TEXT NOT NULL,
    min_order_amount    INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_stores_min_order CHECK (min_order_amount >= 0),
    free_delivery_threshold INTEGER DEFAULT NULL CONSTRAINT chk_stores_free_deliv CHECK (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0),
    default_prep_minutes INTEGER NOT NULL DEFAULT 15 CONSTRAINT chk_stores_prep_min CHECK (default_prep_minutes >= 0),
    is_takeout_available INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_stores_takeout CHECK (is_takeout_available IN (0, 1)),
    origin_notice_text  TEXT,
    referral_agency_id  TEXT,
    referral_agent_id   TEXT,
    bank_name_enc       TEXT,
    bank_account_enc    TEXT,
    bank_holder_enc     TEXT,
    attributes_json     TEXT NOT NULL DEFAULT '{}'
                        CONSTRAINT chk_stores_attrs CHECK (json_valid(attributes_json) AND json_type(attributes_json) = 'object' AND length(attributes_json) <= 8192),
    attributes_version  INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_stores_attrs_ver CHECK (attributes_version >= 1),
    is_active           INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_stores_active CHECK (is_active IN (0, 1)),
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE TABLE mart_suppliers (
    id                     TEXT PRIMARY KEY
                           CONSTRAINT chk_mart_suppliers_id CHECK (length(id) = 30 AND id GLOB 'mrt_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    mart_name              TEXT NOT NULL,
    biz_reg_no             TEXT NOT NULL UNIQUE,
    nh_erp_code            TEXT,
    manager_phone_enc      TEXT NOT NULL,
    manager_phone_hmac     TEXT NOT NULL
                           CONSTRAINT chk_mart_suppliers_phone_hmac CHECK (length(manager_phone_hmac) = 64 AND manager_phone_hmac NOT GLOB '*[^0-9a-f]*'),
    settlement_account_enc TEXT NOT NULL,   -- 정산 계좌(암호문만 저장, 검색 불필요하므로 HMAC 없음)
    pii_key_ver            INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_mart_suppliers_key_ver CHECK (pii_key_ver >= 1),
    business_day_cutoff    TEXT NOT NULL DEFAULT '04:00'
                           CONSTRAINT chk_mart_suppliers_cutoff CHECK (business_day_cutoff GLOB '[01][0-9]:[0-5][0-9]' OR business_day_cutoff GLOB '2[0-3]:[0-5][0-9]'),
    order_cutoff_time      TEXT
                           CONSTRAINT chk_mart_suppliers_ord_cutoff CHECK (order_cutoff_time IS NULL OR order_cutoff_time GLOB '[01][0-9]:[0-5][0-9]' OR order_cutoff_time GLOB '2[0-3]:[0-5][0-9]'),
    road_address           TEXT NOT NULL,
    consignment_org_id     TEXT REFERENCES organizations(id)
                           CONSTRAINT chk_mart_consignment_org CHECK (consignment_org_id IS NULL OR (length(consignment_org_id) = 30 AND consignment_org_id GLOB 'org_*')),
    consignment_type       TEXT NOT NULL DEFAULT 'DIRECT'
                           CONSTRAINT chk_mart_consignment_type CHECK (consignment_type IN ('DIRECT', 'CONSIGNED', 'HYBRID')),
    attributes_json        TEXT NOT NULL DEFAULT '{}'
                           CONSTRAINT chk_mart_attrs CHECK (json_valid(attributes_json) AND json_type(attributes_json) = 'object' AND length(attributes_json) <= 8192),
    attributes_version     INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_mart_attrs_ver CHECK (attributes_version >= 1),
    is_active              INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_mart_suppliers_active CHECK (is_active IN (0, 1)),
    created_at             INTEGER NOT NULL,
    updated_at             INTEGER NOT NULL
);

-- 식자재 납품 수령처. 기관 본부가 수령하더라도 fac_ 레코드를 별도 생성(related_org_id로 연결).
CREATE TABLE facilities (
    id                TEXT PRIMARY KEY
                      CONSTRAINT chk_facilities_id CHECK (length(id) = 30 AND id GLOB 'fac_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    facility_name     TEXT NOT NULL,
    facility_code     TEXT NOT NULL UNIQUE,
    related_org_id    TEXT REFERENCES organizations(id)
                      CONSTRAINT chk_facilities_org_id CHECK (related_org_id IS NULL OR (length(related_org_id) = 30 AND related_org_id GLOB 'org_*')),
    facility_type     TEXT NOT NULL
                      CONSTRAINT chk_facilities_type CHECK (facility_type IN ('SENIOR_CENTER', 'WELFARE_CENTER', 'ORG_OFFICE')),
    landline_cid_enc  TEXT NOT NULL,
    landline_cid_hmac TEXT NOT NULL
                      CONSTRAINT chk_facilities_cid_hmac CHECK (length(landline_cid_hmac) = 64 AND landline_cid_hmac NOT GLOB '*[^0-9a-f]*'),
    pii_key_ver       INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_facilities_key_ver CHECK (pii_key_ver >= 1),
    road_address      TEXT NOT NULL,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);
CREATE INDEX idx_facilities_cid_hmac ON facilities (landline_cid_hmac);
CREATE INDEX idx_facilities_org      ON facilities (related_org_id);

-- [미해결] PK가 (facility_id, user_id)라 해임 후 재임명 이력을 새 행으로 남길 수 없음. 다음 단계에서 수정.
CREATE TABLE facility_members (
    facility_id TEXT NOT NULL REFERENCES facilities(id)
                CONSTRAINT chk_facility_members_facility_id CHECK (length(facility_id) = 30 AND facility_id GLOB 'fac_*'),
    user_id     TEXT NOT NULL REFERENCES users(id)
                CONSTRAINT chk_facility_members_user_id CHECK (length(user_id) = 30 AND user_id GLOB 'usr_*'),
    role        TEXT NOT NULL
                CONSTRAINT chk_facility_members_role CHECK (role IN ('DIRECTOR', 'MANAGER', 'STAFF')),
    can_order   INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_facility_members_can_order CHECK (can_order IN (0, 1)),
    status      TEXT NOT NULL DEFAULT 'ACTIVE'
                CONSTRAINT chk_facility_members_status CHECK (status IN ('ACTIVE', 'REVOKED')),
    started_at  INTEGER NOT NULL,
    ended_at    INTEGER,
    PRIMARY KEY (facility_id, user_id)
);
CREATE INDEX idx_facility_members_user ON facility_members (user_id);

-- 매장·마트 소속 및 역할. 판매자는 store_id / mart_id 중 정확히 하나.
CREATE TABLE store_members (
    store_id   TEXT REFERENCES stores(id)
               CONSTRAINT chk_store_members_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id    TEXT REFERENCES mart_suppliers(id)
               CONSTRAINT chk_store_members_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    user_id    TEXT NOT NULL REFERENCES users(id)
               CONSTRAINT chk_store_members_user_id CHECK (length(user_id) = 30 AND user_id GLOB 'usr_*'),
    role       TEXT NOT NULL
               CONSTRAINT chk_store_members_role CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
    created_at INTEGER NOT NULL,
    CONSTRAINT chk_store_members_owner CHECK (
        (store_id IS NOT NULL AND mart_id IS NULL) OR
        (store_id IS NULL AND mart_id IS NOT NULL)
    )
);
-- 0.1.x의 UNIQUE(store_id, mart_id, user_id)는 한쪽이 항상 NULL이라 중복을 막지 못했음 -> 2개로 분리.
CREATE UNIQUE INDEX uq_store_members_store ON store_members (store_id, user_id) WHERE store_id IS NOT NULL;
CREATE UNIQUE INDEX uq_store_members_mart  ON store_members (mart_id, user_id)  WHERE mart_id IS NOT NULL;
CREATE INDEX idx_store_members_user ON store_members (user_id);

-- 매장별 요일별 영업시간 및 휴게시간 (기준 타임존: Asia/Seoul, UTC+9)
CREATE TABLE store_hours (
    id          TEXT PRIMARY KEY
                CONSTRAINT chk_store_hours_id CHECK (length(id) = 30 AND id GLOB 'sth_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id    TEXT NOT NULL REFERENCES stores(id)
                CONSTRAINT chk_store_hours_store_id CHECK (length(store_id) = 30 AND store_id GLOB 'str_*'),
    day_of_week INTEGER NOT NULL
                CONSTRAINT chk_store_hours_day CHECK (day_of_week BETWEEN 0 AND 6),
    open_time   TEXT
                CONSTRAINT chk_store_hours_open_time CHECK (open_time IS NULL OR open_time GLOB '[01][0-9]:[0-5][0-9]' OR open_time GLOB '2[0-3]:[0-5][0-9]'),
    close_time  TEXT
                CONSTRAINT chk_store_hours_close_time CHECK (close_time IS NULL OR close_time GLOB '[01][0-9]:[0-5][0-9]' OR close_time GLOB '2[0-3]:[0-5][0-9]'),
    break_start TEXT
                CONSTRAINT chk_store_hours_break_start CHECK (break_start IS NULL OR break_start GLOB '[01][0-9]:[0-5][0-9]' OR break_start GLOB '2[0-3]:[0-5][0-9]'),
    break_end   TEXT
                CONSTRAINT chk_store_hours_break_end CHECK (break_end IS NULL OR break_end GLOB '[01][0-9]:[0-5][0-9]' OR break_end GLOB '2[0-3]:[0-5][0-9]'),
    is_closed   INTEGER NOT NULL DEFAULT 0
                CONSTRAINT chk_store_hours_is_closed CHECK (is_closed IN (0, 1)),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    CONSTRAINT chk_store_hours_break_pair CHECK ((break_start IS NULL AND break_end IS NULL) OR (break_start IS NOT NULL AND break_end IS NOT NULL)),
    CONSTRAINT chk_store_hours_open_pair CHECK (is_closed = 1 OR (open_time IS NOT NULL AND close_time IS NOT NULL)),
    CONSTRAINT uq_store_hours_store_day UNIQUE (store_id, day_of_week)
);
CREATE INDEX idx_store_hours_store ON store_hours (store_id);

-- 매장별 지역(동) 추가 배달비 규칙
CREATE TABLE store_delivery_fee_rules (
    id            TEXT PRIMARY KEY
                  CONSTRAINT chk_dfr_id CHECK (length(id) = 30 AND id GLOB 'dfr_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id      TEXT NOT NULL REFERENCES stores(id)
                  CONSTRAINT chk_dfr_store_id CHECK (length(store_id) = 30 AND store_id GLOB 'str_*'),
    district_name TEXT NOT NULL,
    extra_fee     INTEGER NOT NULL DEFAULT 0
                  CONSTRAINT chk_dfr_extra_fee CHECK (extra_fee >= 0),
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    CONSTRAINT uq_dfr_store_district UNIQUE (store_id, district_name)
);
CREATE INDEX idx_dfr_store ON store_delivery_fee_rules (store_id);

-- ============================================================================
-- [3] 단말
-- ============================================================================

CREATE TABLE devices (
    id                TEXT PRIMARY KEY
                      CONSTRAINT chk_devices_id CHECK (length(id) = 30 AND id GLOB 'dev_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id          TEXT REFERENCES stores(id)
                      CONSTRAINT chk_devices_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id           TEXT REFERENCES mart_suppliers(id)
                      CONSTRAINT chk_devices_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    mac_address       TEXT NOT NULL UNIQUE,
    board_serial      TEXT NOT NULL,
    firmware_version  TEXT NOT NULL,
    is_online         INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_devices_online CHECK (is_online IN (0, 1)),
    paper_status      TEXT NOT NULL DEFAULT 'NORMAL' CONSTRAINT chk_devices_paper CHECK (paper_status IN ('NORMAL', 'PAPER_LOW', 'PAPER_EMPTY', 'HEAD_OVERHEAT')),
    active_partition  TEXT NOT NULL DEFAULT 'A' CONSTRAINT chk_devices_partition CHECK (active_partition IN ('A', 'B')),
    last_heartbeat_at INTEGER,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    CONSTRAINT chk_devices_placement CHECK (
        (store_id IS NOT NULL AND mart_id IS NULL) OR
        (store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE INDEX idx_devices_store ON devices (store_id);
CREATE INDEX idx_devices_mart  ON devices (mart_id);

-- ============================================================================
-- [4] 상품
-- ============================================================================

CREATE TABLE product_categories (
    id            TEXT PRIMARY KEY
                  CONSTRAINT chk_product_categories_id CHECK (length(id) = 30 AND id GLOB 'cat_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id      TEXT REFERENCES stores(id)
                  CONSTRAINT chk_prod_cat_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id       TEXT REFERENCES mart_suppliers(id)
                  CONSTRAINT chk_prod_cat_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    name          TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active     INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_prod_cat_active CHECK (is_active IN (0, 1)),
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    CONSTRAINT chk_prod_cat_owner CHECK (
        (store_id IS NOT NULL AND mart_id IS NULL) OR
        (store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE INDEX idx_product_categories_store ON product_categories (store_id);
CREATE INDEX idx_product_categories_mart  ON product_categories (mart_id);

CREATE TABLE products (
    id             TEXT PRIMARY KEY
                   CONSTRAINT chk_products_id CHECK (length(id) = 30 AND id GLOB 'prd_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id       TEXT REFERENCES stores(id)
                   CONSTRAINT chk_products_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id        TEXT REFERENCES mart_suppliers(id)
                   CONSTRAINT chk_products_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    category_id    TEXT REFERENCES product_categories(id)
                   CONSTRAINT chk_products_cat_id CHECK (category_id IS NULL OR (length(category_id) = 30 AND category_id GLOB 'cat_*')),
    name           TEXT NOT NULL,
    price          INTEGER NOT NULL CONSTRAINT chk_products_price CHECK (price >= 0),
    original_price INTEGER CONSTRAINT chk_products_original_price CHECK (original_price IS NULL OR original_price >= 0),
    barcode_sku    TEXT,
    weight_value   REAL,
    weight_unit    TEXT CONSTRAINT chk_products_weight_unit CHECK (weight_unit IS NULL OR weight_unit IN ('g', 'kg', 'ml', 'l', 'EA')),
    unit           TEXT NOT NULL DEFAULT 'EA',
    tax_type       TEXT NOT NULL DEFAULT 'TAXABLE'
                   CONSTRAINT chk_products_tax CHECK (tax_type IN ('TAXABLE', 'TAX_FREE', 'ZERO_TAX')),
    origin_text    TEXT,
    is_available   INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_products_available CHECK (is_available IN (0, 1)),
    supplier_id    TEXT,
    cost_price     INTEGER CONSTRAINT chk_products_cost_price CHECK (cost_price IS NULL OR cost_price >= 0),
    packaging_cost INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_products_pkg_cost CHECK (packaging_cost >= 0),
    margin_rate    REAL CONSTRAINT chk_products_margin_rate CHECK (margin_rate IS NULL OR (margin_rate >= -100.0 AND margin_rate <= 100.0)),
    is_oem         INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_products_is_oem CHECK (is_oem IN (0, 1)),
    oem_brand_name TEXT,
    options_json   TEXT,
    image_r2_key   TEXT,
    image_format   TEXT NOT NULL DEFAULT 'webp' CONSTRAINT chk_products_img_fmt CHECK (image_format = 'webp'),
    image_hash     TEXT,
    allergens_json         TEXT,
    shelf_location         TEXT CONSTRAINT chk_products_shelf CHECK (shelf_location IS NULL OR length(shelf_location) <= 50),
    pos_plu_code           TEXT CONSTRAINT chk_products_plu CHECK (pos_plu_code IS NULL OR length(pos_plu_code) <= 30),
    is_local_food          INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_products_local_food CHECK (is_local_food IN (0, 1)),
    daily_price_updated_at INTEGER CONSTRAINT chk_products_daily_price CHECK (daily_price_updated_at IS NULL OR daily_price_updated_at > 0),
    created_at             INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    CONSTRAINT chk_products_owner CHECK (
        (store_id IS NOT NULL AND mart_id IS NULL) OR
        (store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE INDEX idx_products_store ON products (store_id);
CREATE INDEX idx_products_mart  ON products (mart_id);
CREATE INDEX idx_products_mart_barcode  ON products (mart_id, barcode_sku) WHERE barcode_sku IS NOT NULL;
CREATE INDEX idx_products_mart_location ON products (mart_id, shelf_location) WHERE shelf_location IS NOT NULL;

-- ============================================================================
-- [5] 통합 주문
-- ============================================================================
-- display_seq: 판매자·영업일 단위 정수 순번. "A-01", "104" 같은 표시 문자열은 앱이 만든다.
-- 주문 생성 batch(단일 트랜잭션) 순서:
--   (1) display_counters UPSERT로 last_seq 증가
--   (2) orders INSERT, display_seq는 서브쿼리로 읽음:
--       (SELECT last_seq FROM display_counters WHERE seller_id = ? AND business_date = ?)
--   (3) order_items INSERT  (4) payments INSERT
-- batch는 하나의 트랜잭션이라 중간 실패 시 (1)의 증가도 함께 롤백됨 -> 롤백은 결번 원인이 아님.
-- 결번은 주문 취소 등 비즈니스 사유로만 생기며, 표시용 번호이므로 허용한다.
-- [미해결] order_status 값(COOKING/DELIVERED), cooking_minutes, 배송 OTP, 인쇄 플래그,
--          포장 주문의 배송주소 NULL 허용 여부는 다음 단계에서 기획서와 맞춤.
CREATE TABLE orders (
    id                   TEXT PRIMARY KEY
                         CONSTRAINT chk_orders_id CHECK (length(id) = 30 AND id GLOB 'ord_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    client_request_id    TEXT NOT NULL
                         CONSTRAINT chk_orders_client_req CHECK (length(client_request_id) BETWEEN 8 AND 64),
    store_id             TEXT REFERENCES stores(id)
                         CONSTRAINT chk_orders_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id              TEXT REFERENCES mart_suppliers(id)
                         CONSTRAINT chk_orders_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    buyer_user_id        TEXT REFERENCES users(id)
                         CONSTRAINT chk_orders_buyer_user_id CHECK (buyer_user_id IS NULL OR (length(buyer_user_id) = 30 AND buyer_user_id GLOB 'usr_*')),
    caller_phone_enc     TEXT,
    caller_phone_hmac    TEXT
                         CONSTRAINT chk_orders_caller_hmac CHECK (caller_phone_hmac IS NULL OR (length(caller_phone_hmac) = 64 AND caller_phone_hmac NOT GLOB '*[^0-9a-f]*')),
    buyer_facility_id    TEXT REFERENCES facilities(id)
                         CONSTRAINT chk_orders_facility_id CHECK (buyer_facility_id IS NULL OR (length(buyer_facility_id) = 30 AND buyer_facility_id GLOB 'fac_*')),
    order_type           TEXT NOT NULL DEFAULT 'GENERAL'
                         CONSTRAINT chk_orders_type CHECK (order_type IN ('GENERAL', 'FOOD_SUPPLY')),
    fulfillment_type     TEXT NOT NULL DEFAULT 'DELIVERY'
                         CONSTRAINT chk_orders_fulfillment CHECK (fulfillment_type IN ('DELIVERY', 'TAKEOUT', 'DINE_IN')),
    order_channel        TEXT NOT NULL
                         CONSTRAINT chk_orders_channel CHECK (order_channel IN ('ARS', 'PWA', 'KIOSK', 'POS')),
    table_no             TEXT
                         CONSTRAINT chk_orders_table_no CHECK (table_no IS NULL OR length(table_no) <= 20),
    pickup_estimated_at  INTEGER
                         CONSTRAINT chk_orders_pickup_est CHECK (pickup_estimated_at IS NULL OR pickup_estimated_at > 0),
    business_date        TEXT NOT NULL
                         CONSTRAINT chk_orders_business_date CHECK (business_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    display_seq          INTEGER NOT NULL
                         CONSTRAINT chk_orders_display_seq CHECK (display_seq > 0),
    delivery_fee         INTEGER NOT NULL DEFAULT 0
                         CONSTRAINT chk_orders_delivery_fee CHECK (delivery_fee >= 0),
    discount_amount      INTEGER NOT NULL DEFAULT 0
                         CONSTRAINT chk_orders_discount CHECK (discount_amount >= 0),
    promotion_id         TEXT
                         CONSTRAINT chk_orders_promotion_id CHECK (promotion_id IS NULL OR (length(promotion_id) = 30 AND promotion_id GLOB 'prm_*')),
    total_amount         INTEGER NOT NULL
                         CONSTRAINT chk_orders_total CHECK (total_amount >= 0),
    canceled_amount      INTEGER NOT NULL DEFAULT 0
                         CONSTRAINT chk_orders_canceled_amt CHECK (canceled_amount >= 0),
    final_paid_amount    INTEGER
                         CONSTRAINT chk_orders_final_paid CHECK (final_paid_amount IS NULL OR final_paid_amount >= 0),
    order_status         TEXT NOT NULL DEFAULT 'PENDING'
                         CONSTRAINT chk_orders_status CHECK (order_status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'DELIVERING', 'COMPLETED', 'CANCELLED')),
    delivery_address_enc TEXT NOT NULL,
    is_disposable_needed INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_orders_disposable CHECK (is_disposable_needed IN (0, 1)),
    kitchen_memo         TEXT,
    delivery_memo        TEXT,
    pii_key_ver          INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_orders_key_ver CHECK (pii_key_ver >= 1),
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL,
    CONSTRAINT chk_orders_exclusive_seller CHECK (
        (store_id IS NOT NULL AND mart_id IS NULL) OR
        (store_id IS NULL AND mart_id IS NOT NULL)
    ),
    CONSTRAINT chk_orders_caller_pair    CHECK ((caller_phone_enc IS NULL) = (caller_phone_hmac IS NULL)),
    CONSTRAINT chk_orders_buyer_presence CHECK (buyer_user_id IS NOT NULL OR caller_phone_hmac IS NOT NULL),
    CONSTRAINT chk_orders_food_facility  CHECK ((order_type = 'FOOD_SUPPLY') = (buyer_facility_id IS NOT NULL)),
    -- [확인 필요] 식자재 주문을 mart_suppliers 전용으로 제한하는 것이 의도인지 (로컬푸드·일반 업체 납품 가능성)
    CONSTRAINT chk_orders_food_seller    CHECK (order_type <> 'FOOD_SUPPLY' OR mart_id IS NOT NULL),
    CONSTRAINT chk_orders_food_member    CHECK (order_type <> 'FOOD_SUPPLY' OR buyer_user_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_orders_store_daily_seq  ON orders (store_id, business_date, display_seq) WHERE store_id IS NOT NULL;
CREATE UNIQUE INDEX uq_orders_mart_daily_seq   ON orders (mart_id, business_date, display_seq)  WHERE mart_id IS NOT NULL;
CREATE UNIQUE INDEX uq_orders_user_client_req  ON orders (buyer_user_id, client_request_id)     WHERE buyer_user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_orders_phone_client_req ON orders (caller_phone_hmac, client_request_id) WHERE caller_phone_hmac IS NOT NULL;
CREATE INDEX idx_orders_buyer_created ON orders (buyer_user_id, created_at);
CREATE INDEX idx_orders_store_created ON orders (store_id, created_at);
CREATE INDEX idx_orders_mart_created  ON orders (mart_id, created_at);
CREATE INDEX idx_orders_facility      ON orders (buyer_facility_id);

CREATE TABLE order_items (
    id          TEXT PRIMARY KEY
                CONSTRAINT chk_order_items_id CHECK (length(id) = 30 AND id GLOB 'itm_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    order_id    TEXT NOT NULL REFERENCES orders(id)
                CONSTRAINT chk_order_items_order_id CHECK (length(order_id) = 30 AND order_id GLOB 'ord_*'),
    product_id  TEXT NOT NULL REFERENCES products(id)
                CONSTRAINT chk_order_items_product_id CHECK (length(product_id) = 30 AND product_id GLOB 'prd_*'),
    item_name   TEXT NOT NULL,
    unit_price  INTEGER NOT NULL CONSTRAINT chk_order_items_unit_price CHECK (unit_price >= 0),
    quantity    INTEGER NOT NULL CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    tax_type    TEXT NOT NULL DEFAULT 'TAXABLE'
                CONSTRAINT chk_order_items_tax CHECK (tax_type IN ('TAXABLE', 'TAX_FREE', 'ZERO_TAX')),
    total_price           INTEGER NOT NULL CONSTRAINT chk_order_items_total CHECK (total_price >= 0),
    options_selected_json TEXT,
    kitchen_mods_json     TEXT,
    item_status           TEXT NOT NULL DEFAULT 'ACTIVE'
                          CONSTRAINT chk_order_items_status CHECK (item_status IN ('ACTIVE', 'CANCELED', 'SUBSTITUTED')),
    cancel_reason         TEXT,
    created_at            INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order   ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);
CREATE INDEX idx_orders_fulfillment  ON orders (store_id, fulfillment_type, order_status);

-- ============================================================================
-- [6] 배송
-- ============================================================================
-- [미해결] 주문당 활성 배송 세션 1개 제한, 2인 1조, 상업 라이더는 다음 단계.
CREATE TABLE delivery_sessions (
    id                             TEXT PRIMARY KEY
                                   CONSTRAINT chk_delivery_sessions_id CHECK (length(id) = 30 AND id GLOB 'dlv_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    order_id                       TEXT NOT NULL REFERENCES orders(id)
                                   CONSTRAINT chk_delivery_sessions_order_id CHECK (length(order_id) = 30 AND order_id GLOB 'ord_*'),
    worker_id                      TEXT REFERENCES workers(id)
                                   CONSTRAINT chk_delivery_sessions_worker_id CHECK (worker_id IS NULL OR (length(worker_id) = 30 AND worker_id GLOB 'wrk_*')),
    delivery_status                TEXT NOT NULL DEFAULT 'ASSIGNED'
                                   CONSTRAINT chk_delivery_sessions_status CHECK (delivery_status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'COMPLETED', 'FAILED')),
    delivery_channel               TEXT NOT NULL DEFAULT 'SENIOR_COURIER'
                                   CONSTRAINT chk_dlv_channel CHECK (delivery_channel IN ('SENIOR_COURIER', 'COMMERCIAL_RIDER', 'LOCAL_AGENCY', 'OUTSOURCED_AGENCY')),
    local_agency_id                TEXT REFERENCES partner_agencies(id)
                                   CONSTRAINT chk_dlv_local_agency CHECK (local_agency_id IS NULL OR (length(local_agency_id) = 30 AND local_agency_id GLOB 'agn_*')),
    local_agency_branch_name       TEXT
                                   CONSTRAINT chk_dlv_branch_name CHECK (local_agency_branch_name IS NULL OR length(local_agency_branch_name) <= 50),
    agency_commission_fee          INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_dlv_agency_fee CHECK (agency_commission_fee >= 0),
    outsourced_agency_name         TEXT
                                   CONSTRAINT chk_dlv_agency CHECK (outsourced_agency_name IS NULL OR outsourced_agency_name IN ('VROONG', 'BAROGO', 'THINKING_DAERO', 'OTHER')),
    outsourced_tracking_id         TEXT
                                   CONSTRAINT chk_dlv_track CHECK (outsourced_tracking_id IS NULL OR length(outsourced_tracking_id) <= 64),
    vehicle_type                   TEXT NOT NULL DEFAULT 'FOOT_WALK'
                                   CONSTRAINT chk_dlv_vehicle CHECK (vehicle_type IN ('FOOT_WALK', 'SILVER_CART', 'BICYCLE', 'MOTORCYCLE', 'VAN')),
    base_delivery_fee              INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_dlv_base_fee CHECK (base_delivery_fee >= 0),
    distance_surge_fee             INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_dlv_dist_fee CHECK (distance_surge_fee >= 0),
    weather_surge_fee              INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_dlv_weather_fee CHECK (weather_surge_fee >= 0),
    peak_surge_fee                 INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_dlv_peak_fee CHECK (peak_surge_fee >= 0),
    driver_payout_amount           INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_dlv_driver_payout CHECK (driver_payout_amount >= 0),
    platform_logistics_cut         INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_dlv_platform_cut CHECK (platform_logistics_cut >= 0),
    distance_meters                INTEGER CONSTRAINT chk_dlv_distance CHECK (distance_meters IS NULL OR distance_meters >= 0),
    estimated_prep_minutes         INTEGER CONSTRAINT chk_dlv_prep_min CHECK (estimated_prep_minutes IS NULL OR estimated_prep_minutes >= 0),
    estimated_transit_minutes      INTEGER CONSTRAINT chk_dlv_transit_min CHECK (estimated_transit_minutes IS NULL OR estimated_transit_minutes >= 0),
    estimated_delivery_at          INTEGER CONSTRAINT chk_dlv_eta CHECK (estimated_delivery_at IS NULL OR estimated_delivery_at > 0),
    pickup_at                      INTEGER,
    completed_at                   INTEGER,
    proof_type                     TEXT NOT NULL DEFAULT 'DOORSTEP_PHOTO'
                                   CONSTRAINT chk_dlv_proof_type CHECK (proof_type IN ('DOORSTEP_PHOTO', 'DIRECT_HANDOVER', 'SECURITY_OFFICE')),
    proof_photo_object_key         TEXT,   -- R2 비공개 객체 키(공개 URL 아님). 인가된 Presigned URL로만 조회.
    recipient_signature_object_key TEXT,   -- 서명 이미지 객체 키
    proof_latitude                 REAL,
    proof_longitude                REAL,
    created_at                     INTEGER NOT NULL,
    updated_at                     INTEGER NOT NULL
);
CREATE INDEX idx_delivery_sessions_order   ON delivery_sessions (order_id);
CREATE INDEX idx_delivery_sessions_worker  ON delivery_sessions (worker_id);
CREATE INDEX idx_dlv_channel_status        ON delivery_sessions (delivery_channel, delivery_status);
CREATE INDEX idx_dlv_local_agency          ON delivery_sessions (local_agency_id) WHERE local_agency_id IS NOT NULL;

-- ============================================================================
-- [7] 결제·정산
-- ============================================================================

CREATE TABLE payments (
    id                 TEXT PRIMARY KEY
                       CONSTRAINT chk_payments_id CHECK (length(id) = 30 AND id GLOB 'pay_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    order_id           TEXT NOT NULL REFERENCES orders(id)
                       CONSTRAINT chk_payments_order_id CHECK (length(order_id) = 30 AND order_id GLOB 'ord_*'),
    parent_payment_id  TEXT REFERENCES payments(id)
                       CONSTRAINT chk_payments_parent_id CHECK (parent_payment_id IS NULL OR (length(parent_payment_id) = 30 AND parent_payment_id GLOB 'pay_*')),
    receipt_type       TEXT NOT NULL DEFAULT 'ORIGINAL'
                       CONSTRAINT chk_payments_receipt_type CHECK (receipt_type IN ('ORIGINAL', 'VOID', 'REISSUED')),
    receipt_number     TEXT
                       CONSTRAINT chk_payments_receipt_no CHECK (receipt_number IS NULL OR length(receipt_number) <= 50),
    funding_source     TEXT NOT NULL
                       CONSTRAINT chk_payments_funding CHECK (funding_source IN ('SUBSIDY', 'OWN_EXPENSE', 'GENERAL')),
    payment_method     TEXT NOT NULL
                       CONSTRAINT chk_payments_method CHECK (payment_method IN ('WELFARE_CARD', 'CREDIT_CARD', 'CASH', 'TRANSFER')),
    amount             INTEGER NOT NULL CONSTRAINT chk_payments_amount CHECK (amount > 0),
    tax_free_amount    INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_payments_tax_free CHECK (tax_free_amount >= 0),
    taxable_amount     INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_payments_taxable CHECK (taxable_amount >= 0),
    vat_amount         INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_payments_vat CHECK (vat_amount >= 0),
    pg_provider        TEXT,
    pg_tx_id           TEXT,
    payment_status     TEXT NOT NULL DEFAULT 'PAID'
                       CONSTRAINT chk_payments_status CHECK (payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'CANCELLED', 'REFUNDED')),
    canceled_reason    TEXT CONSTRAINT chk_payments_cancel_reason CHECK (canceled_reason IS NULL OR length(canceled_reason) <= 200),
    created_at         INTEGER NOT NULL,
    CONSTRAINT chk_payments_funding_method CHECK (
        (funding_source = 'SUBSIDY' AND payment_method = 'WELFARE_CARD') OR
        (funding_source IN ('OWN_EXPENSE', 'GENERAL') AND payment_method IN ('CREDIT_CARD', 'CASH', 'TRANSFER'))
    )
);
CREATE UNIQUE INDEX uq_payments_pg_tx   ON payments (pg_provider, pg_tx_id) WHERE pg_provider IS NOT NULL AND pg_tx_id IS NOT NULL;
CREATE INDEX idx_payments_order         ON payments (order_id);
CREATE INDEX idx_payments_parent        ON payments (parent_payment_id)     WHERE parent_payment_id IS NOT NULL;
CREATE INDEX idx_payments_receipt       ON payments (receipt_number)        WHERE receipt_number IS NOT NULL;

-- [미해결] 정산 라인(주문·결제 연결), 보조금/자부담 분리, 사업단 정산은 다음 단계.
CREATE TABLE settlements (
    id                 TEXT PRIMARY KEY
                       CONSTRAINT chk_settlements_id CHECK (length(id) = 30 AND id GLOB 'set_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    seller_type        TEXT NOT NULL,
    store_id           TEXT REFERENCES stores(id)
                       CONSTRAINT chk_settlements_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id            TEXT REFERENCES mart_suppliers(id)
                       CONSTRAINT chk_settlements_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    settlement_date    TEXT NOT NULL
                       CONSTRAINT chk_settlements_date CHECK (settlement_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    total_sales_amount INTEGER NOT NULL CONSTRAINT chk_settlements_total CHECK (total_sales_amount >= 0),
    fee_amount         INTEGER NOT NULL CONSTRAINT chk_settlements_fee CHECK (fee_amount >= 0),
    net_payout_amount  INTEGER NOT NULL CONSTRAINT chk_settlements_net_nonneg CHECK (net_payout_amount >= 0),
    status             TEXT NOT NULL DEFAULT 'CALCULATED'
                       CONSTRAINT chk_settlements_status CHECK (status IN ('CALCULATED', 'TRANSFERRED', 'HELD')),
    statement_pdf_r2_key TEXT,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL,
    CONSTRAINT chk_settlements_seller CHECK (
        (seller_type = 'STORE' AND store_id IS NOT NULL AND mart_id IS NULL) OR
        (seller_type = 'MART'  AND mart_id IS NOT NULL AND store_id IS NULL)
    ),
    CONSTRAINT chk_settlements_net CHECK (net_payout_amount = total_sales_amount - fee_amount)
);
CREATE UNIQUE INDEX uq_settlements_store_date ON settlements (store_id, settlement_date) WHERE store_id IS NOT NULL;
CREATE UNIQUE INDEX uq_settlements_mart_date  ON settlements (mart_id, settlement_date)  WHERE mart_id IS NOT NULL;

-- ============================================================================
-- [8] 통화 세션·표시 순번 카운터
-- ============================================================================
-- [미해결] matched_entity_id는 다형 참조(FK 없음). 판매자 쪽 원칙과 맞추는 수정은 다음 단계.
-- [법률 검토 전] 통화 녹음 여부 미정. 컬럼은 R2 비공개 객체 키만 둔다.
CREATE TABLE call_sessions (
    id                   TEXT PRIMARY KEY
                         CONSTRAINT chk_call_sessions_id CHECK (length(id) = 31 AND id GLOB 'call_[0-7]*' AND substr(id, 6) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    device_id            TEXT NOT NULL REFERENCES devices(id)
                         CONSTRAINT chk_call_sessions_device_id CHECK (length(device_id) = 30 AND device_id GLOB 'dev_*'),
    caller_cid_enc       TEXT NOT NULL,
    caller_cid_hmac      TEXT NOT NULL
                         CONSTRAINT chk_call_sessions_cid_hmac CHECK (length(caller_cid_hmac) = 64 AND caller_cid_hmac NOT GLOB '*[^0-9a-f]*'),
    pii_key_ver          INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_call_sessions_key_ver CHECK (pii_key_ver >= 1),
    call_direction       TEXT NOT NULL DEFAULT 'INBOUND'
                         CONSTRAINT chk_call_sessions_direction CHECK (call_direction IN ('INBOUND', 'OUTBOUND')),
    dtmf_keys            TEXT,
    matched_entity_type  TEXT
                         CONSTRAINT chk_call_sessions_entity_type CHECK (matched_entity_type IS NULL OR matched_entity_type IN ('STORE', 'MART', 'FACILITY')),
    matched_entity_id    TEXT,
    recording_object_key TEXT,
    created_at           INTEGER NOT NULL
);
CREATE INDEX idx_call_sessions_cid_hmac ON call_sessions (caller_cid_hmac);
CREATE INDEX idx_call_sessions_device   ON call_sessions (device_id, created_at);

-- 판매자·영업일 단위 순번. seller_id는 str_/mrt_ 다형이라 FK 없음.
-- 주문 batch에서 orders의 FK가 실패하면 트랜잭션 전체가 롤백되므로, 존재하지 않는 판매자의 카운터는 남지 않음.
CREATE TABLE display_counters (
    seller_type   TEXT NOT NULL,
    seller_id     TEXT NOT NULL,
    business_date TEXT NOT NULL
                  CONSTRAINT chk_counters_date CHECK (business_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    last_seq      INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_counters_seq CHECK (last_seq >= 0),
    updated_at    INTEGER NOT NULL,
    PRIMARY KEY (seller_id, business_date),
    CONSTRAINT chk_counters_seller CHECK (
        length(seller_id) = 30 AND (
            (seller_type = 'STORE' AND seller_id GLOB 'str_*') OR
            (seller_type = 'MART'  AND seller_id GLOB 'mrt_*')
        )
    )
);


-- ============================================================================
-- AITIP 확장 생태계 테이블 (TypeID 엄격 준수)
-- ============================================================================

-- [prm_] 가맹점 및 마트 할인 / 프로모션 정책
CREATE TABLE store_promotions (
    id                   TEXT PRIMARY KEY
                         CONSTRAINT chk_store_promotions_id CHECK (length(id) = 30 AND id GLOB 'prm_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id             TEXT REFERENCES stores(id)
                         CONSTRAINT chk_promotions_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id              TEXT REFERENCES mart_suppliers(id)
                         CONSTRAINT chk_promotions_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    name                 TEXT NOT NULL,
    promo_type           TEXT NOT NULL
                         CONSTRAINT chk_promo_type CHECK (promo_type IN (
                             'TAKEOUT_DISCOUNT', 'TIME_SALE', 'BASKET_DISCOUNT',
                             'BUNDLE_DISCOUNT', 'BUY_X_GET_Y', 'CROSS_CATEGORY', 'DAY_OF_WEEK'
                         )),
    discount_type        TEXT NOT NULL
                         CONSTRAINT chk_promo_disc_type CHECK (discount_type IN ('FIXED_AMOUNT', 'PERCENTAGE', 'SET_PRICE')),
    discount_value       INTEGER NOT NULL CONSTRAINT chk_promo_disc_val CHECK (discount_value > 0),
    min_order_amount     INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_promo_min_order CHECK (min_order_amount >= 0),
    bundle_qty           INTEGER CONSTRAINT chk_promo_bundle_qty CHECK (bundle_qty IS NULL OR bundle_qty >= 2),
    free_qty             INTEGER CONSTRAINT chk_promo_free_qty CHECK (free_qty IS NULL OR free_qty >= 1),
    cross_category_id    TEXT REFERENCES product_categories(id)
                         CONSTRAINT chk_promo_cross_cat CHECK (cross_category_id IS NULL OR (length(cross_category_id) = 30 AND cross_category_id GLOB 'cat_*')),
    promo_group_tag      TEXT,
    applicable_days_json TEXT,
    start_at             TEXT NOT NULL,
    end_at               TEXT NOT NULL,
    is_active            INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_promo_active CHECK (is_active IN (0, 1)),
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL,
    CONSTRAINT chk_promotions_owner CHECK (
        (store_id IS NOT NULL AND mart_id IS NULL) OR
        (store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE INDEX idx_promotions_store ON store_promotions (store_id);
CREATE INDEX idx_promotions_mart  ON store_promotions (mart_id);

-- [sch_] 하나로마트 정기 순회 배송 시간표
CREATE TABLE mart_delivery_schedules (
    id                TEXT PRIMARY KEY
                      CONSTRAINT chk_mart_delivery_schedules_id CHECK (length(id) = 30 AND id GLOB 'sch_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    mart_id           TEXT NOT NULL REFERENCES mart_suppliers(id)
                      CONSTRAINT chk_mart_schedules_mart_id CHECK (length(mart_id) = 30 AND mart_id GLOB 'mrt_*'),
    slot_order        INTEGER NOT NULL CONSTRAINT chk_mart_slot_order CHECK (slot_order >= 1),
    order_cutoff_time TEXT NOT NULL CONSTRAINT chk_mart_cutoff_time CHECK (
        order_cutoff_time GLOB '[01][0-9]:[0-5][0-9]' OR order_cutoff_time GLOB '2[0-3]:[0-5][0-9]'
    ),
    dispatch_time     TEXT NOT NULL CONSTRAINT chk_mart_dispatch_time CHECK (
        dispatch_time GLOB '[01][0-9]:[0-5][0-9]' OR dispatch_time GLOB '2[0-3]:[0-5][0-9]'
    ),
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);
CREATE INDEX idx_mart_schedules_mart ON mart_delivery_schedules (mart_id);

-- [stm_] 시니어클럽 2인 1조 상생 배달단 팀
CREATE TABLE senior_delivery_teams (
    id                TEXT PRIMARY KEY
                      CONSTRAINT chk_senior_delivery_teams_id CHECK (length(id) = 30 AND id GLOB 'stm_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    org_id            TEXT NOT NULL REFERENCES organizations(id)
                      CONSTRAINT chk_senior_team_org_id CHECK (length(org_id) = 30 AND org_id GLOB 'org_*'),
    team_name         TEXT NOT NULL,
    leader_worker_id  TEXT NOT NULL REFERENCES workers(id)
                      CONSTRAINT chk_senior_team_leader CHECK (length(leader_worker_id) = 30 AND leader_worker_id GLOB 'wrk_*'),
    member_worker_id  TEXT NOT NULL REFERENCES workers(id)
                      CONSTRAINT chk_senior_team_member CHECK (length(member_worker_id) = 30 AND member_worker_id GLOB 'wrk_*'),
    activity_days_json TEXT NOT NULL,
    is_active         INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_senior_team_active CHECK (is_active IN (0, 1)),
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);
CREATE INDEX idx_senior_teams_org ON senior_delivery_teams (org_id);

-- [dst_] 참여기관 관할 경로당 및 복지 배송 거점
CREATE TABLE senior_delivery_destinations (
    id                 TEXT PRIMARY KEY
                       CONSTRAINT chk_senior_delivery_destinations_id CHECK (length(id) = 30 AND id GLOB 'dst_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    org_id             TEXT NOT NULL REFERENCES organizations(id)
                       CONSTRAINT chk_senior_dest_org_id CHECK (length(org_id) = 30 AND org_id GLOB 'org_*'),
    assigned_team_id   TEXT REFERENCES senior_delivery_teams(id)
                       CONSTRAINT chk_senior_dest_team_id CHECK (assigned_team_id IS NULL OR (length(assigned_team_id) = 30 AND assigned_team_id GLOB 'stm_*')),
    facility_id        TEXT REFERENCES facilities(id)
                       CONSTRAINT chk_senior_dest_facility_id CHECK (facility_id IS NULL OR (length(facility_id) = 30 AND facility_id GLOB 'fac_*')),
    delivery_slot_time TEXT NOT NULL CONSTRAINT chk_senior_dest_slot CHECK (
        delivery_slot_time GLOB '[01][0-9]:[0-5][0-9]' OR delivery_slot_time GLOB '2[0-3]:[0-5][0-9]'
    ),
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
);
CREATE INDEX idx_senior_dest_org ON senior_delivery_destinations (org_id);

-- [agn_] 제휴 영업 대리점 (총판 / 지사 / VAN협력사 / 배달대리점)
CREATE TABLE partner_agencies (
    id                    TEXT PRIMARY KEY
                          CONSTRAINT chk_partner_agencies_id CHECK (length(id) = 30 AND id GLOB 'agn_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    business_name         TEXT NOT NULL,
    biz_reg_no            TEXT NOT NULL UNIQUE,
    agency_type           TEXT NOT NULL CONSTRAINT chk_agency_type CHECK (agency_type IN ('MASTER_DISTRIBUTOR', 'REGIONAL_AGENCY', 'INSTALLATION_PARTNER', 'DELIVERY_AGENCY')),
    representative_name   TEXT NOT NULL,
    phone_enc             TEXT NOT NULL,
    phone_hmac            TEXT NOT NULL
                          CONSTRAINT chk_partner_agencies_phone_hmac CHECK (length(phone_hmac) = 64 AND phone_hmac NOT GLOB '*[^0-9a-f]*'),
    coverage_regions_json TEXT NOT NULL,
    bank_name_enc         TEXT NOT NULL,
    bank_account_enc      TEXT NOT NULL,
    bank_holder_enc       TEXT NOT NULL,
    is_active             INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_agency_active CHECK (is_active IN (0, 1)),
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL
);

-- [agt_] 현장 영업사원 및 설치 엔지니어
CREATE TABLE partner_agents (
    id          TEXT PRIMARY KEY
                CONSTRAINT chk_partner_agents_id CHECK (length(id) = 30 AND id GLOB 'agt_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    agency_id   TEXT NOT NULL REFERENCES partner_agencies(id)
                CONSTRAINT chk_partner_agents_agency_id CHECK (length(agency_id) = 30 AND agency_id GLOB 'agn_*'),
    user_id     TEXT NOT NULL UNIQUE REFERENCES users(id)
                CONSTRAINT chk_partner_agents_user_id CHECK (length(user_id) = 30 AND user_id GLOB 'usr_*'),
    agent_role  TEXT NOT NULL CONSTRAINT chk_agent_role CHECK (agent_role IN ('SALES_REP', 'FIELD_ENGINEER', 'HYBRID')),
    agent_code  TEXT NOT NULL UNIQUE,
    is_active   INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_agent_active CHECK (is_active IN (0, 1)),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

-- [ins_] 단말기 현장 설치 및 증빙 (CTI 배선 / 시험출력 / 전자서명)
CREATE TABLE device_installations (
    id                        TEXT PRIMARY KEY
                              CONSTRAINT chk_device_installations_id CHECK (length(id) = 30 AND id GLOB 'ins_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    device_id                 TEXT NOT NULL REFERENCES devices(id)
                              CONSTRAINT chk_installations_device_id CHECK (length(device_id) = 30 AND device_id GLOB 'dev_*'),
    store_id                  TEXT NOT NULL REFERENCES stores(id)
                              CONSTRAINT chk_installations_store_id CHECK (length(store_id) = 30 AND store_id GLOB 'str_*'),
    agency_id                 TEXT NOT NULL REFERENCES partner_agencies(id)
                              CONSTRAINT chk_installations_agency_id CHECK (length(agency_id) = 30 AND agency_id GLOB 'agn_*'),
    technician_agent_id       TEXT NOT NULL REFERENCES partner_agents(id)
                              CONSTRAINT chk_installations_tech_id CHECK (length(technician_agent_id) = 30 AND technician_agent_id GLOB 'agt_*'),
    sales_agent_id            TEXT REFERENCES partner_agents(id)
                              CONSTRAINT chk_installations_sales_id CHECK (sales_agent_id IS NULL OR (length(sales_agent_id) = 30 AND sales_agent_id GLOB 'agt_*')),
    installation_status       TEXT NOT NULL CONSTRAINT chk_ins_status CHECK (installation_status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    installed_at              INTEGER,
    device_photo_r2_key       TEXT,
    cti_wiring_photo_r2_key   TEXT,
    test_print_photo_r2_key   TEXT,
    merchant_signature_r2_key TEXT,
    notes                     TEXT,
    created_at                INTEGER NOT NULL,
    updated_at                INTEGER NOT NULL
);

-- [cns_] 전자상거래법 이용약관 및 개인정보 동의 이력
CREATE TABLE user_consents (
    id                     TEXT PRIMARY KEY
                           CONSTRAINT chk_user_consents_id CHECK (length(id) = 30 AND id GLOB 'cns_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    user_id                TEXT NOT NULL REFERENCES users(id)
                           CONSTRAINT chk_consents_user_id CHECK (length(user_id) = 30 AND user_id GLOB 'usr_*'),
    terms_version          TEXT NOT NULL,
    privacy_version        TEXT NOT NULL,
    location_terms_version TEXT NOT NULL,
    marketing_opt_in       INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_cns_mkt CHECK (marketing_opt_in IN (0, 1)),
    ip_address             TEXT,
    created_at             INTEGER NOT NULL
);
CREATE INDEX idx_user_consents_user ON user_consents (user_id);


-- [bar_] 식약처 무료 공공데이터 & 가맹점 공유 바코드 카탈로그 (비용 0원)
CREATE TABLE shared_barcode_catalog (
    id                TEXT PRIMARY KEY
                      CONSTRAINT chk_shared_barcode_id CHECK (length(id) = 30 AND id GLOB 'bar_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    barcode           TEXT NOT NULL UNIQUE
                      CONSTRAINT chk_shared_barcode_val CHECK (length(barcode) BETWEEN 8 AND 14 AND barcode NOT GLOB '*[^0-9]*'),
    product_name      TEXT NOT NULL,
    manufacturer      TEXT,
    standard_spec     TEXT,
    category_name     TEXT,
    allergens_text    TEXT,
    origin_country    TEXT,
    source_type       TEXT NOT NULL DEFAULT 'MFDS'
                      CONSTRAINT chk_shared_barcode_src CHECK (source_type IN ('MFDS', 'MERCHANT_INPUT')),
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);
CREATE INDEX idx_shared_barcode_val ON shared_barcode_catalog (barcode);


-- [sup_] 매입처 / 제조사 / OEM 파트너사 (SwadKart & 마트 POS 연동)
CREATE TABLE suppliers (
    id                   TEXT PRIMARY KEY
                         CONSTRAINT chk_suppliers_id CHECK (length(id) = 30 AND id GLOB 'sup_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id             TEXT REFERENCES stores(id)
                         CONSTRAINT chk_suppliers_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id              TEXT REFERENCES mart_suppliers(id)
                         CONSTRAINT chk_suppliers_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    supplier_name        TEXT NOT NULL,
    biz_reg_no           TEXT NOT NULL,
    supplier_type        TEXT NOT NULL CONSTRAINT chk_supplier_type CHECK (supplier_type IN (
                             'LOCAL_FARM', 'WHOLESALE_VENDOR', 'OEM_MANUFACTURER', 'NH_LOGISTICS'
                         )),
    contact_phone_enc    TEXT NOT NULL,
    contact_phone_hmac   TEXT NOT NULL
                         CONSTRAINT chk_suppliers_phone_hmac CHECK (length(contact_phone_hmac) = 64 AND contact_phone_hmac NOT GLOB '*[^0-9a-f]*'),
    settlement_cycle     TEXT NOT NULL DEFAULT 'MONTHLY_END'
                         CONSTRAINT chk_sup_settle CHECK (settlement_cycle IN ('DAILY', 'WEEKLY', 'MONTHLY_END')),
    bank_name_enc        TEXT,
    bank_account_enc     TEXT,
    bank_holder_enc      TEXT,
    is_active            INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_supplier_active CHECK (is_active IN (0, 1)),
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL
);
CREATE INDEX idx_suppliers_mart ON suppliers (mart_id);

-- [ret_] 반품 및 감모 폐기 원장 (SwadKart orderController 재고원복 연계)
CREATE TABLE inventory_returns (
    id                   TEXT PRIMARY KEY
                         CONSTRAINT chk_inv_returns_id CHECK (length(id) = 30 AND id GLOB 'ret_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    mart_id              TEXT NOT NULL REFERENCES mart_suppliers(id)
                         CONSTRAINT chk_inv_returns_mart_id CHECK (length(mart_id) = 30 AND mart_id GLOB 'mrt_*'),
    product_id           TEXT NOT NULL REFERENCES products(id)
                         CONSTRAINT chk_inv_returns_product_id CHECK (length(product_id) = 30 AND product_id GLOB 'prd_*'),
    supplier_id          TEXT REFERENCES suppliers(id)
                         CONSTRAINT chk_inv_returns_supplier_id CHECK (supplier_id IS NULL OR (length(supplier_id) = 30 AND supplier_id GLOB 'sup_*')),
    order_id             TEXT REFERENCES orders(id)
                         CONSTRAINT chk_inv_returns_order_id CHECK (order_id IS NULL OR (length(order_id) = 30 AND order_id GLOB 'ord_*')),
    return_type          TEXT NOT NULL CONSTRAINT chk_return_type CHECK (return_type IN (
                             'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'SPOILED_DISPOSAL'
                         )),
    return_qty           INTEGER NOT NULL CONSTRAINT chk_ret_qty CHECK (return_qty > 0),
    unit_cost_price      INTEGER NOT NULL CONSTRAINT chk_ret_cost CHECK (unit_cost_price >= 0),
    total_refund_amount  INTEGER NOT NULL CONSTRAINT chk_ret_total CHECK (total_refund_amount >= 0),
    reason_notes         TEXT NOT NULL,
    proof_photo_r2_key   TEXT,
    status               TEXT NOT NULL DEFAULT 'REQUESTED'
                         CONSTRAINT chk_ret_status CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'SETTLED')),
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL
);
CREATE INDEX idx_inv_returns_mart ON inventory_returns (mart_id);
CREATE INDEX idx_inv_returns_product ON inventory_returns (product_id);

-- ============================================================================
-- 33. order_reviews (주문 리뷰 및 평점 분리·블랙컨슈머 방어)
-- ============================================================================
CREATE TABLE order_reviews (
    id                   TEXT PRIMARY KEY
                         CONSTRAINT chk_order_reviews_id CHECK (length(id) = 30 AND id GLOB 'rev_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    order_id             TEXT NOT NULL UNIQUE REFERENCES orders(id)
                         CONSTRAINT chk_order_reviews_order_id CHECK (length(order_id) = 30 AND order_id GLOB 'ord_*'),
    buyer_user_id        TEXT NOT NULL REFERENCES users(id)
                         CONSTRAINT chk_order_reviews_buyer_id CHECK (length(buyer_user_id) = 30 AND buyer_user_id GLOB 'usr_*'),
    seller_type          TEXT NOT NULL
                         CONSTRAINT chk_order_reviews_seller_type CHECK (seller_type IN ('STORE', 'MART')),
    store_id             TEXT REFERENCES stores(id)
                         CONSTRAINT chk_order_reviews_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id              TEXT REFERENCES mart_suppliers(id)
                         CONSTRAINT chk_order_reviews_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    product_rating       INTEGER NOT NULL
                         CONSTRAINT chk_order_reviews_prd_rating CHECK (product_rating BETWEEN 1 AND 5),
    delivery_rating      INTEGER NOT NULL
                         CONSTRAINT chk_order_reviews_dlv_rating CHECK (delivery_rating BETWEEN 1 AND 5),
    content              TEXT
                         CONSTRAINT chk_order_reviews_content CHECK (content IS NULL OR length(content) <= 1000),
    review_photos_json   TEXT,
    blind_status         TEXT NOT NULL DEFAULT 'NORMAL'
                         CONSTRAINT chk_order_reviews_blind CHECK (blind_status IN ('NORMAL', 'TEMPORARY_BLIND', 'PERMANENT_BLIND')),
    blind_reason         TEXT
                         CONSTRAINT chk_order_reviews_blind_reason CHECK (blind_reason IS NULL OR length(blind_reason) <= 500),
    blind_requested_at   INTEGER,
    blind_resolved_at    INTEGER,
    owner_reply          TEXT
                         CONSTRAINT chk_order_reviews_owner_reply CHECK (owner_reply IS NULL OR length(owner_reply) <= 1000),
    owner_replied_at     INTEGER,
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL,
    CONSTRAINT chk_order_reviews_seller CHECK (
        (seller_type = 'STORE' AND store_id IS NOT NULL AND mart_id IS NULL) OR
        (seller_type = 'MART' AND store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX uq_order_reviews_order ON order_reviews (order_id);
CREATE INDEX idx_order_reviews_store ON order_reviews (store_id, created_at) WHERE store_id IS NOT NULL;
CREATE INDEX idx_order_reviews_mart  ON order_reviews (mart_id, created_at)  WHERE mart_id IS NOT NULL;
CREATE INDEX idx_order_reviews_blind ON order_reviews (blind_status);

-- ============================================================================
-- 34. delivery_claims (배달 사고·오배송·파손 분쟁 조정 및 과책 분계 원장)
-- ============================================================================
CREATE TABLE delivery_claims (
    id                   TEXT PRIMARY KEY
                         CONSTRAINT chk_delivery_claims_id CHECK (length(id) = 30 AND id GLOB 'clm_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    order_id             TEXT NOT NULL REFERENCES orders(id)
                         CONSTRAINT chk_delivery_claims_order_id CHECK (length(order_id) = 30 AND order_id GLOB 'ord_*'),
    delivery_session_id  TEXT REFERENCES delivery_sessions(id)
                         CONSTRAINT chk_delivery_claims_dlv_id CHECK (delivery_session_id IS NULL OR (length(delivery_session_id) = 30 AND delivery_session_id GLOB 'dlv_*')),
    claim_type           TEXT NOT NULL
                         CONSTRAINT chk_delivery_claims_type CHECK (claim_type IN ('SPILL_DAMAGE', 'WRONG_DELIVERY', 'MISSING_ITEM', 'SEVERE_DELAY', 'OTHER')),
    fault_attribution    TEXT NOT NULL DEFAULT 'UNDER_INVESTIGATION'
                         CONSTRAINT chk_delivery_claims_fault CHECK (fault_attribution IN ('UNDER_INVESTIGATION', 'MERCHANT_FAULT', 'COURIER_FAULT', 'AGENCY_FAULT', 'PLATFORM_COMPENSATION', 'CUSTOMER_FAULT')),
    claim_status         TEXT NOT NULL DEFAULT 'FILED'
                         CONSTRAINT chk_delivery_claims_status CHECK (claim_status IN ('FILED', 'INVESTIGATING', 'APPROVED_REFUND', 'REJECTED', 'SETTLED')),
    claimed_amount       INTEGER NOT NULL
                         CONSTRAINT chk_delivery_claims_claimed_amt CHECK (claimed_amount > 0),
    compensated_amount   INTEGER NOT NULL DEFAULT 0
                         CONSTRAINT chk_delivery_claims_comp_amt CHECK (compensated_amount >= 0),
    compensation_type    TEXT
                         CONSTRAINT chk_delivery_claims_comp_type CHECK (compensation_type IS NULL OR compensation_type IN ('PAYMENT_CANCEL', 'POINT_GRANT', 'RE_DELIVERY')),
    claim_photos_json    TEXT,
    customer_memo        TEXT
                         CONSTRAINT chk_delivery_claims_cust_memo CHECK (customer_memo IS NULL OR length(customer_memo) <= 500),
    investigation_memo   TEXT
                         CONSTRAINT chk_delivery_claims_inv_memo CHECK (investigation_memo IS NULL OR length(investigation_memo) <= 1000),
    created_at           INTEGER NOT NULL,
    settled_at           INTEGER
);
CREATE INDEX idx_delivery_claims_order  ON delivery_claims (order_id);
CREATE INDEX idx_delivery_claims_status ON delivery_claims (claim_status);
CREATE INDEX idx_delivery_claims_fault  ON delivery_claims (fault_attribution);

-- ============================================================================
-- 35. virtual_numbers (0504 가상 안심번호 풀 및 수명주기 바인딩 원장)
-- ============================================================================
CREATE TABLE virtual_numbers (
    id                       TEXT PRIMARY KEY
                             CONSTRAINT chk_virtual_numbers_id CHECK (length(id) = 30 AND id GLOB 'vnm_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    virtual_phone            TEXT NOT NULL UNIQUE
                             CONSTRAINT chk_virtual_phone CHECK (length(virtual_phone) BETWEEN 10 AND 12 AND virtual_phone GLOB '050[0-9]*'),
    order_id                 TEXT REFERENCES orders(id)
                             CONSTRAINT chk_vnum_order_id CHECK (order_id IS NULL OR (length(order_id) = 30 AND order_id GLOB 'ord_*')),
    real_customer_phone_enc  TEXT,
    real_customer_phone_hmac TEXT
                             CONSTRAINT chk_vnum_cust_hmac CHECK (real_customer_phone_hmac IS NULL OR (length(real_customer_phone_hmac) = 64 AND real_customer_phone_hmac NOT GLOB '*[^0-9a-f]*')),
    real_driver_phone_enc    TEXT,
    real_driver_phone_hmac   TEXT
                             CONSTRAINT chk_vnum_drv_hmac CHECK (real_driver_phone_hmac IS NULL OR (length(real_driver_phone_hmac) = 64 AND real_driver_phone_hmac NOT GLOB '*[^0-9a-f]*')),
    status                   TEXT NOT NULL DEFAULT 'AVAILABLE'
                             CONSTRAINT chk_vnum_status CHECK (status IN ('AVAILABLE', 'BOUND', 'EXPIRED')),
    bound_at                 INTEGER,
    expires_at               INTEGER,
    released_at              INTEGER,
    created_at               INTEGER NOT NULL,
    updated_at               INTEGER NOT NULL
);
CREATE INDEX idx_vnum_order  ON virtual_numbers (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_vnum_status ON virtual_numbers (status);

-- ============================================================================
-- 36. message_logs (카카오 알림톡 및 이동통신사 SMS/LMS 폴백 발송 원장)
-- ============================================================================
CREATE TABLE message_logs (
    id                   TEXT PRIMARY KEY
                         CONSTRAINT chk_message_logs_id CHECK (length(id) = 30 AND id GLOB 'msg_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    order_id             TEXT REFERENCES orders(id)
                         CONSTRAINT chk_msg_order_id CHECK (order_id IS NULL OR (length(order_id) = 30 AND order_id GLOB 'ord_*')),
    recipient_user_id    TEXT REFERENCES users(id)
                         CONSTRAINT chk_msg_user_id CHECK (recipient_user_id IS NULL OR (length(recipient_user_id) = 30 AND recipient_user_id GLOB 'usr_*')),
    recipient_phone_hmac TEXT NOT NULL
                         CONSTRAINT chk_msg_phone_hmac CHECK (length(recipient_phone_hmac) = 64 AND recipient_phone_hmac NOT GLOB '*[^0-9a-f]*'),
    channel              TEXT NOT NULL
                         CONSTRAINT chk_msg_channel CHECK (channel IN ('ALIMTALK', 'SMS', 'LMS')),
    template_code        TEXT NOT NULL
                         CONSTRAINT chk_msg_template CHECK (length(template_code) BETWEEN 4 AND 50),
    title                TEXT
                         CONSTRAINT chk_msg_title CHECK (title IS NULL OR length(title) <= 100),
    content              TEXT NOT NULL
                         CONSTRAINT chk_msg_content CHECK (length(content) <= 2000),
    fallback_flag        INTEGER NOT NULL DEFAULT 0
                         CONSTRAINT chk_msg_fallback CHECK (fallback_flag IN (0, 1)),
    send_status          TEXT NOT NULL DEFAULT 'SENT'
                         CONSTRAINT chk_msg_status CHECK (send_status IN ('SENT', 'DELIVERED', 'FAILED')),
    created_at           INTEGER NOT NULL
);
CREATE INDEX idx_message_logs_order ON message_logs (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_message_logs_phone ON message_logs (recipient_phone_hmac, created_at);

-- ============================================================================
-- 37. device_telemetry_logs (단말기 실시간 MDM 텔레메트리 및 이상징후 원장)
-- ============================================================================
CREATE TABLE device_telemetry_logs (
    id                 TEXT PRIMARY KEY
                       CONSTRAINT chk_dev_telem_id CHECK (length(id) = 30 AND id GLOB 'tel_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    device_id          TEXT NOT NULL REFERENCES devices(id)
                       CONSTRAINT chk_telem_device_id CHECK (length(device_id) = 30 AND device_id GLOB 'dev_*'),
    paper_status       TEXT NOT NULL
                       CONSTRAINT chk_telem_paper CHECK (paper_status IN ('NORMAL', 'PAPER_LOW', 'PAPER_EMPTY', 'HEAD_OVERHEAT')),
    network_type       TEXT NOT NULL
                       CONSTRAINT chk_telem_net CHECK (network_type IN ('ETHERNET', 'WIFI', 'LTE')),
    cpu_temp_celsius   REAL
                       CONSTRAINT chk_telem_temp CHECK (cpu_temp_celsius IS NULL OR (cpu_temp_celsius >= -20 AND cpu_temp_celsius <= 120)),
    memory_usage_pct   INTEGER
                       CONSTRAINT chk_telem_mem CHECK (memory_usage_pct IS NULL OR (memory_usage_pct >= 0 AND memory_usage_pct <= 100)),
    storage_usage_pct  INTEGER
                       CONSTRAINT chk_telem_storage CHECK (storage_usage_pct IS NULL OR (storage_usage_pct >= 0 AND storage_usage_pct <= 100)),
    created_at         INTEGER NOT NULL
);
CREATE INDEX idx_dev_telem_device ON device_telemetry_logs (device_id, created_at);
CREATE INDEX idx_dev_telem_paper  ON device_telemetry_logs (paper_status);

-- ============================================================================
-- 38. firmware_releases (A/B 롤백 무중단 OTA 펌웨어 릴리즈 원장)
-- ============================================================================
CREATE TABLE firmware_releases (
    id                 TEXT PRIMARY KEY
                       CONSTRAINT chk_firmware_id CHECK (length(id) = 30 AND id GLOB 'frm_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    firmware_version   TEXT NOT NULL UNIQUE
                       CONSTRAINT chk_firmware_ver CHECK (length(firmware_version) <= 30),
    target_hardware    TEXT NOT NULL
                       CONSTRAINT chk_firmware_hw CHECK (target_hardware IN ('RPI_4B', 'RPI_CM4', 'ANDROID_POS')),
    binary_r2_key      TEXT NOT NULL,
    binary_sha256      TEXT NOT NULL
                       CONSTRAINT chk_firmware_sha CHECK (length(binary_sha256) = 64 AND binary_sha256 NOT GLOB '*[^0-9a-f]*'),
    is_critical        INTEGER NOT NULL DEFAULT 0
                       CONSTRAINT chk_firmware_critical CHECK (is_critical IN (0, 1)),
    release_status     TEXT NOT NULL DEFAULT 'TESTING'
                       CONSTRAINT chk_firmware_status CHECK (release_status IN ('TESTING', 'CANARY', 'ROLLED_OUT', 'REVOKED')),
    release_notes      TEXT,
    created_at         INTEGER NOT NULL
);
CREATE INDEX idx_firmware_hw_status ON firmware_releases (target_hardware, release_status);

-- ============================================================================
-- 39. merchant_daily_bi_snapshots (가맹점/마트 일간 공헌이익 및 원가분석 BI)
-- ============================================================================
CREATE TABLE merchant_daily_bi_snapshots (
    id                           TEXT PRIMARY KEY
                                 CONSTRAINT chk_bi_snap_id CHECK (length(id) = 30 AND id GLOB 'bis_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    seller_type                  TEXT NOT NULL
                                 CONSTRAINT chk_bi_seller_type CHECK (seller_type IN ('STORE', 'MART')),
    store_id                     TEXT REFERENCES stores(id)
                                 CONSTRAINT chk_bi_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id                      TEXT REFERENCES mart_suppliers(id)
                                 CONSTRAINT chk_bi_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    business_date                TEXT NOT NULL
                                 CONSTRAINT chk_bi_date CHECK (business_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    total_orders_count           INTEGER NOT NULL DEFAULT 0
                                 CONSTRAINT chk_bi_orders_cnt CHECK (total_orders_count >= 0),
    gross_sales_amount           INTEGER NOT NULL DEFAULT 0
                                 CONSTRAINT chk_bi_gross_sales CHECK (gross_sales_amount >= 0),
    total_food_cost_amount       INTEGER NOT NULL DEFAULT 0
                                 CONSTRAINT chk_bi_food_cost CHECK (total_food_cost_amount >= 0),
    total_packaging_cost_amount   INTEGER NOT NULL DEFAULT 0
                                 CONSTRAINT chk_bi_pkg_cost CHECK (total_packaging_cost_amount >= 0),
    estimated_gross_profit       INTEGER NOT NULL DEFAULT 0,
    profit_margin_pct            REAL,
    top_selling_product_id       TEXT REFERENCES products(id)
                                 CONSTRAINT chk_bi_top_product CHECK (top_selling_product_id IS NULL OR (length(top_selling_product_id) = 30 AND top_selling_product_id GLOB 'prd_*')),
    created_at                   INTEGER NOT NULL,
    CONSTRAINT chk_bi_seller CHECK (
        (seller_type = 'STORE' AND store_id IS NOT NULL AND mart_id IS NULL) OR
        (seller_type = 'MART' AND store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX uq_bi_seller_date ON merchant_daily_bi_snapshots (seller_type, store_id, mart_id, business_date);
CREATE INDEX idx_bi_store_date ON merchant_daily_bi_snapshots (store_id, business_date) WHERE store_id IS NOT NULL;
CREATE INDEX idx_bi_mart_date  ON merchant_daily_bi_snapshots (mart_id, business_date)  WHERE mart_id IS NOT NULL;

-- ============================================================================
-- 40. inventory_demand_forecasts (AI 수요예측 및 자동발주 추천 원장)
-- ============================================================================
CREATE TABLE inventory_demand_forecasts (
    id                     TEXT PRIMARY KEY
                           CONSTRAINT chk_forecast_id CHECK (length(id) = 30 AND id GLOB 'fcs_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    seller_type            TEXT NOT NULL
                           CONSTRAINT chk_fcs_seller_type CHECK (seller_type IN ('STORE', 'MART')),
    store_id               TEXT REFERENCES stores(id)
                           CONSTRAINT chk_fcs_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id                TEXT REFERENCES mart_suppliers(id)
                           CONSTRAINT chk_fcs_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    product_id             TEXT NOT NULL REFERENCES products(id)
                           CONSTRAINT chk_fcs_product_id CHECK (length(product_id) = 30 AND product_id GLOB 'prd_*'),
    forecast_target_date   TEXT NOT NULL
                           CONSTRAINT chk_fcs_target_date CHECK (forecast_target_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    predicted_sales_qty    INTEGER NOT NULL
                           CONSTRAINT chk_fcs_pred_qty CHECK (predicted_sales_qty >= 0),
    recommended_order_qty  INTEGER NOT NULL
                           CONSTRAINT chk_fcs_rec_qty CHECK (recommended_order_qty >= 0),
    confidence_score       REAL
                           CONSTRAINT chk_fcs_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
    weather_condition      TEXT
                           CONSTRAINT chk_fcs_weather CHECK (weather_condition IS NULL OR length(weather_condition) <= 50),
    created_at             INTEGER NOT NULL,
    CONSTRAINT chk_fcs_seller CHECK (
        (seller_type = 'STORE' AND store_id IS NOT NULL AND mart_id IS NULL) OR
        (seller_type = 'MART' AND store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX uq_forecast_product_date ON inventory_demand_forecasts (product_id, forecast_target_date);
CREATE INDEX idx_forecast_store ON inventory_demand_forecasts (store_id, forecast_target_date) WHERE store_id IS NOT NULL;
CREATE INDEX idx_forecast_mart  ON inventory_demand_forecasts (mart_id, forecast_target_date)  WHERE mart_id IS NOT NULL;
