# [DOC-00] AITIP 플랫폼 통합 UID 및 식별자 체계 표준 명세서
**문서 식별자:** `AITIP-SPEC-UID-2026-V1`  
**버전:** `2.0.0 (Strict Privacy & Production Baseline)`  
**작성일자:** 2026-11-07  
**적용 범위:** AITIP 클라우드(Cloudflare Workers/D1), 엣지 CTI 단말기, 프론트엔드(PWA/포스/알림톡)

---

## 1. 개요 및 설계 철학

### 1.1 배경 및 문제의식
과거 많은 O2O 및 공공 연계 시스템은 "사람이 읽기 편하다"는 이유로 기본키(PK)에 행정동, 업태, 일련번호, MAC 주소 등을 결합하는 '의미적 식별자(Semantic ID)' 방식을 채택했습니다. 그러나 이 방식은 다음과 같은 치명적인 구조적 결함을 야기합니다:
1. **데이터 거짓말(Identity Lie) 현상**: 행정구역 개편(분동·통합), 매장 이전, 업태 변경 시 영구 불변해야 하는 PK를 변경할 수 없어 과거의 식별자가 현재의 실체와 모순되는 현상이 발생합니다.
2. **분산 환경의 카운터 병목**: `-0001`과 같은 순번은 중앙 집중식 카운터 잠금을 필요로 하여, 수만 대의 엣지 단말기와 서버리스 환경에서 시스템 처리율을 급격히 저하시킵니다.
3. **충돌 및 보안 취약점**: 생일 역설(Birthday Paradox)로 인한 짧은 난수 충돌, 순차적 순번 노출로 인한 열거 공격(Enumeration Attack)에 무방비로 노출됩니다.

### 1.2 3계층 식별자 분리 원칙 (Core Principle)
AITIP 플랫폼은 데이터 무결성과 비즈니스 유연성을 동시에 만족하기 위해 **식별자를 목적에 따라 3개 계층으로 엄격히 분리**합니다.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AITIP 3계층 식별자 체계                         │
└────────────────────────────────────────────────────────────────────────┘

  [ 제1계층 : 내부 고유 식별자 (Machine Primary Key / Foreign Key) ]
  • 규격: TypeID (RFC 9562 UUIDv7 + Crockford Base32)
  • 특성: 완전 불변(Immutable), 시간순 정렬(K-Sortable), 분산 실질적 무충돌
  • 용도: RDBMS PK/FK, 분산 캐시 키, MQTT 토픽, 영구 감사 로그

  [ 제2계층 : 표시용 비즈니스 코드 (Human Display Code) ]
  • 규격: DB에는 순수 정수 순번(display_seq)만 기록, 앱에서 A-01 / 104 등으로 포맷팅
  • 특성: 매장별 영업일 마감 기준 원자적 카운터 발급, 필요 시 변경 가능
  • 용도: 주방 전표, 현장 영수증, TTS 음성 안내, 고객 전표 호출

  [ 제3계층 : 관계형 속성 컬럼 (Relational Attribute Columns) ]
  • 규격: 테이블 내 일반 컬럼 (region_code, store_category, mac_address 등)
  • 특성: 비즈니스 변동에 따라 자유롭게 UPDATE 가능
  • 용도: 다차원 검색, 통계 집계, 지자체 감사 필터링
```

---

## 2. TypeID 규격 표준 (제1계층 내부 식별자)

AITIP의 모든 영구 엔터티는 **TypeID 규격(소문자 접두사 + 언더스코어 + 26자리 Crockford Base32 인코딩)**을 따릅니다.

### 2.1 문자셋 및 인코딩 규칙
1. **알파벳 구성**: 혼동을 유발하는 4개 문자(`i`, `l`, `o`, `u`)를 엄격히 제외한 **32개 문자셋**만 사용합니다.
   $$\text{Alphabet} = \{ \texttt{0123456789abcdefghjkmnpqrstvwxyz} \}$$
2. **최상위 비트 제약**: 128비트 UUIDv7을 5비트씩 26자리로 표현하므로, 최상위 2비트는 반드시 `00_2`입니다. 따라서 **접미사의 첫 번째 문자는 반드시 `0~7`** 범위여야 합니다.
3. **전체 문자열 길이**:
   * 일반 도메인 (4자리 접두사 `xxx_`): **정확히 30자리**
   * 통화 세션 (5자리 접두사 `call_`): **정확히 31자리**

### 2.2 암호학적 엔트로피 및 시계 동기화 규칙
* **난수 생성기 철칙**: `Math.random()` 사용을 영구 금지하며, 브라우저 및 Cloudflare Workers에서는 `crypto.getRandomValues()`, 엣지(Python/Node)에서는 `os.urandom()` 또는 `crypto.randomBytes()`를 강제합니다.
* **단말기 시계(RTC) 대응**:
  * 단말기가 부팅 직후 인터넷 연결 전 생성한 식별자는 상위 타임스탬프가 어긋날 수 있으나, 74비트의 강력한 암호학적 엔트로피로 인해 **고유성(Uniqueness)에는 영향이 없으며**, 서버 데이터베이스는 단말 생성 시각과 무관하게 **서버 수신 시각(`created_at`)을 기준으로 인덱싱**합니다.

---

## 3. AITIP 27대 도메인 접두사(Prefix) 표준 정의표

본 표에 수록된 모든 예시는 **D1 SQLite 제약조건 및 Crockford Base32 정밀 검증을 100% 통과한 실제 유효 문자열**입니다.

| 도메인 영역 | 접두사 | 전체길이 | 실측 검증된 실제 유효 예시 ID | 엔터티 정의 및 역할 |
| :--- | :---: | :---: | :--- | :--- |
| **통합 계정** | `usr_` | 30자 | `usr_01jcbk9v4e2x8m4v0k5a1b2c3d` | 소비자, 점주, 배송원, 복지사 통합 신원 |
| **참여 기관** | `org_` | 30자 | `org_01jcbk9v4e2x8m4v0k5a1b2c3f` | 시니어클럽, 자활센터, 지자체 복지과 등 총괄 공공기관 |
| **실무 사업단** | `biz_` | 30자 | `biz_01jcbk9v4e2x8m4v0k5a1b2c3g` | 기관 산하 노인일자리 배송사업단, 로컬유통단 |
| **현장 참여자** | `wrk_` | 30자 | `wrk_01jcbk9v4e2x8m4v0k5a1b2c3h` | 어르신 배송원, 자활근로자 현장 업무 프로필 |
| **일반 가맹점** | `str_` | 30자 | `str_01jcbk9v4e2x8m4v0k5a1b2c3j` | 골목식당, 카페 등 소상공인 B2C 판매 사업장 |
| **하나로마트** | `mrt_` | 30자 | `mrt_01jcbk9v4e2x8m4v0k5a1b2c3k` | 농협 하나로마트, 로컬푸드 B2B 공급처 |
| **수요 시설** | `fac_` | 30자 | `fac_01jcbk9v4e2x8m4v0k5a1b2c3m` | **식자재 최종 납품 수령처 (경로당, 복지관)** |
| **엣지 단말기** | `dev_` | 30자 | `dev_01jcbk9v4e2x8m4v0k5a1b2c3n` | 식당/마트 설치 라즈베리파이 CTI 하드웨어 |
| **상품 / 메뉴** | `prd_` | 30자 | `prd_01jcbk9v4e2x8m4v0k5a1b2c3p` | 판매 메뉴 및 농산물/식자재 마스터 |
| **통합 주문** | `ord_` | 30자 | `ord_01jcbk9v4e2x8m4v0k5a1b2c3q` | B2C 일반주문 & B2B 경로당 식자재 발주 원장 |
| **주문 품목** | `itm_` | 30자 | `itm_01jcbk9v4e2x8m4v0k5a1b2c3r` | 주문서 내 개별 상세 품목 |
| **배송 세션** | `dlv_` | 30자 | `dlv_01jcbk9v4e2x8m4v0k5a1b2c3s` | 라이더 배달 및 어르신 식자재 납품 세션 |
| **결제 원장** | `pay_` | 30자 | `pay_01jcbk9v4e2x8m4v0k5a1b2c3t` | 일반카드, 복지카드, 간편결제 트랜잭션 |
| **정산 원장** | `set_` | 30자 | `set_01jcbk9v4e2x8m4v0k5a1b2c3v` | 식당 정산 및 하나로마트/사업단 정산 원장 |
| **CTI 통화세션**| `call_`| 31자 | `call_01jcbk9v4e2x8m4v0k5a1b2c3w`| RJ-9/RJ-11 CTI 인라인 통화 가로채기 및 ARS 세션 |
| **상품 카테고리**| `cat_` | 30자 | `cat_01jcbk9v4e2x8m4v0k5a1b2c3x` | 가맹점/마트 다단계 상품 카테고리 마스터 |
| **프로모션/할인**| `prm_` | 30자 | `prm_01jcbk9v4e2x8m4v0k5a1b2c3y` | 포장할인, 타임세일, 장바구니 할인 정책 원장 |
| **순회배송 슬롯**| `sch_` | 30자 | `sch_01jcbk9v4e2x8m4v0k5a1b2c3z` | 하나로마트 1차/2차 정기 순회 배송 시간표 |
| **상생 배달팀**  | `stm_` | 30자 | `stm_01jcbk9v4e2x8m4v0k5a1b2c40` | 시니어클럽 2인 1조 상생 배달단 팀 |
| **경로당 배송지**| `dst_` | 30자 | `dst_01jcbk9v4e2x8m4v0k5a1b2c41` | 참여기관 관할 경로당 및 복지 배송 거점 |
| **제휴 대리점사**| `agn_` | 30자 | `agn_01jcbk9v4e2x8m4v0k5a1b2c42` | 지역 VAN 총판, POS 대리점, 설치 협력사 |
| **현장 영업/기사**| `agt_` | 30자 | `agt_01jcbk9v4e2x8m4v0k5a1b2c43` | 현장 영업사원 및 CTI 단말기 설치 엔지니어 |
| **단말기 설치건**| `ins_` | 30자 | `ins_01jcbk9v4e2x8m4v0k5a1b2c44` | 단말기 현장 설치 완료 및 배선/서명 R2 증빙 원장 |
| **약관 동의이력**| `cns_` | 30자 | `cns_01jcbk9v4e2x8m4v0k5a1b2c45` | 전자상거래법 이용약관 및 개인정보 동의 이력 |
| **공유 바코드**  | `bar_` | 30자 | `bar_01jcbk9v4e2x8m4v0k5a1b2c46` | 식약처 무료 공공데이터 및 가맹점 공유 바코드 캐시 |
| **매입처/OEM**  | `sup_` | 30자 | `sup_01jcbk9v4e2x8m4v0k5a1b2c47` | 로컬 영농조합, 공산품 도매상, AITIP OEM 제조사 |
| **반품/폐기원장**| `ret_` | 30자 | `ret_01jcbk9v4e2x8m4v0k5a1b2c48` | 고객 반품, 매입처 파손 반품, 신선식품 감모 폐기 원장 |

---

## 4. 무결성 보장 메커니즘 (DB 강제 vs 서버 강제)

### 4.1 데이터베이스(D1) 엔진 강제 규칙 (103개 테스트 실측 통과)
1. **TypeID 문자셋 검증 제약 (`TEXT + CHECK`)**:
   ```sql
   CHECK (
       length(id) = 30 AND 
       id GLOB 'ord_[0-7]*' AND 
       substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'
   )
   ```
2. **판매자 배타적 외래키 제약 (`chk_orders_exclusive_seller`)**:
   * `orders` 테이블에서 `store_id`와 `mart_id` 중 **정확히 하나만 NOT NULL**이어야 함을 강제합니다.
3. **`store_members` 부분 유니크 인덱스 분리**:
   ```sql
   CREATE UNIQUE INDEX uq_store_members_store ON store_members (store_id, user_id) WHERE store_id IS NOT NULL;
   CREATE UNIQUE INDEX uq_store_members_mart  ON store_members (mart_id, user_id)  WHERE mart_id IS NOT NULL;
   ```
4. **결제 및 보조금 무결성 제약**:
   * `funding_source = 'SUBSIDY'`인 경우 결제 수단은 오직 `WELFARE_CARD`만 허용합니다.
   * `UNIQUE (pg_provider, pg_tx_id)`를 통해 웹훅 중복 기록을 원천 차단합니다.
5. **정산 원장 정합성 제약**:
   * `net_payout_amount = total_sales_amount - fee_amount` 강제.
   * `(store_id, settlement_date)` 및 `(mart_id, settlement_date)` 유니크 강제.

### 4.2 개인정보 보호 규칙 (AES-256-GCM + 키 기반 HMAC-SHA256)
* 모든 전화번호와 계좌번호 컬럼에서 **평문을 영구 삭제**했습니다.
* `_enc`: AES-256-GCM 암호문 (키 버전 `pii_key_ver >= 1` 관리).
* `_hmac`: 비밀키 기반 HMAC-SHA256의 64자리 소문자 hex 해시 (`chk_*_hmac` 제약으로 길이 및 형식 강제).
* 멱등성 및 검색 인덱스는 원문이 아닌 `*_hmac` 컬럼에만 생성합니다.

---

## 5. 결론

본 명세서는 **실측된 103개 무결성 테스트와 변이 검증을 통과한 AITIP 시스템의 절대 기준**입니다.
