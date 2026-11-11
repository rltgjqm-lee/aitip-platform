import os
import sys

def main():
    schema_path = 'docs/schema_aitip_v01.sql'
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema = f.read()

    # 1. Update users table role CHECK constraint
    old_user_role = """    role        TEXT NOT NULL DEFAULT 'CUSTOMER'
        CONSTRAINT chk_users_role CHECK (role IN ('CUSTOMER', 'STORE_OWNER', 'COURIER', 'ADMIN')),"""

    new_user_role = """    role        TEXT NOT NULL DEFAULT 'CUSTOMER'
        CONSTRAINT chk_users_role CHECK (role IN (
            'SUPER_ADMIN', 'HQ_DEV_OPS', 'HQ_SALES_OPS', 'HQ_MERCHANT_OPS', 'HQ_FINANCE_OPS', 'HQ_LOGISTICS_OPS',
            'AGENCY_MASTER', 'AGENCY_MANAGER', 'FIELD_ENGINEER', 'SALES_REP',
            'STORE_OWNER', 'MART_MANAGER', 'SENIOR_ORG_MANAGER',
            'COMMERCIAL_RIDER', 'SENIOR_COURIER', 'COURIER', 'ADMIN', 'CUSTOMER'
        )),"""

    if old_user_role in schema:
        schema = schema.replace(old_user_role, new_user_role)
        print("1. users role constraint updated.")
    else:
        print("WARN: old_user_role not matched!")

    # 2. Update stores table with new fields
    old_stores_end = """    attributes_json    TEXT,
    attributes_version INTEGER NOT NULL DEFAULT 1
        CONSTRAINT chk_stores_attr_ver CHECK (attributes_version >= 1),
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);"""

    new_stores_end = """    attributes_json    TEXT,
    attributes_version INTEGER NOT NULL DEFAULT 1
        CONSTRAINT chk_stores_attr_ver CHECK (attributes_version >= 1),
    min_order_amount   INTEGER NOT NULL DEFAULT 0
        CONSTRAINT chk_stores_min_order CHECK (min_order_amount >= 0),
    free_delivery_threshold INTEGER DEFAULT NULL
        CONSTRAINT chk_stores_free_deliv CHECK (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0),
    default_prep_minutes INTEGER NOT NULL DEFAULT 15
        CONSTRAINT chk_stores_prep_min CHECK (default_prep_minutes >= 0),
    is_takeout_available INTEGER NOT NULL DEFAULT 1
        CONSTRAINT chk_stores_takeout CHECK (is_takeout_available IN (0, 1)),
    origin_notice_text TEXT DEFAULT NULL,
    referral_agency_id TEXT DEFAULT NULL,
    referral_agent_id  TEXT DEFAULT NULL,
    bank_name_enc      TEXT DEFAULT NULL,
    bank_account_enc   TEXT DEFAULT NULL,
    bank_holder_enc    TEXT DEFAULT NULL,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);"""

    if old_stores_end in schema:
        schema = schema.replace(old_stores_end, new_stores_end)
        print("2. stores table updated.")
    else:
        print("WARN: old_stores_end not matched!")

    # 3. Update products and add product_categories
    old_products = """CREATE TABLE products (
    product_id   TEXT PRIMARY KEY,
    store_id     TEXT NOT NULL REFERENCES stores(store_id),
    name         TEXT NOT NULL,
    price        INTEGER NOT NULL CONSTRAINT chk_products_price CHECK (price >= 0),
    unit         TEXT,
    tax_type     TEXT NOT NULL DEFAULT 'TAXABLE'
        CONSTRAINT chk_products_tax_type CHECK (tax_type IN ('TAXABLE', 'TAX_FREE', 'ZERO_TAX')),
    origin_text  TEXT,
    is_available INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_products_avail CHECK (is_available IN (0, 1)),
    options_json TEXT,
    image_r2_key TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);"""

    new_products = """CREATE TABLE product_categories (
    category_id   TEXT PRIMARY KEY,
    store_id      TEXT NOT NULL REFERENCES stores(store_id),
    name          TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active     INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_prod_cat_active CHECK (is_active IN (0, 1)),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE products (
    product_id     TEXT PRIMARY KEY,
    store_id       TEXT NOT NULL REFERENCES stores(store_id),
    category_id    TEXT DEFAULT NULL REFERENCES product_categories(category_id),
    name           TEXT NOT NULL,
    price          INTEGER NOT NULL CONSTRAINT chk_products_price CHECK (price >= 0),
    original_price INTEGER DEFAULT NULL CONSTRAINT chk_products_orig_price CHECK (original_price IS NULL OR original_price >= 0),
    barcode_sku    TEXT DEFAULT NULL,
    weight_value   REAL DEFAULT NULL,
    weight_unit    TEXT DEFAULT NULL CONSTRAINT chk_products_weight_unit CHECK (weight_unit IS NULL OR weight_unit IN ('g', 'kg', 'ml', 'l', 'piece')),
    unit           TEXT,
    tax_type       TEXT NOT NULL DEFAULT 'TAXABLE'
        CONSTRAINT chk_products_tax_type CHECK (tax_type IN ('TAXABLE', 'TAX_FREE', 'ZERO_TAX')),
    origin_text    TEXT,
    is_available   INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_products_avail CHECK (is_available IN (0, 1)),
    options_json   TEXT,
    image_r2_key   TEXT,
    image_format   TEXT NOT NULL DEFAULT 'webp' CONSTRAINT chk_products_img_fmt CHECK (image_format = 'webp'),
    image_hash     TEXT DEFAULT NULL,
    allergens_json TEXT DEFAULT NULL,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);"""

    if old_products in schema:
        schema = schema.replace(old_products, new_products)
        print("3. product_categories and products table updated.")
    else:
        print("WARN: old_products not matched!")

    # 4. Update orders table with discount
    old_orders = """    total_price   INTEGER NOT NULL CONSTRAINT chk_orders_total_price CHECK (total_price >= 0),
    delivery_fee  INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_orders_delivery_fee CHECK (delivery_fee >= 0),
    total_amount  INTEGER NOT NULL CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0),
    payment_status TEXT NOT NULL DEFAULT 'PENDING'
        CONSTRAINT chk_orders_pay_status CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    order_status  TEXT NOT NULL DEFAULT 'RECEIVED'
        CONSTRAINT chk_orders_status CHECK (order_status IN ('RECEIVED', 'ACCEPTED', 'COOKING', 'DELIVERING', 'COMPLETED', 'CANCELLED')),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT chk_orders_total_calc CHECK (total_amount = total_price + delivery_fee)
);"""

    new_orders = """    total_price   INTEGER NOT NULL CONSTRAINT chk_orders_total_price CHECK (total_price >= 0),
    delivery_fee  INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_orders_delivery_fee CHECK (delivery_fee >= 0),
    discount_amount INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_orders_discount CHECK (discount_amount >= 0),
    total_amount  INTEGER NOT NULL CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0),
    promotion_id  TEXT DEFAULT NULL,
    payment_status TEXT NOT NULL DEFAULT 'PENDING'
        CONSTRAINT chk_orders_pay_status CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    order_status  TEXT NOT NULL DEFAULT 'RECEIVED'
        CONSTRAINT chk_orders_status CHECK (order_status IN ('RECEIVED', 'ACCEPTED', 'COOKING', 'DELIVERING', 'COMPLETED', 'CANCELLED')),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT chk_orders_total_calc CHECK (total_amount = total_price + delivery_fee - discount_amount)
);"""

    if old_orders in schema:
        schema = schema.replace(old_orders, new_orders)
        print("4. orders table updated with discount.")
    else:
        print("WARN: old_orders not matched!")

    # 5. Appendix
    appendix = """

-- ============================================================================
-- AITIP 확장 생태계 테이블 (가맹점 프로모션 / 마트 순회배송 / 시니어 상생 / 제휴 영업망 / 규제)
-- ============================================================================

-- 1. 가맹점 및 마트 할인 / 프로모션 정책
CREATE TABLE store_promotions (
    promotion_id     TEXT PRIMARY KEY,
    store_id         TEXT NOT NULL REFERENCES stores(store_id),
    name             TEXT NOT NULL,
    promo_type       TEXT NOT NULL CONSTRAINT chk_promo_type CHECK (promo_type IN ('TAKEOUT_DISCOUNT', 'TIME_SALE', 'BASKET_DISCOUNT')),
    discount_type    TEXT NOT NULL CONSTRAINT chk_promo_disc_type CHECK (discount_type IN ('FIXED_AMOUNT', 'PERCENTAGE')),
    discount_value   INTEGER NOT NULL CONSTRAINT chk_promo_disc_val CHECK (discount_value > 0),
    min_order_amount INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_promo_min_order CHECK (min_order_amount >= 0),
    start_at         TEXT NOT NULL,
    end_at           TEXT NOT NULL,
    is_active        INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_promo_active CHECK (is_active IN (0, 1)),
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 2. 하나로마트 정기 순회 배송 시간표
CREATE TABLE mart_delivery_schedules (
    schedule_id      TEXT PRIMARY KEY,
    store_id         TEXT NOT NULL REFERENCES stores(store_id),
    slot_order       INTEGER NOT NULL CONSTRAINT chk_mart_slot_order CHECK (slot_order >= 1),
    order_cutoff_time TEXT NOT NULL CONSTRAINT chk_mart_cutoff_time CHECK (
        order_cutoff_time GLOB '[01][0-9]:[0-5][0-9]' OR order_cutoff_time GLOB '2[0-3]:[0-5][0-9]'
    ),
    dispatch_time    TEXT NOT NULL CONSTRAINT chk_mart_dispatch_time CHECK (
        dispatch_time GLOB '[01][0-9]:[0-5][0-9]' OR dispatch_time GLOB '2[0-3]:[0-5][0-9]'
    ),
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. 참여기관 (시니어클럽 / 복지관 / 자활센터) 전용 프로필
CREATE TABLE senior_org_profiles (
    org_id            TEXT PRIMARY KEY,
    store_id          TEXT NOT NULL UNIQUE REFERENCES stores(store_id),
    org_type          TEXT NOT NULL CONSTRAINT chk_senior_org_type CHECK (org_type IN ('SENIOR_CLUB', 'WELFARE_CENTER', 'SELF_SUFFICIENCY')),
    manager_name_enc  TEXT NOT NULL,
    manager_phone_enc TEXT NOT NULL,
    manager_phone_hmac TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 4. 시니어클럽 2인 1조 상생 배달단 팀
CREATE TABLE senior_delivery_teams (
    team_id           TEXT PRIMARY KEY,
    org_id            TEXT NOT NULL REFERENCES senior_org_profiles(org_id),
    team_name         TEXT NOT NULL,
    leader_user_id    TEXT NOT NULL REFERENCES users(user_id),
    member_user_id    TEXT NOT NULL REFERENCES users(user_id),
    activity_days_json TEXT NOT NULL,
    is_active         INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_senior_team_active CHECK (is_active IN (0, 1)),
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 5. 참여기관 관할 경로당 및 복지 배송 거점
CREATE TABLE senior_delivery_destinations (
    destination_id     TEXT PRIMARY KEY,
    org_id             TEXT NOT NULL REFERENCES senior_org_profiles(org_id),
    assigned_team_id   TEXT DEFAULT NULL REFERENCES senior_delivery_teams(team_id),
    facility_name      TEXT NOT NULL,
    recipient_name_enc TEXT NOT NULL,
    recipient_phone_enc TEXT NOT NULL,
    recipient_phone_hmac TEXT NOT NULL,
    road_address       TEXT NOT NULL,
    delivery_slot_time TEXT NOT NULL CONSTRAINT chk_senior_dest_slot CHECK (
        delivery_slot_time GLOB '[01][0-9]:[0-5][0-9]' OR delivery_slot_time GLOB '2[0-3]:[0-5][0-9]'
    ),
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 6. 제휴 영업 대리점 (총판 / 지사 / VAN협력사)
CREATE TABLE partner_agencies (
    agency_id             TEXT PRIMARY KEY,
    business_name         TEXT NOT NULL,
    biz_reg_no            TEXT NOT NULL UNIQUE,
    agency_type           TEXT NOT NULL CONSTRAINT chk_agency_type CHECK (agency_type IN ('MASTER_DISTRIBUTOR', 'REGIONAL_AGENCY', 'INSTALLATION_PARTNER')),
    representative_name   TEXT NOT NULL,
    phone_enc             TEXT NOT NULL,
    phone_hmac            TEXT NOT NULL,
    coverage_regions_json TEXT NOT NULL,
    bank_name_enc         TEXT NOT NULL,
    bank_account_enc      TEXT NOT NULL,
    bank_holder_enc       TEXT NOT NULL,
    is_active             INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_agency_active CHECK (is_active IN (0, 1)),
    created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 7. 현장 영업사원 및 설치 엔지니어
CREATE TABLE partner_agents (
    agent_id    TEXT PRIMARY KEY,
    agency_id   TEXT NOT NULL REFERENCES partner_agencies(agency_id),
    user_id     TEXT NOT NULL UNIQUE REFERENCES users(user_id),
    agent_role  TEXT NOT NULL CONSTRAINT chk_agent_role CHECK (agent_role IN ('SALES_REP', 'FIELD_ENGINEER', 'HYBRID')),
    agent_code  TEXT NOT NULL UNIQUE,
    is_active   INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_agent_active CHECK (is_active IN (0, 1)),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 8. 단말기 현장 설치 및 증빙 (CTI 배선 / 시험출력 / 전자서명)
CREATE TABLE device_installations (
    installation_id           TEXT PRIMARY KEY,
    device_id                 TEXT NOT NULL REFERENCES devices(device_id),
    store_id                  TEXT NOT NULL REFERENCES stores(store_id),
    agency_id                 TEXT NOT NULL REFERENCES partner_agencies(agency_id),
    technician_agent_id       TEXT NOT NULL REFERENCES partner_agents(agent_id),
    sales_agent_id            TEXT DEFAULT NULL REFERENCES partner_agents(agent_id),
    installation_status       TEXT NOT NULL CONSTRAINT chk_ins_status CHECK (installation_status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    installed_at              TEXT DEFAULT NULL,
    device_photo_r2_key       TEXT DEFAULT NULL,
    cti_wiring_photo_r2_key   TEXT DEFAULT NULL,
    test_print_photo_r2_key   TEXT DEFAULT NULL,
    merchant_signature_r2_key TEXT DEFAULT NULL,
    notes                     TEXT DEFAULT NULL,
    created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 9. 전자상거래법 이용약관 및 개인정보 동의 이력
CREATE TABLE user_consents (
    consent_id             TEXT PRIMARY KEY,
    user_id                TEXT NOT NULL REFERENCES users(user_id),
    terms_version          TEXT NOT NULL,
    privacy_version        TEXT NOT NULL,
    location_terms_version TEXT NOT NULL,
    marketing_opt_in       INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_cns_mkt CHECK (marketing_opt_in IN (0, 1)),
    consented_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ip_address             TEXT DEFAULT NULL
);
"""
    schema = schema + appendix

    with open(schema_path, 'w', encoding='utf-8') as f:
        f.write(schema)

    print("Successfully updated docs/schema_aitip_v01.sql")

if __name__ == '__main__':
    main()
