import sys

def main():
    doc00_path = "docs/DOC-00_AITIP_통합_UID_체계_표준_명세서.md"
    with open(doc00_path, "r", encoding="utf-8") as f:
        text = f.read()

    old_table_header = "## 3. AITIP 15대 도메인 접두사(Prefix) 표준 정의표"
    new_table_header = "## 3. AITIP 24대 도메인 접두사(Prefix) 표준 정의표"

    old_row_call = "| **CTI 통화세션**| `call_`| 31자 | `call_01jcbk9v4e2x8m4v0k5a1b2c3w`| SIP 인라인 통화 가로채기 및 ARS 세션 |"
    
    new_rows = """| **CTI 통화세션**| `call_`| 31자 | `call_01jcbk9v4e2x8m4v0k5a1b2c3w`| RJ-9/RJ-11 CTI 인라인 통화 가로채기 및 ARS 세션 |
| **상품 카테고리**| `cat_` | 30자 | `cat_01jcbk9v4e2x8m4v0k5a1b2c3x` | 가맹점/마트 다단계 상품 카테고리 마스터 |
| **프로모션/할인**| `prm_` | 30자 | `prm_01jcbk9v4e2x8m4v0k5a1b2c3y` | 포장할인, 타임세일, 장바구니 할인 정책 원장 |
| **순회배송 슬롯**| `sch_` | 30자 | `sch_01jcbk9v4e2x8m4v0k5a1b2c3z` | 하나로마트 1차/2차 정기 순회 배송 시간표 |
| **상생 배달팀**  | `stm_` | 30자 | `stm_01jcbk9v4e2x8m4v0k5a1b2c40` | 시니어클럽 2인 1조 상생 배달단 팀 |
| **경로당 배송지**| `dst_` | 30자 | `dst_01jcbk9v4e2x8m4v0k5a1b2c41` | 참여기관 관할 경로당 및 복지 배송 거점 |
| **제휴 대리점사**| `agn_` | 30자 | `agn_01jcbk9v4e2x8m4v0k5a1b2c42` | 지역 VAN 총판, POS 대리점, 설치 협력사 |
| **현장 영업/기사**| `agt_` | 30자 | `agt_01jcbk9v4e2x8m4v0k5a1b2c43` | 현장 영업사원 및 CTI 단말기 설치 엔지니어 |
| **단말기 설치건**| `ins_` | 30자 | `ins_01jcbk9v4e2x8m4v0k5a1b2c44` | 단말기 현장 설치 완료 및 배선/서명 R2 증빙 원장 |
| **약관 동의이력**| `cns_` | 30자 | `cns_01jcbk9v4e2x8m4v0k5a1b2c45` | 전자상거래법 이용약관 및 개인정보 동의 이력 |"""

    if old_table_header in text:
        text = text.replace(old_table_header, new_table_header)
    if old_row_call in text:
        text = text.replace(old_row_call, new_rows)

    with open(doc00_path, "w", encoding="utf-8") as f:
        f.write(text)

    print("DOC-00 successfully updated with 24 TypeID prefixes.")

if __name__ == "__main__":
    main()
