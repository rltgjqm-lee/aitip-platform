# DOC-19: 전국 단위농협 하나로마트·일반마트 위탁운영 및 공동판매·공동구매 통합 연동 설계서

> **문서 상태**: 확장 설계 반영 (2026-11-17) · 전국 다점포 · 공동판매 · 공동구매 포함  
> **참조 문서**: `DOC-00` (통합 UID), `DOC-09` (하나로마트 다채널/위탁운영), `DOC-11` (품절 부분취소/보조금 대사), `DOC-18` (마스터 관리자)  
> **참조 실무 벤치마크**: 토마토솔루션(ERP 그리드/매니저/전단), 셀메이트 POS(재고 동기화), 데이타포스(POS-몰 양방향 연동)

---

## 0. 플랫폼 비전 및 범위 확장 (단일 마트 -> 전국 연합 상생 커머스)

본 시스템은 단일 마트의 온라인 장보기를 넘어, **전국 단위농협 하나로마트와 일반 동네·식자재마트가 함께 참여하는 연합 플랫폼**을 목표로 합니다.

1. **멀티 마트 참여 (`NH_HANARO` + `GENERAL_MART`)**
   - 단위농협 하나로마트뿐 아니라 지역 일반 마트·식자재마트도 동일한 표준 API·그리드·위탁 대행 체계로 입점 (`MRT-*` UID 격리).
2. **공동판매 (Nationwide Co-Selling · 지역 특산물 교차 판매)**
   - 산지 농협·지역 마트·생산자 조합이 보유한 특산물을 단일 점포에 가두지 않고, **전국 참여 마트 온라인 몰(`/mart/pwa/`)에 공동 진열·교차 판매**합니다.
   - 주문 발생 시 `공급 마트(산지 직납)`와 `판매/거점 마트(집화·홍보·픽업)` 간 **다자 정산 수수료가 자동 분배**됩니다.
3. **공동구매 (Group Buying · 기관 및 주민 물량 결집)**
   - **B2B 기관 공동구매**: 여러 경로당·복지관·요양원이 동일 품목(깐양파, 쌀, 절임배추, 공산품 등)을 공동구매 풀(`mgb_*`)에 모으면 목표 수량 도달 시 산지/도매 구간 단가(`tier_prices`)를 적용해 일괄 매입·분배합니다.
   - **B2C 지역 공동구매**: 일반 소비자가 일정 기간 내 목표 수량을 달성하면 특가 확정 후 거점 마트 수령 또는 권역 일괄 배송으로 물류비를 절감합니다.

---

## 1. 일반 쇼핑몰 어드민과 마트·급식 위탁 포털의 구조적 차이

일반 이커머스(카페24·스마트스토어)는 단일 택배 송장·정가 판매 중심이므로 오프라인 마트와 B2B 급식 현업 요구를 수용할 수 없습니다. 본 설계는 아래 5가지 마트 특화 요소를 1급 기능으로 내장합니다.

| 구분 | 일반 쇼핑몰 어드민 | AITIP 마트 위탁·급식 통합 설계 |
| :--- | :--- | :--- |
| **행사 구조** | 단일 상품 정률/정액 할인 | **이종 상품 골라담기**(`MIX_AND_MATCH`), `1+1`/`2+1`, **1인 한정 수량**(`limit_per_person`), 기간 자동 예약/원복 |
| **결제망 경계** | 단일 온라인 PG | **결제망 분리(`payment_scope`)**: `ONLINE_APPLICABLE`(온라인 몰 적용) vs `POS_ONLY`(매장 현장 카드·회원 전용가) |
| **일일 시세** | 상세페이지 개별 수정 | **순수 ESM 인라인 그리드(Grid UI)**: 새벽 경매가 반영을 위해 원가·판매가·행사가·재고·품절임계치 한 화면 일괄 수정 |
| **상품·규격** | 옵션/색상/사이즈 | **전처리 규격**(탈피/세척/슬라이스), 등급(`대/중/소`), 단위 환산(`1망=10봉`, `1판=12모`), **면세(`EXEMPT`)/과세(`TAXABLE`)** |
| **물류·피킹** | 택배 송장 출력 | **주문 1건당 단일 피킹 팀 처리**(중소형 마트 최적화) + **온도대 분리 박싱** + **실중량/결품 부분정정(DOC-11)** |

---

## 2. 4계층 통합 연동 아키텍처

1. **마트 연합 전용 PWA / 온라인 몰 (`/mart/pwa/` — 음식배달 `/food/pwa/`와 완전 분리)**
   - **`B2C_CONSUMER` (일반 소비자 기본 몰)**: 일반 온라인 마트 장보기 UI/UX를 기본으로 구성. 지역 마트 전단 특가·`1+1`·골라담기, `1인 N개 한정(limit_per_person)` 체크, **전국 특산물 공동판매관**, **우리동네 공동구매(예약 공구)**, 당일/예약 배송 및 단골 재주문 지원. (고령자 등 시력 보호 사용자를 위한 상단 토글 `큰 글씨/간편 보기` 옵션 제공)
   - **`B2B_FACILITY` (경로당·복지관·공동급식소)**: 전처리 규격·검수 기준 노출, 주간/격주 정기예약 발주, **기관 연합 공동구매 참여**, **기관 월말 후불 정산(세금계산서) 및 지자체 보조금/바우처 결제** 옵션 포함.
2. **마트·위탁 운영 관리자 (`packages/services/mart-logistics/mart-portal/`, `/mart/`)**
   - 다점포 마트 선택 컨텍스트 (`NH_HANARO` / `GENERAL_MART` 전환)
   - 전단·행사 Split View (좌측 전단 이미지 미리보기 + 우측 파싱 검수 및 `payment_scope` 태깅)
   - POS·일일시세 인라인 그리드 (토마토 ERP 스타일 헤더 필터 행 + 셀 직접 수정 + 일괄 저장)
   - **공동판매 상품 등록(`NATIONWIDE_CO_SELL`) 및 공동구매 캠페인 개설·달성 현황 관리**
   - 기관 전용 단가표·전처리 작업 지시서·관공서 직인 거래명세표
   - **주문 단위 단일 피킹(1 오더 = 1 피킹 팀)**·온도대별 박싱·결품/실중량 부분정정(`DOC-11`) *(단, `fulfillment_source`는 상품 확장성·클레임 귀책·정산 구분 속성으로 유지)*
3. **수퍼관리자 (`packages/platform-admin/`, `/admin/`)**
   - 전국 단위농협 하나로마트·일반 마트(`MRT-*`) · 위탁운영사 · 참여기관(`FAC-*`) 온보딩 및 여신/보조금 한도 승인
   - **전국 공동판매 카탈로그 승인 및 공동구매 목표달성/일괄발주(Procurement) 관제**
   - 통합 실시간 주문·분쟁 관제 (`mord_*`, `Zero-PII` / `0504` 안심번호)
   - **다자 정산**(공급 마트/산지 원가 + 판매 거점 수수료 + 위탁운영사 대행료 + 플랫폼 수수료) 및 과면세 세무 대사
4. **코어 백엔드 & 실시간 브리지**
   - `packages/services/mart-logistics/backend/mart-service.mjs` (`/api/mart/*`)
   - `packages/core/merchant-meta/mart-catalog-parser.mjs` (`FLYER` / `POS_CSV` / `PREP_SHEET`)
   - `packages/core/realtime/mqtt-bridge.mjs`

---

## 3. UID 체계 및 데이터 정합성 규칙 (`DOC-00`)

- **참여 마트 UID**: `MRT-{시도}-{시군구}-{유형}-{사업자}-{순번}` (`mart_type`: `NH_HANARO` | `GENERAL_MART`)
- **마트 관리자 / 사원 UID**: `{MRT-UID}-A{2자리}` (예: `MRT-11-650-01-47121-0001-A01`), `{MRT-UID}-U{3자리}` (예: `MRT-11-650-01-47121-0001-U001`)
- **참여 기관 UID**: `FAC-11-650-01-87391-0001`
- **상품 SKU UID**: `mrt_sku_*`, `mrt_pos_*`, `mrt_prep_*` (바코드 `880...` / 매장 PLU `200...` / 전처리 `290...` 보조키 매핑)
- **공동구매 캠페인 UID**: `mgb_*` (`OPEN` -> `GOAL_REACHED` -> `PROCUREMENT` -> `DISTRIBUTING` -> `SETTLED` / `EXPIRED_REFUND`)
- **마트 주문 UID**: `mord_*` (결품·실중량 정정 시 원주문 UID 유지, 정정 원장 `adj_*` 추가)
- **다자 정산 원장 UID**: `mstl_*` (면세/과세 및 공급마트·판매거점·위탁사·플랫폼 배분 금액 고정)

---

## 4. 단위 마트 상품 · 바코드 · 이미지 등록 표준 설계 (현업 기준선)

단위 마트가 실제로 상품을 등록할 때는 공산품과 1차 농축수산/전처리 상품의 바코드·이미지 확보 경로가 완전히 다르므로 아래 표준 파이프라인을 따릅니다.

### 4.1 바코드 3분류 및 자동 판별·조회 체계
1. **유통표준코드 (`880` GTIN-13 / EAN-13 — 가공식품·공산품)**
   - 스캐너 스캔 또는 POS CSV 유입 시 **플랫폼 중앙 상품 마스터 캐시** -> **한국식품안전관리인증원 HACCP 제품이미지·포장지표기정보 API**(공공데이터포털 무료 OpenAPI) -> **대한상공회의소 유통물류진흥원 코리안넷(GS1 Korea) 바코드 DB 제휴 API**(상용 계약 확장) 순으로 조회하여 `상품명 · 규격 · 제조사 · 표준 이미지 URL`을 자동 채움.
   - *(제외 근거)* 식약처 식품안전나라 '유통바코드' API는 2018년 이후 데이터 갱신이 중단되어 최신 상품 조회용으로 사용하지 않음.
2. **매장 저울 / 자체 PLU 바코드 (`20...`, `21...`, `99...` — 정육·청과·수산)**
   - 전자저울 출력 라벨(`[접두 2자리 + 매장 상품PLU 4~5자리 + 중량(g) 또는 금액(원) 5자리 + 체크디지트 1자리]`)은 바코드 전체를 SKU로 쓰지 않고 **상품PLU 구간만 추출해 SKU 키로 매핑**하며, 뒤 5자리는 실중량/금액 해독에 사용.
3. **전처리·예약 전용 코드 (`290...` — 대행 전처리·기관 급식)**
   - 탈피·세척·슬라이스 등 전처리 및 기관 발주 전용 내부 채번 코드.

### 4.2 상품 이미지 등록 4단계 우선순위 (`schema_r2_media_v01.sql` `med_*` 연동)
1. **1순위 (`BARCODE_DB`)**: `880` 바코드 조회 시 중앙 마스터 / HACCP / 코리안넷 표준 이미지 자동 매핑.
2. **2순위 (`COMMON_POOL`)**: 바코드 이미지가 없는 1차 농축수산·전처리 품목(양파·당근·대파·한돈 등)은 플랫폼 R2 공용 표준 이미지 풀에서 품목 키워드 기반으로 기본 썸네일 자동 연결.
3. **3순위 (`FLYER_CROP`)**: 전단 Split View 검수 화면에서 원본 전단 이미지의 해당 상품 영역을 선택(크롭)해 즉시 상품 썸네일로 저장.
4. **4순위 (`MART_UPLOAD`)**: 단위 마트 담당자가 PC 파일 업로드 또는 스마트폰 카메라로 실사 촬영해 R2(`media_objects`, `med_*` UID)에 직접 저장.

### 4.3 단위 마트 담당자 실무 등록 3대 경로
- **경로 A (POS CSV 일괄 동기화)**: 윈포스/이지포스 상품마스터 CSV 업로드 -> 기존 SKU는 원가·판매가·재고 갱신, 신규 `880` 바코드는 표준 정보·이미지 자동 매칭.
- **경로 B (바코드 스캔 5초 단건 등록)**: USB 바코드 스캐너 또는 모바일 카메라로 바코드 스캔 -> 상품명·규격·이미지 자동 입력 -> 판매가·`payment_scope`만 확인 후 저장.
- **경로 C (전단 Split View / 전처리 발주서 일괄 등록)**: 전단 이미지+텍스트 또는 기관 발주서 표 붙여넣기로 일괄 등록.

### 4.4 관리자 페이지 -> PWA(`/mart/pwa/`) 디스플레이(진열) 및 실시간 제어 설계
소상공인(음식점)은 메뉴 수가 적어 단순 카테고리 리스트 진열로 충분하지만, 마트는 수백~수천 SKU와 전단·골라담기·공동판매가 공존하므로 **홈 블록(Section) 조립형 디스플레이 제어** 구조를 채택합니다.

#### 1) PWA 홈 6대 디스플레이 블록 (관리자에서 순서·ON/OFF·콘텐츠 제어)
1. **`STATUS_BANNER` (상단 영업·배송 마감 바)**: 마트 영업 상태(`OPEN`/`PREP_BREAK`/`CLOSED`), 당일 배송 마감 카운트다운, 긴급 공지 문구.
2. **`FLYER_CAROUSEL` (전단 특가 슬라이더)**: 전단 Split View에서 검수한 전단 이미지/특가 묶음을 상단 캐러셀로 배치. 클릭 시 해당 전단 행사 상품 모아보기 페이지로 이동.
3. **`CATEGORY_GRID` (퀵 카테고리 2행×4열)**: `[금주의 전단] [1+1/골라담기] [채소·과일] [정육·계란] [수산] [가공·생필품] [전국 공동판매] [공동구매]` 등 마트 특성에 맞게 노출 순서·라벨 ON/OFF.
4. **`PROMO_SHELF` (1+1 · 골라담기 · 반짝세일 가로 진열대)**: 행사 룰(`BOGO`, `MIX_AND_MATCH`, `QTY_DISCOUNT`, **`FLASH_SALE` 시간·선착순 한정 반짝세일**) 중심 카드 진열. `POS_ONLY` 상품은 마트 정책(`HIDE` 미노출 | `BADGE_ONLY` 현장가 안내)에 따라 자동 처리.
5. **`CURATED_SHELF` (MD 기획전 · 추천 진열대 — 복수 생성)**: 관리자가 섹션 제목(예: *"오늘 입고된 제철 과일"*, *"9,900원 반찬 모음"*)과 진열 상품을 직접 지정. 품절 상품(`stock_qty <= safety_stock`)은 `자동 하단 이동` 또는 `숨김` 선택.
6. **`CO_SELL_AND_GROUP_BUY` (전국 공동판매 & 공동구매 슬롯)**: 수퍼관리자가 승인한 전국 특산물 공동판매 및 모집 중인 공동구매(`mgb_*` 달성률 게이지 포함) 노출 제어.

#### 2) 수퍼관리자 vs 단위 마트 관리자 디스플레이 제어권 분리
- **수퍼관리자(`/admin/`)**: 전역 PWA 기본 레이아웃 템플릿, 전국 공동판매·공동구매 고정 슬롯, 전사 긴급 점검 배너 제어.
- **단위 마트 관리자(`/mart/`)**: 자점 전단 캐러셀, 퀵 카테고리 순서, MD 기획전(`CURATED_SHELF`) 제목/상품 구성, `POS_ONLY`·품절 상품 진열 정책 제어 및 **모바일(375px) 실시간 미리보기** 제공.

#### 3) 페르소나 게이트 & 실시간 전달 메커니즘 (Pull + MQTT Push)
- **기관(`FAC-*`) 로그인 게이트**: 승인된 기관 계정 로그인 시에만 **전처리 전용 카탈로그**, **기관 계약 단가**, **월말 후불/보조금 결제** 블록 동적 활성화.
- **전달 구조**: 초기 진입 시 `GET /api/mart/pwa/config?mart_id=MRT-...`로 레이아웃·블록·정책을 로드하고, 운영 중 긴급 변경 시 `mqtt-bridge.mjs` 토픽(`aitip/mart/{mart_id}/pwa/control`)으로 접속 중인 PWA 즉시 갱신.

### 4.5 전 품목 등록 · 진열/검색 이원화 전략 (`PUBLISHED_FEED` vs `SEARCH_ONLY`)
마트 POS에는 수천~1만 개 이상의 SKU가 존재하지만, 농·수산품은 매일 시세·신선도가 바뀌고 공산품 다수는 이미지가 없습니다. 점주의 "매장 전 품목 등록" 요구와 온라인 몰 품질을 동시에 만족시키기 위해 **등록(POS 전체)과 노출(진열 vs 검색)을 분리**합니다.

1. **3단계 온라인 노출 티어 (`online_publish_status`)**
   - **`PUBLISHED_FEED` (홈·카테고리 진열)**: 이미지·안전재고·가격이 100% 검증된 핵심 SKU(전단 행사 + 주력 공산품 + 당일 시세 확인된 신선품 200~500종). PWA 홈 블록과 카테고리 피드에 노출.
   - **`SEARCH_ONLY` (검색 전용 노출)**: POS CSV로 등록된 나머지 가공·공산품 수천 종은 홈/카테고리 진열을 어지럽히지 않고 **소비자가 검색창에 직접 입력했을 때만 노출** (이미지 미확보 시 `880` 바코드 DB 백그라운드 매칭 전까지 카테고리 표준 아이콘 표시). 검색 결과에서는 현재 단골 마트의 **전단 할인·반짝세일(`FLASH_SALE`) 대상 상품을 최상단에 우선 정렬 및 배지 표기**.
   - **`SUSPENDED` / `DRAFT` (노출 차단)**:
     - **`FRESH`(1차 농·수·축산) 신선 시세 TTL**: 농·수산품은 매일 시세가 바뀌므로 당일(또는 설정 유효시간) 내 시세 확인이 갱신되지 않으면 **진열뿐 아니라 검색에서도 자동 숨김(`SUSPENDED`)** 처리하여 어제 가격·품절 수산물 주문 사고를 원천 차단.
     - **재고 미달**: `stock_qty <= safety_stock`인 품목은 자동 품절 또는 숨김.
2. **아침 3분 시세 확인 워크플로우**
   - 매일 오전 위탁운영사/마트 담당자가 그리드 상단 `[오늘 시세 미확인 신선품만 보기]` 필터를 눌러 1차 농·수산 핵심 품목만 가격·재고 확인 후 일괄 저장하면 당일 `PUBLISHED_FEED`가 유지됩니다.

---

## 5. 확장 데이터 모델 및 API 명세

### 5.1 상품(`Product`) 및 공동판매·공동구매 확장 필드
- `mart_id`: 소유/공급 마트 UID (`MRT-...`)
- `payment_scope`: `"ONLINE_APPLICABLE"` | `"POS_ONLY"` (현장 POS 카드/회원 전용 할인 구분)
- `fulfillment_source`: `"MART_FLOOR"`(마트 창고·매장) | `"PREP_CENTER"`(전처리 작업장) | `"DIRECT_SUPPLIER"`(공급사·산지 직납)
- `shared_catalog_scope`: `"LOCAL_ONLY"`(자점 전용) | `"NATIONWIDE_CO_SELL"`(전국 마트 공동판매 노출)
- `stock_qty`: 매장 연동 재고 수량
- `safety_stock`: 품절 임계치 (이하 시 온라인 몰 자동 품절 처리)

### 5.2 공동구매(`GroupBuyCampaign`) 모델
- `campaign_id`: `mgb_*`
- `campaign_type`: `"B2B_INSTITUTIONAL"`(기관 연합 공동구매) | `"B2C_RESIDENT"`(주민 공동구매)
- `target_qty` / `current_qty`: 목표 수량 및 현재 누적 참여 수량
- `tier_prices`: 수량 구간별 단가표 (예: `100개 이상 3,800원 / 500개 이상 3,200원`)
- `distribution_mode`: `"HUB_PICKUP"`(거점 마트 수령) | `"REGIONAL_DELIVERY"`(권역 일괄 배송)
- `status`: `"OPEN"` | `"GOAL_REACHED"` | `"PROCUREMENT"` | `"DISTRIBUTING"` | `"SETTLED"` | `"EXPIRED_REFUND"`

### 5.3 API 엔드포인트 (`/api/mart/*`)
- **기본정보 & 카탈로그 (Phase 1 / 1.5)**: `GET /api/mart/profile`, `PATCH /api/mart/profile`, `GET /api/mart/catalog`, `POST /api/mart/products`, `PATCH /api/mart/products/bulk-grid`, `POST /api/mart/import`, `POST /api/mart/promotions`, `GET /api/mart/orders`, `POST /api/mart/orders`, `POST /api/mart/orders/status`
- **피킹·박싱·정산 (Phase 2)**: `GET /api/mart/picking`, `POST /api/mart/orders/adjust` (`DOC-11`), `GET /api/mart/boxing`, `GET /api/mart/settlements`
- **연합 몰·PWA 제어·공구 (Phase 3 구현 완료)**: `GET /api/mart/pwa/config`, `PATCH /api/mart/pwa/control`, `GET /api/mart/marts`, `GET /api/mart/group-buys`, `POST /api/mart/group-buys/join`
- **향후 확장 예정**: `POST /api/mart/group-buys` (신규 공구 개설), `GET /api/mart/facilities/:facilityId/statement` (직인 거래명세표), `880` 바코드 외부 API(HACCP/코리안넷) 실시간 조회

---

## 6. 단계별 구현 로드맵 (2026-11-17 기준)

1. **Phase 1 ~ 1.5 (구현·검증 완료)**: 3트랙 파서(`FLYER`/`POS_CSV`/`PREP_SHEET`), `payment_scope`(`POS_ONLY`) 자동 감지, 순수 ESM 인라인 시세·재고 그리드, 메뉴 분리(일반·신선 / 전처리 / 할인전단 Split View) 및 마트 기본정보 관리.
2. **Phase 2 (구현·검증 완료)**: 주문 단위 단일 피킹(`1 오더 = 1 피킹 팀`), 온도대 분리 박싱, 실중량/결품 부분정정(`DOC-11`), 3자 정산 및 과면세 대사.
3. **Phase 3 뼈대 (구현·검증 완료)**: 마트 전용 몰(`/mart/pwa/`), 관리자->PWA 6대 블록 제어 및 모바일/태블릿/PC 반응형 미리보기, 전국 마트·공동구매 API, 수퍼관리자(`/admin/` `view-mart-union`) 연동. -> **현재 단계: 화면별 세밀 보완 진행 중**.

---

## 7. PWA (`/mart/pwa/`) 화면 흐름 및 장바구니·배송비 정책

### 7.1 일반 소비자(`B2C_CONSUMER`) 기본 화면 구조
1. **상단 헤더**: 동네 마트 선택기(`MRT-*` · 예: 서초농협 하나로마트 양재점), **당일 배송 마감 카운트다운**(`14:00 마감까지 01:20 남음`), **큰 글씨 보기 토글**(선택형 접근성 옵션).
2. **홈 피드**:
   - 전단 특가 배너 (`금주의 전단`, `1+1`, `이종상품 골라담기`)
   - 카테고리 탭 (`농·수·축산` / `가공·생필품` / `유제품·냉장`)
   - **전국 특산물 공동판매관** (`NATIONWIDE_CO_SELL` 산지 직송 상품)
   - **우리동네 공동구매관** (`B2C_RESIDENT` 목표 수량 게이지 및 마감 타이머)
3. **상품 카드 배지 규칙**:
   - `POS_ONLY` 상품(마트 설정 `BADGE_ONLY`인 경우): `매장 현장 결제 전용가` 배지 표시 및 온라인 장바구니 담기 비활성화.
   - `stock_qty <= safety_stock`: `일시품절 (재입고 예정)` 자동 표시.
   - `limit_per_person > 0`: `1인 N개 한정` 표시 및 장바구니 수량 초과 차단.

### 7.2 이원 장바구니 · 매장 픽업 · 온도대 분리 박싱 배송비 정책
- **출고/수령 그룹 자동 분리**: 한 번에 여러 상품을 담아도 장바구니 내부에서 `[우리동네 마트 당일배송 / 매장 픽업(STORE_PICKUP)]`과 `[전국 공동판매 산지택배]` 섹션으로 자동 분리.
- **매장 픽업 (`STORE_PICKUP`)**: 소비자가 PWA에서 미리 주문·결제 후 지정 시간대에 마트 픽업대에서 대기 없이 수령 (배송비 0원, 최소주문금액 완화 또는 면제 설정 가능).
- **최소주문금액 & 배송비**:
  - `우리동네 마트 당일배송`과 `산지택배`는 각각의 최소주문금액과 배송비 정책을 독립 적용.
  - **온도대 분리 박싱 원칙**: 마트 당일배송에서 상온+냉장+냉동 상품을 함께 주문해 실제 박스가 2~3개로 나뉘더라도, **소비자에게는 마트 배송비 1회만 부과** (보냉/포장 부자재 비용은 위탁 대행 수수료 원가에 포함).

### 7.3 기관(`B2B_FACILITY`) 로그인 시 전환 화면
- 일반 소비자 몰 UI 위에 **기관 발주 전용 바** 활성화: `참여기관명(FAC-*)`, `보조금/바우처 잔액`, `월말 후불 여신 잔여 한도`.
- **전처리 전용 카탈로그**, **기관 계약 단가**, **정기발주(주간/격주) 달력**, **기관 연합 공동구매(`B2B_INSTITUTIONAL`)** 메뉴 추가 노출.

---

## 8. 수퍼관리자(`/admin/`) · 마트 관리자(`/mart/`) RBAC 권한 매트릭스

| 기능 영역 | 본사 최고운영자 (`HQ_SUPER_ADMIN`) | 단위농협·마트 점주 (`MART_OWNER`) | 위탁운영사 매니저 (`AGENCY_OPERATOR`) | 기관 발주 담당자 (`FACILITY_BUYER`) |
| :--- | :---: | :---: | :---: | :---: |
| **전국 마트(`MRT-*`)·기관(`FAC-*`) 입점/여신 승인** | 승인·정지 | 자점 조회 | 소속 기관 조회 | 자기관 조회 |
| **상품 원가·판매가·POS CSV·전단 등록** | 조회 | 조회·수정 | 등록·수정 | 불가 (계약가만 조회) |
| **PWA 영업 제어(`OPEN`/`PREP_BREAK`)·품절 토글** | 전사/지점 강제제어 | 자점 조회 | 자점 실시간 제어 | 불가 |
| **공동판매(`NATIONWIDE_CO_SELL`)·공동구매(`mgb_*`)** | 전국 노출 승인·발주 | 자점 상품 출품 | 공구 개설·분배 | 공구 참여 |
| **총량 피킹·온도대 박싱·`DOC-11` 결품 정정** | 이력 관제 | 조회 | 실행·확정 | 정정 결과 수신 |
| **다자 정산·과면세 세무·보조금 대사** | 정산 확정·지급 | 자점 정산 조회 | 대행료 정산 조회 | 월말 거래명세서 출력 |

### `platform-admin` 5대 메뉴 연동 배치
1. **`1. 실시간 관제 & CS`**: 마트 주문(`mord_*`) 스트림, `DOC-11` 결품 정정 이력, `DOC-12` 신선도 클레임 분쟁 처리.
2. **`2. 가맹점 · 영업망 · 자산`**: 업종 구분(`FOOD` | `MART`)으로 전국 하나로마트·일반마트(`MRT-*`) 및 참여기관(`FAC-*`) 여신·수수료율 관리.
3. **`3. 프로모션 & 포인트`**: 전국 공동판매 배너 승인 및 공동구매 캠페인(`mgb_*`) 목표달성/일괄발주 관제.
4. **`4. 정산 & 세무`**: `[공급 마트 원가] + [판매 거점 수수료] + [위탁 대행료] + [플랫폼 수수료]` 다자 정산 및 `면세(EXEMPT)`/`과세(TAXABLE)` 분리 대사.
5. **`5. 플랫폼 설정 & 보안`**: 전사 긴급 점검 모드, `Zero-PII`(0504 안심번호 파기 주기), 카카오 알림톡 템플릿(주문접수/결품정정/배송완료).

---

## 9. 예외 처리 · 여신 · 클레임 정책

1. **기관 여신 한도 초과 / 보조금 잔액 부족**
   - 결제 시 `지자체 보조금/바우처 잔액`을 우선 차감하고, 부족분은 `기관 월말 후불 여신` 또는 `일반 카드 복합결제`로 자동 분기.
   - 후불 여신 한도 초과 시 주문을 즉시 반려하지 않고 **`HOLD_CREDIT`(여신 승인 대기)** 상태로 등록해 위탁운영사·수퍼관리자가 한시 증액 승인 가능.
2. **신선식품·전처리 클레임(`DOC-12` 연계) 귀책 분기**
   - 수령 후 24시간 이내 사진(`med_*` R2 업로드) 증빙으로 신선도 불량/파손 접수 시 출고거점(`fulfillment_source`)에 따라 귀책을 자동 분류:
     - `MART_FLOOR` -> 마트·위탁사 확인 후 환불/재배송
     - `PREP_CENTER` -> 전처리 작업장 귀책(대행 정산 차감)
     - `DIRECT_SUPPLIER` -> 산지·공급사 귀책(공급가 정산 차감)
3. **실중량·결품 부분정정 및 세일상품 품절 방어 (`DOC-11` 연계)**
   - **세일상품 집중 방어 원칙**: 실제 품절의 대부분은 전단 특가·`1+1`·반짝세일 상품에서 발생하므로 3중 방어를 적용:
     1. **온라인 할당 수량(`promo_online_quota`)**: 행사 상품은 매장 재고와 별도로 온라인 판매 상한(선착순 할당량)을 설정해 오프라인 매진 전 온라인 선제 마감 가능.
     2. **원클릭 행사 품절 전파**: 피킹 중 세일상품 매대 소진 확인 시 피커/관리자가 즉시 품절 전환하면 `MQTT Push`로 PWA 추가 유입을 즉시 차단.
     3. **주문 시 `stockout_policy` 사전 선택**: 고객이 주문서에서 `PARTIAL_REFUND`(해당 품목 제외 부분환불·기본값) / `ALLOW_SUBSTITUTE`(동일 가격대 대체) / `CONTACT_FIRST`(연락 후 결정) 중 사전 선택.
   - **실중량·부분정정 원장**: 정육·청과 실측 중량 차이 또는 결품 확정 시 원주문 UID(`mord_*`)는 유지한 채 정정 원장(`adj_*`)을 생성하고, 확정 차액 및 사유를 PWA와 카카오 알림톡으로 즉시 통보.

---

## 10. 현행 구현 현황 및 다음 AI 인수인계 체크리스트 (2026-11-17 기준)

### 10.1 구현 완료된 파일 목록 (모두 `node --check` 및 HTTP `200` 검증 완료)
- **코어 파서**: `packages/core/merchant-meta/mart-catalog-parser.mjs` (`dist/core/mart-catalog-parser.mjs` 동기화됨)
- **마트 백엔드**: `packages/services/mart-logistics/backend/mart-service.mjs` (JSON 영속 파일: `packages/services/mart-logistics/backend/data/mart_data.json`)
- **로컬 게이트웨이**: `dev-server.mjs` (`/api/mart/*`, `/mart/*`, `/mart/pwa/*`)
- **마트 위탁 관리자 포털 (`/mart/`)**: `packages/services/mart-logistics/mart-portal/`
  - `index.html`, `js/api.js`, `js/app.js`
  - `js/modules/mart-info.js` (마트 기본정보 & 운영정책)
  - `js/modules/catalog.js` (일반·신선 상품, POS CSV, 진열/검색 노출티어, 인라인 시세 그리드)
  - `js/modules/prep-catalog.js` (대행 전처리 상품 전용)
  - `js/modules/flyer-promo.js` (전단 Split View & 행사 룰 전용)
  - `js/modules/orders.js` (주문·예약·기관 발주)
  - `js/modules/picking.js` (주문 단위 피킹 & `DOC-11` 정정)
  - `js/modules/boxing.js` (온도대 분리 박싱 & 출고)
  - `js/modules/settlement.js` (3자 정산 & 과면세 대사)
  - `js/modules/pwa-control.js` (PWA 6대 블록 제어 & 모바일/태블릿/PC 반응형 미리보기)
- **마트 전용 소비자·기관 몰 (`/mart/pwa/`)**: `packages/services/mart-logistics/mart-pwa/` (`index.html`, `mart-pwa.css`, `js/pwa-api.js`, `js/pwa-app.js`)
- **수퍼관리자 연동 (`/admin/`)**: `packages/platform-admin/js/modules/mart-union.js`, `admin-api.js`, `admin-app.js`, `index.html` (`view-mart-union`)

### 10.2 미구현 · 다음 고도화 과제 (Gap)
1. **장바구니 프로모션 계산 엔진**: `1+1`, `골라담기(MIX_AND_MATCH)` 묶음가, `1인 한정` 장바구니 자동 할인 계산.
2. **상품 이미지 등록 파이프라인**: HACCP 공공 API / 코리안넷 제휴 연동, `schema_r2_media_v01.sql`(`med_*`) 기반 R2 업로드 및 전단 크롭 UI.
3. **B2B 기관 전용 상세 기능**: 관공서 직인 거래명세표 출력, `HOLD_CREDIT` 여신 한도 초과 승인 흐름, `DIRECT_SUPPLIER` 산지직송 이원 장바구니 배송비 분리 계산.
4. **실시간 MQTT 연동**: `mqtt-bridge.mjs`를 통한 관리자->PWA 긴급 영업중지/품절 즉시 푸시 및 `0504` 안심번호/카카오 알림톡 발송 연동.

---

## 11. 실무 고도화 확정 사항 및 아키텍처 보완 (2026-11-20 업데이트)

1. **전단 행사 처리 2원화 원칙 (실물 전단지 한계 대응)**
   - **정석 (1차 메인)**: 다단 그리드·카드사 로고 이미지·전품목 1+1이 혼재된 디자인 전단지 이미지에서 정규식 OCR만으로 무인 자동화하는 것은 오인식 위험이 높으므로, **POS/본부 전단 행사표 CSV 업로드(`1. 파싱 미리보기 -> 2. 확정 일괄 반영`)**로 데이터를 100% 정확히 적재하고, **원본 전단 이미지는 WebP 변환 후 고객 PWA 상단 `FLYER_CAROUSEL` 배너(`pwa_config.flyer_banners`)로 직접 게시**한다.
   - **보조 수단 (2차 확장)**: 엑셀 없이 이미지만 수령한 경우, 비전 AI(Vision LLM)로 구조화 JSON을 초벌 추출한 뒤 동일 `파싱 미리보기` 화면에서 담당자가 1차 검수·수정 후 반영하는 하이브리드 파이프라인을 적용한다.
2. **동적 행사 유형 마스터와 4종 계산 엔진 분리 (`mart_promo_types`)**
   - 전국 마트·단위농협별 상이한 행사 명칭(`조합원 데이`, `수요장터` 등)을 수용하기 위해 표시 라벨(`promo_type`)은 운영자가 UI에서 추가·숨김·삭제할 수 있도록 개방하되, 실제 장바구니 할인 계산은 검증된 4종 고정 엔진(`calc_mode`: `UNIT_DISCOUNT`, `BOGO_BUNDLE`, `MIX_MATCH`, `THRESHOLD`)에 매핑한다.
   - 이미 행사 룰이나 상품이 참조 중인 유형은 데이터 정합성 보존을 위해 물리 삭제를 차단하고 `is_active = 0`(숨김)으로 처리한다.
3. **마트 포털 <-> 수퍼관리자 양방향 승인 거버넌스**
   - **마트 등록 -> 수퍼관리자 승인 (`mart_group_buys`)**: 마트 관리자가 등록한 공동구매 캠페인은 `PENDING_ADMIN` 상태로 접수되며, 수퍼관리자(`/admin/` `#mart-union`) 승인(`APPROVED`) 후에만 고객 PWA에 노출된다.
   - **수퍼관리자 배포 -> 마트 승인 (`NATIONWIDE_CO_SELL`)**: 본부 소싱 공동판매 상품은 `PENDING_MART` 상태로 배포 제안되며, 각 마트 관리자(`1. 상품등록 > 본부 배포 승인대기`)가 취급 승인해야 `PUBLISHED_FEED`로 판매된다.
4. **표준 3단계 상품분류 상세화 및 과면세 입력 단순화**
   - `02 축산`에 `0204 오리 · 특수육` 및 `0205 수입육 · 양념육` 중분류를 분리·신설했다.
   - 상품 등록 드로어에서는 구식 운영구분 드롭다운을 제거하고 **`과면세 구분`(`EXEMPT`/`TAXABLE`) 단일 선택**으로 단순화하며, 내부 필터용 `category_type`은 대분류 코드에 따라 자동 매핑한다.
5. **Cloudflare D1 전환 준비 (`wrangler.toml`, `0001_mart_d1_init.sql`, `MartD1Adapter`)**
   - `schema_aitip_v01.sql` 및 `0001_mart_d1_init.sql`에 `applied_promo_id`, `channel_scope`, `is_prep`, `mart_promo_types`, `pwa_configs`, `mart_group_buys` 및 조회용 복합 인덱스를 반영했다.
   - *(운영 참고)* 2026-12-01부터 Cloudflare Observability가 이벤트 건수 대신 수집/저장 용량(GB) 기준 과금으로 전환되므로, Workers 실배포 시 불필요한 디버그 `console.log`를 최소화하여 무료 포함량 내에서 운영하도록 관리한다.

---

## 12. 시범사업 현장 피드백 기반 4대 실무 운영 고도화 (2026-11-22 업데이트)

1. **당일 시세 일괄 업로드 · 오류 행만 재업로드 · 원클릭 롤백 (`channel-assign.js`, `mart-service.mjs`)**
   - **API 엔드포인트**: `POST /api/mart/prices/batch` (`applyDailyPriceBatch`), `GET /api/mart/prices/history` (`getUploadHistory`), `POST /api/mart/prices/rollback` (`rollbackUploadBatch`).
   - **부분 실패 격리 및 오류 행만 수정·재업로드**: 500건 중 일부 행만 오류가 발생하더라도 정상 행은 반영하고, 오류 행만 별도 인라인 수정 테이블 또는 오류 전용 CSV로 내려받아 재업로드할 수 있도록 구현했다.
   - **신선 전체 동기화(`SYNC_FRESH`) & 선택 상품 미니 엑셀**: 체크박스로 선택한 상품만 미니 엑셀/CSV로 내려받는 기능과, 당일 업로드된 신선 목록에 포함되지 않은 기존 신선 상품을 자동 품절(`stock_qty = 0`) 전환하는 `SYNC_FRESH` 모드를 제공한다.
   - **업로드 스냅샷 & 원클릭 롤백**: 일괄 업로드 직전 상품 스냅샷을 `upload_history`에 저장하여 오입력 시 직전 상태로 즉시 복원할 수 있다.
2. **재고 0 자동 품절 및 재고 상태 필터 (`catalog.js`, `b2b-app.js`)**
   - 상품 목록에 `여유(OK)` / `곧 품절(LOW)` / `품절(OUT)` 재고 상태 필터를 추가하고, `stock_qty === 0`인 상품은 B2B 및 고객 주문에서 즉시 품절 처리되어 담기/주문이 차단되도록 연동했다.
3. **기획전 매대 내 진열 순서(`▲`/`▼`) 및 매대 전용가 (`pwa-control.js`, `pwa-app.js`)**
   - `PROMO_SHELF` / `CURATED_SHELF` 블록 내 진열 상품의 노출 순서를 `▲`/`▼` 버튼으로 직접 조정하고, 블록별 상품 전용 가격(`shelf_overrides` / `shelf_price`)을 지정해 고객 PWA 매대에 즉시 반영할 수 있다.
4. **할인 규칙 CSV 일괄 관리 및 선착순 한정수량 자동 종료 (`flyer-promo.js`, `mart-service.mjs`)**
   - `RULES` 탭에 `[할인 규칙 CSV 다운로드]`(`#btn-dl-promo-rules-csv`) 및 `[할인 규칙 일괄 수정(CSV)]`(`#file-promo-rules-csv`)을 추가하여 `규칙ID` 기준으로 기간·할인율·한정수량을 일괄 수정(`PATCH /api/mart/promotions`)할 수 있다.
   - `createPromotion` / `updatePromotion`에 `total_limit_qty` (`0`=무제한), `used_qty`, `status` (`ACTIVE`/`ENDED`/`PAUSED`)를 추가하고, `createOrder` 시 주문 수량만큼 `used_qty`를 누적하여 `total_limit_qty > 0 && used_qty >= total_limit_qty` 도달 시 규칙을 `ENDED`로 자동 전환하며 연결 상품의 할인을 해제하고 정상가로 복원한다.
5. **전사 공통 하단 센터 페이지네이션 (`<< < 1 2 > >>`)**
   - `catalog.js`, `prep-catalog.js`, `channel-assign.js`, `daily-price.js`, `flyer-promo.js`, `orders.js`, `settlement.js` 마트 포털 전 주요 목록 하단에 전사 공통 디자인 규격인 중앙 정렬 `처음(<<) · 이전(<) · 페이지 번호 · 다음(>) · 끝(>>)` 페이지네이션을 적용했다.
6. **당일 시세 · 변동 독립 메뉴, 원형 `(?)` 사용안내, 주문·B2B 상세 & 사업자 푸터**
   - `2. 판매 · 행사 적용 > 당일 시세 · 변동` (`daily-price.js`) 독립 화면 및 `catalog.js` 상단 우측 원형 `(?)` 사용 안내 모달을 추가했다.
   - `orders.js`, `picking.js`, `boxing.js`, `settlement.js` 및 B2B 포털(`b2b-app.js`)에 `[상세보기]`와 상세 드로어/모달을 적용하고, B2B `REQUESTED` 상태 발주서의 수량 변경·발주 취소(`adjustOrderItem`, `updateOrderStatus`)를 연동했다.
   - `mart-pwa`, `mart-b2b` 하단에 관리자 기본정보(`mart`)와 실시간 연동되는 사업자 푸터를 추가했다.

---

## 13. 마트 포털 모달 · 시세 · 결제·정산 UI 고도화 (2026-11-24 업데이트)

1. **중앙 오버레이 모달 및 2열 와이드 폼 통일 (`mart.css`, `catalog.js`, `prep-catalog.js`, `orders.js`)**
   - `packages/services/mart-logistics/mart-portal/mart.css`: `.mc-drawer-backdrop` · `.mc-drawer`를 우측 슬라이드 드로어에서 화면 중앙 오버레이 모달(`min(640px, 95vw)`, `max-height: 90vh`)로 통일하고, `.mc-drawer--wide`(`width: min(980px, 96vw)`) 및 `.mc-drawer-body.mc-drawer-grid-2`(2열 그리드, 768px 이하 1열)를 추가했다.
   - `catalog.js` (`#form-mart-add`), `prep-catalog.js` (`#form-prep-add`), `orders.js` (`CREATE_OFFLINE` 오프라인 다품목 주문 입력 모달, `#mo-draft-list` 스크롤 제한 `max-height: 280px`)에 `mc-drawer--wide` 및 `mc-drawer-grid-2`를 적용했다.
   - `catalog.js`: `#btn-haccp-lookup`에 신선 대분류(`01`/`02`/`03`) 가드를 추가하고, `'알수없음'` 문자열 정제 및 수정 시 프로모션 미적용(`!editingProduct?.applied_promo_id`) 상품의 `sale_price = regPrice` 동기화를 보완했다.
2. **배정 화면 헤더 정리 및 당일 시세 서브탭 복구 (`channel-assign.js`, `daily-price.js`, `mart.css`)**
   - `channel-assign.js`: `B2C · B2B 판매 · 가격 배정` 우측 상단의 중복 당일 시세 버튼 3종을 제거하고 `[현재 배정 목록 엑셀 다운로드]`(`#btn-ca-dl-assign`)와 `[당일 시세 · 변동 바로가기]`(`#btn-ca-go-daily` -> `#daily-price`)로 정리했다.
   - `daily-price.js`: `martApi.getUploadHistory()` 오호출(`TypeError`)을 `martApi.getPriceUploadHistory()`로 수정하고, `mart.css`에 `.mc-tabs`, `.mc-tab`, `.mc-tab.active` 스타일을 추가해 서브탭 깨짐을 복구했다.
3. **일반고객(B2C) · 기관(B2B) 분리 및 결제 방법 조회 (`settlement.js`)**
   - `settlement.js`: 백엔드 `getSettlementSummary()`가 반환하는 `customer_type` 및 `payment_method`를 UI에 연동하여, 상단 `.mc-tabs`(`전체 내역` / `일반고객 결제 (B2C)` / `기관·경로당 정산 (B2B)`), 결제 수단 필터(`#stl-pay-method`: 카드·간편결제, 기관 월말 후불, 지자체 바우처, 현금), 테이블 `구분` · `결제 방법` 컬럼 및 `결제 · 정산 상세` 모달(`고객 구분`, `결제 방법`, `정산 방식`, `정산 공제`)을 추가했다. 선택한 탭·필터 기준에 맞춰 상단 5대 KPI 합계도 함께 재계산된다.


