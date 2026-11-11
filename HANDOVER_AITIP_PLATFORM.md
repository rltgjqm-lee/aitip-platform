# 🚀 AITIP-Platform 마스터 핸드오버 및 실무 개발 지침서 (HANDOVER)

> **문서 번호**: AITIP-HANDOVER-2026-V19  
> **최종 갱신 일시**: 2026-11-09 12:10 (KST)  
> **시스템 규격**: STD-ENTERPRISE-MASTER-2026-V20 (전사 27대 식별 체계, 소상공인 본체 코어 & AITIP 단말기 연동, 공통 척추 & 2대 전략 분리, 경로당·마을 공동구매(공구) 메커니즘, 외주 배달 3사 & 지역 대리점 쿼드러플 디스패칭, 결품 듀얼 영수증, CS 분쟁, 알림톡/0504, MDM/OTA, 경영BI/수요예측 완전 통합)  
> **개발 행동 강령**: `AGENTS.md` (절대 신조: 상생 신뢰, 정직한 조언, 거짓말/꼼수 금지, 사전 보고·승인제, UID 무결성 사수, ESM/API 계층화)  
> **프로젝트 위치**: `C:\Users\user\Desktop\aitip-platform`  
> **로컬 개발 포트**: **`8989`** (기존 wellriskkeeper 8888, bupyeong 8787과 완전 격리)  
> **무결성 검증 실측치**: **278 / 278 테스트 통과 (FAIL 0, 100% PASS)**

---

## 🕊️ 0. 우리의 핵심 신조 (The Core Creed)
> **"아무리 좋은 코딩이라도 신뢰가 바탕이 되지 않으면 아무 소용이 없다.**  
> **한 달에 수십만 원, 수백만 원씩 영세 상인의 피를 빨아먹는 약탈적 독점 플랫폼이 아니라, 세상에 진정으로 도움이 되고 온기를 더하는 상생 플랫폼을 만든다.**  
> **이를 실현하기 위해 AI는 인간에게 눈앞을 모면하는 거짓말이 아닌 정직한 조언을 주어야 한다.**  
> **비록 시간이 걸리더라도 편법 대신 진짜 대안을 찾아야 하며, 한계에 부딪히면 혼자 억지 부리지 말고 솔직하게 도움을 청해야 한다."**

---

## 📌 1. 프로젝트 정체성 및 본체-파생 위계 정의 (절대 철칙)

본 프로젝트는 **"소상공인(외식업·음식점·골목상점)을 위한 배달의민족형 상생 주문·배달 O2O 플랫폼"을 절대적인 본체 코어(Master Core Engine: 90% 비중)**로 삼고, 그 위에서 **경로당 영양급식**과 **하나로마트 식품사막화 방지**를 특화된 **파생 서비스(Vertical Derivatives)**로 구동하는 고도화된 확장형 플랫폼입니다.

```
========================================================================================
 🚀 [본체 플랫폼 Core Engine: 90% 이상] 소상공인 배달의민족형 상생 주문·배달 O2O 플랫폼
    • 고객 주문 웹/앱 (메뉴 조회, 옵션 선택, 장바구니, 간편 결제)
    • 중앙 클라우드 주문·배차 관제 엔진 (Cloudflare Workers API Gateway & Dispatch Routing)
    • 📟 핵심 하드웨어: 매장 카운터/주방 거치형 [AITIP 스마트 단말기]
      (초고출력 딩동 벨/TTS, 수락 시 주방 전표 자동 인쇄, 외주 배달대행사 원클릭 호출)
    • 라이더/배달원 모바일 PWA (실시간 콜 수락, GPS 관제, 비대면 사진 PoD 배달완료)
========================================================================================
                          │                                           │
                          ▼ (파생 서비스 1)                           ▼ (파생 서비스 2)
  ┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
  │ 🍱 경로당 영양급식 수·발주 파생 서비스         │ │ 🛒 식품사막화 방지 단위농협 하나로마트 파생   │
  │ • 식재료 및 맞춤 밀키트 수·발주               │ │ • 단위농협 하나로마트 온라인 생필품 장보기   │
  │ • 👥 권역별 경로당 [공동구매(공구)] 메커니즘   │ │ • 👥 마을회관/자연부락 [공동구매(공구)] 장보기│
  │ • 경로당 단말기 입고 검수 & 지자체 보조금 결제│ │ • 하나로마트 피킹·패키징 & 노인일자리 배달   │
  └───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
```

---

## 🍕 2. 본체 플랫폼: 소상공인(배민형) 배달 주문 & AITIP 단말기 연동 구조

1. **소상공인 점주 관점 (AITIP 스마트 단말기 & merchant-portal 직결)**:
   - 매장 카운터 및 주방에 설치된 거치형 **AITIP 스마트 터치 단말기** (`packages/edge-device/`).
   - 손님이 주문하면 **초고출력 딩동 벨소리 및 음성 TTS** 안내 ("새로운 배달 주문이 들어왔습니다").
   - 점주가 단말기 화면(또는 카운터 PC `merchant-portal`)에서 조리 예상 시간(15분, 25분) 선택 후 `[주문 수락]` 터치.
   - 단말기에 직결된 열전사 프린터에서 **주방 주문서(`KITCHEN_TICKET`) 및 고객 영수증(`RECEIPT`) 듀얼 자동 인쇄** (미수락 시 식자재 낭비 방지).
   - 조리 완료 시 단말기에서 `[라이더 호출 (배차 요청)]` 원터치 실행 (시니어 $\to$ 지역대리점 $\to$ 전담라이더 $\to$ 외주3사 쿼드러플 디스패칭).
2. **고객/주문자 관점 (모바일 웹/앱 `packages/frontend/pwa-order/`)**:
   - 내 위치 기반 주변 골목상권 맛집 탐색, 실시간 영업 상태/메뉴 확인.
   - 장바구니 담기, 간편 결제(카드/지역화폐/페이), 실시간 조리·배달 현황(ETA) 조회.
   - 하나로마트 장보기 탭 및 경로당 어르신 전용 큰글씨 모드 원클릭 전환.
3. **배달 라이더 관점 (모바일 PWA `packages/frontend/pwa-rider/`)**:
   - 실시간 배차 콜 수락, 픽업 매장 위치 안내, 가택 배송 내비게이션.
   - 시니어 배송단: 도보/실버카트 1km 안심 배달 + 독거 어르신 안부 확인 체크.
   - 일반 라이더: 오토바이 중거리 배달 + 문앞 보관 사진(PoD) R2 자동 업로드.

---

## 👥 3. 2대 파생 서비스 및 '공동구매(공구)' 특화 메커니즘

### 1) [파생 1] 경로당 영양급식 + 권역별 공동구매(공구)
- **개념**: 경로당 주 5일 식사 지원 국정과제 연계 B2B 식자재 공급망.
- **👥 공동구매(공구) 특화**:
  - 인접한 여러 경로당(동 단위 5~10개소)이 쌀, 김치, 채소, 고기를 **공동구매(공구)로 묶음 발주**.
  - 대량 구매를 통한 식자재 단가 절감 및 급식지원센터/식자재마트의 순회 묶음 배송 효율 극대화.
- **수·발주 및 정산**:
  - 경로당 회장/조리사가 단말기 터치(또는 114 ARS) 발주 ➔ 2인1조 시니어 배송단 가택 배송 ➔ 단말기 입고 검수 ➔ **지자체 급식 보조금 묶음 후불 대사 (취소+정정 듀얼 전표 회계 패키지 PDF)**.

### 2) [파생 2] 식품사막화 방지(단위농협 하나로마트) + 마을 단위 공동구매(공구)
- **개념**: 대형마트가 없는 농어촌 면·리 및 구도심 어르신의 생필품 구매난 해소.
- **👥 공동구매(공구) 특화**:
  - 마을 이장, 부녀회장, 또는 마을회관 거점에서 어르신들의 장바구니를 취합하여 **마을 공동구매(공구) 일괄 발주**.
  - 일정 금액/수량 이상 모이면 배송비 면제 및 신선식품 일괄 마을회관 배송.
- **피킹 & 배달**:
  - 단위농협 하나로마트 직원이 매장에서 피킹·패키징(`mart-portal`).
  - 노인일자리 공익활동 참여자(어르신 배달단 2인 1조)가 가택 배송 및 안부확인 동시 수행.

---

## 📁 4. 전사 16대 표준 명세 기반 마스터 디렉터리 아키텍처

```text
aitip-platform/
│
├── .agents/                                # AI 행동 강령 및 핵심 신조 (AGENTS.md)
├── docs/                                   # 전사 16대 표준 명세서 (DOC-00 ~ DOC-15 완결)
├── migrations/                             # D1 마이그레이션 순번 관리 (0001_ ~ )
├── scripts/                                # D1 스키마 무결성 검증기 (test_schema_integrity.py, 278개 통과)
├── tools/
│   └── device-simulator/                   # 단말기 WSS/MQTTS 통신 자동화 테스트용 가상 기기
├── HANDOVER_AITIP_PLATFORM.md              # 일일 마스터 공정 일지 (V18)
│
└── packages/
    ├── contracts/                          # 📜 [전사 공통 계약 & 스키마: Zero Secret]
    │   ├── types/                          # 27대 TypeID Crockford Base32 유효성 검증기 & D1 모델 타입
    │   ├── schemas/                        # JSON Schema
    │   │   ├── orders/                     # 주문, 조리, 배달, 듀얼 영수증 (DOC-11)
    │   │   ├── dispatch/                   # 쿼드러플 디스패칭 (시니어·지사·라이더·외주3사) (DOC-10)
    │   │   ├── telemetry/                  # 단말기 5대 텔레메트리 & OTA 메타데이터 (DOC-14)
    │   │   └── bi/                         # 공헌이익 BI 스냅샷 & AI 수요예측 (DOC-15)
    │   └── test-vectors/                   # ESC/POS 듀얼 전표 바이너리, TypeID 샘플셋
    │
    ├── backend/                            # 🚀 [Cloudflare Workers / D1 / DO 마이크로서비스 백엔드]
    │   ├── security/                       # 서버 전용 AES-256-GCM, HMAC-SHA256 암호화
    │   ├── middlewares/                    # Ed25519 단말기 서명 챌린지 인증, 매장/지사 인가
    │   ├── transport/                      # 🏠 [내부 통신 중추망]
    │   │   ├── mqtt/                       # MQTTS 브로커 ➔ 단말기 1:1 직결 터널
    │   │   └── ws/                         # Durable Objects WSS 터미널 허브 (2중 타이머)
    │   ├── adapters/                       # 🚪 [외부 독립 관문 (3rd-Party Adapters)]
    │   │   ├── delivery-agency/            # 1. 외주 대행 3사 (부릉, 바로고, 생각대로 본사 API)
    │   │   ├── local-agency/               # 🌟 가맹점 계약 지역 배달대리점(지사망) 어댑터
    │   │   ├── payment/                    # 2. PG사 결제·취소·감액 승인 (토스, 나이스, KCP)
    │   │   ├── messaging/                  # 3. 카카오 알림톡 에이전트 & 이통사 SMS 폴백
    │   │   ├── consignment/                # 4. 하나로마트 위탁 운영 & 시니어클럽 피킹/배송
    │   │   └── agent/                      # 5. 외부 AI 비서 (Gemini/Clova) A2A 주문 게이트웨이
    │   ├── modules/                        # 📦 [비즈니스 도메인 서비스 계층]
    │   │   ├── orders/                     # 주문 라이프사이클 & 공동구매(공구) 풀링
    │   │   ├── print-jobs/                 # Outbox 인쇄 큐 관리, 만료/ACK 동기화
    │   │   ├── products/                   # 메뉴/상품 관리, 엑셀 대량 업로드, 바코드 매대
    │   │   ├── stores/                     # 요식업 매장 설정, 주방 바쁨모드, 영업시간
    │   │   ├── deliveries/                 # 4단계 쿼드러플 디스패칭, 동적 서지, 실시간 ETA, PoD (DOC-10)
    │   │   ├── settlements/                # D+1 빠른정산, 마트 격주마감, 보조금 회계대사 (DOC-11)
    │   │   ├── disputes/                   # CS 배달사고 4대 과책분계, 0초 환불, 24시간 블라인드 (DOC-12)
    │   │   ├── virtual-numbers/            # 0504 가상 안심번호 풀 관리 및 60분 수명주기 (DOC-13)
    │   │   ├── mdm/                        # 단말기 5대 텔레메트리 관제 & A/B 무중단 OTA 배포 (DOC-14)
    │   │   └── bi/                         # 메뉴별 실질 공헌이익(BOM) & AI 수요예측 발주 (DOC-15)
    │   └── cron/                           # ⏰ [주기적 백그라운드 스케줄러]
    │       ├── escalation-sweeper.js       # 1분 주기 미알림/미수락 주문 감시 안전망
    │       ├── virtual-number-sweeper.js   # 60분 경과 안심번호 자동 파기/풀 반환
    │       ├── bi-forecast-cron.js         # 15시 발주 추천 & 자정 BI 집계
    │       └── ota-watchdog-checker.js     # 펌웨어 3분 와치독 롤백 감시
    │
    ├── edge-device/                        # 📟 [AITIP 스마트 단말기 C / Linux / LVGL]
    │   ├── cti-driver/                     # Dual RJ-9 무전원 기계식 릴레이 & Si3050 DAA 드라이버
    │   ├── print-spooler/                  # ESC/POS 주방전표·영수증 UART 프린터 드라이버
    │   ├── transport-client/               # 443 WSS / MQTTS 터미널 클라이언트 (30초 핑)
    │   ├── telemetry-agent/                # 5대 텔레메트리 (용지상태, 통신망, 온도) 수집기
    │   ├── ota/                            # A/B 듀얼 파티션 무중단 롤백 OTA 클라이언트
    │   └── ui/                             # LVGL 24pt 큰글씨 터치 GUI (주방 수락/바쁨모드)
    │
    └── frontend/                           # 💻 [사용자 접점 PWA / Web (Vite + SvelteKit / ESM)]
        ├── api/                            # 🛡️ [API 계층 분리] fetch 직접 호출 금지 전용 SDK 클라이언트
        ├── merchant-portal/                # 👑 [본체 코어: 90% 소상공인] 사장님 매장관리·주방 KDS·원가·BI 포털 (PC/태블릿/POS)
        ├── pwa-merchant/                   # 📱 [소상공인 모바일] 점주 외출/현장용 알림 PWA (긴급 2차 수락, 바쁨모드 토글)
        ├── pwa-order/                      # 🛒 [고객] 배달의민족형 소비자 배달·포장 주문 메인 + (마트 장보기 / 경로당 모드)
        ├── pwa-rider/                      # 🛵 [기사] 시니어 도보(안부확인) & 일반 오토바이(지오펜스/PoD) 통합 배달앱
        ├── mart-portal/                    # 🏬 [파생 1: 하나로마트] 단위농협 전용 백오피스 (엑셀 시세 패치, 위탁/매대 관리)
        └── admin-dashboard/                # 🏛️ [파생 2: 공공/행정] 본사·지역배달대리점(지사)·시니어클럽·지자체 복지과 통합 관제
```

---

## 📅 5. 일자별 엔지니어링 공정 일지 (Daily Engineering Log)

### 📌 [Day 1] 2026-11-06
- **전사 아키텍처 및 식별자 체계 수립**:
  - `DOC-00` 통합 UID 체계 표준(TypeID Crockford Base32 기반 정렬형 ID) 정의.
  - 소상공인 본체 코어 및 2대 파생 서비스 위계 확립.

### 📌 [Day 2] 2026-11-07
- **오픈소스 벤치마크 및 148개 제약조건 DDL 수립**:
  - 5대 배달 오픈소스(SwadKart, TastyPrinter, Enatega, NextOrders, Hyperlocal) 완독 및 교훈 도출.
  - Cloudflare D1 정규화 스키마 수립 및 148개 무결성 테스트 스위트 100% 통과.

### 📌 [Day 3] 2026-11-08
- **가맹점·마트·참여기관 정보등록/수정 UI/UX 명세서 (`DOC-07`) 수립**:
  - Enatega식 800줄 모달 지옥 폐기 ➔ 엑셀식 0초 딜레이 인라인 키보드 탐색 그리드 수립.
  - ESM 모듈화 표준 및 전용 API 서비스 계층 분리 (`merchantApi.ts`, `martApi.ts`, `seniorOrgApi.ts`, `agencyApi.ts`).
- **5대 소스 기반 유통·OEM 코어 및 요식업 주방운영 명세서 (`DOC-08`) 수립**:
  - TastyPrinter 주방 전표(2배 확대 볼드, 가격 은닉) vs 영수증 전표 분리.
  - SwadKart 레시피 BOM 원가 및 0% 중개수수료 실질 마진 시뮬레이터.
  - 3-Way 판매 채널(`fulfillment_type`: 'DELIVERY', 'TAKEOUT', 'DINE_IN') 및 피크타임 주방 보호(`busyMode`).
  - D1 스키마 확장 및 무결성 테스트 186/186 통과.

### 📌 [Day 4] 2026-11-09 (금일 전사 16대 명세 100% 완성 및 물리 뼈대 구축)
- **하나로마트 다채널 접속 및 위탁 운영 명세서 (`DOC-09`) 수립**:
  - 구매자 3대 접속 및 운영자 4대 모드(POS, 백오피스, 매대, 위탁포털) 확립. D1 확장(Section 24) **198/198 PASS**.
- **배달대행사 외주 연동 및 쿼드러플 디스패칭·서지·ETA 명세서 (`DOC-10`) 수립**:
  - 시니어클럽 $\to$ 가맹점 계약 **지역 배달대리점(`LOCAL_AGENCY` 지사망)** $\to$ 전담라이더 $\to$ 외주3사 본사 API. D1 확장(Section 20 & 25) **278/278 PASS**.
- **결품 부분환불·영수증 재발행 및 보조금 회계 대사 명세서 (`DOC-11`) 수립**:
  - 오프라인 마트/POS 정합성: **[원거래 취소(VOID)] + [최종 재발행(REISSUED)] 듀얼 영수증 라이프사이클** 확립. D1 확장(Section 26) 통과.
- **CS·분쟁조정·오배송 파손보상 및 악성리뷰 방어 명세서 (`DOC-12`) 수립**:
  - 배달사고 4대 과책분계(`delivery_claims`), 음식/배달 평점 분리, 점주 24시간 블라인드 소명권. D1 확장(Section 27) 통과.
- **카카오 알림톡·0504 안심번호 수명주기 및 상생 CRM 명세서 (`DOC-13`) 수립**:
  - 알림톡 5단계 & 0.3초 SMS 폴백, 0504 안심번호 60분 수명주기/풀 반환. D1 확장(Section 28) 통과.
- **스마트 단말기 MDM 원격관제 및 OTA 무중단 펌웨어 명세서 (`DOC-14`) 수립**:
  - 용지상태 등 5대 텔레메트리 실시간 감시, A/B 파티션 무중단 OTA 배포 & 3분 하드웨어 와치독 롤백. D1 확장(Section 29) 통과.
- **가맹점 경영분석(BI)·공헌이익 및 수요예측 명세서 (`DOC-15`) 수립**:
  - SwadKart BOM 원가 연동 4분면 메뉴 진단 BI, 기상청 날씨 연동 AI 수요예측 자동 발주 추천. D1 확장(Section 30) 통과.
- **전사 16대 표준 명세 기반 물리 디렉터리 뼈대(42개 폴더) 구축 완료**:
  - `packages/contracts/`, `packages/backend/`, `packages/edge-device/`, `packages/frontend/` 전면 배치 완료.
- **소상공인 vs 마트 도메인 분리 철칙 및 공통 척추(Backbone) 아키텍처 확정**:
  - 마트(바코드/피킹/결품정정)와 소상공인 치킨집(옵션트리/주방조리/즉시배달)의 집합 관계 규명: 마트는 음식점의 상위집합이 아니며, 마트를 만들고 숨긴다고 음식점이 되지 않음을 정밀 증명.
  - 해결책: 공통 척추(TypeID, 가맹점, 주문원장, 결제, 쿼드러플 디스패칭) + 2대 전략(OptionTreeCatalog vs BarcodeCatalog, KitchenFulfillment vs MartPickingFulfillment) 분리 확정.
- **냉혹한 실무 개발 순서 (Walking Skeleton Spike) 선언**:
  - 설계 100% 대비 실행 0%의 현실을 직시하고, 마트·경로당·CTI C드라이버 등 부차 영역을 일시 유예.
  - 최우선 목표: **"소상공인 치킨집 메뉴 1개 등록 ➔ 손님 주문 생성 ➔ 로컬 D1 DB orders 테이블에 1건 적재"**라는 단 하나의 실핏줄(Walking Skeleton)을 뚫는 모노레포 구축에 전력 투구.
- **5대 오픈소스(Enatega / Argon Dashboard / NextOrders) 정통 엔터프라이즈 UI 규격 확립**:
  - 유치한 만화 이모지 및 가짜 alert 목업 전면 폐기.
  - `mart-portal`: 좌측 고정 사이드바, 정통 B2B 그레이 톤, 4대 KPI 메트릭 카드, 고밀도 데이터 그리드(SKU/시세/변동액/정산대사), DOC-11 듀얼 영수증 전문 뷰어 탑재.
  - `merchant-portal`: 소상공인 요식업 주방 KDS(주방 디스플레이) 및 메뉴 품절 관리, BOM 원가 분석기 탑재.
  - 로컬 개발 서버(`dev-server.mjs`, 포트 **`8989`**) 백그라운드 구동 및 3개 엔드포인트(`/`, `/mart/`, `/food/`) 200 OK 실측 검증 완료.

---

## 📚 6. 전사 마스터 문서 체계 현황 (100% 완결)

| 문서 식별자 | 파일 경로 | 주요 내용 및 버전 | 상태 |
| :--- | :--- | :--- | :---: |
| **마스터 설계** | [docs/AITIP_PLATFORM_MASTER_DESIGN_2026.md](file:///c:/Users/user/Desktop/aitip-platform/docs/AITIP_PLATFORM_MASTER_DESIGN_2026.md) | 전사 마스터 기본설계서 및 42개 디렉터리 배치도 (제8장) | **V7.0 최신** |
| **DOC-00** | [docs/DOC-00_AITIP_통합_UID_체계_표준_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-00_AITIP_통합_UID_체계_표준_명세서.md) | 27대 TypeID 프리픽스 표준 배정 및 Crockford Base32 제약 | **V3.2 최신** |
| **DOC-01** | [docs/DOC-01_소비자_및_가맹점_인터페이스_상세기획서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-01_소비자_및_가맹점_인터페이스_상세기획서.md) | 소비자 웹/앱 및 CTI 단말 인터페이스 화면 설계 | **V1.0 최신** |
| **DOC-02** | [docs/DOC-02_식당_마트_AITIP단말기_하드웨어연동_상세기획서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-02_식당_마트_AITIP단말기_하드웨어연동_상세기획서.md) | ESC/POS 듀얼전표, CTI 바이패스, **외부 EMQX MQTT 양방향 브릿지·LWT 원격관제** | **V5.0 최신** |
| **DOC-03** | [docs/DOC-03_시니어_및_배송_안심보안_상세기획서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-03_시니어_및_배송_안심보안_상세기획서.md) | 개인정보 HMAC/AES-GCM 암호화 및 2인1조 시니어 배송 안심망 | **V1.0 최신** |
| **DOC-04** | [docs/DOC-04_Cloudflare_D1_통합데이터베이스_스키마_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-04_Cloudflare_D1_통합데이터베이스_스키마_명세서.md) | Cloudflare D1 관계형 정규화 DDL 및 무결성 제약조건 | **V2.0 최신** |
| **DOC-05** | [docs/DOC-05_Cloudflare_Workers_API_라우트_및_비즈니스로직_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-05_Cloudflare_Workers_API_라우트_및_비즈니스로직_명세서.md) | Workers 엣지 라우팅, 에러 핸들링, 트랜잭션 규칙 | **V1.0 최신** |
| **DOC-06** | [docs/DOC-06_라즈베리_하드웨어_CTI_단말기_부품BOM_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-06_라즈베리_하드웨어_CTI_단말기_부품BOM_명세서.md) | CTI 단말기 전자회로, 부품 BOM, 원가 및 조립 규격 | **V1.0 최신** |
| **DOC-07** | [docs/DOC-07_가맹점_마트_참여기관_정보등록_UIUX_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-07_가맹점_마트_참여기관_정보등록_UIUX_명세서.md) | ESM 모듈화, API 계층화, 인라인 0초 딜레이 편집 UI/UX | **V1.0 최신** |
| **DOC-08** | [docs/DOC-08_요식업_골목상권_주방운영_원가계산_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-08_요식업_골목상권_주방운영_원가계산_명세서.md) | 3대 채널(배달/포장/홀), 듀얼 ESC/POS 주방전표, BOM 원가계산 | **V1.0 최신** |
| **DOC-09** | [docs/DOC-09_하나로마트_다채널접속_및_위탁운영_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-09_하나로마트_다채널접속_및_위탁운영_명세서.md) | 구매자 3대 접속, 운영자 4대 모드, 엑셀 시세 패치, 위탁 포털 | **V1.0 최신** |
| **DOC-10** | [docs/DOC-10_배달대행사_외주연동_및_디스패칭_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-10_배달대행사_외주연동_및_디스패칭_명세서.md) | 쿼드러플 디스패칭 4단계 라우팅, 지역 대리점망(지사) 및 외주 3사 본사 연동, 동적 서지/ETA, PoD, 기사 정산 | **V2.0 최신** |
| **DOC-11** | [docs/DOC-11_품절부분취소_영수증재발행_및_보조금회계대사_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-11_품절부분취소_영수증재발행_및_보조금회계대사_명세서.md) | 결품 듀얼 영수증 라이프사이클(취소+정정), 금융 결제 2대 안전망, 보조금 회계 대사 | **V1.0 최신** |
| **DOC-12** | [docs/DOC-12_CS_분쟁조정_오배송보상_및_악성리뷰_방어정책_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-12_CS_분쟁조정_오배송보상_및_악성리뷰_방어정책_명세서.md) | 배달사고 4대 과책분계(claims), 평점분리(음식vs배달), 24시간 블라인드 소명권(reviews) | **V1.0 최신** |
| **DOC-13** | [docs/DOC-13_카카오알림톡_0504안심번호수명주기_및_고객CRM_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-13_카카오알림톡_0504안심번호수명주기_및_고객CRM_명세서.md) | 알림톡 5단계, 이통사 SMS 폴백, 0504 안심번호 60분 수명주기, 단골 상생 CRM | **V1.0 최신** |
| **DOC-14** | [docs/DOC-14_스마트단말기_MDM_원격관제_및_OTA_무중단펌웨어_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-14_스마트단말기_MDM_원격관제_및_OTA_무중단펌웨어_명세서.md) | MDM 5대 텔레메트리 감시망, A/B 파티션 무중단 OTA 배포, 하드웨어 와치독 롤백 | **V1.0 최신** |
| **DOC-15** | [docs/DOC-15_가맹점_경영분석BI_원가기여도_및_수요예측_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-15_가맹점_경영분석BI_원가기여도_및_수요예측_명세서.md) | 일간 실질 공헌이익 BI 스냅샷, 4분면 메뉴 진단, 기상 연동 AI 발주 추천, 영양 리포트 | **V1.0 최신** |
| **DDL 스키마** | [docs/schema_aitip_v01.sql](file:///c:/Users/user/Desktop/aitip-platform/docs/schema_aitip_v01.sql) | D1 SQLite 정규화 스키마 (278개 제약조건 실측 통과) | **V3.1 최신** |
| **테스트 스위트** | [scripts/test_schema_integrity.py](file:///c:/Users/user/Desktop/aitip-platform/scripts/test_schema_integrity.py) | 278개 제약조건 자동 검증 파이썬 스크립트 | **100% PASS** |
| **행동 강령** | [.agents/AGENTS.md](file:///c:/Users/user/Desktop/aitip-platform/.agents/AGENTS.md) | 절대 행동 원칙: 사전 보고·승인제, UID 무결성, ESM/API 모듈화 | **절대 준수** |

---

## 🛠️ 7. 그 폴더(`aitip-platform`)에서 즉시 실행할 5단계 실무 개발 체크리스트

- [ ] **[1단계] GitHub 배달 오픈소스 벤치마킹 및 코어 백엔드 스캐폴딩**:
  - `packages/contracts/types`: 27대 TypeID Crockford Base32 유효성 검증기 구현
  - `packages/backend`: Hono.js 기반 초경량 API 서버 (`dev-server.mjs`, 포트 **`8989`**) 구축
  - ESM 모듈화 및 전용 API 서비스 계층 (`packages/frontend/api/`) 기본 뼈대 수립
- [ ] **[2단계] 가맹점·메뉴·주문·공동구매 RDBMS 마스터 스키마 구축**:
  - `merchants` / `stores` (소상공인 식당, 하나로마트, 급식센터)
  - `products` / `menus` (음식 메뉴, 신선 식자재, 마트 생필품)
  - `orders` (일반 주문, 경로당 공구, 마을 공구)
  - `order_group_pools` (공동구매 참여자 및 묶음 배송 풀링 로직)
  - `devices` (단말기 시리얼, 매장 매핑, 접속 상태)
- [ ] **[3단계] AITIP 단말기 실시간 연동 프로토콜 (Hardware Bridge) 구현**:
  - `packages/backend/transport/`: WebSocket / MQTT 기반 실시간 주문 브로드캐스팅 (지연시간 < 500ms)
  - 단말기 주문 수락 / 조리 시간 전송 API 및 2중 타이머 에스컬레이션
  - `packages/edge-device/print-spooler`: 영수증 프린터 자동 인쇄 규격 (ESC/POS 주방전표·영수증 듀얼 포맷팅)
- [ ] **[4단계] 소상공인 점주용 AITIP 단말기 웹 뷰 & 고객 주문 PWA 구현**:
  - `packages/frontend/merchant-portal`: AITIP 터치 전용 고대비 가맹점 POS & 주방 KDS 화면
  - `packages/frontend/pwa-order`: 모바일 반응형 고객 주문 웹 (소상공인 메뉴 배달·포장 주문)
- [ ] **[5단계] 2대 파생 서비스 UI 및 공동구매(공구) 모듈 구현**:
  - 경로당 영양급식 수·발주 및 입고 검수 터치 화면
  - `packages/frontend/mart-portal`: 단위농협 하나로마트 피킹/패키징(Pick & Pack) 작업자 뷰
  - `packages/frontend/pwa-rider`: 라이더 실시간 배차 및 가택 안부확인 결합형 배송 PWA
```
