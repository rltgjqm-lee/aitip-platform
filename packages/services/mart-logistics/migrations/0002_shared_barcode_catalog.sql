-- 0002: 전사 공용 바코드 카탈로그 (공공데이터포털 HACCP + R2 shared/barcode/{gtin}.* 공용 풀)
CREATE TABLE IF NOT EXISTS shared_barcode_catalog (
    id             TEXT PRIMARY KEY,
    barcode        TEXT NOT NULL UNIQUE CHECK (length(barcode) BETWEEN 8 AND 14 AND barcode NOT GLOB '*[^0-9]*'),
    product_name   TEXT NOT NULL,
    manufacturer   TEXT,
    standard_spec  TEXT,
    category_name  TEXT,
    allergens_text TEXT,
    image_r2_key   TEXT,
    image_url      TEXT,
    source_type    TEXT NOT NULL DEFAULT 'HACCP' CHECK (source_type IN ('MFDS', 'HACCP', 'MERCHANT_INPUT')),
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shared_barcode_val ON shared_barcode_catalog (barcode);
CREATE INDEX IF NOT EXISTS idx_shared_barcode_name ON shared_barcode_catalog (product_name);
