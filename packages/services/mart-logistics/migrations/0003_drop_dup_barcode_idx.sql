-- 0003: shared_barcode_catalog.barcode UNIQUE 자동 인덱스와 중복되는 idx_shared_barcode_val 제거 (D1 쓰기량 20% 절감)
DROP INDEX IF EXISTS idx_shared_barcode_val;
