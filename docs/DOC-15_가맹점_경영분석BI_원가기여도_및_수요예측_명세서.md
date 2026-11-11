# 📊 AITIP DOC-15: 가맹점 경영분석(BI)·공헌이익 및 수요예측 명세서
**문서 식별자:** `AITIP-SPEC-DOC-15-MERCHANT-BI-FORECASTING-2026-V01`  
**표준 제정일:** 2026-11-09  
**상태:** 승인 완료 (Approved & Implemented)  
**적용 대상:** 골목식당 요식업 가맹점, 하나로마트/로컬푸드 직매장, 경로당 영양급식 운영기관, 지자체 복지과, Cloudflare Workers & D1

---

## 1. 🕊️ 핵심 신조 및 소상공인 실질 마진 극대화·지속가능 상생 철학

> **"하루 14시간 불 앞에서 땀 흘려 일한 영세 상인이 월말에 빈손으로 한숨 쉬는 비극을 끝낸다.**  
> **AITIP은 독점 플랫폼의 약탈적 10~15% 중개수수료를 0%로 없앨 뿐만 아니라,**  
> **메뉴별 진짜 원가율과 마진 기여도를 투명하게 밝히고, 내일 팔릴 양을 정확히 예측하여 폐기 손실을 0으로 만든다."**

많은 영세 자영업자들이 *"매출은 월 2천만 원인데 통장에 남는 돈이 없다"*고 호소합니다.  
기존 독점 배달앱은 가맹점의 매출 데이터만 쥐고 흔들며 비싼 광고비를 뜯어낼 뿐, 상인에게 원가 분석이나 재고 관리 인사이트를 전혀 제공하지 않습니다.

AITIP은 SwadKart의 레시피 BOM 원가 엔진을 계승하여 점주에게 **"메뉴별 진짜 남는 돈(실질 공헌이익)을 1원 단위로 분석해 주는 일간 경영 BI(`merchant_daily_bi_snapshots`)"**와, 날씨/요일 빅데이터를 결합해 마트와 식당의 폐기 손실을 막아주는 **"AI 수요 예측 및 자동 발주 추천 엔진(`inventory_demand_forecasts`)"**을 제공합니다.

---

## 2. 📊 메뉴별 BOM 원가 및 실질 공헌이익(Contribution Margin) 분석

단순한 '매출액'의 허상에서 벗어나, 상인의 통장에 실제로 꽂히는 **순 공헌이익**을 4단계로 정밀 계산합니다.

$$\text{메뉴별 실질 공헌이익} = \text{판매가} - \text{식자재 BOM 원가} - \text{포장용기비} - \text{PG 결제 실원가} (\mathbf{플랫폼 중개수수료\,0\%})$$

```mermaid
graph TD
    Sales["고객 판매가 (10,000원)"] --> Deduct1["- 식자재 BOM 재료비 (3,500원 / 35%)"]
    Deduct1 --> Deduct2["- 전용 포장용기비 (400원 / 4%)"]
    Deduct2 --> Deduct3["- PG 카드 결제 실원가 (250원 / 2.5%)"]
    Deduct3 --> ZeroCut["- AITIP 플랫폼 중개 수수료: 0원!"]
    ZeroCut --> NetProfit["= 실질 공헌이익: 5,850원 (마진율 58.5%)"]
```

### 2.1 4분면(BCG 매트릭스) 메뉴 진단 모델

매일 아침 점주 대시보드에 매장의 모든 메뉴를 4개 그룹으로 자동 분류하여 직관적인 경영 솔루션을 제시합니다.

| 분류 | 판매량 | 마진율 | 진단 및 AITIP 경영 솔루션 |
| :--- | :---: | :---: | :--- |
| **🌟 효자 메뉴 (Star)** | **높음** | **높음** | **매장의 핵심 수익원!** 홈 화면 최상단 '대표 추천' 배치 및 배달앱 썸네일 고화질 강조 |
| **🐴 소몰이 메뉴 (Cash Cow)** | **높음** | 보통/낮음 | **손님을 끌어모으는 미끼 메뉴!** 박리다매 유지하되, 고마진 음료/사이드 묶음 세트 메뉴 구성 유도 |
| **❓ 기회 메뉴 (Question Mark)** | 낮음 | **높음** | **숨겨진 보석 메뉴!** 맛과 마진이 훌륭하나 인지도가 부족하므로 1,000원 할인 쿠폰 프로모션 집중 투입 |
| **⚠️ 경고 메뉴 (Dog)** | 낮음 | 낮음 | **팔수록 손해 보는 적자 메뉴!** 재료비 상승에 따른 가격 인상 또는 레시피 단순화(식자재 절감) 처방전 제시 |

---

## 3. 🌦️ 요일·기상 빅데이터 기반 하나로마트/식당 수요 예측 및 자동 발주

기상청 날씨 데이터(기온, 강수량)와 요일별 과거 90일 판매 시계열 데이터를 결합하여 신선식품 폐기율을 0%에 수렴시킵니다.

$$\text{권장 발주량} = \text{내일 예상 판매량}(\text{AI 예측}) + \text{안전재고}(\text{Safety Stock}) - \text{현재 매장 실재고}$$

```mermaid
sequenceDiagram
    autonumber
    participant Weather as 기상청 초단기실황 API
    participant Engine as AITIP AI 수요예측 엔진
    participant D1 as Cloudflare D1 (과거 90일 판매량)
    actor Merchant as 하나로마트 점장 / 식당 사장님

    Engine->>Weather: 내일 날씨 조회 (비 80%, 기온 18도)
    Engine->>D1: 최근 90일 우천 요일 판매 추이 분석 (전/국물류 35% 상승, 냉면 40% 감소)
    Engine->>Engine: 품목별 내일 판매량 및 안전재고 계산
    Engine->>Merchant: 매일 15:00 모바일 카카오 알림톡 발송
    Note over Merchant: "내일 비가 옵니다! 부침가루 20봉, 대파 10단, 삼겹살 15kg 발주를 추천합니다."
    Merchant->>Engine: [추천 발주서 1클릭 전송]
    Engine-->>Merchant: 농가/도매처 B2B 발주서 자동 전송 완료!
```

---

## 4. 🍱 경로당 영양급식 주간 영양 균형표 & 지자체 보조금 잔액 리포트

경로당 조리사님과 지자체(구청/군청) 복지과 공무원이 실시간으로 영양과 예산을 투명하게 교차 검증합니다.

```
[2026년 OO동 제1경로당 주간 영양 및 보조금 대시보드]
 ├── 1. 보조금 예산 집행 현황
 │    ├── 분기 총 지원금: 4,500,000원
 │    ├── 현재 누적 집행액: 1,820,000원 (집행률 40.4% - 적정 페이스 유지 중)
 │    └── 1인 1식 평균 식단가: 3,450원 (영양 기준 충족)
 └── 2. 주간 어르신 필수 영양소 권장 달성률
      ├── 단백질 (두부, 계란, 한우양지): 108% 달성 (우수)
      ├── 칼슘/비타민 (시금치, 멸치, 로컬채소): 95% 달성 (양호)
      └── 나트륨 (저염 국물류 권장): 기준치 이하 안전 관리 중 (0.6% 저염 식단)
```

이 리포트는 매주 월요일 아침 지자체 복지과 공무원 관리자 화면에 자동 집계되어 보고서 작성 업무를 100% 자동화합니다.

---

## 5. 🗄️ Cloudflare D1 스키마 구현 내역 (Section 30)

```sql
-- 1. merchant_daily_bi_snapshots (가맹점/마트 일간 공헌이익 및 원가분석 BI)
CREATE TABLE merchant_daily_bi_snapshots (
    id                           TEXT PRIMARY KEY
                                 CONSTRAINT chk_bi_snap_id CHECK (length(id) = 30 AND id GLOB 'bis_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    seller_type                  TEXT NOT NULL
                                 CONSTRAINT chk_bi_seller_type CHECK (seller_type IN ('STORE', 'MART')),
    store_id                     TEXT REFERENCES stores(id)
                                 CONSTRAINT chk_bi_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id                      TEXT REFERENCES mart_suppliers(id)
                                 CONSTRAINT chk_bi_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    business_date                TEXT NOT NULL
                                 CONSTRAINT chk_bi_date CHECK (business_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    total_orders_count           INTEGER NOT NULL DEFAULT 0
                                 CONSTRAINT chk_bi_orders_cnt CHECK (total_orders_count >= 0),
    gross_sales_amount           INTEGER NOT NULL DEFAULT 0
                                 CONSTRAINT chk_bi_gross_sales CHECK (gross_sales_amount >= 0),
    total_food_cost_amount       INTEGER NOT NULL DEFAULT 0
                                 CONSTRAINT chk_bi_food_cost CHECK (total_food_cost_amount >= 0),
    total_packaging_cost_amount   INTEGER NOT NULL DEFAULT 0
                                 CONSTRAINT chk_bi_pkg_cost CHECK (total_packaging_cost_amount >= 0),
    estimated_gross_profit       INTEGER NOT NULL DEFAULT 0,
    profit_margin_pct            REAL,
    top_selling_product_id       TEXT REFERENCES products(id)
                                 CONSTRAINT chk_bi_top_product CHECK (top_selling_product_id IS NULL OR (length(top_selling_product_id) = 30 AND top_selling_product_id GLOB 'prd_*')),
    created_at                   INTEGER NOT NULL,
    CONSTRAINT chk_bi_seller CHECK (
        (seller_type = 'STORE' AND store_id IS NOT NULL AND mart_id IS NULL) OR
        (seller_type = 'MART' AND store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX uq_bi_seller_date ON merchant_daily_bi_snapshots (seller_type, store_id, mart_id, business_date);
CREATE INDEX idx_bi_store_date ON merchant_daily_bi_snapshots (store_id, business_date) WHERE store_id IS NOT NULL;
CREATE INDEX idx_bi_mart_date  ON merchant_daily_bi_snapshots (mart_id, business_date)  WHERE mart_id IS NOT NULL;

-- 2. inventory_demand_forecasts (AI 수요예측 및 자동발주 추천 원장)
CREATE TABLE inventory_demand_forecasts (
    id                     TEXT PRIMARY KEY
                           CONSTRAINT chk_forecast_id CHECK (length(id) = 30 AND id GLOB 'fcs_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    seller_type            TEXT NOT NULL
                           CONSTRAINT chk_fcs_seller_type CHECK (seller_type IN ('STORE', 'MART')),
    store_id               TEXT REFERENCES stores(id)
                           CONSTRAINT chk_fcs_store_id CHECK (store_id IS NULL OR (length(store_id) = 30 AND store_id GLOB 'str_*')),
    mart_id                TEXT REFERENCES mart_suppliers(id)
                           CONSTRAINT chk_fcs_mart_id CHECK (mart_id IS NULL OR (length(mart_id) = 30 AND mart_id GLOB 'mrt_*')),
    product_id             TEXT NOT NULL REFERENCES products(id)
                           CONSTRAINT chk_fcs_product_id CHECK (length(product_id) = 30 AND product_id GLOB 'prd_*'),
    forecast_target_date   TEXT NOT NULL
                           CONSTRAINT chk_fcs_target_date CHECK (forecast_target_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    predicted_sales_qty    INTEGER NOT NULL
                           CONSTRAINT chk_fcs_pred_qty CHECK (predicted_sales_qty >= 0),
    recommended_order_qty  INTEGER NOT NULL
                           CONSTRAINT chk_fcs_rec_qty CHECK (recommended_order_qty >= 0),
    confidence_score       REAL
                           CONSTRAINT chk_fcs_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
    weather_condition      TEXT
                           CONSTRAINT chk_fcs_weather CHECK (weather_condition IS NULL OR length(weather_condition) <= 50),
    created_at             INTEGER NOT NULL,
    CONSTRAINT chk_fcs_seller CHECK (
        (seller_type = 'STORE' AND store_id IS NOT NULL AND mart_id IS NULL) OR
        (seller_type = 'MART' AND store_id IS NULL AND mart_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX uq_forecast_product_date ON inventory_demand_forecasts (product_id, forecast_target_date);
CREATE INDEX idx_forecast_store ON inventory_demand_forecasts (store_id, forecast_target_date) WHERE store_id IS NOT NULL;
CREATE INDEX idx_forecast_mart  ON inventory_demand_forecasts (mart_id, forecast_target_date)  WHERE mart_id IS NOT NULL;
```

---

## 6. 🛡️ 무결성 검증 실측치 (271/271 PASS)

`scripts/test_schema_integrity.py` Section 30에서 다음 항목에 대한 검증을 전수 완료하였습니다:
1. `merchant_daily_bi_snapshots` 일간 공헌이익(마진율 60.0%) BI 스냅샷 등록 성공.
2. `store_id`와 `mart_id` 동시 설정 거부 (`chk_bi_seller`).
3. 음수 총매출액, 음수 식자재 원가 거부.
4. `inventory_demand_forecasts` 기상 연동 AI 발주 추천 등록 성공.
5. 음수 예상 판매량 거부 (`chk_fcs_pred_qty`).
6. `confidence_score` 1.0 초과(1.5) 거부 (`chk_fcs_confidence`).
7. `forecast_target_date` 날짜 형식 불일치 거부 (`chk_fcs_target_date`).
8. 가맹점 일자별 BI 인덱스(`idx_bi_store_date`) 및 상품별 일자 유니크 인덱스(`uq_forecast_product_date`) 쿼리 플랜 작동 검증.

**실행 결과: 271 / 271 전수 통과 (0 FAIL, 100% PASS)**.
