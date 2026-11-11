import re

def main():
    schema_path = "docs/schema_aitip_v01.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update products table with OEM & Cost fields
    old_products_end = """    options_json   TEXT,
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

    new_products_end = """    supplier_id    TEXT,
    cost_price     INTEGER CONSTRAINT chk_products_cost_price CHECK (cost_price IS NULL OR cost_price >= 0),
    packaging_cost INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_products_pkg_cost CHECK (packaging_cost >= 0),
    margin_rate    REAL CONSTRAINT chk_products_margin_rate CHECK (margin_rate IS NULL OR (margin_rate >= -100.0 AND margin_rate <= 100.0)),
    is_oem         INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_products_is_oem CHECK (is_oem IN (0, 1)),
    oem_brand_name TEXT,
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

    assert old_products_end in content, "old_products_end not found!"
    content = content.replace(old_products_end, new_products_end)
    print("1. products table updated with cost_price, packaging_cost, is_oem.")

    # 2. Append suppliers and inventory_returns tables
    oem_tables = """

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
"""

    content += oem_tables

    with open(schema_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("2. suppliers and inventory_returns tables added to schema_aitip_v01.sql")

if __name__ == "__main__":
    main()
