import re

def main():
    test_file = "scripts/test_schema_integrity.py"
    with open(test_file, "r", encoding="utf-8") as f:
        code = f.read()

    # 1. Update PREFIXES to include new prefixes
    old_prefixes = """PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr"]"""
    
    new_prefixes = """PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr",
            "cat", "prm", "sch", "stm", "dst", "agn", "agt", "ins", "cns"]"""

    assert old_prefixes in code, "old_prefixes not found!"
    code = code.replace(old_prefixes, new_prefixes)

    # 2. Add Section 20 at end of run_all()
    target_marker = """    # 19. 세금 구분 (tax_type) 검증
    section("19. 품목별 세금 구분 및 정산 과세 검증 (tax_type)")
    test_tax_type_integrity(conn)"""

    new_section_call = """    # 19. 세금 구분 (tax_type) 검증
    section("19. 품목별 세금 구분 및 정산 과세 검증 (tax_type)")
    test_tax_type_integrity(conn)

    # 20. 확장 생태계 무결성 (가맹점/마트/시니어/영업망/WebP/프로모션)
    section("20. 확장 생태계 및 관리자 등록 UI 데이터 무결성 검증")
    test_ecosystem_tables_integrity(conn)"""

    assert target_marker in code, "target_marker not found!"
    code = code.replace(target_marker, new_section_call)

    # 3. Add test function definition
    test_func = """

def test_ecosystem_tables_integrity(conn: sqlite3.Connection):
    # 20.1 users.role 검증
    u_admin_id = make_typeid("usr")
    phone = "01099990001"
    enc = f"enc:{phone}"
    hmac_val = make_hmac(phone)
    
    conn.execute(
        \"\"\"INSERT INTO users (id, phone_enc, phone_hmac, pii_key_ver, name, role, status, created_at, updated_at)
           VALUES (?, ?, ?, 1, '슈퍼관리자', 'SUPER_ADMIN', 'ACTIVE', ?, ?)\"\"\",
        (u_admin_id, enc, hmac_val, NOW, NOW)
    )
    conn.commit()
    report("users SUPER_ADMIN 역할 등록 허용")

    # 잘못된 role 거부
    u_invalid_id = make_typeid("usr")
    hmac_inv = make_hmac("01099990002")
    try:
        conn.execute(
            \"\"\"INSERT INTO users (id, phone_enc, phone_hmac, pii_key_ver, name, role, status, created_at, updated_at)
               VALUES (?, 'enc:010', ?, 1, '해커', 'HACKER_ROLE', 'ACTIVE', ?, ?)\"\"\",
            (u_invalid_id, hmac_inv, NOW, NOW)
        )
        conn.commit()
        raise AssertionError("잘못된 role이 허용됨")
    except sqlite3.IntegrityError as e:
        assert "chk_users_role" in str(e)
        report("users 미등록 role 거부", expected="chk_users_role")

    # 20.2 product_categories 등록 및 소유자 배타성
    str_id = make_typeid("str")
    s_phone = "0212345678"
    conn.execute(
        \"\"\"INSERT INTO stores (id, business_name, biz_reg_no, store_category, business_day_cutoff,
                               phone_enc, phone_hmac, pii_key_ver, road_address, attributes_json,
                               min_order_amount, is_takeout_available, created_at, updated_at)
           VALUES (?, '테스트분식', '111-22-33333', '분식', '04:00', 'enc:phone', ?, 1, '서울시', '{}', 10000, 1, ?, ?)\"\"\",
        (str_id, make_hmac(s_phone), NOW, NOW)
    )
    conn.commit()

    cat_id = make_typeid("cat")
    conn.execute(
        \"\"\"INSERT INTO product_categories (id, store_id, mart_id, name, display_order, is_active, created_at, updated_at)
           VALUES (?, ?, NULL, '면류', 1, 1, ?, ?)\"\"\",
        (cat_id, str_id, NOW, NOW)
    )
    conn.commit()
    report("product_categories (cat_) 등록 성공")

    # 20.3 products WebP 강제 및 중량/단위 검증
    prd_id = make_typeid("prd")
    conn.execute(
        \"\"\"INSERT INTO products (id, store_id, mart_id, category_id, name, price, original_price,
                                barcode_sku, weight_value, weight_unit, unit, tax_type, is_available,
                                image_r2_key, image_format, created_at, updated_at)
           VALUES (?, ?, NULL, ?, '신라면', 4500, 5000, '8801043014847', 120, 'g', 'EA', 'TAXABLE', 1,
                   'products/str_01/shin_ramen.webp', 'webp', ?, ?)\"\"\",
        (prd_id, str_id, cat_id, NOW, NOW)
    )
    conn.commit()
    report("products WebP 및 중량/바코드 규격 등록 성공")

    # 잘못된 image_format (png) 거부
    prd_inv_id = make_typeid("prd")
    try:
        conn.execute(
            \"\"\"INSERT INTO products (id, store_id, mart_id, name, price, image_format, created_at, updated_at)
               VALUES (?, ?, NULL, '콜라', 2000, 'png', ?, ?)\"\"\",
            (prd_inv_id, str_id, NOW, NOW)
        )
        conn.commit()
        raise AssertionError("image_format != webp 가 허용됨")
    except sqlite3.IntegrityError as e:
        assert "chk_products_img_fmt" in str(e)
        report("products non-webp 이미지 포맷 거부", expected="chk_products_img_fmt")

    # 20.4 store_promotions 할인 등록
    prm_id = make_typeid("prm")
    conn.execute(
        \"\"\"INSERT INTO store_promotions (id, store_id, mart_id, name, promo_type, discount_type,
                                         discount_value, min_order_amount, start_at, end_at, is_active,
                                         created_at, updated_at)
           VALUES (?, ?, NULL, '포장 1000원 할인', 'TAKEOUT_DISCOUNT', 'FIXED_AMOUNT', 1000, 10000,
                   '2026-11-01', '2026-12-31', 1, ?, ?)\"\"\",
        (prm_id, str_id, NOW, NOW)
    )
    conn.commit()
    report("store_promotions (prm_) 포장 할인 정책 등록 성공")

    # 20.5 partner_agencies 및 partner_agents 제휴 영업망 등록
    agn_id = make_typeid("agn")
    conn.execute(
        \"\"\"INSERT INTO partner_agencies (id, business_name, biz_reg_no, agency_type, representative_name,
                                         phone_enc, phone_hmac, coverage_regions_json, bank_name_enc,
                                         bank_account_enc, bank_holder_enc, is_active, created_at, updated_at)
           VALUES (?, '경기총판', '222-33-44444', 'MASTER_DISTRIBUTOR', '홍길동', 'enc:phone', ?,
                   '[\"41111\"]', 'enc:bank', 'enc:acc', 'enc:holder', 1, ?, ?)\"\"\",
        (agn_id, make_hmac("0312223333"), NOW, NOW)
    )
    conn.commit()
    report("partner_agencies (agn_) 총판 대리점 등록 성공")

    agt_id = make_typeid("agt")
    conn.execute(
        \"\"\"INSERT INTO partner_agents (id, agency_id, user_id, agent_role, agent_code, is_active, created_at, updated_at)
           VALUES (?, ?, ?, 'FIELD_ENGINEER', 'ENG-001', 1, ?, ?)\"\"\",
        (agt_id, agn_id, u_admin_id, NOW, NOW)
    )
    conn.commit()
    report("partner_agents (agt_) 현장 설치 기사 등록 성공")

    # 20.6 device_installations 현장 설치 증빙 등록
    dev_id = make_typeid("dev")
    conn.execute(
        \"\"\"INSERT INTO devices (id, store_id, device_serial, mac_address, status, created_at, updated_at)
           VALUES (?, ?, 'SN-TEST-999', '00:11:22:33:44:55', 'ACTIVE', ?, ?)\"\"\",
        (dev_id, str_id, NOW, NOW)
    )
    conn.commit()

    ins_id = make_typeid("ins")
    conn.execute(
        \"\"\"INSERT INTO device_installations (id, device_id, store_id, agency_id, technician_agent_id,
                                            installation_status, installed_at, cti_wiring_photo_r2_key,
                                            test_print_photo_r2_key, merchant_signature_r2_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, 'r2/cti.webp', 'r2/print.webp', 'r2/sig.webp', ?, ?)\"\"\",
        (ins_id, dev_id, str_id, agn_id, agt_id, NOW, NOW, NOW)
    )
    conn.commit()
    report("device_installations (ins_) CTI 배선/시험출력/서명 증빙 등록 성공")

    # 20.7 user_consents 약관 동의 이력
    cns_id = make_typeid("cns")
    conn.execute(
        \"\"\"INSERT INTO user_consents (id, user_id, terms_version, privacy_version, location_terms_version,
                                      marketing_opt_in, ip_address, created_at)
           VALUES (?, ?, 'v1.0', 'v1.0', 'v1.0', 1, '127.0.0.1', ?)\"\"\",
        (cns_id, u_admin_id, NOW)
    )
    conn.commit()
    report("user_consents (cns_) 전자상거래 약관 동의 이력 등록 성공")
"""

    code = code + test_func

    with open(test_file, "w", encoding="utf-8") as f:
        f.write(code)

    print("Updated scripts/test_schema_integrity.py with Section 20 tests.")

if __name__ == "__main__":
    main()
