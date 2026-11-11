import sys

def main():
    test_file = "scripts/test_schema_integrity.py"
    with open(test_file, "r", encoding="utf-8") as f:
        code = f.read()

    # 1. Update PREFIXES
    old_prefixes = """PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr"]"""
    
    new_prefixes = """PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr",
            "cat", "prm", "sch", "stm", "dst", "agn", "agt", "ins", "cns"]"""

    if old_prefixes in code:
        code = code.replace(old_prefixes, new_prefixes)
        print("PREFIXES updated.")

    # 2. Add Section 20 before conn.close()
    target_pos = """    itm_tax_free = dict(itm1, id=new_id("itm"), tax_type="TAX_FREE")
    r.ok(conn, "order_items 면세(TAX_FREE) 스냅샷 저장 통과",
         *ins("order_items", itm_tax_free))

    conn.close()"""

    new_section = """    itm_tax_free = dict(itm1, id=new_id("itm"), tax_type="TAX_FREE")
    r.ok(conn, "order_items 면세(TAX_FREE) 스냅샷 저장 통과",
         *ins("order_items", itm_tax_free))

    # ------------------------------------------------------------------
    r.group("20. 확장 생태계 및 관리자 등록 UI 데이터 무결성 (Section 20)")

    # 20.1 users.role 검증
    r.ok(conn, "users SUPER_ADMIN 역할 등록 통과",
         *ins("users", dict(users_row(name="최고운영자"), id=new_id("usr"), role="SUPER_ADMIN", phone_hmac=new_hmac("01088880001"))))
    r.ok(conn, "users HQ_DEV_OPS 개발부서 역할 등록 통과",
         *ins("users", dict(users_row(name="수석엔지니어"), id=new_id("usr"), role="HQ_DEV_OPS", phone_hmac=new_hmac("01088880002"))))
    r.ok(conn, "users HQ_SALES_OPS 본사영업관리자 역할 등록 통과",
         *ins("users", dict(users_row(name="영업운영팀장"), id=new_id("usr"), role="HQ_SALES_OPS", phone_hmac=new_hmac("01088880003"))))
    r.reject(conn, "users 미등록 role 거부",
             *ins("users", dict(users_row(name="해커"), id=new_id("usr"), role="UNAUTHORIZED_ROLE", phone_hmac=new_hmac("01088880004"))),
             expect="chk_users_role")

    # 20.2 product_categories (cat_) 등록
    cat1_id = new_id("cat")
    r.ok(conn, "product_categories (cat_) 식당 카테고리 등록 통과",
         *ins("product_categories", dict(id=cat1_id, store_id=F["str"], mart_id=None, name="식사류", display_order=1, is_active=1, created_at=NOW, updated_at=NOW)))
    r.reject(conn, "product_categories store_id / mart_id 동시 지정 거부",
             *ins("product_categories", dict(id=new_id("cat"), store_id=F["str"], mart_id=F["mrt"], name="혼합", display_order=1, is_active=1, created_at=NOW, updated_at=NOW)),
             expect="chk_prod_cat_owner")

    # 20.3 products WebP 강제 및 중량/바코드 규격
    prd_webp_id = new_id("prd")
    r.ok(conn, "products WebP 포맷 및 중량/바코드 등록 통과",
         *ins("products", dict(id=prd_webp_id, store_id=F["str"], mart_id=None, category_id=cat1_id, name="제육덮밥", price=8000, original_price=9000,
                               barcode_sku="8801234567890", weight_value=450, weight_unit="g", unit="EA", tax_type="TAXABLE", is_available=1,
                               image_r2_key="products/str_01/pork_bowl.webp", image_format="webp", created_at=NOW, updated_at=NOW)))
    r.reject(conn, "products non-webp 이미지 포맷 거부",
             *ins("products", dict(id=new_id("prd"), store_id=F["str"], mart_id=None, name="비빔밥", price=7500, image_format="png", created_at=NOW, updated_at=NOW)),
             expect="chk_products_img_fmt")

    # 20.4 store_promotions (prm_) 포장/타임세일 할인 등록
    prm1_id = new_id("prm")
    r.ok(conn, "store_promotions (prm_) 포장 할인 정책 등록 통과",
         *ins("store_promotions", dict(id=prm1_id, store_id=F["str"], mart_id=None, name="포장 2000원 할인",
                                       promo_type="TAKEOUT_DISCOUNT", discount_type="FIXED_AMOUNT", discount_value=2000,
                                       min_order_amount=10000, start_at="2026-11-01", end_at="2026-12-31", is_active=1,
                                       created_at=NOW, updated_at=NOW)))
    r.reject(conn, "store_promotions 할인값 0 이하 거부",
             *ins("store_promotions", dict(id=new_id("prm"), store_id=F["str"], mart_id=None, name="무효할인",
                                           promo_type="TAKEOUT_DISCOUNT", discount_type="FIXED_AMOUNT", discount_value=0,
                                           min_order_amount=0, start_at="2026-11-01", end_at="2026-12-31", is_active=1,
                                           created_at=NOW, updated_at=NOW)),
             expect="chk_promo_disc_val")

    # 20.5 mart_delivery_schedules (sch_) 정기 순회 배송표
    sch1_id = new_id("sch")
    r.ok(conn, "mart_delivery_schedules (sch_) 정기 순회 배송 시간표 등록 통과",
         *ins("mart_delivery_schedules", dict(id=sch1_id, mart_id=F["mrt"], slot_order=1, order_cutoff_time="10:30", dispatch_time="11:00", created_at=NOW, updated_at=NOW)))
    r.reject(conn, "mart_delivery_schedules 잘못된 cutoff_time 거부",
             *ins("mart_delivery_schedules", dict(id=new_id("sch"), mart_id=F["mrt"], slot_order=2, order_cutoff_time="24:00", dispatch_time="15:00", created_at=NOW, updated_at=NOW)),
             expect="chk_mart_cutoff_time")

    # 20.6 partner_agencies (agn_) 및 partner_agents (agt_) 제휴 영업망
    agn1_id = new_id("agn")
    r.ok(conn, "partner_agencies (agn_) 총판 대리점 등록 통과",
         *ins("partner_agencies", dict(id=agn1_id, business_name="경기남부총판", biz_reg_no="123-45-67890", agency_type="MASTER_DISTRIBUTOR",
                                       representative_name="김총판", phone_enc="enc:031", phone_hmac=new_hmac("03199990001"),
                                       coverage_regions_json='["41111"]', bank_name_enc="enc:nh", bank_account_enc="enc:acc", bank_holder_enc="enc:holder",
                                       is_active=1, created_at=NOW, updated_at=NOW)))
    
    agt_user_id = new_id("usr")
    r.ok(conn, "users 기사 계정 등록 통과",
         *ins("users", dict(users_row(name="최기사"), id=agt_user_id, role="FIELD_ENGINEER", phone_hmac=new_hmac("01077770001"))))

    agt1_id = new_id("agt")
    r.ok(conn, "partner_agents (agt_) 현장 설치 기사 등록 통과",
         *ins("partner_agents", dict(id=agt1_id, agency_id=agn1_id, user_id=agt_user_id, agent_role="FIELD_ENGINEER",
                                     agent_code="SUWON-001", is_active=1, created_at=NOW, updated_at=NOW)))

    # 20.7 device_installations (ins_) 단말기 현장 설치 증빙
    ins1_id = new_id("ins")
    r.ok(conn, "device_installations (ins_) CTI 배선/시험출력/서명 증빙 등록 통과",
         *ins("device_installations", dict(id=ins1_id, device_id=F["dev"], store_id=F["str"], agency_id=agn1_id,
                                           technician_agent_id=agt1_id, sales_agent_id=None, installation_status="COMPLETED",
                                           installed_at=NOW, device_photo_r2_key="r2/dev.webp", cti_wiring_photo_r2_key="r2/cti.webp",
                                           test_print_photo_r2_key="r2/print.webp", merchant_signature_r2_key="r2/sig.webp",
                                           notes="정상 설치 및 통화시험 완료", created_at=NOW, updated_at=NOW)))

    # 20.8 user_consents (cns_) 전자상거래 약관 동의 이력
    cns1_id = new_id("cns")
    r.ok(conn, "user_consents (cns_) 전자상거래 약관 동의 등록 통과",
         *ins("user_consents", dict(id=cns1_id, user_id=agt_user_id, terms_version="v1.0.0", privacy_version="v1.0.0",
                                    location_terms_version="v1.0.0", marketing_opt_in=0, ip_address="127.0.0.1", created_at=NOW)))

    conn.close()"""

    assert target_pos in code, "target_pos not found in code!"
    code = code.replace(target_pos, new_section)

    with open(test_file, "w", encoding="utf-8") as f:
        f.write(code)

    print("Successfully added Section 20 to scripts/test_schema_integrity.py")

if __name__ == "__main__":
    main()
