import os
import re

def main():
    schema_path = "docs/schema_aitip_v01.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update users table: add role column with check constraint
    old_users = """CREATE TABLE users (
    id          TEXT PRIMARY KEY
                CONSTRAINT chk_users_id CHECK (length(id) = 30 AND id GLOB 'usr_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    phone_enc   TEXT NOT NULL,
    phone_hmac  TEXT NOT NULL
                CONSTRAINT chk_users_phone_hmac CHECK (length(phone_hmac) = 64 AND phone_hmac NOT GLOB '*[^0-9a-f]*'),
    pii_key_ver INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_users_key_ver CHECK (pii_key_ver >= 1),
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'ACTIVE'
                CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'BLOCKED', 'DORMANT')),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);"""

    new_users = """CREATE TABLE users (
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
                    'AGENCY_MASTER', 'AGENCY_MANAGER', 'FIELD_ENGINEER', 'SALES_REP',
                    'STORE_OWNER', 'MART_MANAGER', 'SENIOR_ORG_MANAGER',
                    'COMMERCIAL_RIDER', 'SENIOR_COURIER', 'COURIER', 'CUSTOMER'
                )),
    status      TEXT NOT NULL DEFAULT 'ACTIVE'
                CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'BLOCKED', 'DORMANT')),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);"""

    assert old_users in content, "old_users not found!"
    content = content.replace(old_users, new_users)
    print("1. users table updated with role check.")

    # 2. Update stores table: add operational fields
    old_stores = """CREATE TABLE stores (
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
    attributes_json     TEXT NOT NULL DEFAULT '{}'
                        CONSTRAINT chk_stores_attrs CHECK (json_valid(attributes_json) AND json_type(attributes_json) = 'object' AND length(attributes_json) <= 8192),
    attributes_version  INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_stores_attrs_ver CHECK (attributes_version >= 1),
    is_active           INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_stores_active CHECK (is_active IN (0, 1)),
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);"""

    new_stores = """CREATE TABLE stores (
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
);"""

    assert old_stores in content, "old_stores not found!"
    content = content.replace(old_stores, new_stores)
    print("2. stores table updated with operational fields.")

    # 3. Add product_categories and update products table
    old_products = """CREATE TABLE products (
    id           TEXT PRIMARY KEY
                 CONSTRAINT chk_products_id CHECK (length(id) = 30 AND id GLOB 'prd_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id     TEXT REFERENCES stores(id)
                 CONSTRAINT chk_products_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id      TEXT REFERENCES mart_suppliers(id)
                 CONSTRAINT chk_products_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    name         TEXT NOT NULL,
    price        INTEGER NOT NULL CONSTRAINT chk_products_price CHECK (price >= 0),
    unit         TEXT NOT NULL DEFAULT 'EA',
    tax_type     TEXT NOT NULL DEFAULT 'TAXABLE'
                 CONSTRAINT chk_products_tax CHECK (tax_type IN ('TAXABLE', 'TAX_FREE', 'ZERO_TAX')),
    origin_text  TEXT, -- [확인 필요] 법적 표시 의무 규정 세부 점검 필요
    is_available INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_products_available CHECK (is_available IN (0, 1)),
    options_json TEXT,
    image_r2_key TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    CONSTRAINT chk_products_owner CHECK (
        (store_id IS NOT NULL AND mart_id IS NULL) OR
        (store_id IS NULL AND mart_id IS NOT NULL)
    )
);"""

    new_products = """CREATE TABLE product_categories (
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
    options_json   TEXT,
    image_r2_key   TEXT,
    image_format   TEXT NOT NULL DEFAULT 'webp' CONSTRAINT chk_products_img_fmt CHECK (image_format = 'webp'),
    image_hash     TEXT,
    allergens_json TEXT,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    CONSTRAINT chk_products_owner CHECK (
        (store_id IS NOT NULL AND mart_id IS NULL) OR
        (store_id IS NULL AND mart_id IS NOT NULL)
    )
);"""

    assert old_products in content, "old_products not found!"
    content = content.replace(old_products, new_products)
    print("3. product_categories created and products table updated with WebP & weights.")

    # 4. Update orders table with discount_amount
    old_orders_cols = """    delivery_fee         INTEGER NOT NULL DEFAULT 0
                         CONSTRAINT chk_orders_delivery_fee CHECK (delivery_fee >= 0),
    total_amount         INTEGER NOT NULL
                         CONSTRAINT chk_orders_total CHECK (total_amount >= 0),"""

    new_orders_cols = """    delivery_fee         INTEGER NOT NULL DEFAULT 0
                         CONSTRAINT chk_orders_delivery_fee CHECK (delivery_fee >= 0),
    discount_amount      INTEGER NOT NULL DEFAULT 0
                         CONSTRAINT chk_orders_discount CHECK (discount_amount >= 0),
    promotion_id         TEXT
                         CONSTRAINT chk_orders_promotion_id CHECK (promotion_id IS NULL OR (length(promotion_id) = 30 AND promotion_id GLOB 'prm_*')),
    total_amount         INTEGER NOT NULL
                         CONSTRAINT chk_orders_total CHECK (total_amount >= 0),"""

    assert old_orders_cols in content, "old_orders_cols not found!"
    content = content.replace(old_orders_cols, new_orders_cols)
    print("4. orders table updated with discount_amount and promotion_id.")

    # 5. Append new ecosystem tables
    ecosystem_sql = """

-- ============================================================================
-- AITIP 확장 생태계 테이블 (TypeID 엄격 준수)
-- ============================================================================

-- [prm_] 가맹점 및 마트 할인 / 프로모션 정책
CREATE TABLE store_promotions (
    id               TEXT PRIMARY KEY
                     CONSTRAINT chk_store_promotions_id CHECK (length(id) = 30 AND id GLOB 'prm_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    store_id         TEXT REFERENCES stores(id)
                     CONSTRAINT chk_promotions_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id          TEXT REFERENCES mart_suppliers(id)
                     CONSTRAINT chk_promotions_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    name             TEXT NOT NULL,
    promo_type       TEXT NOT NULL
                     CONSTRAINT chk_promo_type CHECK (promo_type IN ('TAKEOUT_DISCOUNT', 'TIME_SALE', 'BASKET_DISCOUNT')),
    discount_type    TEXT NOT NULL
                     CONSTRAINT chk_promo_disc_type CHECK (discount_type IN ('FIXED_AMOUNT', 'PERCENTAGE')),
    discount_value   INTEGER NOT NULL CONSTRAINT chk_promo_disc_val CHECK (discount_value > 0),
    min_order_amount INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_promo_min_order CHECK (min_order_amount >= 0),
    start_at         TEXT NOT NULL,
    end_at           TEXT NOT NULL,
    is_active        INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_promo_active CHECK (is_active IN (0, 1)),
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
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

-- [agn_] 제휴 영업 대리점 (총판 / 지사 / VAN협력사)
CREATE TABLE partner_agencies (
    id                    TEXT PRIMARY KEY
                          CONSTRAINT chk_partner_agencies_id CHECK (length(id) = 30 AND id GLOB 'agn_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    business_name         TEXT NOT NULL,
    biz_reg_no            TEXT NOT NULL UNIQUE,
    agency_type           TEXT NOT NULL CONSTRAINT chk_agency_type CHECK (agency_type IN ('MASTER_DISTRIBUTOR', 'REGIONAL_AGENCY', 'INSTALLATION_PARTNER')),
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
"""

    content += ecosystem_sql

    with open(schema_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("5. docs/schema_aitip_v01.sql successfully updated with all TypeID strict ecosystem tables!")

if __name__ == "__main__":
    main()
