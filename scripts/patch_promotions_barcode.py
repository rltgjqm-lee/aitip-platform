import re

def main():
    schema_path = "docs/schema_aitip_v01.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update store_promotions table with bundle, cross, day-of-week fields
    old_promotions = """CREATE TABLE store_promotions (
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
);"""

    new_promotions = """CREATE TABLE store_promotions (
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
);"""

    assert old_promotions in content, "old_promotions not found!"
    content = content.replace(old_promotions, new_promotions)
    print("1. store_promotions updated with complex promotions (bundle, cross, day-of-week).")

    # 2. Append shared_barcode_catalog table
    barcode_table = """

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
"""

    content += barcode_table

    with open(schema_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("2. shared_barcode_catalog added to docs/schema_aitip_v01.sql")

if __name__ == "__main__":
    main()
