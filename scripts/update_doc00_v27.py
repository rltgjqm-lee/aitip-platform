import sys

def main():
    doc00_path = "docs/DOC-00_AITIP_통합_UID_체계_표준_명세서.md"
    with open(doc00_path, "r", encoding="utf-8") as f:
        text = f.read()

    old_table_header = "## 3. AITIP 25대 도메인 접두사(Prefix) 표준 정의표"
    new_table_header = "## 3. AITIP 27대 도메인 접두사(Prefix) 표준 정의표"

    old_row_bar = "| **공유 바코드**  | `bar_` | 30자 | `bar_01jcbk9v4e2x8m4v0k5a1b2c46` | 식약처 무료 공공데이터 및 가맹점 공유 바코드 캐시 |"
    new_rows = """| **공유 바코드**  | `bar_` | 30자 | `bar_01jcbk9v4e2x8m4v0k5a1b2c46` | 식약처 무료 공공데이터 및 가맹점 공유 바코드 캐시 |
| **매입처/OEM**  | `sup_` | 30자 | `sup_01jcbk9v4e2x8m4v0k5a1b2c47` | 로컬 영농조합, 공산품 도매상, AITIP OEM 제조사 |
| **반품/폐기원장**| `ret_` | 30자 | `ret_01jcbk9v4e2x8m4v0k5a1b2c48` | 고객 반품, 매입처 파손 반품, 신선식품 감모 폐기 원장 |"""

    if old_table_header in text:
        text = text.replace(old_table_header, new_table_header)
    if old_row_bar in text:
        text = text.replace(old_row_bar, new_rows)

    with open(doc00_path, "w", encoding="utf-8") as f:
        f.write(text)

    print("DOC-00 updated with 27 TypeID prefixes.")

if __name__ == "__main__":
    main()
