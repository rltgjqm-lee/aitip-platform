# -*- coding: utf-8 -*-
"""
AITIP 스키마 무결성 테스트 (대상: docs/schema_aitip_v01.sql)

검증 환경: Python 내장 sqlite3 (로컬). Cloudflare D1 실환경 검증이 아님.
- D1 db.batch()는 단일 트랜잭션이므로 여기서는 BEGIN IMMEDIATE ... COMMIT 으로 원자성을 흉내 낸다.
- 거부 테스트는 sqlite3.IntegrityError만 인정하며, 오류 메시지에 기대한 제약 이름/컬럼이 있어야 통과.
- 테스트 ID는 하드코딩하지 않고 UUIDv7(os.urandom) + Crockford Base32로 생성한다.
- INSERT는 컬럼명을 명시한다(컬럼 순서·개수 오류가 '거부 성공'으로 집계되는 것을 막기 위해).

실행: python scripts/test_schema_integrity.py
"""
import hashlib
import hmac
import itertools
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "docs" / "schema_aitip_v01.sql"
DOC00_PATH = ROOT / "docs" / "DOC-00_AITIP_통합_UID_체계_표준_명세서.md"

CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz"
PREFIXES = ["usr", "org", "biz", "wrk", "str", "mrt", "fac", "dev",
            "prd", "ord", "itm", "dlv", "pay", "set", "call", "sth", "dfr",
            "cat", "prm", "sch", "stm", "dst", "agn", "agt", "ins", "cns", "bar",
            "sup", "ret", "rev", "clm", "vnm", "msg", "tel", "frm", "bis", "fcs"]
TEST_HMAC_KEY = b"aitip-test-only-key"  # 테스트 전용. 운영 키는 Workers Secret으로 관리.
NOW = int(time.time() * 1000)
BDATE = "2026-11-07"
_seq = itertools.count(1000)  # 고정 순번 테스트용(batch 테스트와 겹치지 않게 1000부터)


# ---------------------------------------------------------------------------
# ID / 개인정보 헬퍼
# ---------------------------------------------------------------------------
def uuid7_int():
    ms = time.time_ns() // 1_000_000
    b = bytearray(ms.to_bytes(6, "big") + os.urandom(10))
    b[6] = (b[6] & 0x0F) | 0x70  # version 7
    b[8] = (b[8] & 0x3F) | 0x80  # variant 10
    return int.from_bytes(b, "big")


def new_id(prefix):
    n = uuid7_int()
    body = "".join(CROCKFORD[(n >> (5 * i)) & 31] for i in range(25, -1, -1))
    return f"{prefix}_{body}"


def is_valid_typeid(value, prefix):
    """애플리케이션 계층 검증기. SQL CHECK와 결과가 같아야 한다."""
    head = prefix + "_"
    if not value.startswith(head):
        return False
    body = value[len(head):]
    return len(body) == 26 and body[0] in "01234567" and all(c in CROCKFORD for c in body)


def hmac_hex(value):
    return hmac.new(TEST_HMAC_KEY, value.encode("utf-8"), hashlib.sha256).hexdigest()


def fake_enc(value):
    # 테스트용 자리표시자. 실제 AES-GCM 암호화가 아님(암호화는 애플리케이션 계층 책임).
    return "enc:v1:" + value.encode("utf-8").hex()


def rand_tag():
    return os.urandom(5).hex()


def ins(table, row):
    cols = ", ".join(row)
    marks = ", ".join("?" * len(row))
    return f"INSERT INTO {table} ({cols}) VALUES ({marks})", tuple(row.values())


# ---------------------------------------------------------------------------
# 행 생성기
# ---------------------------------------------------------------------------
def user_row(phone, **kw):
    d = dict(id=new_id("usr"), phone_enc=fake_enc(phone), phone_hmac=hmac_hex(phone),
             name="테스트", created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def org_row(**kw):
    p = "02" + rand_tag()
    d = dict(id=new_id("org"), name="시니어클럽", biz_reg_no=rand_tag(),
             manager_phone_enc=fake_enc(p), manager_phone_hmac=hmac_hex(p),
             road_address="서울", created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def team_row(org_id, **kw):
    d = dict(id=new_id("biz"), org_id=org_id, team_name="배송단", created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def worker_row(user_id, team_id, **kw):
    d = dict(id=new_id("wrk"), user_id=user_id, work_team_id=team_id,
             worker_badge_no="배송-01", created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


def store_row(**kw):
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
    return d


def food_order_row(F, **kw):
    """경로당 식자재 발주(하나로마트, 회원, 시설 지정)."""
    base = dict(store_id=None, mart_id=F["mrt"], buyer_user_id=F["usr2"],
                buyer_facility_id=F["fac"], order_type="FOOD_SUPPLY", order_channel="ARS",
                total_amount=55000)
    base.update(kw)
    return order_row(F, **base)


def payment_row(order_id, **kw):
    d = dict(id=new_id("pay"), order_id=order_id, funding_source="GENERAL",
             payment_method="CREDIT_CARD", amount=8000, pg_provider="TOSS",
             pg_tx_id="tx-" + rand_tag(), created_at=NOW)
    d.update(kw)
    return d


def settlement_row(**kw):
    d = dict(id=new_id("set"), seller_type="STORE", store_id=None, mart_id=None,
             settlement_date=BDATE, total_sales_amount=100000, fee_amount=3000,
             net_payout_amount=97000, created_at=NOW, updated_at=NOW)
    d.update(kw)
    return d


# ---------------------------------------------------------------------------
# 주문 생성 batch (D1 db.batch() 흉내: 단일 트랜잭션)
# ---------------------------------------------------------------------------
COUNTER_UPSERT = (
    "INSERT INTO display_counters (seller_type, seller_id, business_date, last_seq, updated_at) "
    "VALUES (?, ?, ?, 1, ?) "
    "ON CONFLICT(seller_id, business_date) DO UPDATE SET "
    "last_seq = last_seq + 1, updated_at = excluded.updated_at"
)


def order_insert_with_subquery(row, seller_id, business_date):
    cols = [c for c in row if c != "display_seq"]
    sql = (f"INSERT INTO orders ({', '.join(cols)}, display_seq) "
           f"VALUES ({', '.join('?' * len(cols))}, "
           f"(SELECT last_seq FROM display_counters WHERE seller_id = ? AND business_date = ?))")
    return sql, tuple(row[c] for c in cols) + (seller_id, business_date)


def run_order_batch(conn, seller_type, seller_id, business_date, row):
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(COUNTER_UPSERT, (seller_type, seller_id, business_date, NOW))
        conn.execute(*order_insert_with_subquery(row, seller_id, business_date))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise


# ---------------------------------------------------------------------------
# 실행기
# ---------------------------------------------------------------------------
class Runner:
    def __init__(self):
        self.total = 0
        self.failed = []

    @staticmethod
    def group(title):
        print(f"\n--- {title} ---")

    def _rec(self, ok, name, detail=""):
        self.total += 1
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}] {name}" + (f"  -> {detail}" if detail else ""))
        if not ok:
            self.failed.append(name)

    def check(self, name, cond, detail=""):
        self._rec(bool(cond), name, detail)

    def ok(self, conn, name, sql, params=()):
        try:
            conn.execute(sql, params)
            self._rec(True, name)
            return True
        except Exception as e:
            self._rec(False, name, f"예상치 못한 {type(e).__name__}: {e}")
            return False

    def reject(self, conn, name, sql, params, expect):
        try:
            conn.execute(sql, params)
        except sqlite3.IntegrityError as e:
            msg = str(e)
            hit = expect in msg
            self._rec(hit, name, f'"{msg}"' + ("" if hit else f'  (기대: "{expect}")'))
            return
        except Exception as e:
            self._rec(False, name, f"IntegrityError가 아님: {type(e).__name__}: {e}")
            return
        self._rec(False, name, "거부되지 않고 삽입됨")

    def finish(self):
        print("\n" + "=" * 72)
        print(f"  결과: 전체 {self.total} | 통과 {self.total - len(self.failed)} | 실패 {len(self.failed)}")
        for n in self.failed:
            print(f"    실패: {n}")
        print("=" * 72)
        return 0 if not self.failed else 1


def open_db(path=":memory:"):
    conn = sqlite3.connect(path, timeout=30, isolation_level=None, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def load_schema(conn):
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def seed(conn, r=None):
    """기준 데이터. r이 있으면 각 삽입을 테스트로 집계."""
    F = {}

    def put(name, table, row, key):
        sql, params = ins(table, row)
        if r is not None:
            r.ok(conn, name, sql, params)
        else:
            conn.execute(sql, params)
        F[key] = row["id"]

    put("users 1 (일반 소비자)", "users", user_row("01011112222", name="홍길동"), "usr1")
    put("users 2 (경로당 회장)", "users", user_row("01033334444", name="김회장"), "usr2")
    put("organizations", "organizations", org_row(), "org")
    put("work_teams", "work_teams", team_row(F["org"]), "biz")
    put("workers", "workers", worker_row(F["usr1"], F["biz"]), "wrk")
    put("stores", "stores", store_row(), "str")
    put("mart_suppliers", "mart_suppliers", mart_row(), "mrt")
    put("facilities", "facilities", facility_row(F["org"], "025551111"), "fac")
    put("devices (식당 설치)", "devices", device_row(store_id=F["str"]), "dev")
    put("products (식당 메뉴)", "products", product_row(store_id=F["str"]), "prd_s")
    put("products (마트 식자재)", "products", product_row(mart_id=F["mrt"], price=55000), "prd_m")
    put("store_hours (식당 월요일 영업)", "store_hours", store_hours_row(F["str"], day_of_week=1), "sth")
    put("store_delivery_fee_rules (식당 서초동 배달비)", "store_delivery_fee_rules", dfr_row(F["str"], "서초동", 1000), "dfr")
    return F


# ---------------------------------------------------------------------------
# 테스트 본문
# ---------------------------------------------------------------------------
def main():
    r = Runner()
    print("=" * 72)
    print(f"  AITIP 스키마 무결성 테스트  (로컬 sqlite3 {sqlite3.sqlite_version}, D1 실환경 아님)")
    print("=" * 72)

    conn = open_db()

    r.group("0. 환경")
    try:
        load_schema(conn)
        r.check("스키마 DDL 로드", True)
    except Exception as e:
        r.check("스키마 DDL 로드", False, f"{type(e).__name__}: {e}")
        return r.finish()
    r.check("PRAGMA foreign_keys = 1", conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1)

    # ------------------------------------------------------------------
    r.group("1. ID 생성기·검증기")
    gen = [(p, new_id(p)) for p in PREFIXES for _ in range(300)]
    r.check("생성 ID 4,500개 전부 규격 통과", all(is_valid_typeid(v, p) for p, v in gen))
    r.check("길이: 4자 접두사 30자 / call_ 31자",
            all(len(v) == (31 if p == "call" else 30) for p, v in gen))
    many = [new_id("ord") for _ in range(20000)]
    r.check("ord_ 20,000개 중복 없음", len(set(many)) == len(many))
    a = new_id("ord"); time.sleep(0.005); b = new_id("ord")
    r.check("5ms 간격 생성 시 문자열 정렬 = 생성 순서", a < b, f"{a} < {b}")

    base = new_id("usr")
    samples = [base, base[:-1] + "i", base[:-1] + "l", base[:-1] + "o", base[:-1] + "u",
               base[:-1] + "A", base[:-1] + "-", "usr_8" + base[5:], "usr_z" + base[5:],
               base[:-1], base + "0", "ord_" + base[4:], "USR_" + base[4:]]
    sql_check = ("SELECT (length(?1) = 30 AND ?1 GLOB 'usr_[0-7]*' "
                 "AND substr(?1, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*')")
    mismatch = [s for s in samples
                if bool(conn.execute(sql_check, (s,)).fetchone()[0]) != is_valid_typeid(s, "usr")]
    r.check("Python 검증기와 SQL CHECK 판정 일치 (13개 표본)", not mismatch, f"불일치: {mismatch}")

    if DOC00_PATH.exists():
        text = DOC00_PATH.read_text(encoding="utf-8")
        found = re.findall(r"`((?:%s)_[0-9a-z]+)`" % "|".join(PREFIXES), text)
        bad = [v for v in found if not is_valid_typeid(v, v.split("_")[0])]
        r.check(f"DOC-00 예시 ID {len(found)}개 규격 통과", found and not bad, f"위반: {bad}")
    else:
        r.check("DOC-00 파일 존재", False, str(DOC00_PATH))

    # ------------------------------------------------------------------
    r.group("2. 기준 데이터 삽입")
    F = seed(conn, r)

    # ------------------------------------------------------------------
    r.group("3. TypeID 거부 (users.id / stores.id / call_sessions.id)")
    body = new_id("usr")[4:]
    bad_ids = [
        ("금지문자 i", "usr_" + body[:-1] + "i"),
        ("금지문자 l", "usr_" + body[:-1] + "l"),
        ("금지문자 o", "usr_" + body[:-1] + "o"),
        ("금지문자 u", "usr_" + body[:-1] + "u"),
        ("대문자", "usr_" + body[:-1] + "A"),
        ("특수문자 '-'", "usr_" + body[:-1] + "-"),
        ("첫 글자 8", "usr_8" + body[1:]),
        ("첫 글자 z", "usr_z" + body[1:]),
        ("길이 29자", "usr_" + body[:-1]),
        ("길이 31자", "usr_" + body + "0"),
        ("다른 접두사 ord_", "ord_" + body),
    ]
    for k, (label, bad) in enumerate(bad_ids):
        r.reject(conn, f"users.id {label} 거부", *ins("users", user_row(f"0109000{k:04d}", id=bad)),
                 expect="chk_users_id")
    r.reject(conn, "stores.id 자리에 ord_ 거부", *ins("stores", store_row(id="ord_" + body)),
             expect="chk_stores_id")
    cid = "01077778888"
    call_ok = dict(id=new_id("call"), device_id=F["dev"], caller_cid_enc=fake_enc(cid),
                   caller_cid_hmac=hmac_hex(cid), created_at=NOW)
    r.ok(conn, "call_ 31자 ID 통과", *ins("call_sessions", call_ok))
    call_bad = dict(call_ok, id=call_ok["id"][:-1])
    r.reject(conn, "call_ 30자 ID 거부", *ins("call_sessions", call_bad), expect="chk_call_sessions_id")

    # ------------------------------------------------------------------
    r.group("4. 외래키 (PRAGMA foreign_keys 동작 확인)")
    r.reject(conn, "존재하지 않는 store_id로 주문 거부",
             *ins("orders", order_row(F, store_id=new_id("str"))), expect="FOREIGN KEY constraint failed")
    r.reject(conn, "존재하지 않는 사업단으로 workers 거부",
             *ins("workers", worker_row(F["usr2"], new_id("biz"))), expect="FOREIGN KEY constraint failed")

    # ------------------------------------------------------------------
    r.group("5. 판매자 배타 / 주문 유형 교차 제약")
    r.ok(conn, "일반 B2C 주문 통과", *ins("orders", order_row(F)))
    r.reject(conn, "판매자 둘 다 NULL 거부", *ins("orders", order_row(F, store_id=None)),
             expect="chk_orders_exclusive_seller")
    r.reject(conn, "판매자 둘 다 지정 거부", *ins("orders", order_row(F, mart_id=F["mrt"])),
             expect="chk_orders_exclusive_seller")
    r.reject(conn, "GENERAL인데 buyer_facility_id 있음 거부",
             *ins("orders", order_row(F, buyer_facility_id=F["fac"])), expect="chk_orders_food_facility")
    r.reject(conn, "FOOD_SUPPLY인데 buyer_facility_id 없음 거부",
             *ins("orders", food_order_row(F, buyer_facility_id=None)), expect="chk_orders_food_facility")
    r.reject(conn, "FOOD_SUPPLY인데 식당(str_)이 판매자 거부",
             *ins("orders", food_order_row(F, store_id=F["str"], mart_id=None)), expect="chk_orders_food_seller")
    ph = "01055556666"
    r.reject(conn, "FOOD_SUPPLY 비회원(발신번호만) 거부",
             *ins("orders", food_order_row(F, buyer_user_id=None, caller_phone_enc=fake_enc(ph),
                                           caller_phone_hmac=hmac_hex(ph))),
             expect="chk_orders_food_member")
    r.ok(conn, "FOOD_SUPPLY 정상 발주 통과", *ins("orders", food_order_row(F)))

    # ------------------------------------------------------------------
    r.group("6. 개인정보 컬럼 규칙")
    plain = {"phone", "manager_phone", "landline_cid", "caller_cid", "caller_phone",
             "settlement_bank_account", "delivery_address", "phone_hash", "caller_phone_hash"}
    tables = [t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    leaks = [f"{t}.{c[1]}" for t in tables for c in conn.execute(f"PRAGMA table_info({t})") if c[1] in plain]
    r.check("평문 전화번호·계좌·주소 컬럼 없음 (전 테이블)", not leaks, f"발견: {leaks}")
    ph2 = "01012120000"
    r.ok(conn, "비회원 ARS 일반 주문(enc+hmac) 통과",
         *ins("orders", order_row(F, buyer_user_id=None, order_channel="ARS",
                                  caller_phone_enc=fake_enc(ph2), caller_phone_hmac=hmac_hex(ph2))))
    r.reject(conn, "caller_phone_enc만 있고 hmac 없음 거부",
             *ins("orders", order_row(F, caller_phone_enc=fake_enc(ph2))), expect="chk_orders_caller_pair")
    r.reject(conn, "users.phone_hmac 64자 hex 아님 거부",
             *ins("users", user_row("01000000001", phone_hmac="abc123")), expect="chk_users_phone_hmac")
    r.reject(conn, "users.phone_hmac 대문자 hex 거부",
             *ins("users", user_row("01000000002", phone_hmac=hmac_hex("x").upper())), expect="chk_users_phone_hmac")
    r.reject(conn, "같은 전화번호(HMAC) 사용자 중복 거부",
             *ins("users", user_row("01011112222")), expect="UNIQUE constraint failed: users.phone_hmac")

    # ------------------------------------------------------------------
    r.group("7. 멱등성 키 / 일일 표시 순번 유니크 / 주문 부가옵션")
    o = order_row(F, client_request_id="creq-dup-0001")
    r.ok(conn, "멱등성 키 첫 주문 통과", *ins("orders", o))
    r.reject(conn, "같은 회원 같은 client_request_id 거부",
             *ins("orders", order_row(F, client_request_id="creq-dup-0001")),
             expect="UNIQUE constraint failed: orders.buyer_user_id, orders.client_request_id")
    r.ok(conn, "다른 회원 같은 client_request_id 통과",
         *ins("orders", order_row(F, buyer_user_id=F["usr2"], client_request_id="creq-dup-0001")))
    ph3 = "01034343434"
    guest = dict(buyer_user_id=None, order_channel="ARS", client_request_id="creq-ars-0001",
                 caller_phone_enc=fake_enc(ph3), caller_phone_hmac=hmac_hex(ph3))
    r.ok(conn, "비회원 발신번호 첫 주문 통과", *ins("orders", order_row(F, **guest)))
    r.reject(conn, "같은 발신번호(HMAC) 같은 키 거부", *ins("orders", order_row(F, **guest)),
             expect="UNIQUE constraint failed: orders.caller_phone_hmac, orders.client_request_id")

    r.ok(conn, "식당 순번 500 통과", *ins("orders", order_row(F, display_seq=500)))
    r.reject(conn, "같은 식당·같은 영업일 순번 500 중복 거부", *ins("orders", order_row(F, display_seq=500)),
             expect="UNIQUE constraint failed: orders.store_id, orders.business_date, orders.display_seq")
    r.ok(conn, "다음 영업일 순번 500 통과",
         *ins("orders", order_row(F, display_seq=500, business_date="2026-11-08")))
    r.ok(conn, "마트 순번 500 (판매자가 다르므로) 통과", *ins("orders", food_order_row(F, display_seq=500)))
    r.reject(conn, "같은 마트·같은 영업일 순번 500 중복 거부", *ins("orders", food_order_row(F, display_seq=500)),
             expect="UNIQUE constraint failed: orders.mart_id, orders.business_date, orders.display_seq")
    r.reject(conn, "display_seq 0 거부", *ins("orders", order_row(F, display_seq=0)),
             expect="chk_orders_display_seq")
    r.ok(conn, "수저 필요 1 통과", *ins("orders", order_row(F, is_disposable_needed=1)))
    r.reject(conn, "수저 필요 2 거부", *ins("orders", order_row(F, is_disposable_needed=2)),
             expect="chk_orders_disposable")
    r.ok(conn, "주방/배달 요청사항 분리 저장 통과",
         *ins("orders", order_row(F, kitchen_memo="덜 맵게", delivery_memo="문 앞 노크")))

    # ------------------------------------------------------------------
    r.group("8. 결제")
    gen_order = order_row(F)
    food_order = food_order_row(F, total_amount=55000)
    conn.execute(*ins("orders", gen_order))
    conn.execute(*ins("orders", food_order))
    p1 = payment_row(gen_order["id"], pg_tx_id="tx-fixed-001")
    r.ok(conn, "일반 신용카드 결제 통과", *ins("payments", p1))
    r.reject(conn, "SUBSIDY + CREDIT_CARD 거부",
             *ins("payments", payment_row(food_order["id"], funding_source="SUBSIDY", amount=50000)),
             expect="chk_payments_funding_method")
    r.reject(conn, "SUBSIDY + TRANSFER 거부",
             *ins("payments", payment_row(food_order["id"], funding_source="SUBSIDY",
                                          payment_method="TRANSFER", amount=50000)),
             expect="chk_payments_funding_method")
    r.ok(conn, "SUBSIDY + WELFARE_CARD 통과",
         *ins("payments", payment_row(food_order["id"], funding_source="SUBSIDY",
                                      payment_method="WELFARE_CARD", amount=50000, pg_provider="NH_CARD")))
    r.ok(conn, "자부담 현금 분할 결제(pg 없음) 통과",
         *ins("payments", payment_row(food_order["id"], funding_source="OWN_EXPENSE", payment_method="CASH",
                                      amount=5000, pg_provider=None, pg_tx_id=None)))
    r.ok(conn, "pg 없는 현금 결제 2건째 통과 (부분 인덱스 대상 아님)",
         *ins("payments", payment_row(gen_order["id"], funding_source="GENERAL", payment_method="CASH",
                                      amount=1000, pg_provider=None, pg_tx_id=None)))
    r.reject(conn, "같은 PG 승인번호 중복 거부", *ins("payments", payment_row(gen_order["id"], pg_tx_id="tx-fixed-001")),
             expect="UNIQUE constraint failed: payments.pg_provider, payments.pg_tx_id")
    r.reject(conn, "결제 금액 0 거부", *ins("payments", payment_row(gen_order["id"], amount=0)),
             expect="chk_payments_amount")
    r.ok(conn, "[DB 한계 확인] GENERAL 주문에 SUBSIDY 결제는 DB가 막지 못함 -> 서버 규칙 대상",
         *ins("payments", payment_row(gen_order["id"], funding_source="SUBSIDY",
                                      payment_method="WELFARE_CARD", amount=1000)))

    # ------------------------------------------------------------------
    r.group("9. 주문 품목 / 배송 / 옵션")
    r.ok(conn, "메뉴 options_json 저장 통과",
         *ins("products", product_row(store_id=F["str"], options_json='{"option_groups":[]}')))
    r.ok(conn, "메뉴 image_r2_key 저장 통과",
         *ins("products", product_row(store_id=F["str"], image_r2_key="products/str_01m/item.webp")))
    itm1 = dict(id=new_id("itm"), order_id=gen_order["id"], product_id=F["prd_s"],
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
                      created_at=NOW)
    r.ok(conn, "마트 장보기 품목별 부분 취소(CANCELED) 통과", *ins("order_items", itm_cancel))
    r.reject(conn, "order_items item_status 유효하지 않은 값 거부",
             *ins("order_items", dict(itm1, id=new_id("itm"), item_status="INVALID")),
             expect="chk_order_items_status")
    r.ok(conn, "delivery_sessions 통과",
         *ins("delivery_sessions", dict(id=new_id("dlv"), order_id=food_order["id"], worker_id=F["wrk"],
                                        created_at=NOW, updated_at=NOW)))

    # ------------------------------------------------------------------
    r.group("10. store_members (0.1.x 중복 구멍 수정 확인)")
    sm = dict(store_id=F["str"], mart_id=None, user_id=F["usr1"], role="OWNER", created_at=NOW)
    r.ok(conn, "식당 점주 등록 통과", *ins("store_members", sm))
    r.reject(conn, "같은 식당·같은 사용자 2번째 등록 거부", *ins("store_members", sm),
             expect="UNIQUE constraint failed: store_members.store_id, store_members.user_id")
    mm = dict(store_id=None, mart_id=F["mrt"], user_id=F["usr1"], role="STAFF", created_at=NOW)
    r.ok(conn, "같은 사용자가 마트 직원으로 등록 통과", *ins("store_members", mm))
    r.reject(conn, "같은 마트·같은 사용자 2번째 등록 거부", *ins("store_members", mm),
             expect="UNIQUE constraint failed: store_members.mart_id, store_members.user_id")
    r.reject(conn, "store_id·mart_id 둘 다 NULL 거부", *ins("store_members", dict(sm, store_id=None)),
             expect="chk_store_members_owner")
    r.reject(conn, "store_id·mart_id 둘 다 지정 거부",
             *ins("store_members", dict(sm, user_id=F["usr2"], mart_id=F["mrt"])),
             expect="chk_store_members_owner")
    cnt = conn.execute("SELECT count(*) FROM store_members WHERE store_id = ? AND user_id = ?",
                       (F["str"], F["usr1"])).fetchone()[0]
    r.check("식당 점주 행 수 = 1", cnt == 1, f"실제 {cnt}")

    # ------------------------------------------------------------------
    r.group("11. settlements")
    r.ok(conn, "식당 정산 (net = total - fee) 통과", *ins("settlements", settlement_row(store_id=F["str"])))
    r.reject(conn, "seller_type=MART인데 store_id 채움 거부",
             *ins("settlements", settlement_row(seller_type="MART", store_id=F["str"], settlement_date="2026-11-01")),
             expect="chk_settlements_seller")
    r.reject(conn, "seller_type=STORE인데 mart_id만 채움 거부",
             *ins("settlements", settlement_row(mart_id=F["mrt"], settlement_date="2026-11-02")),
             expect="chk_settlements_seller")
    r.reject(conn, "net ≠ total - fee 거부",
             *ins("settlements", settlement_row(store_id=F["str"], settlement_date="2026-11-03",
                                                net_payout_amount=99999)),
             expect="chk_settlements_net")
    r.reject(conn, "같은 식당·같은 정산일 중복 거부", *ins("settlements", settlement_row(store_id=F["str"])),
             expect="UNIQUE constraint failed: settlements.store_id, settlements.settlement_date")
    r.ok(conn, "마트 정산 통과", *ins("settlements", settlement_row(seller_type="MART", mart_id=F["mrt"])))
    r.ok(conn, "정산서 statement_pdf_r2_key 저장 통과",
         *ins("settlements", settlement_row(store_id=F["str"], settlement_date="2026-11-04",
                                            statement_pdf_r2_key="statements/str_01m/202611.pdf")))
    r.reject(conn, "같은 마트·같은 정산일 중복 거부",
             *ins("settlements", settlement_row(seller_type="MART", mart_id=F["mrt"])),
             expect="UNIQUE constraint failed: settlements.mart_id, settlements.settlement_date")

    # ------------------------------------------------------------------
    r.group("12. display_counters / 주문 batch 흐름")
    r.reject(conn, "STORE 유형에 mrt_ ID 카운터 거부",
             "INSERT INTO display_counters (seller_type, seller_id, business_date, last_seq, updated_at) "
             "VALUES (?, ?, ?, 0, ?)", ("STORE", F["mrt"], BDATE, NOW), expect="chk_counters_seller")
    r.reject(conn, "last_seq 음수 거부",
             "INSERT INTO display_counters (seller_type, seller_id, business_date, last_seq, updated_at) "
             "VALUES (?, ?, ?, -1, ?)", ("STORE", F["str"], "2026-12-01", NOW), expect="chk_counters_seq")

    bd = "2026-11-09"

    def seqs_for(col, seller, day):
        return [x[0] for x in conn.execute(
            f"SELECT display_seq FROM orders WHERE {col} = ? AND business_date = ? ORDER BY display_seq",
            (seller, day))]

    def strip_seq(row):
        row = dict(row)
        row.pop("display_seq")
        return row

    run_order_batch(conn, "STORE", F["str"], bd, strip_seq(order_row(F, business_date=bd)))
    run_order_batch(conn, "STORE", F["str"], bd, strip_seq(order_row(F, business_date=bd)))
    r.check("batch 2회 -> 식당 순번 [1, 2]", seqs_for("store_id", F["str"], bd) == [1, 2],
            str(seqs_for("store_id", F["str"], bd)))
    run_order_batch(conn, "MART", F["mrt"], bd, strip_seq(food_order_row(F, business_date=bd)))
    r.check("같은 날 마트 순번은 독립적으로 [1]", seqs_for("mart_id", F["mrt"], bd) == [1],
            str(seqs_for("mart_id", F["mrt"], bd)))

    try:
        run_order_batch(conn, "STORE", F["str"], bd, strip_seq(order_row(F, business_date=bd, total_amount=-1)))
        r.check("batch 중 주문 삽입 실패 시 IntegrityError", False, "예외 없이 성공함")
    except sqlite3.IntegrityError as e:
        r.check("batch 중 주문 삽입 실패 시 IntegrityError (chk_orders_total)", "chk_orders_total" in str(e), str(e))
    last = conn.execute("SELECT last_seq FROM display_counters WHERE seller_id = ? AND business_date = ?",
                        (F["str"], bd)).fetchone()[0]
    r.check("실패한 batch의 카운터 증가도 롤백됨 (last_seq = 2)", last == 2, f"실제 {last}")
    run_order_batch(conn, "STORE", F["str"], bd, strip_seq(order_row(F, business_date=bd)))
    r.check("다음 batch 순번 3 (롤백으로 인한 결번 없음)", seqs_for("store_id", F["str"], bd) == [1, 2, 3],
            str(seqs_for("store_id", F["str"], bd)))
    r.reject(conn, "카운터 증가 없이 서브쿼리 삽입 -> display_seq NULL 거부",
             *order_insert_with_subquery(strip_seq(order_row(F, business_date="2026-11-10")), F["str"], "2026-11-10"),
             expect="NOT NULL constraint failed: orders.display_seq")

    # ------------------------------------------------------------------
    r.group("13. 동시성 (파일 DB, 연결 4개 x 25건, 같은 식당·같은 영업일)")
    tmpdir = tempfile.mkdtemp(prefix="aitip_schema_")
    try:
        path = os.path.join(tmpdir, "c.db")
        c0 = open_db(path)
        load_schema(c0)
        G = seed(c0)
        c0.close()
        errors = []

        def worker(n):
            c = open_db(path)
            try:
                for _ in range(n):
                    try:
                        run_order_batch(c, "STORE", G["str"], BDATE, strip_seq(order_row(G)))
                    except Exception as e:
                        errors.append(repr(e))
            finally:
                c.close()

        threads = [threading.Thread(target=worker, args=(25,)) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        c1 = open_db(path)
        got = [x[0] for x in c1.execute(
            "SELECT display_seq FROM orders WHERE store_id = ? AND business_date = ? ORDER BY display_seq",
            (G["str"], BDATE))]
        c1.close()
        r.check("동시 batch 중 오류 없음", not errors, f"{len(errors)}건: {errors[:2]}")
        r.check("발급 순번 = 1..100, 중복·결번 없음", got == list(range(1, 101)),
                f"건수 {len(got)}, 최소 {min(got) if got else None}, 최대 {max(got) if got else None}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    # ------------------------------------------------------------------
    r.group("14. 인덱스 사용 (EXPLAIN QUERY PLAN)")
    plans = [
        ("주문 품목 조회", "SELECT * FROM order_items WHERE order_id = ?", "idx_order_items_order"),
        ("결제 조회", "SELECT * FROM payments WHERE order_id = ?", "idx_payments_order"),
        ("배송 세션 조회", "SELECT * FROM delivery_sessions WHERE order_id = ?", "idx_delivery_sessions_order"),
        ("수신 전화 -> 경로당 매칭", "SELECT id FROM facilities WHERE landline_cid_hmac = ?", "idx_facilities_cid_hmac"),
        ("발신번호별 통화 이력", "SELECT id FROM call_sessions WHERE caller_cid_hmac = ?", "idx_call_sessions_cid_hmac"),
    ]
    for label, q, idx in plans:
        detail = " | ".join(row[3] for row in conn.execute("EXPLAIN QUERY PLAN " + q, ("x",)))
        r.check(f"{label}: {idx} 사용", idx in detail and "SCAN" not in detail, detail)
    for label, q in [("구매자 주문 목록(최신순)", "SELECT * FROM orders WHERE buyer_user_id = ? ORDER BY created_at DESC"),
                     ("식당 주문 목록(최신순)", "SELECT * FROM orders WHERE store_id = ? ORDER BY created_at DESC")]:
        detail = " | ".join(row[3] for row in conn.execute("EXPLAIN QUERY PLAN " + q, ("x",)))
        r.check(f"{label}: 인덱스 사용, 임시 정렬 없음",
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

    # ------------------------------------------------------------------
    r.group("20. 확장 생태계 및 관리자 등록 UI 데이터 무결성 (Section 20)")

    # 20.1 users.role 검증
    r.ok(conn, "users SUPER_ADMIN 역할 등록 통과",
         *ins("users", user_row("01088880001", name="최고운영자", role="SUPER_ADMIN")))
    r.ok(conn, "users HQ_DEV_OPS 개발부서 역할 등록 통과",
         *ins("users", user_row("01088880002", name="수석엔지니어", role="HQ_DEV_OPS")))
    r.ok(conn, "users HQ_SALES_OPS 본사영업관리자 역할 등록 통과",
         *ins("users", user_row("01088880003", name="영업운영팀장", role="HQ_SALES_OPS")))
    r.reject(conn, "users 미등록 role 거부",
             *ins("users", user_row("01088880004", name="해커", role="UNAUTHORIZED_ROLE")),
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
         *ins("products", product_row(store_id=F["str"], id=prd_webp_id, category_id=cat1_id, name="제육덮밥", price=8000, original_price=9000,
                                     barcode_sku="8801234567890", weight_value=450, weight_unit="g", unit="EA", tax_type="TAXABLE", is_available=1,
                                     image_r2_key="products/str_01/pork_bowl.webp", image_format="webp")))
    r.reject(conn, "products non-webp 이미지 포맷 거부",
             *ins("products", product_row(store_id=F["str"], name="비빔밥", price=7500, image_format="png")),
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
                                       representative_name="김총판", phone_enc="enc:031", phone_hmac=hmac_hex("03199990001"),
                                       coverage_regions_json='["41111"]', bank_name_enc="enc:nh", bank_account_enc="enc:acc", bank_holder_enc="enc:holder",
                                       is_active=1, created_at=NOW, updated_at=NOW)))

    agn_dlv_id = new_id("agn")
    r.ok(conn, "partner_agencies (agn_) 지역 배달대리점(DELIVERY_AGENCY) 등록 통과",
         *ins("partner_agencies", dict(id=agn_dlv_id, business_name="바로고 강남논현지사", biz_reg_no="123-45-67891", agency_type="DELIVERY_AGENCY",
                                       representative_name="이지사", phone_enc="enc:02", phone_hmac=hmac_hex("025550001"),
                                       coverage_regions_json='["11680"]', bank_name_enc="enc:kb", bank_account_enc="enc:acc2", bank_holder_enc="enc:holder2",
                                       is_active=1, created_at=NOW, updated_at=NOW)))
    r.reject(conn, "partner_agencies 유효하지 않은 agency_type 거부",
             *ins("partner_agencies", dict(id=new_id("agn"), business_name="유령대리점", biz_reg_no="123-45-67899", agency_type="ILLEGAL_TYPE",
                                           representative_name="박유령", phone_enc="enc:02", phone_hmac=hmac_hex("025550009"),
                                           coverage_regions_json='["11680"]', bank_name_enc="enc:kb", bank_account_enc="enc:acc3", bank_holder_enc="enc:holder3",
                                           is_active=1, created_at=NOW, updated_at=NOW)),
             expect="chk_agency_type")
    
    agt_u = user_row("01077770001", name="최기사", role="FIELD_ENGINEER")
    r.ok(conn, "users 기사 계정 등록 통과", *ins("users", agt_u))

    agt1_id = new_id("agt")
    r.ok(conn, "partner_agents (agt_) 현장 설치 기사 등록 통과",
         *ins("partner_agents", dict(id=agt1_id, agency_id=agn1_id, user_id=agt_u["id"], agent_role="FIELD_ENGINEER",
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

    # -----------------------------------------------------------------------
    # 23. 요식업 3대 채널(배달/포장/홀) 및 주방 전표/원가 엔진 무결성
    # -----------------------------------------------------------------------
    print("\n--- 23. 요식업 3대 채널(배달/포장/홀) 및 주방 전표/원가 엔진 무결성 (Section 23) ---")

    # 23.1 orders fulfillment_type: 'DELIVERY', 'TAKEOUT', 'DINE_IN'
    ord_dine_id = new_id("ord")
    r.ok(conn, "orders DINE_IN (매장 홀 식사, 테이블 번호 지정) 등록 통과",
         *ins("orders", order_row(F, id=ord_dine_id, fulfillment_type="DINE_IN", table_no="홀-12번",
                                 client_request_id="creq-dine-01", display_seq=101)))

    ord_take_id = new_id("ord")
    r.ok(conn, "orders TAKEOUT (방문 포장, 픽업 예상 시각 지정) 등록 통과",
         *ins("orders", order_row(F, id=ord_take_id, fulfillment_type="TAKEOUT", pickup_estimated_at=NOW + 1200,
                                 client_request_id="creq-take-01", display_seq=102)))

    r.reject(conn, "orders fulfillment_type 유효하지 않은 값('DRIVE_THRU') 거부",
             *ins("orders", order_row(F, id=new_id("ord"), fulfillment_type="DRIVE_THRU",
                                     client_request_id="creq-bad-ful", display_seq=103)),
             expect="chk_orders_fulfillment")

    r.reject(conn, "orders table_no 20자 초과 거부",
             *ins("orders", order_row(F, id=new_id("ord"), fulfillment_type="DINE_IN", table_no="A" * 21,
                                     client_request_id="creq-bad-tbl", display_seq=104)),
             expect="chk_orders_table_no")

    r.reject(conn, "orders pickup_estimated_at 음수(-1) 거부",
             *ins("orders", order_row(F, id=new_id("ord"), fulfillment_type="TAKEOUT", pickup_estimated_at=-1,
                                     client_request_id="creq-bad-pick", display_seq=105)),
             expect="chk_orders_pickup_est")

    # 23.2 order_items kitchen_mods_json (주방 전표용 모디파이어 스냅샷)
    itm_kitchen_id = new_id("itm")
    kitchen_mods_sample = json.dumps([
        {"group": "맵기선택", "option": "순한맛", "price": 0},
        {"group": "토핑추가", "option": "눈꽃치즈", "price": 1500}
    ], ensure_ascii=False)
    r.ok(conn, "order_items kitchen_mods_json 주방 전표 모디파이어 저장 통과",
         *ins("order_items", dict(id=itm_kitchen_id, order_id=ord_dine_id, product_id=F["prd_s"],
                                  item_name="치즈떡볶이", unit_price=8000, quantity=1, total_price=9500,
                                  options_selected_json=kitchen_mods_sample,
                                  kitchen_mods_json=kitchen_mods_sample, created_at=NOW)))

    # 23.3 idx_orders_fulfillment 인덱스 동작 확인
    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM orders WHERE store_id = ? AND fulfillment_type = ? AND order_status = ?",
                       (F["str"], "DINE_IN", "PENDING"))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_orders_fulfillment" in plan, f"Expected idx_orders_fulfillment, got: {plan}"
    r.ok(conn, "orders fulfillment_type 채널별 조회 인덱스 (idx_orders_fulfillment) 작동 통과",
         "SELECT 1", ())

    # -----------------------------------------------------------------------
    # 24. 하나로마트 다채널 및 시니어클럽 위탁운영/신선시세 무결성 (Section 24)
    # -----------------------------------------------------------------------
    print("\n--- 24. 하나로마트 다채널 및 시니어클럽 위탁운영/신선시세 무결성 (Section 24) ---")

    # 24.1 users.role: AGENCY_OPERATOR, CONSIGNMENT_PICKER
    u_agency_op = user_row("01077778888", name="대행사매니저", role="AGENCY_OPERATOR")
    r.ok(conn, "users AGENCY_OPERATOR (위탁 대행사 매니저) 등록 통과",
         *ins("users", u_agency_op))

    u_picker = user_row("01077779999", name="시니어피킹원", role="CONSIGNMENT_PICKER")
    r.ok(conn, "users CONSIGNMENT_PICKER (마트 상주 시니어 피킹원) 등록 통과",
         *ins("users", u_picker))

    # 24.2 mart_suppliers consignment_type & consignment_org_id
    mrt_consigned_id = new_id("mrt")
    r.ok(conn, "mart_suppliers CONSIGNED (시니어클럽 전담 위탁 운영) 등록 통과",
         *ins("mart_suppliers", dict(id=mrt_consigned_id, mart_name="농협하나로마트 서초점",
                                     biz_reg_no="123-81-99887", nh_erp_code="NH-SEOCHO-01",
                                     manager_phone_enc="enc:phone", manager_phone_hmac=hmac_hex("0211112222"),
                                     settlement_account_enc="enc:bank", road_address="서울 서초구 서초대로",
                                     consignment_org_id=F["org"], consignment_type="CONSIGNED",
                                     created_at=NOW, updated_at=NOW)))

    r.reject(conn, "mart_suppliers consignment_type 유효하지 않은 값('OUTSOURCED') 거부",
             *ins("mart_suppliers", dict(id=new_id("mrt"), mart_name="오류마트",
                                         biz_reg_no="123-81-99888", manager_phone_enc="enc:phone",
                                         manager_phone_hmac=hmac_hex("0211112223"), settlement_account_enc="enc:bank",
                                         road_address="서울", consignment_type="OUTSOURCED",
                                         created_at=NOW, updated_at=NOW)),
             expect="chk_mart_consignment_type")

    r.reject(conn, "mart_suppliers consignment_org_id 잘못된 접두사('usr_') 거부",
             *ins("mart_suppliers", dict(id=new_id("mrt"), mart_name="오류마트2",
                                         biz_reg_no="123-81-99889", manager_phone_enc="enc:phone",
                                         manager_phone_hmac=hmac_hex("0211112224"), settlement_account_enc="enc:bank",
                                         road_address="서울", consignment_org_id=F["usr1"],
                                         created_at=NOW, updated_at=NOW)),
             expect="chk_mart_consignment_org")

    # 24.3 products shelf_location, pos_plu_code, is_local_food, daily_price_updated_at
    prd_produce_id = new_id("prd")
    r.ok(conn, "products 신선 농산물 (매대위치 A1, 로컬푸드, 당일시세갱신) 등록 통과",
         *ins("products", product_row(mart_id=mrt_consigned_id, id=prd_produce_id, name="[로컬] 흙대파 1단",
                                      price=2200, original_price=2500, barcode_sku="8809123456789",
                                      shelf_location="A1-신선채소매대", pos_plu_code="PLU-101",
                                      is_local_food=1, daily_price_updated_at=NOW, image_format="webp")))

    r.reject(conn, "products shelf_location 50자 초과 거부",
             *ins("products", product_row(mart_id=mrt_consigned_id, name="대파", price=2000,
                                         shelf_location="A" * 51, image_format="webp")),
             expect="chk_products_shelf")

    r.reject(conn, "products pos_plu_code 30자 초과 거부",
             *ins("products", product_row(mart_id=mrt_consigned_id, name="대파", price=2000,
                                         pos_plu_code="P" * 31, image_format="webp")),
             expect="chk_products_plu")

    r.reject(conn, "products is_local_food 유효하지 않은 값(2) 거부",
             *ins("products", product_row(mart_id=mrt_consigned_id, name="대파", price=2000,
                                         is_local_food=2, image_format="webp")),
             expect="chk_products_local_food")

    r.reject(conn, "products daily_price_updated_at 음수(-1) 거부",
             *ins("products", product_row(mart_id=mrt_consigned_id, name="대파", price=2000,
                                         daily_price_updated_at=-1, image_format="webp")),
             expect="chk_products_daily_price")

    # 24.4 인덱스 검증 (idx_products_mart_barcode, idx_products_mart_location)
    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM products WHERE mart_id = ? AND barcode_sku = ?",
                       (mrt_consigned_id, "8809123456789"))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_products_mart_barcode" in plan, f"Expected idx_products_mart_barcode, got: {plan}"
    r.ok(conn, "products 바코드 고속조회 인덱스 (idx_products_mart_barcode) 작동 통과", "SELECT 1", ())

    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM products WHERE mart_id = ? AND shelf_location = ?",
                       (mrt_consigned_id, "A1-신선채소매대"))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_products_mart_location" in plan, f"Expected idx_products_mart_location, got: {plan}"
    r.ok(conn, "products 매대위치 고속조회 인덱스 (idx_products_mart_location) 작동 통과", "SELECT 1", ())

    # ------------------------------------------------------------------
    r.group("25. 배달 세션 및 외주 대행·서지·ETA 무결성 (Section 25)")
    # 25.1 시니어 클럽 도보/실버카트 배달 등록 성공
    dlv_senior_id = new_id("dlv")
    dlv_senior = dict(
        id=dlv_senior_id,
        order_id=food_order["id"],
        worker_id=F["wrk"],
        delivery_status="ASSIGNED",
        delivery_channel="SENIOR_COURIER",
        outsourced_agency_name=None,
        outsourced_tracking_id=None,
        vehicle_type="SILVER_CART",
        base_delivery_fee=2500,
        distance_surge_fee=0,
        weather_surge_fee=500,
        peak_surge_fee=0,
        driver_payout_amount=2800,
        platform_logistics_cut=200,
        distance_meters=650,
        estimated_prep_minutes=15,
        estimated_transit_minutes=12,
        estimated_delivery_at=NOW + 1620,
        pickup_at=None,
        completed_at=None,
        proof_type="DOORSTEP_PHOTO",
        proof_photo_object_key="pod/dlv_senior_photo_01.webp",
        recipient_signature_object_key=None,
        proof_latitude=37.5665,
        proof_longitude=126.9780,
        created_at=NOW,
        updated_at=NOW,
    )
    r.ok(conn, "delivery_sessions 시니어 클럽 도보/실버카트 배송 등록 성공", *ins("delivery_sessions", dlv_senior))

    # 25.2 배달대행 외주 연동(VROONG) 및 이륜차 등록 성공
    dlv_agency_id = new_id("dlv")
    dlv_agency = dict(
        id=dlv_agency_id,
        order_id=food_order["id"],
        worker_id=None,
        delivery_status="IN_TRANSIT",
        delivery_channel="OUTSOURCED_AGENCY",
        outsourced_agency_name="VROONG",
        outsourced_tracking_id="VRG-20261109-987654",
        vehicle_type="MOTORCYCLE",
        base_delivery_fee=3500,
        distance_surge_fee=1000,
        weather_surge_fee=1000,
        peak_surge_fee=500,
        driver_payout_amount=5500,
        platform_logistics_cut=500,
        distance_meters=3200,
        estimated_prep_minutes=20,
        estimated_transit_minutes=15,
        estimated_delivery_at=NOW + 2100,
        pickup_at=NOW + 1200,
        completed_at=None,
        proof_type="DIRECT_HANDOVER",
        proof_photo_object_key=None,
        recipient_signature_object_key="pod/dlv_agency_sig_01.webp",
        proof_latitude=37.5651,
        proof_longitude=126.9895,
        created_at=NOW,
        updated_at=NOW,
    )
    r.ok(conn, "delivery_sessions 외주 대행사(VROONG) 이륜차 배송 등록 성공", *ins("delivery_sessions", dlv_agency))

    # 25.3 지역 배달대리점(LOCAL_AGENCY) 배송 세션 등록 성공
    dlv_local_id = new_id("dlv")
    dlv_local = dict(
        id=dlv_local_id,
        order_id=food_order["id"],
        worker_id=None,
        delivery_status="ASSIGNED",
        delivery_channel="LOCAL_AGENCY",
        local_agency_id=agn_dlv_id,
        local_agency_branch_name="바로고 강남논현지사",
        agency_commission_fee=350,
        outsourced_agency_name=None,
        outsourced_tracking_id=None,
        vehicle_type="MOTORCYCLE",
        base_delivery_fee=3500,
        distance_surge_fee=500,
        weather_surge_fee=0,
        peak_surge_fee=0,
        driver_payout_amount=3650,
        platform_logistics_cut=0,
        distance_meters=1800,
        estimated_prep_minutes=15,
        estimated_transit_minutes=10,
        estimated_delivery_at=NOW + 1500,
        pickup_at=None,
        completed_at=None,
        proof_type="DOORSTEP_PHOTO",
        proof_photo_object_key="pod/dlv_local_agency_photo_01.webp",
        recipient_signature_object_key=None,
        proof_latitude=37.5110,
        proof_longitude=127.0250,
        created_at=NOW,
        updated_at=NOW,
    )
    r.ok(conn, "delivery_sessions 지역 배달대리점(LOCAL_AGENCY) 배송 등록 성공", *ins("delivery_sessions", dlv_local))

    # 25.4 CHECK 제약 검증
    # 1) delivery_channel 유효성
    r.reject(conn, "delivery_sessions 유효하지 않은 채널('DRONE') 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), delivery_channel="DRONE")),
             expect="chk_dlv_channel")

    # 1-1) local_agency_id TypeID 규격 검증
    r.reject(conn, "delivery_sessions 잘못된 local_agency_id 접두사('usr_') 거부",
             *ins("delivery_sessions", dict(dlv_local, id=new_id("dlv"), local_agency_id=F["usr1"])),
             expect="chk_dlv_local_agency")

    # 1-2) local_agency_branch_name 길이 초과 (50자)
    r.reject(conn, "delivery_sessions local_agency_branch_name 50자 초과 거부",
             *ins("delivery_sessions", dict(dlv_local, id=new_id("dlv"), local_agency_branch_name="지" * 51)),
             expect="chk_dlv_branch_name")

    # 1-3) agency_commission_fee 음수 거부
    r.reject(conn, "delivery_sessions agency_commission_fee 음수(-1) 거부",
             *ins("delivery_sessions", dict(dlv_local, id=new_id("dlv"), agency_commission_fee=-1)),
             expect="chk_dlv_agency_fee")

    # 2) outsourced_agency_name 유효성
    r.reject(conn, "delivery_sessions 유효하지 않은 외주 대행사('COUPANG_EATS') 거부",
             *ins("delivery_sessions", dict(dlv_agency, id=new_id("dlv"), outsourced_agency_name="COUPANG_EATS")),
             expect="chk_dlv_agency")

    # 3) outsourced_tracking_id 길이 초과 (64자)
    r.reject(conn, "delivery_sessions 외주 운송장번호 64자 초과 거부",
             *ins("delivery_sessions", dict(dlv_agency, id=new_id("dlv"), outsourced_tracking_id="T" * 65)),
             expect="chk_dlv_track")

    # 4) vehicle_type 유효성
    r.reject(conn, "delivery_sessions 유효하지 않은 운송수단('HOVERBOARD') 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), vehicle_type="HOVERBOARD")),
             expect="chk_dlv_vehicle")

    # 5) 서지 요금 음수 거부
    r.reject(conn, "delivery_sessions base_delivery_fee 음수(-1) 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), base_delivery_fee=-1)),
             expect="chk_dlv_base_fee")
    r.reject(conn, "delivery_sessions weather_surge_fee 음수(-500) 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), weather_surge_fee=-500)),
             expect="chk_dlv_weather_fee")
    r.reject(conn, "delivery_sessions driver_payout_amount 음수(-100) 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), driver_payout_amount=-100)),
             expect="chk_dlv_driver_payout")

    # 6) 거리 및 ETA 검증
    r.reject(conn, "delivery_sessions distance_meters 음수(-10) 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), distance_meters=-10)),
             expect="chk_dlv_distance")
    r.reject(conn, "delivery_sessions estimated_transit_minutes 음수(-1) 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), estimated_transit_minutes=-1)),
             expect="chk_dlv_transit_min")
    r.reject(conn, "delivery_sessions estimated_delivery_at 0 이하 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), estimated_delivery_at=0)),
             expect="chk_dlv_eta")

    # 7) proof_type 유효성
    r.reject(conn, "delivery_sessions 유효하지 않은 배달증빙유형('THROUGH_WINDOW') 거부",
             *ins("delivery_sessions", dict(dlv_senior, id=new_id("dlv"), proof_type="THROUGH_WINDOW")),
             expect="chk_dlv_proof_type")

    # 25.5 인덱스 검증 (idx_dlv_channel_status, idx_dlv_local_agency)
    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM delivery_sessions WHERE delivery_channel = ? AND delivery_status = ?",
                       ("SENIOR_COURIER", "ASSIGNED"))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_dlv_channel_status" in plan, f"Expected idx_dlv_channel_status, got: {plan}"
    r.ok(conn, "delivery_sessions 채널·상태 복합 인덱스 (idx_dlv_channel_status) 작동 검증", "SELECT 1", ())

    cur2 = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM delivery_sessions WHERE local_agency_id = ?",
                        (agn_dlv_id,))
    plan2 = " ".join(row[3] for row in cur2.fetchall())
    assert "idx_dlv_local_agency" in plan2, f"Expected idx_dlv_local_agency, got: {plan2}"
    r.ok(conn, "delivery_sessions 지역 배달대리점 인덱스 (idx_dlv_local_agency) 작동 검증", "SELECT 1", ())

    # ------------------------------------------------------------------
    r.group("26. 결품 부분환불·영수증 재발행(취소+정정) 및 보조금 회계 무결성 (Section 26)")
    # 26.1 원거래 결제 (50,000원) 등록 성공
    p_orig_id = new_id("pay")
    p_orig = dict(
        id=p_orig_id,
        order_id=food_order["id"],
        parent_payment_id=None,
        receipt_type="ORIGINAL",
        receipt_number="REC-20261109-0012",
        funding_source="SUBSIDY",
        payment_method="WELFARE_CARD",
        amount=50000,
        tax_free_amount=30000,
        taxable_amount=18182,
        vat_amount=1818,
        pg_provider="NH_CARD",
        pg_tx_id="nh_tx_20261109_0001",
        payment_status="PAID",
        canceled_reason=None,
        created_at=NOW,
    )
    r.ok(conn, "payments 원거래 결제(50,000원) ORIGINAL 영수증 등록 성공", *ins("payments", p_orig))

    # 26.2 하나로마트/대한민국 표준 회계: 결품(2,500원) 발생에 따른 [원거래 취소 전표 + 재발행 정정 전표] 쌍 등록
    # 1) 원거래 취소 전표 (50,000원 VOID 전표)
    p_void_id = new_id("pay")
    p_void = dict(
        id=p_void_id,
        order_id=food_order["id"],
        parent_payment_id=p_orig_id,
        receipt_type="VOID",
        receipt_number="REC-20261109-0012-VOID",
        funding_source="SUBSIDY",
        payment_method="WELFARE_CARD",
        amount=50000,
        tax_free_amount=30000,
        taxable_amount=18182,
        vat_amount=1818,
        pg_provider="NH_CARD",
        pg_tx_id="nh_tx_20261109_0001_void",
        payment_status="CANCELLED",
        canceled_reason="하나로마트 매장 시금치 1단 결품으로 인한 원거래 취소",
        created_at=NOW + 60,
    )
    r.ok(conn, "payments 원거래 전액 취소 VOID 영수증 전표 등록 성공", *ins("payments", p_void))

    # 2) 최종 차액 재발행 전표 (47,500원 REISSUED 정정 전표)
    p_reissued_id = new_id("pay")
    p_reissued = dict(
        id=p_reissued_id,
        order_id=food_order["id"],
        parent_payment_id=p_orig_id,
        receipt_type="REISSUED",
        receipt_number="REC-20261109-0013",
        funding_source="SUBSIDY",
        payment_method="WELFARE_CARD",
        amount=47500,
        tax_free_amount=27500,
        taxable_amount=18182,
        vat_amount=1818,
        pg_provider="NH_CARD",
        pg_tx_id="nh_tx_20261109_0002_reissue",
        payment_status="PAID",
        canceled_reason="시금치 결품 차감 후 최종 승인 재발행",
        created_at=NOW + 61,
    )
    r.ok(conn, "payments 결품 차감 후 47,500원 REISSUED 정정 영수증 등록 성공", *ins("payments", p_reissued))

    # 26.3 orders 테이블 canceled_amount 및 final_paid_amount 검증
    r.ok(conn, "orders 결품 취소금액 및 최종 결제금액 정상 갱신",
         "UPDATE orders SET canceled_amount = ?, final_paid_amount = ? WHERE id = ?",
         (2500, 47500, food_order["id"]))

    # 26.4 CHECK 제약조건 거부 검증
    # 1) orders canceled_amount 음수 거부
    r.reject(conn, "orders canceled_amount 음수(-1) 거부",
             "UPDATE orders SET canceled_amount = -1 WHERE id = ?",
             (food_order["id"],), expect="chk_orders_canceled_amt")

    # 2) orders final_paid_amount 음수 거부
    r.reject(conn, "orders final_paid_amount 음수(-100) 거부",
             "UPDATE orders SET final_paid_amount = -100 WHERE id = ?",
             (food_order["id"],), expect="chk_orders_final_paid")

    # 3) payments receipt_type 유효하지 않은 값 거부
    r.reject(conn, "payments receipt_type 유효하지 않은 값('INVALID_TYPE') 거부",
             *ins("payments", dict(p_orig, id=new_id("pay"), pg_tx_id="tx_err_1", receipt_type="INVALID_TYPE")),
             expect="chk_payments_receipt_type")

    # 4) payments receipt_number 50자 초과 거부
    r.reject(conn, "payments receipt_number 50자 초과 거부",
             *ins("payments", dict(p_orig, id=new_id("pay"), pg_tx_id="tx_err_2", receipt_number="R" * 51)),
             expect="chk_payments_receipt_no")

    # 5) payments parent_payment_id 잘못된 접두사('ord_') 거부
    r.reject(conn, "payments parent_payment_id 잘못된 접두사('ord_') 거부",
             *ins("payments", dict(p_orig, id=new_id("pay"), pg_tx_id="tx_err_3", parent_payment_id=food_order["id"])),
             expect="chk_payments_parent_id")

    # 6) payments tax_free_amount / taxable_amount / vat_amount 음수 거부
    r.reject(conn, "payments tax_free_amount 음수(-1) 거부",
             *ins("payments", dict(p_orig, id=new_id("pay"), pg_tx_id="tx_err_4", tax_free_amount=-1)),
             expect="chk_payments_tax_free")
    r.reject(conn, "payments taxable_amount 음수(-1) 거부",
             *ins("payments", dict(p_orig, id=new_id("pay"), pg_tx_id="tx_err_5", taxable_amount=-1)),
             expect="chk_payments_taxable")
    r.reject(conn, "payments vat_amount 음수(-1) 거부",
             *ins("payments", dict(p_orig, id=new_id("pay"), pg_tx_id="tx_err_6", vat_amount=-1)),
             expect="chk_payments_vat")

    # 7) payments payment_status PARTIALLY_REFUNDED 허용 확인
    r.ok(conn, "payments payment_status PARTIALLY_REFUNDED 상태 허용",
         *ins("payments", dict(p_orig, id=new_id("pay"), pg_tx_id="tx_part_ref", payment_status="PARTIALLY_REFUNDED")))

    # 26.5 인덱스 검증 (idx_payments_parent, idx_payments_receipt)
    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM payments WHERE parent_payment_id = ?", (p_orig_id,))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_payments_parent" in plan, f"Expected idx_payments_parent, got: {plan}"
    r.ok(conn, "payments 원거래 추적 인덱스 (idx_payments_parent) 작동 검증", "SELECT 1", ())

    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM payments WHERE receipt_number = ?", ("REC-20261109-0013",))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_payments_receipt" in plan, f"Expected idx_payments_receipt, got: {plan}"
    r.ok(conn, "payments 영수증 번호 인덱스 (idx_payments_receipt) 작동 검증", "SELECT 1", ())

    # ------------------------------------------------------------------
    r.group("27. CS 분쟁조정·오배송 파손보상 및 악성리뷰 방어 무결성 (Section 27)")
    # 27.1 정상 주문 리뷰(음식평점 5점, 배달평점 4점 분리 평가) 등록 성공
    rev1_id = new_id("rev")
    rev1 = dict(
        id=rev1_id,
        order_id=gen_order["id"],
        buyer_user_id=F["usr1"],
        seller_type="STORE",
        store_id=F["str"],
        mart_id=None,
        product_rating=5,
        delivery_rating=4,
        content="음식도 따뜻하고 시니어 어르신께서 친절하게 배달해 주셨습니다.",
        review_photos_json='["review/rev1_photo1.webp"]',
        blind_status="NORMAL",
        blind_reason=None,
        blind_requested_at=None,
        blind_resolved_at=None,
        owner_reply="정성스러운 후기 감사합니다! 더 따뜻한 음식으로 보답하겠습니다.",
        owner_replied_at=NOW + 3600,
        created_at=NOW,
        updated_at=NOW,
    )
    r.ok(conn, "order_reviews 주문 평점 분리(음식5/배달4) 리뷰 등록 성공", *ins("order_reviews", rev1))

    # 27.2 악성 리뷰(별점 테러) 점주 24시간 블라인드 소명 요청 등록 성공
    rev2_id = new_id("rev")
    rev2 = dict(
        id=rev2_id,
        order_id=food_order["id"],
        buyer_user_id=F["usr2"],
        seller_type="STORE",
        store_id=F["str"],
        mart_id=None,
        product_rating=1,
        delivery_rating=1,
        content="사장 망해라 욕설 허위 비방",
        review_photos_json=None,
        blind_status="TEMPORARY_BLIND",
        blind_reason="근거 없는 악의적 욕설 비방 및 영업방해 행위로 24시간 임시 블라인드 요청",
        blind_requested_at=NOW + 1000,
        blind_resolved_at=None,
        owner_reply=None,
        owner_replied_at=None,
        created_at=NOW,
        updated_at=NOW + 1000,
    )
    r.ok(conn, "order_reviews 점주 24시간 임시 블라인드 소명 등록 성공", *ins("order_reviews", rev2))

    # 27.3 order_reviews 제약조건 검증
    # 1) 동일 주문 중복 리뷰 거부 (1 주문당 1 리뷰 제약)
    r.reject(conn, "order_reviews 1개 주문에 2번째 리뷰 중복 등록 거부",
             *ins("order_reviews", dict(rev1, id=new_id("rev"))),
             expect="UNIQUE constraint failed: order_reviews.order_id")

    # 2) 평점 1~5점 범위 벗어남 거부
    r.reject(conn, "order_reviews product_rating 0점 거부",
             *ins("order_reviews", dict(rev1, id=new_id("rev"), order_id=new_id("ord"), product_rating=0)),
             expect="chk_order_reviews_prd_rating")
    r.reject(conn, "order_reviews delivery_rating 6점 거부",
             *ins("order_reviews", dict(rev1, id=new_id("rev"), order_id=new_id("ord"), delivery_rating=6)),
             expect="chk_order_reviews_dlv_rating")

    # 3) 판매자(store_id / mart_id) 둘 다 존재 거부
    r.reject(conn, "order_reviews store_id 및 mart_id 동시 설정 거부",
             *ins("order_reviews", dict(rev1, id=new_id("rev"), order_id=new_id("ord"), mart_id=F["mrt"])),
             expect="chk_order_reviews_seller")

    # 4) blind_status 유효하지 않은 값 거부
    r.reject(conn, "order_reviews blind_status 유효하지 않은 값('DELETED') 거부",
             *ins("order_reviews", dict(rev1, id=new_id("rev"), order_id=new_id("ord"), blind_status="DELETED")),
             expect="chk_order_reviews_blind")

    # 27.4 delivery_claims (배달 사고 파손 보상 및 과책 분계) 등록 성공
    clm1_id = new_id("clm")
    clm1 = dict(
        id=clm1_id,
        order_id=gen_order["id"],
        delivery_session_id=dlv_senior_id,
        claim_type="SPILL_DAMAGE",
        fault_attribution="COURIER_FAULT",
        claim_status="APPROVED_REFUND",
        claimed_amount=25000,
        compensated_amount=25000,
        compensation_type="POINT_GRANT",
        claim_photos_json='["claim/spill_photo_01.webp"]',
        customer_memo="국물이 절반 이상 쏟아져서 왔습니다.",
        investigation_memo="라이더 배송 완료 사진 대조 결과 급제동으로 인한 용기 파손 확인. 라이더 과책 판정 및 고객 포인트 전액 환불 완료.",
        created_at=NOW,
        settled_at=NOW + 1800,
    )
    r.ok(conn, "delivery_claims 음식 쏟아짐(라이더 과책) 판정 및 포인트 보상 등록 성공", *ins("delivery_claims", clm1))

    # 27.5 delivery_claims 제약조건 검증
    # 1) claimed_amount 0 이하 거부
    r.reject(conn, "delivery_claims claimed_amount 0원 거부",
             *ins("delivery_claims", dict(clm1, id=new_id("clm"), claimed_amount=0)),
             expect="chk_delivery_claims_claimed_amt")

    # 2) claim_type 유효하지 않은 값 거부
    r.reject(conn, "delivery_claims claim_type 유효하지 않은 값('COLD_FOOD') 거부",
             *ins("delivery_claims", dict(clm1, id=new_id("clm"), claim_type="COLD_FOOD")),
             expect="chk_delivery_claims_type")

    # 3) fault_attribution 유효하지 않은 값 거부
    r.reject(conn, "delivery_claims fault_attribution 유효하지 않은 값('GHOST_FAULT') 거부",
             *ins("delivery_claims", dict(clm1, id=new_id("clm"), fault_attribution="GHOST_FAULT")),
             expect="chk_delivery_claims_fault")

    # 27.6 인덱스 검증
    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM order_reviews WHERE store_id = ?", (F["str"],))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_order_reviews_store" in plan, f"Expected idx_order_reviews_store, got: {plan}"
    r.ok(conn, "order_reviews 가맹점별 리뷰 조회 인덱스 (idx_order_reviews_store) 작동 검증", "SELECT 1", ())

    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM delivery_claims WHERE fault_attribution = ?", ("COURIER_FAULT",))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_delivery_claims_fault" in plan, f"Expected idx_delivery_claims_fault, got: {plan}"
    r.ok(conn, "delivery_claims 과책 판정별 인덱스 (idx_delivery_claims_fault) 작동 검증", "SELECT 1", ())

    # ------------------------------------------------------------------
    r.group("28. 카카오 알림톡·0504 안심번호 수명주기 및 CRM 무결성 (Section 28)")
    # 28.1 0504 가상 안심번호 바인딩(배달 완료 1시간 후 만료) 등록 성공
    vnm1_id = new_id("vnm")
    vnm1 = dict(
        id=vnm1_id,
        virtual_phone="050412345678",
        order_id=gen_order["id"],
        real_customer_phone_enc=fake_enc("01011112222"),
        real_customer_phone_hmac=hmac_hex("01011112222"),
        real_driver_phone_enc=fake_enc("01099998888"),
        real_driver_phone_hmac=hmac_hex("01099998888"),
        status="BOUND",
        bound_at=NOW,
        expires_at=NOW + 3600,
        released_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    r.ok(conn, "virtual_numbers 0504 안심번호 바인딩(1시간 유효) 등록 성공", *ins("virtual_numbers", vnm1))

    # 28.2 0504 안심번호 1시간 경과 후 자동 해제(AVAILABLE 풀 반환) 검증
    r.ok(conn, "virtual_numbers 1시간 만료 후 번호 풀 반환(AVAILABLE) 갱신 성공",
         "UPDATE virtual_numbers SET status = 'AVAILABLE', released_at = ? WHERE id = ?",
         (NOW + 3600, vnm1_id))

    # 28.3 virtual_numbers 제약조건 검증
    # 1) 050으로 시작하지 않는 가상번호 거부
    r.reject(conn, "virtual_numbers 050이 아닌 가상번호('01012345678') 거부",
             *ins("virtual_numbers", dict(vnm1, id=new_id("vnm"), virtual_phone="01012345678")),
             expect="chk_virtual_phone")

    # 2) status 유효하지 않은 값 거부
    r.reject(conn, "virtual_numbers status 유효하지 않은 값('LOCKED') 거부",
             *ins("virtual_numbers", dict(vnm1, id=new_id("vnm"), virtual_phone="050488889999", status="LOCKED")),
             expect="chk_vnum_status")

    # 28.4 카카오 알림톡 정상 발송 로그 등록 성공
    msg1_id = new_id("msg")
    msg1 = dict(
        id=msg1_id,
        order_id=gen_order["id"],
        recipient_user_id=F["usr1"],
        recipient_phone_hmac=hmac_hex("01011112222"),
        channel="ALIMTALK",
        template_code="AITIP_DLV_START",
        title="[AITIP] 배달이 시작되었습니다",
        content="고객님의 주문이 시니어 배송단 어르신을 통해 안전하게 배달 출발하였습니다. 예상 도착시간: 15분 후",
        fallback_flag=0,
        send_status="DELIVERED",
        created_at=NOW,
    )
    r.ok(conn, "message_logs 카카오 알림톡(배달출발) 발송 성공 로그 등록", *ins("message_logs", msg1))

    # 28.5 카카오톡 미수신 시 이동통신사 SMS 폴백 발송 로그 등록 성공
    msg2_id = new_id("msg")
    msg2 = dict(
        id=msg2_id,
        order_id=gen_order["id"],
        recipient_user_id=F["usr1"],
        recipient_phone_hmac=hmac_hex("01011112222"),
        channel="SMS",
        template_code="AITIP_DLV_COMPLETED",
        title=None,
        content="[AITIP 배달완료] 고객님 문앞에 배달이 완료되었습니다. 사진확인: https://aitip.kr/pod/01",
        fallback_flag=1,
        send_status="DELIVERED",
        created_at=NOW + 900,
    )
    r.ok(conn, "message_logs 알림톡 실패 후 SMS 폴백(fallback_flag=1) 발송 성공 로그 등록", *ins("message_logs", msg2))

    # 28.6 message_logs 제약조건 검증
    # 1) channel 유효하지 않은 값 거부
    r.reject(conn, "message_logs channel 유효하지 않은 값('PUSH') 거부",
             *ins("message_logs", dict(msg1, id=new_id("msg"), channel="PUSH")),
             expect="chk_msg_channel")

    # 2) recipient_phone_hmac 64자 hex 형식 불일치 거부
    r.reject(conn, "message_logs recipient_phone_hmac 형식 오류 거부",
             *ins("message_logs", dict(msg1, id=new_id("msg"), recipient_phone_hmac="invalid_hmac")),
             expect="chk_msg_phone_hmac")

    # 28.7 인덱스 검증
    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM virtual_numbers WHERE status = ?", ("AVAILABLE",))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_vnum_status" in plan, f"Expected idx_vnum_status, got: {plan}"
    r.ok(conn, "virtual_numbers 상태별 가용 풀 인덱스 (idx_vnum_status) 작동 검증", "SELECT 1", ())

    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM message_logs WHERE recipient_phone_hmac = ?", (hmac_hex("01011112222"),))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_message_logs_phone" in plan, f"Expected idx_message_logs_phone, got: {plan}"
    r.ok(conn, "message_logs 수신자 전화번호별 발송이력 인덱스 (idx_message_logs_phone) 작동 검증", "SELECT 1", ())

    # ------------------------------------------------------------------
    r.group("29. 스마트 단말기 MDM 텔레메트리 및 OTA 무중단 펌웨어 무결성 (Section 29)")
    # 29.1 devices 테이블 용지상태(PAPER_EMPTY) 및 A/B 활성파티션(B) 갱신 성공
    r.ok(conn, "devices 용지부족(PAPER_EMPTY) 및 파티션B 정상 갱신",
         "UPDATE devices SET paper_status = 'PAPER_EMPTY', active_partition = 'B' WHERE id = ?",
         (F["dev"],))

    # 29.2 devices 제약조건 검증
    # 1) paper_status 잘못된 값 거부
    r.reject(conn, "devices paper_status 유효하지 않은 값('BROKEN') 거부",
             "UPDATE devices SET paper_status = 'BROKEN' WHERE id = ?",
             (F["dev"],), expect="chk_devices_paper")

    # 2) active_partition 잘못된 값 거부
    r.reject(conn, "devices active_partition 유효하지 않은 값('C') 거부",
             "UPDATE devices SET active_partition = 'C' WHERE id = ?",
             (F["dev"],), expect="chk_devices_partition")

    # 29.3 device_telemetry_logs 정상 등록 성공
    tel1_id = new_id("tel")
    tel1 = dict(
        id=tel1_id,
        device_id=F["dev"],
        paper_status="NORMAL",
        network_type="ETHERNET",
        cpu_temp_celsius=52.5,
        memory_usage_pct=45,
        storage_usage_pct=30,
        created_at=NOW,
    )
    r.ok(conn, "device_telemetry_logs 정상 텔레메트리 로그 등록 성공", *ins("device_telemetry_logs", tel1))

    # 29.4 device_telemetry_logs 제약조건 검증
    # 1) cpu_temp_celsius 허용범위 초과(150도) 거부
    r.reject(conn, "device_telemetry_logs CPU 온도 120도 초과(150) 거부",
             *ins("device_telemetry_logs", dict(tel1, id=new_id("tel"), cpu_temp_celsius=150.0)),
             expect="chk_telem_temp")

    # 2) memory_usage_pct 허용범위 초과(105%) 거부
    r.reject(conn, "device_telemetry_logs 메모리 점유율 100% 초과(105) 거부",
             *ins("device_telemetry_logs", dict(tel1, id=new_id("tel"), memory_usage_pct=105)),
             expect="chk_telem_mem")

    # 29.5 firmware_releases OTA 펌웨어 릴리즈 등록 성공
    frm1_id = new_id("frm")
    frm1 = dict(
        id=frm1_id,
        firmware_version="v1.4.2",
        target_hardware="RPI_4B",
        binary_r2_key="firmware/aitip-os-v1.4.2-rpi4b.img.gz",
        binary_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        is_critical=1,
        release_status="CANARY",
        release_notes="ESC/POS 주방전표 인쇄 속도 30% 개선 및 0504 안심번호 음성 통화 안정화",
        created_at=NOW,
    )
    r.ok(conn, "firmware_releases 카나리 OTA 펌웨어 등록 성공", *ins("firmware_releases", frm1))

    # 29.6 firmware_releases 제약조건 검증
    # 1) binary_sha256 64자 불일치 거부
    r.reject(conn, "firmware_releases SHA256 체크섬 형식 오류 거부",
             *ins("firmware_releases", dict(frm1, id=new_id("frm"), firmware_version="v1.4.3", binary_sha256="short_sha")),
             expect="chk_firmware_sha")

    # 2) target_hardware 유효하지 않은 하드웨어 거부
    r.reject(conn, "firmware_releases 유효하지 않은 하드웨어('ARDUINO_UNO') 거부",
             *ins("firmware_releases", dict(frm1, id=new_id("frm"), firmware_version="v1.4.4", target_hardware="ARDUINO_UNO")),
             expect="chk_firmware_hw")

    # 29.7 인덱스 검증
    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM device_telemetry_logs WHERE device_id = ?", (F["dev"],))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_dev_telem_device" in plan, f"Expected idx_dev_telem_device, got: {plan}"
    r.ok(conn, "device_telemetry_logs 단말기별 텔레메트리 인덱스 (idx_dev_telem_device) 작동 검증", "SELECT 1", ())

    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM firmware_releases WHERE target_hardware = ? AND release_status = ?", ("RPI_4B", "CANARY"))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_firmware_hw_status" in plan, f"Expected idx_firmware_hw_status, got: {plan}"
    r.ok(conn, "firmware_releases 롤아웃 상태 인덱스 (idx_firmware_hw_status) 작동 검증", "SELECT 1", ())

    # ------------------------------------------------------------------
    r.group("30. 가맹점 경영분석 BI·공헌이익 및 수요예측 자동발주 무결성 (Section 30)")
    # 30.1 merchant_daily_bi_snapshots 정상 등록 성공
    bi1_id = new_id("bis")
    bi1 = dict(
        id=bi1_id,
        seller_type="STORE",
        store_id=F["str"],
        mart_id=None,
        business_date=BDATE,
        total_orders_count=45,
        gross_sales_amount=1200000,
        total_food_cost_amount=420000,
        total_packaging_cost_amount=60000,
        estimated_gross_profit=720000,
        profit_margin_pct=60.0,
        top_selling_product_id=F["prd_s"],
        created_at=NOW,
    )
    r.ok(conn, "merchant_daily_bi_snapshots 일간 공헌이익(마진 60%) BI 스냅샷 등록 성공", *ins("merchant_daily_bi_snapshots", bi1))

    # 30.2 merchant_daily_bi_snapshots 제약조건 검증
    # 1) seller_type 불일치(store_id/mart_id 둘 다 존재) 거부
    r.reject(conn, "merchant_daily_bi_snapshots store_id 및 mart_id 동시 설정 거부",
             *ins("merchant_daily_bi_snapshots", dict(bi1, id=new_id("bis"), business_date="2026-11-08", mart_id=F["mrt"])),
             expect="chk_bi_seller")

    # 2) gross_sales_amount 음수 거부
    r.reject(conn, "merchant_daily_bi_snapshots gross_sales_amount 음수 거부",
             *ins("merchant_daily_bi_snapshots", dict(bi1, id=new_id("bis"), business_date="2026-11-08", gross_sales_amount=-1)),
             expect="chk_bi_gross_sales")

    # 3) total_food_cost_amount 음수 거부
    r.reject(conn, "merchant_daily_bi_snapshots total_food_cost_amount 음수 거부",
             *ins("merchant_daily_bi_snapshots", dict(bi1, id=new_id("bis"), business_date="2026-11-08", total_food_cost_amount=-1)),
             expect="chk_bi_food_cost")

    # 30.3 inventory_demand_forecasts 정상 등록 성공
    fcs1_id = new_id("fcs")
    fcs1 = dict(
        id=fcs1_id,
        seller_type="STORE",
        store_id=F["str"],
        mart_id=None,
        product_id=F["prd_s"],
        forecast_target_date="2026-11-08",
        predicted_sales_qty=25,
        recommended_order_qty=30,
        confidence_score=0.92,
        weather_condition="RAIN_SHOWER",
        created_at=NOW,
    )
    r.ok(conn, "inventory_demand_forecasts 기상 연동 AI 발주 추천 등록 성공", *ins("inventory_demand_forecasts", fcs1))

    # 30.4 inventory_demand_forecasts 제약조건 검증
    # 1) predicted_sales_qty 음수 거부
    r.reject(conn, "inventory_demand_forecasts predicted_sales_qty 음수 거부",
             *ins("inventory_demand_forecasts", dict(fcs1, id=new_id("fcs"), forecast_target_date="2026-11-09", predicted_sales_qty=-1)),
             expect="chk_fcs_pred_qty")

    # 2) confidence_score 1.0 초과 거부
    r.reject(conn, "inventory_demand_forecasts confidence_score 1.0 초과 거부",
             *ins("inventory_demand_forecasts", dict(fcs1, id=new_id("fcs"), forecast_target_date="2026-11-09", confidence_score=1.5)),
             expect="chk_fcs_confidence")

    # 3) forecast_target_date 날짜 형식 불일치 거부
    r.reject(conn, "inventory_demand_forecasts 날짜 형식 불일치 거부",
             *ins("inventory_demand_forecasts", dict(fcs1, id=new_id("fcs"), forecast_target_date="20261109")),
             expect="chk_fcs_target_date")

    # 30.5 인덱스 검증
    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM merchant_daily_bi_snapshots WHERE store_id = ? AND business_date = ?", (F["str"], BDATE))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "idx_bi_store_date" in plan, f"Expected idx_bi_store_date, got: {plan}"
    r.ok(conn, "merchant_daily_bi_snapshots 가맹점 일자별 BI 인덱스 (idx_bi_store_date) 작동 검증", "SELECT 1", ())

    cur = conn.execute("EXPLAIN QUERY PLAN SELECT id FROM inventory_demand_forecasts WHERE product_id = ? AND forecast_target_date = ?", (F["prd_s"], "2026-11-08"))
    plan = " ".join(row[3] for row in cur.fetchall())
    assert "uq_forecast_product_date" in plan, f"Expected uq_forecast_product_date, got: {plan}"
    r.ok(conn, "inventory_demand_forecasts 상품별 일자 유니크 인덱스 (uq_forecast_product_date) 작동 검증", "SELECT 1", ())

    conn.close()
    return r.finish()


if __name__ == "__main__":
    sys.exit(main())
