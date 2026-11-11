import re

def main():
    test_file = "scripts/test_schema_integrity.py"
    with open(test_file, "r", encoding="utf-8") as f:
        code = f.read()

    # 1. Update PREFIXES with "sup", "ret"
    old_prefixes = """PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr",
            "cat", "prm", "sch", "stm", "dst", "agn", "agt", "ins", "cns", "bar"]"""

    new_prefixes = """PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr",
            "cat", "prm", "sch", "stm", "dst", "agn", "agt", "ins", "cns", "bar",
            "sup", "ret"]"""

    assert old_prefixes in code, "old_prefixes not found!"
    code = code.replace(old_prefixes, new_prefixes)

    # 2. Add Section 22 before conn.close()
    target_pos = """    r.reject(conn, "shared_barcode_catalog 중복 바코드 등록 거부",
             *ins("shared_barcode_catalog", dict(id=new_id("bar"), barcode="8801043014847", product_name="중복라면",
                                                 source_type="MERCHANT_INPUT", created_at=NOW, updated_at=NOW)),
             expect="UNIQUE constraint failed: shared_barcode_catalog.barcode")

    conn.close()"""

    new_section = """    r.reject(conn, "shared_barcode_catalog 중복 바코드 등록 거부",
             *ins("shared_barcode_catalog", dict(id=new_id("bar"), barcode="8801043014847", product_name="중복라면",
                                                 source_type="MERCHANT_INPUT", created_at=NOW, updated_at=NOW)),
             expect="UNIQUE constraint failed: shared_barcode_catalog.barcode")

    # ------------------------------------------------------------------
    r.group("22. 마트 POS/ERP 연동 & OEM 매입/반품/원가 계산기 (Section 22)")

    # 22.1 suppliers (sup_) 매입처/OEM 공장 등록
    sup1_id = new_id("sup")
    r.ok(conn, "suppliers (sup_) OEM 제조사 등록 통과",
         *ins("suppliers", dict(id=sup1_id, store_id=None, mart_id=F["mrt"], supplier_name="안동 농가식품 OEM공장",
                                biz_reg_no="504-81-12345", supplier_type="OEM_MANUFACTURER",
                                contact_phone_enc="enc:phone", contact_phone_hmac=hmac_hex("0548501234"),
                                settlement_cycle="MONTHLY_END", is_active=1, created_at=NOW, updated_at=NOW)))

    # 22.2 products 매입원가(cost_price) 및 OEM 마진 등록
    prd_oem_id = new_id("prd")
    r.ok(conn, "products OEM 원가(cost_price: 3500, 판매가: 5000, 마진율: 30%) 등록 통과",
         *ins("products", product_row(mart_id=F["mrt"], id=prd_oem_id, name="AITIP 실버 안동사과즙", price=5000,
                                     supplier_id=sup1_id, cost_price=3500, packaging_cost=300, margin_rate=30.0,
                                     is_oem=1, oem_brand_name="AITIP 상생로컬", image_format="webp")))
    r.reject(conn, "products 매입원가 음수 거부",
             *ins("products", product_row(mart_id=F["mrt"], name="원가오류사과", price=5000, cost_price=-100, image_format="webp")),
             expect="chk_products_cost_price")

    # 22.3 inventory_returns (ret_) 매입처 반품 및 신선 폐기
    ret1_id = new_id("ret")
    r.ok(conn, "inventory_returns (ret_) 매입처 파손 반품 등록 통과",
         *ins("inventory_returns", dict(id=ret1_id, mart_id=F["mrt"], product_id=prd_oem_id, supplier_id=sup1_id,
                                        order_id=None, return_type="SUPPLIER_RETURN", return_qty=10,
                                        unit_cost_price=3500, total_refund_amount=35000, reason_notes="배송 중 박스 파손",
                                        proof_photo_r2_key="r2/damage_box.webp", status="REQUESTED",
                                        created_at=NOW, updated_at=NOW)))
    r.ok(conn, "inventory_returns (ret_) 신선채소 감모 폐기 등록 통과",
         *ins("inventory_returns", dict(id=new_id("ret"), mart_id=F["mrt"], product_id=prd_oem_id, supplier_id=sup1_id,
                                        order_id=None, return_type="SPOILED_DISPOSAL", return_qty=3,
                                        unit_cost_price=3500, total_refund_amount=10500, reason_notes="유통기한 경과 폐기",
                                        status="APPROVED", created_at=NOW, updated_at=NOW)))
    r.reject(conn, "inventory_returns 반품 수량 0 이하 거부",
             *ins("inventory_returns", dict(id=new_id("ret"), mart_id=F["mrt"], product_id=prd_oem_id, supplier_id=sup1_id,
                                            order_id=None, return_type="SUPPLIER_RETURN", return_qty=0,
                                            unit_cost_price=3500, total_refund_amount=0, reason_notes="수량오류",
                                            status="REQUESTED", created_at=NOW, updated_at=NOW)),
             expect="chk_ret_qty")

    conn.close()"""

    assert target_pos in code, "target_pos not found in code!"
    code = code.replace(target_pos, new_section)

    with open(test_file, "w", encoding="utf-8") as f:
        f.write(code)

    print("Added Section 22 to scripts/test_schema_integrity.py")

if __name__ == "__main__":
    main()
