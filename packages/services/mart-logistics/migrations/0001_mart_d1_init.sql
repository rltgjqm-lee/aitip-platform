-- AITIP Mart Logistics - Cloudflare D1 Initial Migration (0001)
-- Based on docs/schema_aitip_v01.sql + Mart Operational Extensions

PRAGMA foreign_keys = ON;

-- 1. 마트 입점 지점 마스터
CREATE TABLE IF NOT EXISTS mart_suppliers (
    id                 TEXT PRIMARY KEY,
    mart_name          TEXT NOT NULL,
    mart_type          TEXT NOT NULL DEFAULT 'NH_HANARO',
    region             TEXT,
    operator_name      TEXT,
    agency_fee_pct     REAL NOT NULL DEFAULT 5.0,
    biz_number         TEXT,
    phone              TEXT,
    address            TEXT,
    open_hours         TEXT,
    delivery_fee       INTEGER NOT NULL DEFAULT 3000,
    free_delivery_threshold INTEGER NOT NULL DEFAULT 40000,
    min_order_amount   INTEGER NOT NULL DEFAULT 15000,
    pickup_enabled     INTEGER NOT NULL DEFAULT 1,
    receipt_top_notice    TEXT,
    receipt_sub_notice    TEXT,
    receipt_bottom_notice TEXT,
    status             TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
);

-- 2. 커스텀 행사 유형 마스터
CREATE TABLE IF NOT EXISTS mart_promo_types (
    id         TEXT PRIMARY KEY,
    mart_id    TEXT REFERENCES mart_suppliers(id),
    code       TEXT NOT NULL,
    label      TEXT NOT NULL,
    calc_mode  TEXT NOT NULL DEFAULT 'UNIT_DISCOUNT'
               CHECK (calc_mode IN ('UNIT_DISCOUNT', 'BOGO_BUNDLE', 'MIX_MATCH', 'THRESHOLD')),
    is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    is_system  INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mart_promo_types_code ON mart_promo_types (mart_id, code);

-- 3. 행사 룰 마스터
CREATE TABLE IF NOT EXISTS store_promotions (
    id                   TEXT PRIMARY KEY,
    mart_id              TEXT NOT NULL REFERENCES mart_suppliers(id),
    name                 TEXT NOT NULL,
    promo_type           TEXT NOT NULL,
    calc_mode            TEXT NOT NULL DEFAULT 'UNIT_DISCOUNT'
                         CHECK (calc_mode IN ('UNIT_DISCOUNT', 'BOGO_BUNDLE', 'MIX_MATCH', 'THRESHOLD')),
    discount_type        TEXT NOT NULL DEFAULT 'PERCENT',
    discount_value       INTEGER NOT NULL DEFAULT 0,
    min_order_amount     INTEGER NOT NULL DEFAULT 0,
    bundle_qty           INTEGER DEFAULT 1,
    bundle_price         INTEGER DEFAULT 0,
    applicable_days_json TEXT,
    channel_scope        TEXT NOT NULL DEFAULT 'BOTH'
                         CHECK (channel_scope IN ('BOTH', 'ALL_CHANNELS', 'ONLINE_ONLY', 'OFFLINE_ONLY', 'POS_ONLY')),
    card_targets_json    TEXT,
    limit_per_person     INTEGER DEFAULT 0,
    total_limit_qty      INTEGER NOT NULL DEFAULT 0,
    used_qty             INTEGER NOT NULL DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE', 'ENDED', 'PAUSED')),
    max_discount_amount  INTEGER DEFAULT 0,
    max_receipt_sections INTEGER DEFAULT 0,
    start_at             TEXT NOT NULL,
    end_at               TEXT NOT NULL,
    is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_promotions_mart ON store_promotions (mart_id);
CREATE INDEX IF NOT EXISTS idx_promotions_mart_channel_active ON store_promotions (mart_id, channel_scope, is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_mart_status ON store_promotions (mart_id, status);

-- 4. 상품 카탈로그 (SSOT)
CREATE TABLE IF NOT EXISTS products (
    id                    TEXT PRIMARY KEY,
    mart_id               TEXT NOT NULL REFERENCES mart_suppliers(id),
    barcode_sku           TEXT,
    name                  TEXT NOT NULL,
    category_type         TEXT NOT NULL DEFAULT 'B2B_INDUSTRIAL',
    category_l1           TEXT,
    category_l2           TEXT,
    category_l3           TEXT,
    category_path         TEXT,
    spec                  TEXT,
    uom                   TEXT NOT NULL DEFAULT '개',
    tax_type              TEXT NOT NULL DEFAULT 'TAXABLE'
                          CHECK (tax_type IN ('TAXABLE', 'EXEMPT', 'TAX_FREE', 'ZERO_TAX')),
    cost_price            INTEGER DEFAULT 0,
    regular_price         INTEGER NOT NULL DEFAULT 0,
    sale_price            INTEGER NOT NULL DEFAULT 0,
    b2b_price             INTEGER DEFAULT 0,
    b2b_min_qty           INTEGER NOT NULL DEFAULT 1,
    discount_pct          INTEGER DEFAULT 0,
    applied_promo_id      TEXT REFERENCES store_promotions(id),
    sales_target          TEXT NOT NULL DEFAULT 'BOTH',
    channel_scope         TEXT NOT NULL DEFAULT 'ALL_CHANNELS',
    online_publish_status TEXT NOT NULL DEFAULT 'PUBLISHED_FEED',
    shared_catalog_scope  TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    mart_approval_status  TEXT,
    is_prep               INTEGER NOT NULL DEFAULT 0 CHECK (is_prep IN (0, 1)),
    storage_temp          TEXT NOT NULL DEFAULT 'AMBIENT',
    stock_qty             INTEGER NOT NULL DEFAULT 50,
    safety_stock          INTEGER NOT NULL DEFAULT 5,
    media_id              TEXT,
    image_r2_key          TEXT,
    image_url             TEXT,
    is_available          INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_mart ON products (mart_id);
CREATE INDEX IF NOT EXISTS idx_products_mart_barcode ON products (mart_id, barcode_sku) WHERE barcode_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_mart_promo ON products (mart_id, applied_promo_id) WHERE applied_promo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_mart_channel_prep ON products (mart_id, channel_scope, is_prep);

-- 5. 주문 및 상세
CREATE TABLE IF NOT EXISTS orders (
    id             TEXT PRIMARY KEY,
    mart_id        TEXT NOT NULL REFERENCES mart_suppliers(id),
    order_channel  TEXT NOT NULL DEFAULT 'ONLINE',
    customer_type  TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    facility_id    TEXT,
    buyer_name     TEXT,
    delivery_date  TEXT,
    delivery_mode  TEXT DEFAULT 'LOCAL_DELIVERY',
    payment_method TEXT DEFAULT 'CARD',
    card_brand     TEXT,
    promo_discount_total INTEGER NOT NULL DEFAULT 0,
    total_amount   INTEGER NOT NULL DEFAULT 0,
    order_status   TEXT NOT NULL DEFAULT 'REQUESTED',
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_mart_created ON orders (mart_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_mart_status_created ON orders (mart_id, order_status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_mart_delivery ON orders (mart_id, delivery_date);

CREATE TABLE IF NOT EXISTS order_items (
    id           TEXT PRIMARY KEY,
    order_id     TEXT NOT NULL REFERENCES orders(id),
    product_id   TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    qty          INTEGER NOT NULL,
    uom          TEXT,
    unit_price   INTEGER NOT NULL,
    storage_temp TEXT DEFAULT 'AMBIENT'
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- 6. PWA 블록 진열 제어 설정
CREATE TABLE IF NOT EXISTS pwa_configs (
    mart_id         TEXT PRIMARY KEY REFERENCES mart_suppliers(id),
    store_status    TEXT NOT NULL DEFAULT 'OPEN',
    cutoff_time     TEXT NOT NULL DEFAULT '14:00',
    pos_only_policy TEXT NOT NULL DEFAULT 'BADGE_ONLY',
    notice_text     TEXT,
    blocks_json     TEXT NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- 7. 공동구매 캠페인 (마트 등록 -> 슈퍼관리자 승인)
CREATE TABLE IF NOT EXISTS mart_group_buys (
    campaign_id       TEXT PRIMARY KEY,
    mart_id           TEXT NOT NULL REFERENCES mart_suppliers(id),
    campaign_type     TEXT NOT NULL DEFAULT 'B2C_RESIDENT',
    title             TEXT NOT NULL,
    unit_price        INTEGER NOT NULL,
    regular_price     INTEGER NOT NULL,
    target_qty        INTEGER NOT NULL,
    current_qty       INTEGER NOT NULL DEFAULT 0,
    deadline_at       TEXT,
    distribution_mode TEXT DEFAULT 'HUB_PICKUP',
    approval_status   TEXT NOT NULL DEFAULT 'PENDING_ADMIN',
    status            TEXT NOT NULL DEFAULT 'PENDING_ADMIN',
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_buys_mart_apv ON mart_group_buys (mart_id, approval_status);

-- 8. DOC-11 결품 · 수량 정정 원장
CREATE TABLE IF NOT EXISTS mart_adjustments (
    adj_id       TEXT PRIMARY KEY,
    mart_id      TEXT NOT NULL REFERENCES mart_suppliers(id),
    order_id     TEXT NOT NULL REFERENCES orders(id),
    buyer_name   TEXT,
    product_id   TEXT NOT NULL,
    product_name TEXT NOT NULL,
    prev_qty     INTEGER NOT NULL,
    actual_qty   INTEGER NOT NULL,
    diff_amount  INTEGER NOT NULL DEFAULT 0,
    reason       TEXT NOT NULL,
    created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_adjustments_mart_order ON mart_adjustments (mart_id, order_id);

-- 9. 시세 일괄 업로드 이력 & 원클릭 롤백 스냅샷
CREATE TABLE IF NOT EXISTS mart_price_upload_batches (
    batch_id       TEXT PRIMARY KEY,
    mart_id        TEXT NOT NULL REFERENCES mart_suppliers(id),
    mode           TEXT NOT NULL DEFAULT 'PARTIAL',
    total_rows     INTEGER NOT NULL DEFAULT 0,
    updated_count  INTEGER NOT NULL DEFAULT 0,
    error_count    INTEGER NOT NULL DEFAULT 0,
    sold_out_count INTEGER NOT NULL DEFAULT 0,
    snapshot_json  TEXT NOT NULL,
    rolled_back    INTEGER NOT NULL DEFAULT 0 CHECK (rolled_back IN (0, 1)),
    created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_batches_mart_created ON mart_price_upload_batches (mart_id, created_at);
