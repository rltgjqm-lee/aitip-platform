import re

def main():
    test_file = "scripts/test_schema_integrity.py"
    with open(test_file, "r", encoding="utf-8") as f:
        code = f.read()

    # 1. Update PREFIXES with "bar"
    old_prefixes = """PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr",
            "cat", "prm", "sch", "stm", "dst", "agn", "agt", "ins", "cns"]"""

    new_prefixes = """PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr",
            "cat", "prm", "sch", "stm", "dst", "agn", "agt", "ins", "cns", "bar"]"""

    assert old_prefixes in code, "old_prefixes not found!"
    code = code.replace(old_prefixes, new_prefixes)

    # 2. Add Section 21 before conn.close()
    target_pos = """    # 20.8 user_consents (cns_) 전자상거래 약관 동의 이력
    cns1_id = new_id("cns")
    r.ok(conn, "user_consents (cns_) 전자상거래 약관 동의 등록 통과",
         *ins("user_consents", dict(id=cns1_id, user_id=agt_u["id"], terms_version="v1.0.0", privacy_version="v1.0.0",
                                    location_terms_version="v1.0.0", marketing_opt_in=0, ip_address="127.0.0.1", created_at=NOW)))

    conn.close()"""

    new_section = """    # 20.8 user_consents (cns_) 전자상거래 약관 동의 이력
    cns1_id = new_id("cns")
    r.ok(conn, "user_consents (cns_) 전자상거래 약관 동의 등록 통과",
         *ins("user_consents", dict(id=cns1_id, user_id=agt_u["id"], terms_version="v1.0.0", privacy_version="v1.0.0",
                                    location_terms_version="v1.0.0", marketing_opt_in=0, ip_address="127.0.0.1", created_at=NOW)))

    # ------------------------------------------------------------------
    r.group("21. 복합 프로모션(묶음/교차/요일) & 비용 0원 바코드 카탈로그 (Section 21)")

    # 21.1 묶음 할인 (BUNDLE_DISCOUNT)
    prm_bundle = new_id("prm")
    r.ok(conn, "store_promotions 묶음 할인(신라면 5개 4200원) 등록 통과",
         *ins("store_promotions", dict(id=prm_bundle, store_id=F["str"], mart_id=None, name="라면 5개 묶음할인",
                                       promo_type="BUNDLE_DISCOUNT", discount_type="SET_PRICE", discount_value=4200,
                                       bundle_qty=5, min_order_amount=0, start_at="2026-11-01", end_at="2026-12-31",
                                       is_active=1, created_at=NOW, updated_at=NOW)))
    r.reject(conn, "store_promotions 묶음 수량 2 미만 거부",
             *ins("store_promotions", dict(id=new_id("prm"), store_id=F["str"], mart_id=None, name="무효 묶음",
                                           promo_type="BUNDLE_DISCOUNT", discount_type="SET_PRICE", discount_value=1000,
                                           bundle_qty=1, min_order_amount=0, start_at="2026-11-01", end_at="2026-12-31",
                                           is_active=1, created_at=NOW, updated_at=NOW)),
             expect="chk_promo_bundle_qty")

    # 21.2 요일별 특가 (DAY_OF_WEEK)
    prm_day = new_id("prm")
    r.ok(conn, "store_promotions 요일별 특가(수요 알뜰장터 15%) 등록 통과",
         *ins("store_promotions", dict(id=prm_day, store_id=None, mart_id=F["mrt"], name="수요 채소 특가",
                                       promo_type="DAY_OF_WEEK", discount_type="PERCENTAGE", discount_value=15,
                                       applicable_days_json='["WED"]', min_order_amount=0, start_at="2026-11-01",
                                       end_at="2026-12-31", is_active=1, created_at=NOW, updated_at=NOW)))

    # 21.3 교차 할인 (CROSS_CATEGORY)
    prm_cross = new_id("prm")
    r.ok(conn, "store_promotions 교차 골라담기(과자 3봉 9900원) 등록 통과",
         *ins("store_promotions", dict(id=prm_cross, store_id=None, mart_id=F["mrt"], name="과자 3봉 골라담기",
                                       promo_type="CROSS_CATEGORY", discount_type="SET_PRICE", discount_value=9900,
                                       cross_category_id=cat1_id, bundle_qty=3, promo_group_tag="SNACK_9900",
                                       min_order_amount=0, start_at="2026-11-01", end_at="2026-12-31",
                                       is_active=1, created_at=NOW, updated_at=NOW)))

    # 21.4 1+1 증정 (BUY_X_GET_Y)
    prm_bogo = new_id("prm")
    r.ok(conn, "store_promotions 2+1 증정 프로모션 등록 통과",
         *ins("store_promotions", dict(id=prm_bogo, store_id=F["str"], mart_id=None, name="음료 2+1 행사",
                                       promo_type="BUY_X_GET_Y", discount_type="FIXED_AMOUNT", discount_value=1000,
                                       bundle_qty=2, free_qty=1, min_order_amount=0, start_at="2026-11-01",
                                       end_at="2026-12-31", is_active=1, created_at=NOW, updated_at=NOW)))

    # 21.5 shared_barcode_catalog (bar_) 식약처 무료 공공데이터 캐시
    bar1_id = new_id("bar")
    r.ok(conn, "shared_barcode_catalog (bar_) 공공 바코드 데이터 등록 통과",
         *ins("shared_barcode_catalog", dict(id=bar1_id, barcode="8801043014847", product_name="농심 신라면 120g",
                                             manufacturer="농심", standard_spec="120g", category_name="라면/면류",
                                             allergens_text="대두, 밀, 쇠고기, 돼지고기 함유", origin_country="대한민국",
                                             source_type="MFDS", created_at=NOW, updated_at=NOW)))
    r.reject(conn, "shared_barcode_catalog 바코드 숫자 외 문자 거부",
             *ins("shared_barcode_catalog", dict(id=new_id("bar"), barcode="880104301ABCD", product_name="오류라면",
                                                 source_type="MFDS", created_at=NOW, updated_at=NOW)),
             expect="chk_shared_barcode_val")
    r.reject(conn, "shared_barcode_catalog 중복 바코드 등록 거부",
             *ins("shared_barcode_catalog", dict(id=new_id("bar"), barcode="8801043014847", product_name="중복라면",
                                                 source_type="MERCHANT_INPUT", created_at=NOW, updated_at=NOW)),
             expect="UNIQUE constraint failed: shared_barcode_catalog.barcode")

    conn.close()"""

    assert target_pos in code, "target_pos not found in code!"
    code = code.replace(target_pos, new_section)

    with open(test_file, "w", encoding="utf-8") as f:
        f.write(code)

    print("Added Section 21 to scripts/test_schema_integrity.py")

if __name__ == "__main__":
    main()
