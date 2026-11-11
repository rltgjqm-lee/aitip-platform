# -*- coding: utf-8 -*-
with open("scripts/test_schema_integrity.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update PREFIXES
old_pref = 'PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",\n            "prd", "ord", "itm", "dlv", "pay", "set", "call"]'
new_pref = 'PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",\n            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr"]'
assert old_pref in content, "old_pref not found"
content = content.replace(old_pref, new_pref, 1)

# 2. Update store_row, mart_row, product_row, order_row and add store_hours_row, dfr_row
old_rows = '''def store_row(**kw):
    p = "02" + rand_tag()
    d = dict(id=new_id("str"), business_name="맛나식당", biz_reg_no=rand_tag(), store_category="KOREAN",
             phone_enc=fake_enc(p), phone_hmac=hmac_hex(p), road_address="서울",
             created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def mart_row(**kw):
    p = "02" + rand_tag()
    d = dict(id=new_id("mrt"), mart_name="하나로마트", biz_reg_no=rand_tag(), nh_erp_code="NH001",
             manager_phone_enc=fake_enc(p), manager_phone_hmac=hmac_hex(p),
             settlement_account_enc=fake_enc("000-000"), road_address="서울",
             created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def facility_row(org_id, cid, **kw):
    d = dict(id=new_id("fac"), facility_name="도곡1동경로당", facility_code="F-" + rand_tag(),
             related_org_id=org_id, facility_type="SENIOR_CENTER",
             landline_cid_enc=fake_enc(cid), landline_cid_hmac=hmac_hex(cid),
             road_address="서울", created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def device_row(store_id=None, mart_id=None, **kw):
    d = dict(id=new_id("dev"), store_id=store_id, mart_id=mart_id, mac_address=rand_tag(),
             board_serial="SN1", firmware_version="0.1", created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def product_row(store_id=None, mart_id=None, **kw):
    d = dict(id=new_id("prd"), store_id=store_id, mart_id=mart_id, name="상품", price=8000,
             created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def order_row(F, **kw):
    """기본값: 일반 식당 B2C 주문(회원)."""
    d = dict(id=new_id("ord"), client_request_id="creq-" + rand_tag(),
             store_id=F["str"], mart_id=None, buyer_user_id=F["usr1"],
             caller_phone_enc=None, caller_phone_hmac=None, buyer_facility_id=None,
             order_type="GENERAL", order_channel="PWA", business_date=BDATE,
             display_seq=next(_seq), total_amount=8000,
             delivery_address_enc=fake_enc("서울 서초구"), created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d'''

new_rows = '''def store_row(**kw):
    p = "02" + rand_tag()
    d = dict(id=new_id("str"), business_name="맛나식당", biz_reg_no=rand_tag(), food_license_no="2026-0001",
             store_category="KOREAN", business_day_cutoff="04:00",
             phone_enc=fake_enc(p), phone_hmac=hmac_hex(p), road_address="서울",
             attributes_json='{}', attributes_version=1,
             created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def mart_row(**kw):
    p = "02" + rand_tag()
    d = dict(id=new_id("mrt"), mart_name="하나로마트", biz_reg_no=rand_tag(), nh_erp_code="NH001",
             manager_phone_enc=fake_enc(p), manager_phone_hmac=hmac_hex(p),
             settlement_account_enc=fake_enc("000-000"), road_address="서울",
             business_day_cutoff="04:00", order_cutoff_time="11:00",
             attributes_json='{}', attributes_version=1,
             created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def store_hours_row(store_id, day_of_week=1, **kw):
    d = dict(id=new_id("sth"), store_id=store_id, day_of_week=day_of_week,
             open_time="09:00", close_time="21:00", break_start="15:00", break_end="16:00",
             is_closed=0, created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def dfr_row(store_id, district_name="서초동", extra_fee=1000, **kw):
    d = dict(id=new_id("dfr"), store_id=store_id, district_name=district_name,
             extra_fee=extra_fee, created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def facility_row(org_id, cid, **kw):
    d = dict(id=new_id("fac"), facility_name="도곡1동경로당", facility_code="F-" + rand_tag(),
             related_org_id=org_id, facility_type="SENIOR_CENTER",
             landline_cid_enc=fake_enc(cid), landline_cid_hmac=hmac_hex(cid),
             road_address="서울", created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def device_row(store_id=None, mart_id=None, **kw):
    d = dict(id=new_id("dev"), store_id=store_id, mart_id=mart_id, mac_address=rand_tag(),
             board_serial="SN1", firmware_version="0.1", created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def product_row(store_id=None, mart_id=None, **kw):
    d = dict(id=new_id("prd"), store_id=store_id, mart_id=mart_id, name="상품", price=8000,
             unit="EA", tax_type="TAXABLE", origin_text="국내산",
             created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def order_row(F, **kw):
    """기본값: 일반 식당 B2C 주문(회원)."""
    d = dict(id=new_id("ord"), client_request_id="creq-" + rand_tag(),
             store_id=F["str"], mart_id=None, buyer_user_id=F["usr1"],
             caller_phone_enc=None, caller_phone_hmac=None, buyer_facility_id=None,
             order_type="GENERAL", order_channel="PWA", business_date=BDATE,
             display_seq=next(_seq), delivery_fee=0, total_amount=8000,
             delivery_address_enc=fake_enc("서울 서초구"), created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d'''
assert old_rows in content, "old_rows not found"
content = content.replace(old_rows, new_rows, 1)

# 3. Update seed function
old_seed = '''    put("products (식당 메뉴)", "products", product_row(store_id=F["str"]), "prd_s")
    put("products (마트 식자재)", "products", product_row(mart_id=F["mrt"], price=55000), "prd_m")
    return F'''

new_seed = '''    put("products (식당 메뉴)", "products", product_row(store_id=F["str"]), "prd_s")
    put("products (마트 식자재)", "products", product_row(mart_id=F["mrt"], price=55000), "prd_m")
    put("store_hours (식당 월요일 영업)", "store_hours", store_hours_row(F["str"], day_of_week=1), "sth")
    put("store_delivery_fee_rules (식당 서초동 배달비)", "store_delivery_fee_rules", dfr_row(F["str"], "서초동", 1000), "dfr")
    return F'''
assert old_seed in content, "old_seed not found"
content = content.replace(old_seed, new_seed, 1)

# 4. Update itm1 and itm_cancel in section 9
old_itm = '''    itm1 = dict(id=new_id("itm"), order_id=gen_order["id"], product_id=F["prd_s"],
                item_name="된장찌개", unit_price=8000, quantity=1, total_price=8000,
                options_selected_json='[{"group":"맵기","choice":"보통"}]',
                item_status="ACTIVE", cancel_reason=None, created_at=NOW)
    r.ok(conn, "order_items 통과 (옵션 JSON 포함)", *ins("order_items", itm1))
    r.reject(conn, "order_items 수량 0 거부",
             *ins("order_items", dict(itm1, id=new_id("itm"), quantity=0, total_price=0)),
             expect="chk_order_items_quantity")
    itm_cancel = dict(id=new_id("itm"), order_id=food_order["id"], product_id=F["prd_m"],
                      item_name="대파 1단", unit_price=2000, quantity=1, total_price=2000,
                      options_selected_json=None, item_status="CANCELED", cancel_reason="피킹 중 품절",
                      created_at=NOW)'''

new_itm = '''    itm1 = dict(id=new_id("itm"), order_id=gen_order["id"], product_id=F["prd_s"],
                item_name="된장찌개", unit_price=8000, quantity=1, tax_type="TAXABLE", total_price=8000,
                options_selected_json='[{"group":"맵기","choice":"보통"}]',
                item_status="ACTIVE", cancel_reason=None, created_at=NOW)
    r.ok(conn, "order_items 통과 (옵션 JSON 포함)", *ins("order_items", itm1))
    r.reject(conn, "order_items 수량 0 거부",
             *ins("order_items", dict(itm1, id=new_id("itm"), quantity=0, total_price=0)),
             expect="chk_order_items_quantity")
    itm_cancel = dict(id=new_id("itm"), order_id=food_order["id"], product_id=F["prd_m"],
                      item_name="대파 1단", unit_price=2000, quantity=1, tax_type="TAX_FREE", total_price=2000,
                      options_selected_json=None, item_status="CANCELED", cancel_reason="피킹 중 품절",
                      created_at=NOW)'''
assert old_itm in content, "old_itm not found"
content = content.replace(old_itm, new_itm, 1)

# 5. Add groups 15 to 19 before conn.close()
target_end = '''        r.check(f"{label}: 인덱스 사용, 임시 정렬 없음",
                "USING INDEX" in detail and "TEMP B-TREE" not in detail and "SCAN" not in detail, detail)

    conn.close()'''

new_groups = '''        r.check(f"{label}: 인덱스 사용, 임시 정렬 없음",
                "USING INDEX" in detail and "TEMP B-TREE" not in detail and "SCAN" not in detail, detail)

    # ------------------------------------------------------------------
    r.group("15. 정밀 시간 형식 검증 (Strict Time CHECK - 24:00/29:59 거부)")
    r.reject(conn, "stores.business_day_cutoff '29:59' 거부",
             *ins("stores", store_row(business_day_cutoff="29:59")), expect="chk_stores_cutoff")
    r.reject(conn, "stores.business_day_cutoff '24:00' 거부",
             *ins("stores", store_row(business_day_cutoff="24:00")), expect="chk_stores_cutoff")
    r.ok(conn, "stores.business_day_cutoff '23:59' 통과",
         *ins("stores", store_row(business_day_cutoff="23:59")))
    r.ok(conn, "stores.business_day_cutoff '00:00' 통과",
         *ins("stores", store_row(business_day_cutoff="00:00")))
    r.reject(conn, "mart_suppliers.business_day_cutoff '24:00' 거부",
             *ins("mart_suppliers", mart_row(business_day_cutoff="24:00")), expect="chk_mart_suppliers_cutoff")
    r.reject(conn, "mart_suppliers.order_cutoff_time '29:59' 거부",
             *ins("mart_suppliers", mart_row(order_cutoff_time="29:59")), expect="chk_mart_suppliers_ord_cutoff")
    r.ok(conn, "mart_suppliers.order_cutoff_time NULL 통과",
         *ins("mart_suppliers", mart_row(order_cutoff_time=None)))
    r.ok(conn, "mart_suppliers.order_cutoff_time '11:30' 통과",
         *ins("mart_suppliers", mart_row(order_cutoff_time="11:30")))

    # ------------------------------------------------------------------
    r.group("16. 영업시간 및 휴게시간 무결성 (store_hours)")
    sh_base = store_hours_row(F["str"], day_of_week=2)
    r.ok(conn, "정상 화요일 영업시간 통과", *ins("store_hours", sh_base))
    r.reject(conn, "요일 7 초과 거부",
             *ins("store_hours", store_hours_row(F["str"], day_of_week=7)), expect="chk_store_hours_day")
    r.reject(conn, "요일 -1 음수 거부",
             *ins("store_hours", store_hours_row(F["str"], day_of_week=-1)), expect="chk_store_hours_day")
    r.reject(conn, "break_start만 있고 break_end 없음 거부",
             *ins("store_hours", store_hours_row(F["str"], day_of_week=3, break_start="15:00", break_end=None)),
             expect="chk_store_hours_break_pair")
    r.reject(conn, "break_end만 있고 break_start 없음 거부",
             *ins("store_hours", store_hours_row(F["str"], day_of_week=3, break_start=None, break_end="16:00")),
             expect="chk_store_hours_break_pair")
    r.reject(conn, "영업 중(is_closed=0)인데 open_time NULL 거부",
             *ins("store_hours", store_hours_row(F["str"], day_of_week=3, open_time=None, close_time="21:00",
                                                break_start=None, break_end=None)),
             expect="chk_store_hours_open_pair")
    r.ok(conn, "정기 휴무일(is_closed=1)은 open/close NULL 통과",
         *ins("store_hours", store_hours_row(F["str"], day_of_week=0, is_closed=1,
                                            open_time=None, close_time=None, break_start=None, break_end=None)))
    r.reject(conn, "같은 식당 같은 요일 중복 등록 거부",
             *ins("store_hours", store_hours_row(F["str"], day_of_week=2)),
             expect="UNIQUE constraint failed: store_hours.store_id, store_hours.day_of_week")
    r.reject(conn, "store_hours 시간 패턴 '25:00' 거부",
             *ins("store_hours", store_hours_row(F["str"], day_of_week=4, open_time="25:00",
                                                break_start=None, break_end=None)),
             expect="chk_store_hours_open_time")

    # ------------------------------------------------------------------
    r.group("17. 배달비 및 지역별 추가 배달비 규칙 (store_delivery_fee_rules & orders.delivery_fee)")
    r.ok(conn, "역삼동 추가 배달비 1500원 규칙 통과",
         *ins("store_delivery_fee_rules", dfr_row(F["str"], "역삼동", 1500)))
    r.reject(conn, "추가 배달비 음수 거부",
             *ins("store_delivery_fee_rules", dfr_row(F["str"], "양재동", -500)),
             expect="chk_dfr_extra_fee")
    r.reject(conn, "같은 식당 같은 지역 중복 규칙 거부",
             *ins("store_delivery_fee_rules", dfr_row(F["str"], "서초동", 2000)),
             expect="UNIQUE constraint failed: store_delivery_fee_rules.store_id, store_delivery_fee_rules.district_name")
    r.ok(conn, "주문 배달비 스냅샷 3000원 통과",
         *ins("orders", order_row(F, delivery_fee=3000, total_amount=11000)))
    r.reject(conn, "주문 배달비 음수 거부",
             *ins("orders", order_row(F, delivery_fee=-100)),
             expect="chk_orders_delivery_fee")

    # ------------------------------------------------------------------
    r.group("18. 속성 JSON 가드레일 (attributes_json & attributes_version)")
    r.ok(conn, "stores 정상 운영 메모 속성 JSON 통과",
         *ins("stores", store_row(attributes_json='{"dock_no":"D-12","manager_memo":"남문 진입"}', attributes_version=1)))
    r.reject(conn, "stores JSON 문법 오류 거부",
             *ins("stores", store_row(attributes_json='{invalid_json}')),
             expect="chk_stores_attrs")
    r.reject(conn, "stores JSON 배열 타입 거부",
             *ins("stores", store_row(attributes_json='[1, 2, 3]')),
             expect="chk_stores_attrs")
    big_json = '{"pad":"' + ('x' * 8200) + '"}'
    r.reject(conn, "stores JSON 8192자 초과 거부",
             *ins("stores", store_row(attributes_json=big_json)),
             expect="chk_stores_attrs")
    r.reject(conn, "stores attributes_version 0 거부",
             *ins("stores", store_row(attributes_version=0)),
             expect="chk_stores_attrs_ver")
    r.ok(conn, "mart_suppliers 정상 속성 JSON 통과",
         *ins("mart_suppliers", mart_row(attributes_json='{"local_food_coop_id":"COOP_77"}', attributes_version=2)))
    r.reject(conn, "mart_suppliers JSON 배열 거부",
             *ins("mart_suppliers", mart_row(attributes_json='["a", "b"]')),
             expect="chk_mart_attrs")
    r.reject(conn, "mart_suppliers JSON 8192자 초과 거부",
             *ins("mart_suppliers", mart_row(attributes_json=big_json)),
             expect="chk_mart_attrs")

    # ------------------------------------------------------------------
    r.group("19. 품목 세금 구분 및 법적 원산지 스냅샷 (tax_type)")
    r.ok(conn, "면세 농산물(TAX_FREE) 상품 등록 통과",
         *ins("products", product_row(mart_id=F["mrt"], name="제주 감귤", price=12000, tax_type="TAX_FREE", origin_text="국내산(제주)")))
    r.ok(conn, "영세율(ZERO_TAX) 상품 등록 통과",
         *ins("products", product_row(mart_id=F["mrt"], name="수출 규격 포장재", price=5000, tax_type="ZERO_TAX")))
    r.reject(conn, "유효하지 않은 tax_type 상품 등록 거부",
             *ins("products", product_row(store_id=F["str"], tax_type="UNKNOWN")),
             expect="chk_products_tax")
    itm_tax_bad = dict(itm1, id=new_id("itm"), tax_type="INVALID")
    r.reject(conn, "order_items 유효하지 않은 tax_type 거부",
             *ins("order_items", itm_tax_bad),
             expect="chk_order_items_tax")
    itm_tax_free = dict(itm1, id=new_id("itm"), tax_type="TAX_FREE")
    r.ok(conn, "order_items 면세(TAX_FREE) 스냅샷 저장 통과",
         *ins("order_items", itm_tax_free))

    conn.close()'''

assert target_end in content, "target_end not found"
content = content.replace(target_end, new_groups, 1)

with open("scripts/test_schema_integrity.py", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS: test_schema_integrity.py updated.")
