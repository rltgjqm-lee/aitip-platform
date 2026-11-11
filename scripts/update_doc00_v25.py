import sys

def main():
    doc00_path = "docs/DOC-00_AITIP_통합_UID_체계_표준_명세서.md"
    with open(doc00_path, "r", encoding="utf-8") as f:
        text = f.read()

    old_table_header = "## 3. AITIP 24대 도메인 접두사(Prefix) 표준 정의표"
    new_table_header = "## 3. AITIP 25대 도메인 접두사(Prefix) 표준 정의표"

    old_row_cns = "| **약관 동의이력**| `cns_` | 30자 | `cns_01jcbk9v4e2x8m4v0k5a1b2c45` | 전자상거래법 이용약관 및 개인정보 동의 이력 |"
    new_rows = """| **약관 동의이력**| `cns_` | 30자 | `cns_01jcbk9v4e2x8m4v0k5a1b2c45` | 전자상거래법 이용약관 및 개인정보 동의 이력 |
| **공유 바코드**  | `bar_` | 30자 | `bar_01jcbk9v4e2x8m4v0k5a1b2c46` | 식약처 무료 공공데이터 및 가맹점 공유 바코드 캐시 |"""

    if old_table_header in text:
        text = text.replace(old_table_header, new_table_header)
    if old_row_cns in text:
        text = text.replace(old_row_cns, new_rows)

    with open(doc00_path, "w", encoding="utf-8") as f:
        f.write(text)

    print("DOC-00 updated with 25 TypeID prefixes.")

if __name__ == "__main__":
    main()
