# 🚀 AITIP-Platform 마스터 핸드오버 및 실무 개발 지침서 (HANDOVER)

> **문서 번호**: AITIP-HANDOVER-2026-V33  
> **최종 갱신 일시**: 2026-11-25 16:26 (KST)  
> **시스템 규격**: STD-ENTERPRISE-MASTER-2026-V26 (전사 8대 계층형 UID & 통계청 KSIC-11 5자리 법정코드 결합, 주소 엔진 ➔ 관할 총판·대리점 자동 매핑 거버넌스, $O(1)$ 핀포인트 조회, UI 숨김 표시 및 토글 관제, 소상공인 본체 코어 & AITIP 단말기 연동, 경로당·마을 공동구매 메커니즘, 쿼드러플 디스패칭, 결품 듀얼 영수증, CS 분쟁, 알림톡/0504, MDM/OTA, 경영BI/수요예측 완전 통합, 전사 이모티콘 100% 완전 박멸, 물음표 커서 영구 퇴출, 전사 테이블 1열 상호명/관리코드 전진 배치, 가맹점 상세 관제 SSOT 모달 완성, MQTT-하드웨어 기술 규격서 증보 v1.1.0 완비, MQTT 실시간 중추망 3대 파이프라인 E2E 100% 가동, 전사 8대 계층형 UID 일원화 정규화 완결, 카카오 최신 CDN t1.kakaocdn.net 및 PWA 서비스 워커 sw.js 캐시 판올림 전사 7개 프로젝트 100% GitHub 푸시 완료, Cloudflare Pages 서버리스 한계 규명 및 TryCloudflare 퀵 터널 원격 실물 테스트 체계 완비, 슈퍼관리자 단순 조회를 탈피한 4대 축 실무형 통합 관제탑 Control Tower 고도화 로드맵 수립)  
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

### [Day 4] 2026-11-09 (전사 16대 명세 100% 완성 및 물리 뼈대 구축)
- **하나로마트 다채널 접속 및 위탁 운영 명세서 (`DOC-09`) 수립**:
  - 구매자 3대 접속 및 운영자 4대 모드(POS, 백오피스, 매대, 위탁포털) 확립. D1 확장(Section 24) **198/198 PASS**.
- **배달대행사 외주 연동 및 쿼드러플 디스패칭·서지·ETA 명세서 (`DOC-10`) 수립**:
  - 시니어클럽 -> 가맹점 계약 **지역 배달대리점(`LOCAL_AGENCY` 지사망)** -> 전담라이더 -> 외주3사 본사 API. D1 확장(Section 20 & 25) **278/278 PASS**.
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

### [Day 5] 2026-11-10 ~ 2026-11-11 (치킨집 포털 & PWA 위저드 및 인쇄 모듈 고도화)
- **써브웨이 방식 4단계 풀 코스 세트 위저드 완결**:
  - `1. 부위 선택 (필수)` -> `2. 소스/토핑 (선택)` -> `3. 사이드 메뉴 (선택)` -> `4. 음료·주류 (선택)` 풀코스 주문 흐름 확립.
- **주문 방식별 장바구니 100% 완전 분리**:
  - `state.carts = { DELIVERY: [], TAKEOUT: [], DINE_IN: [] }` 구조 적용으로 배달/포장/매장식사 간 장바구니 데이터 격리.
- **바코드 및 매장/테이블 QR 인쇄 시스템 탑재**:
  - 순수 ESM SVG 1D 바코드(Code-128 Subset B) 및 2D QR 코드 벡터 생성기 탑재, 매장 QR 및 6구 테이블 부착용 스티커 시트 브라우저 원클릭 인쇄 연동.

### [Day 6] 2026-11-12 (플랫폼 마스터 관리자(HQ) 구축 및 오리지널 화이트-민트 UI 고도화)
- **한글 인코딩 결함 및 실시간 주문 0원 계산 버그 완전 해결**:
  - `store_data.json` mock live orders 내 한글 깨짐(`?????`) 전면 복구.
  - `pwa-app.js` 및 `[[path]].js` 내 `items_total`, `delivery_tip`, `final_payment_amount` 계산 로직 방어적 보강 완료.
  - `BroadcastChannel` 기반 PWA-to-KDS 1ms 실시간 주문 동기화 및 5초 주기 폴링/알림 벨 chimes 탑재.
- **사장님 포털 PWA 시뮬레이터 실제 PWA iframe 100% 미러링 탑재**:
  - 구형 300라인 정적 렌더러 제거, 실제 고객 PWA 화면(`pwa/`)을 iframe으로 직접 임베딩하여 장바구니/영수증/바코드 100% 정합성 유지.
- **엔터프라이즈 플랫폼 마스터 관리자 및 다중자산 정산 상세설계서 (`DOC-18`) 완결**:
  - 해외 5대 서비스(Clover, Meituan, Toast, Square, Shopify Plus) 벤치마크를 통한 전사 3대 결손 영역 보완.
  - 3계층 유통망: 본사(HQ) -> 17개 광역 총판(`dst_`) -> 226개 지역 대리점(`agn_`) -> 영업사원(`fsr_`).
  - '수수료 0원' 용어 배제 및 '원가 기반 실비 정산 및 가맹점 정산 요율 체계' 정립.
  - 다중 자산(신용카드, 카드사 포인트 복합결제, 지자체 지역화폐, 스테이블코인 USDT/USDC) 실시간 3자 대사(Reconciliation).
  - 가맹점 실지급(D+1), 대리점 사업소득 3.3% 원천징수, 총판 10% 부가세 전자세금계산서 발행 및 국세청 표준 CSV 연계.
- **플랫폼 마스터 관리자 포털 (`packages/platform-admin/`) 신설 및 구축**:
  - **오리지널 화이트 & 민트 테마 복원**: 가맹점 관리자 및 PWA와 100% 일치하는 화이트 서피스 + 브랜드 민트(`--brand-mint: #2AC1BC;`, `--brand-mint-text: #0E706C;`, `--brand-mint-light: #E6F7F6;`) 테마 적용.
  - **대항목 아코디언(접기/펴기) 구조화**: 사이드바 10개 메뉴를 4대 대분류(`nav-group`)로 묶고 원클릭 접기/펴기 및 SVG 화살표 회전 애니메이션 탑재.
  - **4px 슬림 커스텀 스크롤바**: 윈도우 OS의 거친 기본 스크롤바를 완전히 제거하고 4px 투명 트랙 및 슬림 썸 적용.
  - **Module 01 전국 통합 경영 BI 대시보드 (`dashboard.js`)**: 4대 핵심 KPI 카드, 다중 자산 점유율 그래프, 6대 외부 게이트웨이 헬스체크, 전국 실시간 주문 스트림 테이블 탑재.
  - **규칙 4 준수 API 레이어 (`admin-api.js`)**: 컴포넌트 내 인라인 fetch 전면 금지, `/api/admin/*` 전용 API 클라이언트 일원화 및 안전한 TypeID 폴백 목업 내장.
- **로컬 개발 서버 및 빌드 파이프라인 동기화**:
  - `dev-server.mjs`: `/admin/` 라우팅 등록 및 AITIP 통합 개발 허브 랜딩 페이지 카드 연동.
  - `scripts/build-pages.mjs`: `packages/platform-admin/` -> `dist/admin/` 배포 빌드 동기화.
  - 로컬 포트 `8989`에서 `/`, `/admin/`, `/food/`, `/food/pwa/`, `/mart/` 전 포털 200 OK 실측 검증 완료.
- **Git 원격 저장소(`main`) 푸시 완료**:
  - 최신 커밋: `8a4be0b` (`feat(admin): apply authentic white-mint theme and collapsible accordion sidebar`)
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
| **DOC-00** | [docs/DOC-00_AITIP_통합_UID_체계_표준_명세서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-00_AITIP_통합_UID_체계_표준_명세서.md) | **8대 계층형 UID & 통계청 KSIC-11 법정코드 결합 및 주소 엔진 매핑 거버넌스** | **V3.0 최신** |
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
| **DOC-18** | [docs/DOC-18_엔터프라이즈_플랫폼_마스터_관리자_및_다중자산_정산_상세설계서.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-18_엔터프라이즈_플랫폼_마스터_관리자_및_다중자산_정산_상세설계서.md) | **주소 엔진 ➔ 관할 총판·대리점 자동 매핑 스트립 및 UI 숨김 표시 거버넌스** | **V2.0 최신** |
| **DOC-20** | [docs/DOC-20_공공데이터포털_HACCP_상품바코드_API_연동가이드.md](file:///c:/Users/user/Desktop/aitip-platform/docs/DOC-20_공공데이터포털_HACCP_상품바코드_API_연동가이드.md) | **공공데이터포털 HACCP 제품이미지·바코드 API(`CertImgListServiceV3`) 연동 및 Cloudflare 이관 가이드** | **V1.0 최신** |
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

---

## 🏛️ 8. 전사 계층형 UID 및 주소 엔진 ➔ 영업망 자동 매핑 구축 완료 보고 (2026-11-14)

### 1) 8대 계층형 UID 규격 (`전사06.md` 표준 승격) + 통계청 법정 5자리 코드 결합
- **가맹점 식별자**: `STR-{시도2}-{시군구3}-{대리점2}-{통계청업종5}-{점포순번4}` (예: `STR-11-650-01-56162-0001` 바른치킨 서초본점)
- **하나로마트 식별자**: `MRT-{시도2}-{시군구3}-{대리점2}-{통계청업종5}-{마트순번4}` (예: `MRT-11-650-01-47121-0001` 서초농협 하나로마트 양재점)
- **수요 복지시설 식별자**: `FAC-{시도2}-{시군구3}-{대리점2}-{통계청업종5}-{시설순번4}` (예: `FAC-11-650-01-87391-0001` 서초구 양재1동 복지센터)
- **주문 식별자**: `ORD-{가맹점UID}-{영업일자6}-{전표순번4}` (예: `ORD-11-650-01-56162-0001-261113-0042`)

### 2) $O(1)$ 가맹점 핀포인트 조회 실측 검증 완료 (풀스캔 0%)
- `adminApi.getMerchantByOrderId('ORD-11-650-01-56162-0001-261113-0042')` ➔ 식별자 직접 파싱을 통해 수백만 건 DB 풀스캔 없이 단 1ms 만에 판매 가맹점 `STR-11-650-01-56162-0001` 즉시 반환.
- `adminApi.getMerchantByOrderId('ORD-11-650-01-47121-0001-261113-0012')` ➔ `47121` 업종코드 판별을 통해 하나로마트 직배 매장 즉시 반환.

### 3) 공공 주소 엔진과 사설 영업망 분리 및 순방향 매핑 실현
- 주소 검색엔진에는 사설 법인명(총판, 대리점 이름)을 1글자도 포함하지 않음 (순수 행정구역: 대한민국 17개 시·도, 시·군·구 도로명).
- 사용자가 순수 행정구역 선택 시, 시스템 계약망 테이블(`TERRITORY_AGENCY_MAP`)을 통해 **관할 광역 총판 및 담당 대리점이 검색창 하단 배지 스트립으로 자동 도출**되어 즉시 핀포인트 필터링 연동.

### 4) 금연 프로젝트 규격 'UID 숨김' 체크박스 및 컬럼 토글 실측 완료
- **사용자 핵심 지적**: "이모지콘 쓰지마. 그리고 uid 숨김은 왜?? 이렇게 처리를 하지?? 금연 프로젝트 처럼 하면 될 것을 전사 v06이 디자인 관련 사항도 포함되어 있을 텐데."
- **정석 구현 내용**:
  1. **상단 컨트롤 바**: `<label><input type="checkbox" id="chkHideUid" /> UID 숨김</label>` 체크박스 배치 (이모티콘 전면 배제).
  2. **독립 컬럼 분리**: 1열 전표번호(`A-42` 뱃지), 2열 `주문 식별자 (UID)` 전용 열, 3열 판매 매장 분리.
  3. **컬럼 단위 숨김(Column Toggle)**: 'UID 숨김' 체크 시 2열 식별자 열 전체가 `display: none;`으로 감추어져 매장명과 주문 품목, 결제금액 중심의 시원한 뷰 제공.
  4. **전체 펼침 모드**: 체크박스 해제 시 37자리 계층형 UID 전체가 가로 1줄(`white-space: nowrap`)로 당당하게 펼쳐지며 순수 `<code>${id}</code>` 표준 규격으로 표출 (사족 복사 버튼 완전 제거).
  5. **이모티콘 전면 배제 (전사06.md 제6장 5절 표준 준수)**: 관리자 화면 전역에서 무분별한 이모티콘을 100% 제거하고 `[관할 행정코드]`, `[관할 총판]`, `[관할 대리점]`, `조건 조회` 등 품격 있는 행정 표준 텍스트 레이블 적용.
- **실측 증적**:
  - 기본 상태 (UID 숨김 체크 상태): `step_269_shot_1_orders_default_checkbox_checked.png`
  - 체크 해제 (UID 전용 컬럼 펼침 상태): `step_273_shot_1_orders_uid_expanded_checkbox_unchecked.png`
  - 서초구 매핑 스트립 실측: `final_step_273.png`

### 5) 사용자 피드백 반영 및 UI 정규화 최종 요약
- **조치 결과**:
  1. `packages/platform-admin/js/modules/erp-filter.js`에서 왜곡된 라벨('권역/총판', '총판 전체')을 전면 폐기하고, 대한민국 표준 행정구역인 `시·도 (권역):`, `시·군·구:`로 100% 정규화.
  2. 행정구역 선택 시 하단에 계약망 테이블(`TERRITORY_AGENCY_MAP`)이 실시간 매핑되어 `[관할 행정코드: 11-650] 서울특별시 서초구 | [관할 총판] 서울광역 총판 (주)에이티파트너스 | [관할 대리점] (주)서초네트웍스 (대리점 01)  영업망 자동 매핑 완료` 배지 스트립 생성.
  3. `scripts/build-pages.mjs` 배포 빌드를 통해 `dist/admin/`에 100% 반영 완료.
  4. 브라우저 실측 에이전트를 통해 실시간 주문 관제(#orders), 전국 배송망 관제(#riders), 통합 대시보드(#dashboard) 전 화면에서 정규화된 주소 엔진 및 금연 프로젝트 규격 UID 컬럼 숨김 토글 작동 증적 확보.

### 6) 단말기 S/N 인벤토리 정규화 및 MQTT 프로비저닝 확정 (2026-11-14)
- **사용자 핵심 질문**: "1. 왜? 여기에 이렇게 표시를 하지 2. 네 말대로 하면 단말기 s/n 관리도 있어야 한다는 것인데? 맥 주소는 설치시 sn과 같이 mqtt로 전송되는 건가?"
- **조치 결과**:
  1. **단말기 자산 테이블 정규화 (`packages/platform-admin/js/modules/hardware-mdm.js`)**:
     - 기존의 무의미한 내부 UUID(`dev_01...`)를 테이블 전면에서 완전 퇴출.
     - 1열: 기기 외관 바코드와 1:1 일치하는 **단말기 시리얼 (S/N)** (`CTI-BRD-882910` 등 굵은 고정폭 코드) 배치.
     - 2열: 통신칩 고유 주소인 **하드웨어 MAC 주소** (`B8:27:EB:14:8A:21`)를 독립 컬럼으로 분리.
     - 3열: **설치 매핑 점포** (`바른치킨 서초본점` 등 상호명 및 가맹점 UID) 배치.
  2. **단말기 S/N 관리 및 MQTT 부팅 프로비저닝 프로토콜 확정**:
     - 공장 출고 시 EEPROM에 S/N과 물리 MAC 주소 각인 및 바코드 부착.
     - 대리점 기사가 현장 방문 시 S/N 바코드 스캔 + 가맹점 UID 1차 사전 매핑 등록.
     - 단말기 전원 인가 시 에이전트가 EEPROM에서 S/N과 MAC 주소를 자체 리딩하여 MQTTS 포트 8883 `aitip/provision/handshake` 토픽으로 전송.
     - 본사 서버가 매핑 검증 후 MAC 주소 확정 바인딩 및 기기 온라인 활성화 (`is_online = 1`).
  3. **브라우저 실측 검증 완료**:
     - 실측 스크린샷: `step_287_shot_1_hardware_column_normalization.png` (또는 `final_step_287.png`).

### 8) 전사 테이블 정규화, 무작위 TypeID 전면 퇴출, 물음표 커서(cursor: help) 완전 박멸 및 가맹점 상세 관제(SSOT) 모달 완성 (2026-11-14)
- **사용자 핵심 지적**:
  - "all 커서를 찾을 께 아니라, 이런 거 깔끔ㅎ하게 정리 안해. 아주 지긋지긋하다. 이모지콘 쓰는 습관은."
  - "너는 어떻게 미디엄 보다 더 못하지? 하... 또 말한 부분만 수정 했구나,, 할 말이 없다. 어떻게 보면 네가 맞는 거 같고.."
  - "뭘 했다는 거지 마우스에 물음표만 뜨는데? 상단에 초기화, 선택하고 상세 보기를 하면 더 좋지 않을 까?? 이런 것도 다 얘기를 해야 하는 거지?"
  - "상세보기는 적용 안한거 아니야?"
- **정밀 타격 및 전사 아키텍처 개편 내용**:
  1. **플랫폼 전역 이모티콘 100% 완전 박멸 (`전사06.md` 제6장 5절 표준 완결)**:
     - `index.html` (라인 202: 배너 `⚠️` ➔ `[알림]`, 라인 220: 헤더 셀렉트 `🏢` 완전 삭제)
     - `organization-tree.js` (라인 65~74: 탭 버튼 `🌐`, `🏢`, `🏬`, `🤝` 전면 삭제)
     - `onboarding.js` (라인 97: `📋` 삭제)
     - `partner-integrations.js` (라인 65, 87: `🛡️`, `⛔` ➔ `[CLOSED] 정상 바이패스`, `[OPEN] 트래픽 차단`)
     - `payments-control.js` (라인 19, 22, 60, 148: `🔵`, `🟠` 전면 삭제)
     - `riders-dispatch.js` (라인 51: `⚠️` ➔ `[지연주의]`)
     - `settlement-taxes.js` (라인 96, 110, 129, 132: `🔵`, `🟢` 전면 삭제)
  2. **물음표 커서(`cursor: help`) 완전 박멸 & 실체적 [상세보기] 모달 탑재**:
     - `admin-app.js` (라인 333), `dashboard.js` (라인 136, 189, 193)에 잔존하던 `cursor: help` 전면 삭제.
     - 대시보드 점포 원장 테이블 행 클릭(`cursor: pointer`) 및 각 행 마지막 11열에 `[상세보기]` 버튼 신설.
     - `showStoreDetailModal(store, agency, devices)` 중앙 모달 연동:
       - [기본 사업자 및 매장 정보]: 상호명, 업종 구분, 사업자등록번호, 대표자/연락처, 도로명 소재지 주소.
       - [소속 영업망 & 관리 체계]: 소속 광역 총판 법인명, 소속 지역 대리점 상호명, 대리점 담당자, 영업망 수수료율(0.5%), 관할 권역.
       - [설치 단말기 & CTI 하드웨어]: 가동 대수(2대), 대표 단말 S/N(`CTI-BRD-882910`), MAC 주소(`B8:27:EB:14:8A:21`), 연동 POS사, MQTT 8883 실시간 통신망.
       - [당일 영업 및 결제 정산]: 당일 주문(42건), 당일 거래액(1,145,000원), D+1 정산 주기, 정산 수취 계좌(신한은행), 가맹점 상태.
  3. **전사 테이블 1열 무작위 TypeID 전면 퇴출 및 인간 친화적 법인 상호명 전진 배치**:
     - **광역 총판 관리 (`#distributors`)**: 1열 `총판 식별자 (TypeID)` 제거 ➔ 1열 `광역 총판 법인명` (`서울광역 총판 (주)에이티파트너스`) 및 보조 관리코드(`DIST-11`) 전진 배치. 관제 액션 버튼 `[총판 뷰 전환]` 줄바꿈 방지.
     - **지역 대리점 관리 (`#agencies`)**: 1열 `대리점 상호명` (`강남제일정보시스템`, `(주)서초네트웍스`) 전진 배치. 3열 `소속 광역 총판`에 무작위 UUID(`agn_...`) 대신 실제 총판 법인명(`서울광역 총판 (주)에이티파트너스`) 매핑 표출. 관제 액션 `[대리점 뷰 전환]` 단정화.
     - **제휴 협력사 관리 (`#partners`)**: 1열 `협력사 법인 상호명` (`(주)한국밴정보시스템`), 2열 `제휴 협력사 유형` 전진 배치.
     - **대시보드 점포 원장 (`#dashboard`)**: 6열 `소속 대리점`에 무작위 UUID 대신 실제 대리점 상호명(`(주)서초네트웍스`, `강남제일정보시스템`) 매핑 표출.
  4. **상단 헤더 우측 버튼 깨짐 완벽 방지 (`admin.css`)**:
     - `.header-btn` 클래스에 `white-space: nowrap; flex-shrink: 0;`를 명시하여 좁은 화면에서도 `실시간 새로고침`, `가맹점 포털`, `하나로마트` 버튼이 가로 1줄로 단정하게 유지되도록 고정.
  5. **브라우저 실측 증적 전수 확보 (전사 7대 핵심 모달 100% 검증 완료)**:
     - 1) 통합 대시보드 점포 상세 모달 실측: `final_step_353.png` (`step_344_shot_1_dashboard_store_modal_opened.png`)
     - 2) 가맹점 계약 & 매장 관리 점포 상세 모달 실측: `step_365_shot_1_merchants_store_modal_opened.png`
     - 3) 실시간 주문 스트림 전표 및 4자 정산 분개 상세 모달 실측: `step_369_shot_1_orders_detail_modal_opened.png`
     - 4) 광역 총판 법인 상세 모달 실측: `step_369_shot_2_distributor_modal_opened.png`
     - 5) 지역 대리점 상세 모달 실측: `step_375_shot_1_agency_modal_opened.png`
     - 6) 전국 배송망 라이더 상세 모달 실측: `step_395_shot_1_riders_modal_opened.png` (`final_step_395.png`)
     - 7) 단말기 S/N 인벤토리 & MDM 상세 모달 실측: `step_300_shot_1_step_296_shot_1_hardware_modal_opened.png` (`final_step_308.png`)


### 9) 온보딩 심사 5대 서류 대사판 모달 완성, "뭘 보완하지?" 보완요청 다이얼로그 탑재 및 헤더/버튼 꺾임 100% 박멸 (2026-11-14)
- **사용자 핵심 지적**:
  - 사용자 첨부 스크린샷 4장: 광역 총판(`agn_...` 및 `빙의 관\n제 ->`), 지역 대리점(`AITIP 마스터 관리\n자`, `지역 대리점 관리 (Regional\nAgencies)`, `실시간 새로고\n침`), 제휴 협력사(탭 바 이모티콘 4종 및 액션 부재), 온보딩 심사(`서류 심\n사중` 및 `뭘 보완하지?`).
  - "뭘 보완하지?" (단순 텍스트 [보완요청] 버튼만 있고 실체적 검토 및 보완 사유 입력 창이 없는 문제).
- **정밀 타격 및 구현 완료 내용**:
  1. **헤더 및 타이틀 줄바꿈(꺾임) 완전 박멸 (`packages/platform-admin/admin.css`)**:
     - `.brand-title` (라인 130): `white-space: nowrap; flex-shrink: 0;` 적용 -> `AITIP 마스터 관리자` 260px 사이드바에서 1줄 고정.
     - `.view-page-title` (라인 352): `white-space: nowrap; flex-shrink: 0;` 적용 -> `지역 대리점 관리 (Regional Agencies)` 1줄 고정.
     - `.badge-status` (라인 566): `white-space: nowrap; flex-shrink: 0;` 적용 -> `서류 심사중` 뱃지 1줄 고정.
     - `.header-btn` (라인 385): `white-space: nowrap; flex-shrink: 0;` -> `실시간 새로고침`, `가맹점 포털 ->`, `하나로마트 ->` 수평 1줄 정규화.
  2. **신규 입점 온보딩 심사 화면 개편 (`packages/platform-admin/js/modules/onboarding.js`)**:
     - 1열: 기계용 26자리 난수 대신 상호명(`성심당 서초점 (가칭)`) 및 표준 접수번호(`접수번호: APP-2026-00129`) 표출.
     - 8열: 심사 상태 뱃지 `white-space: nowrap;` 적용으로 `서류 심\n사중` 세로 꺾임 100% 박멸.
     - 9열: 심사 액션에 `[서류 심사]`, `[보완요청]`, `[승인]` 3대 버튼 가로 인라인 배치.
  3. **신규 입점 가맹점 5대 필수 서류 검증 중앙 모달 (`showOnboardingReviewModal`) 탑재**:
     - 사업자등록증 사본, 일반음식점 영업신고증, 정산 통장 사본, 매장 간판 사진, 판매 메뉴 및 단가표 5대 서류의 제출 파일명과 검증 상태(`VERIFIED` / `REQUIRES_CHECK`)를 대조하는 전용 모달.
     - 모달 내에서 점포 인허가/계좌 명세 확인 및 `[서류 보완 요청]`과 `[최종 입점 승인]` 직접 실행.
  4. **서류 보완 요청 대화형 다이얼로그 (`showRevisionRequestModal`) - "뭘 보완하지?" 명쾌한 해결**:
     - 보완 대상 5대 서류 다중 체크박스 선택 (사업자등록증, 영업신고증, 통장 사본, 매장 사진, 메뉴판).
     - 구체적 보완 사유 입력 Textarea (기본 가이드 문구 제공: 예: `[영업신고증 대표자명 불일치] ...`).
     - 수신 점주 통보: `${app.rep_name} (${app.phone})` 대상 카카오 알림톡 & LMS 발송 시뮬레이션 처리.
  5. **제휴 협력사 관리 (`#partners`) 및 광역 총판 관리 (`#distributors`) 정규화**:
     - 탭 바 유니코드 컬러 이모티콘 100% 영구 박멸 및 텍스트 표준화.
     - 제휴 협력사 테이블 9열에 `[상세보기]` 버튼 전수 배치.
  6. **브라우저 실측 증적 전수 확보**:
     - 1) 온보딩 5대 서류 심사 대사판 모달: `step_406_shot_1_step_406_shot_1_onboarding_review_modal_opened.png`
     - 2) 온보딩 서류 보완 요청 다이얼로그 ("뭘 보완하지?"): `step_406_shot_2_step_406_shot_2_onboarding_revision_dialog_opene.png`
     - 3) 광역 총판 관리 1줄 레이아웃 (타이틀/헤더/액션 꺾임 0건): `step_410_shot_1_step_409_shot_1_distributors_clean_layout.png`
     - 4) 제휴 협력사 관리 이모티콘 0건 & 상세보기 탑재: `step_410_shot_2_step_409_shot_2_partners_clean_layout.png`


### 10) 메뉴 6(5자 다차원 정산 원장) UID 잔재 완전 박멸 및 [상세보기] 모달 탑재 (2026-11-14)
- **사용자 핵심 지적**:
  - "메뉴6에는 아직도 uid 잔재가 남아 있고, 상세 보기도 안되고.."
  - 첨부 이미지: `#settlement-taxes` 테이블 1열에 26자리 원시 TypeID(`agn_01jcbk9v502x8m4v0k5a1b2c01` 등) 4건이 노출되어 있고 우측에 [상세보기]가 없는 상태.
- **정밀 타격 및 구현 완료 내용**:
  1. **유통망 세무 정산 센터 (`packages/platform-admin/js/modules/settlement-taxes.js`)**:
     - 1열: 기계용 26자리 UID(`agn_...`)를 메인에서 완전 걷어내고, 파트너 상호명(`강남제일정보시스템`, `(주)서초네트웍스` 등)을 굵게 전진 배치. 아래 서브텍스트로 대표자명 및 표준 세무 관리코드(`TAX-01JCBK9V`) 표출.
     - 10열: `<th>관제 액션</th>` 열 신설 및 `[상세보기]` 버튼 전수 배치 (`white-space: nowrap;`).
     - **`유통망 세무 및 수수료 정산 상세 원장 (Tax Settlement SSOT)`** 중앙 모달 구현:
       - 파트너 기본 사업자 정보 (상호, 대표자, 관할 권역, 등록 형태)
       - 당월 수당 발생 및 과세 유형 (수당 원금, 3.3% 원천징수 vs 10% 전자세금계산서, 적용 세율)
       - 세액 공제 및 실지급/청구 분개 (공제/부가 세액, 최종 실지급/청구액, 정산 수취 계좌 일치 인증)
       - 국세청 전자신고 & 감사 증적 (홈택스 서식 번호, 전자신고 상태, 마감 주기, SHA256 감사 로그)
       - 하단 `[국세청 전자신고서 사본 확인]`, `[닫기]` 버튼 탑재.
  2. **결제 & 3자 대사 정산 관제 (`packages/platform-admin/js/modules/payments-control.js`)**:
     - 1열: `mat_01...` 원시 정산 키 대신 금융 표준 승인 번호(`TID-20261113-2C01`)와 표준 주문번호(`ORD-11-...`) 단정하게 표출.
     - 9열: 관제 액션 열에 표준 `[상세보기]` 버튼 정규화.
  3. **브라우저 실측 증적 전수 확보**:
     - 1) 유통망 세무 정산 상세 원장 모달 실측: `step_422_shot_1_step_421_shot_1_settlement_taxes_modal_opened.png`
     - 2) 결제 & 3자 대사 정산 관제 정규화 테이블 실측: `step_424_shot_1_step_423_shot_1_settlement_merchants_clean.png`


### 11) 결제(TID/승인번호)-5대서비스 가맹점(STR)-D1 정산(SET) UID 연동 체계 및 우측 슬라이드 드로어 상세 원장 완성 (2026-11-14)
- **사용자 핵심 지적 및 지침**:
  - "tid는 왜 이 구조 이지? ord은 왜 같이 병기 하고."
  - "아니지 tid도 구분이 되어야지."
  - "너 진짜, 5대서비스 구조 소스 제대로 검토한거야, 완전히 개판인데. 내가 물어 본 것은 2번이야. 2번에 대해서 5대 서비스 소스를 검토한거냐고 물어 본거여. 너는 지금 단순히 거래 숫자만 발생시키잖아. 나중에 어떻게 가맹점과 정산을 연동 하는거 냐고? ㅇㅇ 제발 uid체계에 바탕이야,"
- **정밀 타격 및 구현 완료 내용**:
  1. **결제 식별자 분리 및 1열 꺾임 100% 박멸 (`packages/platform-admin/js/modules/payments-control.js`)**:
     - 1열 `거래 식별자 (TID / 승인번호)`에서 32자리 주문번호(`ORD-...`) 병기 완전 삭제.
     - 결제 채널 뱃지(`[토스페이먼츠]`, `[NH농협]`, `[서울페이]`) + 결제망 고유 거래 TID(`TOSS-TX-261113-0042`, `NH-TX-261113-0012` 등) 1줄 고정 (`white-space: nowrap;`).
     - 카드사 승인기관 8자리 승인번호(`승인번호: 38910241`) 하단 인라인 배치.
  2. **가맹점 정보 점포 UID 매핑 (3열)**:
     - 상호명(`바른치킨 서초본점`, `서초농협 하나로마트`, `준오헤어 서초점`, `부티크스테이 서초`)과 D1 계층형 점포 UID(`STR-11-650-01-56162-0001`, `MRT-11-650-01-47121-0001`, `STR-11-650-01-96112-0001`, `STR-11-650-01-55112-0001`) 1:1 매핑 표출.
  3. **5대 도메인 서비스 실체적 D1 트랜잭션 및 정산 원장 규격화 (`packages/platform-admin/js/admin-api.js`)**:
     - 1) 외식 배달 (`food-delivery`): KSIC 56162, D+1 익일 정산, 점주 신한은행 계좌 직결.
     - 2) 마트 B2B 직배 (`mart-logistics`): KSIC 47121, DOC-11 결품 감액 재승인(-7,000원), 과세/면세 복합 분개, 농협은행 계좌 직결.
     - 3) 외식 제로페이 (`food-delivery`): KSIC 56162, 1원 대사 불일치 단수 보전 계정, 국민은행 계좌 직결.
     - 4) 뷰티/헤어 예약 (`booking-beauty`): KSIC 96112, 헤어 디자이너 예약 보증금 시술 완료 연동, 우리은행 계좌 직결.
     - 5) 숙박 예약 (`booking-stay`): KSIC 55112, 객실 예약 체크인 완료 후 D+1 정산, 하나은행 계좌 직결.
  4. **우측 슬라이드 드로어 내 [가맹점 원장 및 D1 정산 직결 연동 정보] 탑재 (`openTxDetailDrawer`)**:
     - 가맹점 상호명 및 점포 UID (`STR-11-650-01-56162-0001`).
     - 원 주문 식별자 (`ORD-11-650-01-56162-0001-261113-0042`).
     - D1 일일 정산 원장 번호 (`SET-11-650-01-56162-0001-261113`).
     - 정산 입금 예정일 (`2026-11-14 (D+1)`).
     - 점주 수취 계좌 (`신한은행 110-***-492011`, 예금주: 주식회사 바른푸드).
     - 정산 승인 상태 (`CALCULATED`).
     - 3자 대사 분개 원장 (가맹점 대금, 라이더 배달료, 플랫폼 상생 수수료, 지역 대리점 관제 수당, PG사 결제망 수수료).
  5. **브라우저 실측 증적 전수 확보**:
     - 1) 테이블 1열(TID) 및 3열(점포 UID) 1줄 정규화 전체 뷰: `step_446_shot_1_step_445_shot_1_settlement_merchants_full_table.png` (`final_step_446.png`)
     - 2) 우측 슬라이드 드로어 상단(승인 전문 개요 및 D1 정산 직결 연동 정보): `step_432_shot_1_step_431_shot_1_settlement_merchants_drawer_open.png`
     - 3) 우측 슬라이드 드로어 하단(3자 대사 정산 분개 원장 및 영수증 인쇄/확인 버튼): `step_434_shot_1_step_433_shot_1_settlement_merchants_drawer_scro.png` (`final_step_434.png`)


### 12) 소상공인 요식업 본체 코어 100% 생산형 완성 및 E2E 전표 인쇄 실측 검증 (2026-11-14)
- **사용자 지침**: "그러면 우선 소상공인 100%를 맞추자.."
- **정밀 타격 및 구현 완료 내용**:
  1. **고객 주문 PWA API 레이어 전면 분리 (`customer-api.js` 신설)**:
     - `pwa-app.js` 내부에 하드코딩되어 있던 인라인 `fetch`를 100% 제거하고 `customerApi` 전용 서비스 모듈로 일원화 (`AGENTS.md` 제4항 API 분리 원칙 완전 준수).
     - 매장 정보(`getStoreInfo`), 메뉴 카탈로그(`getMenuCatalog`), 리뷰(`getReviews`), 초기 병렬 로드(`loadStoreBootstrap`), 실시간 주문 발주(`createOrder`), 배달 추적(`trackOrder`) 일원화.
  2. **Cloudflare Pages Serverless Function 100% 동기화 (`functions/api/food/[[path]].js`)**:
     - 로컬 `food-service.mjs`(1,842라인)의 고급 엔드포인트(정산 대사 `/settlement`, 부가세 신고용 CSV `/settlement/tax-csv`, KDS 주문 접수 `/orders/:id/accept`, 홀 테이블 현황 `/dinein/*`, 휴무일/배달비 규칙 등)를 서버리스 엣지 함수에 100% 대등하게 반영.
  3. **점주 KDS 전표 인쇄 모달 중복 해소 및 감열지 프리뷰 복구 (`merchant-portal/index.html`)**:
     - 기존 `modal-receipt-print`와 신규 `modal-print-receipt` 간의 1단어 ID 불일치 및 `#receipt-paper-box` 중복 DOM 요소를 1개로 단일화.
     - [A-41] 주문 카드의 `[전표/영수증 인쇄]` 클릭 시, TastyPrinter ESC/POS 80mm 표준 주방 조리 전표(전표번호 `A-41`, 접수일시, 조리시간 25분, 0504 안심번호, 배달주소, 세부 맞춤옵션, 조리요청사항)가 중앙에 실물 규격으로 온전히 렌더링되도록 수정.
  4. **고객 PWA ➔ 점주 KDS ➔ 주방 전표 E2E 실측 증적 전수 확보**:
     - 1) 고객 PWA 메뉴 선택 및 0504 안심번호 주문 완료 팝업 (바코드 `* A-41 *` 및 Live Track): `step_473_shot_1_order_completion_popup.png` (`final_step_475.png`)
     - 2) 점주 KDS [A-41] 주문 인입 및 조리시간(25분) 접수 완료: `step_540_shot_1_kds_order_a41_accepted.png`
     - 3) 점주 KDS 주방 조리 전표 모달 실물 렌더링 증적: `step_1044_shot_1_kds_receipt_modal_rendered.png` (`final_step_1044.png`)


---

### 13) 내일(D+1) MQTT 양방향 실시간 중추망 코딩 준비 명세 (2026-11-14 기준)
- **사용자 지침**: "핸드오버 문서, 기본설계서 업데이트 해 놓고, 내일 mqtt 콛, 짤꺼야 준비 해놓아. 전사 v06도 업데이트 해."
- **준수 규격**: `DOC-17 (가맹점 엣지 단말기 공유기 무설정 아웃바운드 MQTT 및 HTTPS 무결성 OTA 상세설계서)`
- **내일 착수할 MQTT 3대 핵심 코딩 과제**:
  1. **초경량 로컬 MQTT 브릿지/브로커 모듈 구축 (`tools/mock-mqtt-broker.mjs` 또는 `dev-server.mjs` WSS 브릿지)**:
     - EMQX v5 MQTTS 8883 / WSS 8084 포트 호환 브로커 엔진.
     - 기기 인증 토큰(HMAC-SHA256) 검증 및 매장별 토픽 격리 ACL 강제.
  2. **고객 PWA 주문 ➔ 백엔드(`food-service.mjs`) ➔ MQTT Publish ➔ 단말기/KDS 0.01초 실시간 수신 직결**:
     - 손님 결제 완료 시 `aitip/stores/{storeId}/orders` 토픽으로 QoS 1 발행.
     - 단말기(`packages/edge-device/transport-client/client.mjs`) 및 점주 KDS가 즉각 수신하여 딩동 사운드 + ESC/POS 80mm 주방 전표 자동 인쇄 트리거.
  3. **단말기 CTI 전화 인입 ➔ MQTT Publish ➔ 점주 KDS 발신번호(CID) 팝업 브리지**:
     - 전화선 링 감지 시 `aitip/devices/{deviceId}/telephony` 발행 ➔ 점주 화면에 단골 고객 정보 및 최근 주문 내역 0.1초 팝업 연동.
- **사전 검증된 인프라 및 파일 경로**:
  - 클라이언트 코어: `packages/edge-device/transport-client/client.mjs` (완비, 30초 Smart Keep-Alive, 지수 백오프 자동 재연결)
  - 단말기 시뮬레이터: `packages/edge-device/tools/device-simulator/simulator.mjs`
  - CTI 브릿지 드라이버: `packages/edge-device/cti-driver/cid-bridge.mjs`


---

### 14) MQTT 실시간 중추망 연동에 따른 하드웨어 영향 분석 및 단말기 기술 규격서(v1.1.0) 제9장 신설 (2026-11-15)
- **사용자 지침**: "이제 기술적 자료이니 진행하기전에 문서화를 해 놓는 것이 어떤가? 결국 이것이 나중에 하드웨어 스펙에 영향이 미치는 것 아닌가?", "ㅇㅇ문서 작업 후 보고 부터 해. 개발사에는 9장을 보내면 되나?"
- **정밀 타격 및 구현 완료 내용**:
  1. **과거 자료(`C:\Users\user\Desktop\Aitip시스템매뉴얼`)와 현재 2026 표준 간의 5대 불일치(GAP) 규명**:
     - 1) 온디바이스 Asterisk 18 PBX 구동 완전 폐기 ➔ Si3050 DAA 링 감지 + 클라우드 MQTT 경량 패킷 전송 전환.
     - 2) 외장 MicroSD 방식 배제 ➔ 온보드 8GB eMMC 5.1 BGA 실장 + Read-Only SquashFS A/B 이중 뱅크 강제.
     - 3) 라즈베리파이/바나나파이 + USB 외장 허브 배제 ➔ RK3566 / H616 올인원 단일 임베디드 보드 표준화.
     - 4) 외장 USB 모뎀 단선 위험 배제 ➔ 온보드 Normally-Closed 무전원 기계식 DPDT 릴레이 물리 바이패스 보장.
     - 5) 인바운드 포트(SIP 5060) 개방 배제 ➔ 순수 아웃바운드 MQTTS 8883 / WSS 443 공유기 무설정 통신.
  2. **단말기 공동 사업 기술 규격서 증보 (`docs/AITIP_Smart_CTI_Terminal_Joint_Hardware_Specification_v1.0.md`)**:
     - 버전 판올림: `v1.0.0` ➔ `v1.1.0 (Joint Engineering & MQTT Network Interface Specification 증보판)`.
     - **[제9장: MQTT 실시간 중추망 연동에 따른 하드웨어 요구 규격] 신설**:
       - 9.1: 공유기 무설정 원칙(Zero-Inbound Port), MQTTS 8883 / WSS 443 3초 자동 폴백, 30초 Smart Keep-Alive (월 5MB 미만).
       - 9.2: 메인 SoC 하드웨어 암호화 가속 엔진(AES/SHA) 필수, RAM 1GB 중 MQTT 소켓 버퍼 50MB 격리 및 OOM 차단.
       - 9.3: 온보드 8GB eMMC 5.1 실장, 10,000건(20MB) 로컬 오프라인 영속성 큐, 5초 저널링 플러시로 10년 수명 보장.
       - 9.4: 식당 마감 멀티탭 강제 차단 방어: 온보드 EDLC 슈퍼커패시터(슈퍼캡) 500ms~1000ms 방전 유예 시간 동안 CTI 기계식 릴레이 NC 복귀, Clean Disconnect, `sync` 완결.
       - 9.5: I2C RTC (PCF8563) + 코인 배터리로 TLS 인증서 만료 방어(3년 오차 ±2ppm), 60초 외부 하드웨어 WDT(와치독) 하드리셋.
       - 9.6: Si3050 DAA 링 감지 ➔ MQTT 발행 지연시간 50ms 이내 보장, ESC/POS 80mm 115200bps RTS/CTS 하드웨어 흐름제어 회로.
       - 9.7: 과거 기획 폐기 항목 및 신규 양산 정합 기준표 수록.
  3. **하드웨어 개발/제조 파트너사 전달 가이드라인 수립**:
     - 개발사에는 단편적인 9장 발췌본이 아닌 **v1.1.0 전체 기술 규격서**를 전달하되,
     - "제1~8장의 물리적 폼팩터/CTI/전원 회로 위에, 소프트웨어 통신망과의 인터페이스 제약조건을 완결짓는 **제9장을 최우선 검토 기준**으로 삼아줄 것"을 명시하여 스펙 왜곡과 부품 오발주를 원천 차단.


---

### 15) MQTT 양방향 실시간 중추망 3대 파이프라인 코딩 및 E2E 실측 검증 완결 (2026-11-15)
- **사용자 지침**: "진행해"
- **정밀 타격 및 구현 완료 내용**:
  1. **초경량 무의존성 실시간 MQTT 브릿지 모듈 신설 (`packages/core/realtime/mqtt-bridge.mjs`)**:
     - 외부 npm 패키지 의존성 0% (Node.js v24 내장 `node:crypto`, `node:events`, `node:buffer` 100% 활용).
     - RFC 6455 표준 WebSocket 프레임 인코더/디코더 (Unmasking 스트림 파서, Ping/Pong 0x09/0x0A, HTTP 101 Switching Protocols 핸드셰이크) 완비.
     - MQTT 와일드카드 (`+`, `#`) 지원 토픽 Pub/Sub 엔진 (`aitip/stores/+/orders`, `aitip/devices/+/telephony`, `aitip/devices/+/status`).
     - 자가 검증: `scratch/test_mqtt_bridge.mjs` 실행 결과 토픽 매칭 및 클라이언트 2대 0.001초 Pub/Sub 100% PASS.
  2. **로컬 개발 서버 실시간 브릿지 연동 (`dev-server.mjs`)**:
     - `server.on('upgrade', ...)` 이벤트 장착으로 `/ws/mqtt` 및 `/ws/realtime` 웹소켓 요청 무지연 라우팅.
     - `POST /api/food/orders` 주문 생성 즉시 `mqttBridge.publish('aitip/stores/' + storeId + '/orders', newOrder)` 0.01초 직결 발행.
     - CTI 전화 인입 시뮬레이션 엔드포인트 신설: `POST /api/food/telephony/simulate` ➔ `aitip/devices/:deviceId/telephony` 발행.
  3. **점주 KDS 실시간 리스너 및 CTI 전화 팝업 모달 장착 (`packages/services/food-delivery/merchant-portal`)**:
     - `app.js`: `initKdsLiveSync()` 내에 브라우저 기본 `WebSocket('ws://' + location.host + '/ws/realtime')` 연결 추가.
     - `index.html`: `#modal-cid-inbound` (실시간 CTI 전화 주문 인입 모달) 신설.
     - 전화벨(Ring) 감지 즉시 점주 KDS 화면에 발신번호(`010-5882-9258`), 단골 고객 여부, 최근 주문 내역 팝업 표출 및 `[이 고객 전화 주문서 접수]` 원클릭 발주 연동.
  4. **엣지 단말기 트랜스포트 클라이언트 직결 (`packages/edge-device/transport-client/client.mjs`)**:
     - Node.js v24 내장 글로벌 `WebSocket`을 자동 감지하여 `ws://` / `wss://` 접속 시 실물 물리 소켓으로 연결.
     - 비정상 차단 재연결 지수 백오프 및 정상 종료(`disconnect`) 플래그 완비.
  5. **종단간(E2E) 실측 검증 완료 (`scratch/test_e2e_realtime_mqtt.mjs`)**:
     - 엣지 단말기 시뮬레이터 물리 웹소켓 브로커 연결 성공.
     - 고객 PWA 주문 생성 시 0.001초 만에 단말기 수신 ➔ 717 bytes TastyPrinter ESC/POS 80mm 감열지 주방 전표 자동 출력 실측 증적 확보.
     - CTI 전화 인입 브로드캐스트 패킷 수신 및 단골 고객 정보 연동 전 과정 100% 정상 통과.


---

### 16) 전사 8대 계층형 UID 표준 동기화 및 비표준 더미 식별자 100% 척결 (2026-11-15)
- **사용자 지침**: "단말기 UID : dev_01m6z4term8923 / 매장 UID : str_01h7x8q4barunchicken001 왜? 단말기, 매장 uid가 이거지?", "ㅇㅇ"
- **정밀 타격 및 구현 완료 내용**:
  1. **초기 프로토타입 비표준 더미(Mock) 문자열 100% 척결**:
     - 가짜 매장 ID `str_01h7x8q4barunchicken001` ➔ **전사 표준 8대 계층형 UID `STR-11-650-01-56162-0001`** (서울 11, 서초구 650, 서초네트웍스 01, 치킨전문점 56162, 1호점 0001)로 전면 일원화.
     - 가짜 단말기 ID `dev_01m6z4term8923` ➔ **하드웨어 표준 식별자 `DEV-CTI-882910`** (S/N `CTI-BRD-882910`, MAC `B8:27:EB:89:23:10`)로 전면 일원화.
  2. **전사 8개 핵심 소스 파일 동기화 완료**:
     - 1) `packages/services/food-delivery/backend/data/store_data.json`
     - 2) `functions/api/food/store_data.json`
     - 3) `packages/services/food-delivery/backend/food-service.mjs`
     - 4) `packages/services/food-delivery/customer-pwa/js/default-data.js`
     - 5) `dist/food/pwa/js/default-data.js`
     - 6) `packages/edge-device/tools/device-simulator/simulator.mjs`
     - 7) `packages/services/food-delivery/merchant-portal/js/app.js` (토픽: `aitip/stores/STR-11-650-01-56162-0001/orders`)
     - 8) `dev-server.mjs`
  3. **E2E 재실측 검증 완료**:
     - `DEV-CTI-882910` 단말기가 `ws://localhost:8989/ws/mqtt`로 정상 물리 접속.
     - `aitip/stores/STR-11-650-01-56162-0001/orders` 토픽으로 신규 주문(A-45) 실시간 수신 및 717 bytes 전표 인쇄 100% PASS 확인.
     - 스키마 무결성 검증: **278 / 278 (FAIL 0, 100% PASS)** 유지.


---

### 17) 카카오 우편번호 공식 최신 CDN(t1.kakaocdn.net) 전사 일괄 교체 및 GitHub 동기화 완결 (2026-11-15)
- **사용자 지침**: "지금 카카로 주소 나올때, 다음 주소변경하라는 것은 뭐야?", "그럼 우리 프로젝트에 카카오 주소 쓰는 것은 다 변경을 해야 하는 건가?", "지오코딩도 연관이 있는 거는 아니야?", "그리고 git hub에 업데이트를 각각 해야 하는 거 아니야?", "ㅇㅇ우선 이것 부터 진행하자."
- **배경 원인 및 지오코딩 연계성 규명**:
  1. 카카오(구 Daum) 본사의 레거시 도메인(`t1.daumcdn.net`) 리소스 서비스 종료(2026-11-30) 정책에 따라, 구형 스크립트 로드 시 우편번호 팝업 상단에 "도메인 변경 안내 공지 배너"가 강제 표출됨.
  2. 지오코딩(`dapi.kakao.com`) 자체는 도메인 변경 대상이 아니지만, 우편번호 입력창이 차단되면 주소 텍스트를 받지 못해 후속 지오코더(`kakao.maps.services.Geocoder`) 및 지도 연계 파이프라인 전체가 마비되는 구조적 결합 관계 확인.
- **정밀 타격 및 구현 완료 내용**:
  1. **AITIP 플랫폼 본체 (2개 소스, 4개 파일)**:
     - `packages/services/food-delivery/customer-pwa/index.html` (라인 10) 및 `dist/food/pwa/index.html` (라인 10): `https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js` 교체.
     - `customer-pwa/js/pwa-app.js` (라인 1460~1463) 및 `dist/food/pwa/js/pwa-app.js`: 최신 `kakao.Postcode` 1순위 바인딩 및 `daum.Postcode` 안전 폴백 적용.
  2. **바탕화면 6개 독립 프로젝트 전수 스캔 및 각 GitHub 원격 저장소 커밋·푸시 완료**:
     - `senior-caresafe`: `index.html` (커밋 `829d50c`, main push)
     - `bupyeong-seniorcare`: `pages/org-admin.html`, `pages/pwa-activity.html`, `pages/pwa-survey.html` (커밋 `265252e`, main push)
     - `catmap`: `admin/index.html` (커밋 `10c5b03`, main push)
     - `check-smoking-zone`: `index.html`, `admin/index.html` (커밋 `9a247f6`, main push)
     - `wellriskkeeper`: `pages/org-admin.html`, `pages/pwa-activity.html`, `pages/pwa-survey.html`, `sw.js` (커밋 `a040f30`, main push)
     - `sgds`: `index.html` (커밋 `83e4894`, main push)
     - 검증: 전사 7개 프로젝트 전역에서 구형 `t1.daumcdn.net` 잔여 0건 확인.


---

### 18) PWA 서비스 워커(sw.js) 캐시 무효화 및 버전 판올림 전사 완결 (2026-11-15)
- **사용자 지침**: "sw는?", "ㅇㅇ"
- **핵심 문제의식 (PWA 아키텍처 급소)**:
  - HTML 소스코드만 고치더라도 사용자 스마트폰이나 브라우저에 이미 설치·캐시된 PWA 서비스 워커(`sw.js`)의 `CACHE_NAME` 버전을 올리지 않으면, 브라우저는 로컬 캐시에 저장된 옛날 HTML(구형 Daum 주소 스크립트)을 계속 띄워 장애가 지속됨.
- **정밀 타격 및 구현 완료 내용**:
  - 6개 프로젝트 `sw.js`의 `CACHE_NAME` 버전을 정밀 1단계씩 판올림하여 기존 로컬 캐시 즉시 파기 및 신규 카카오 주소 자동 다운로드 보장:
    1. `senior-caresafe/sw.js`: `senior-caresafe-v1.0.13` ➔ **`senior-caresafe-v1.0.14`** (커밋 `3fc79f2`, main push)
    2. `bupyeong-seniorcare/sw.js`: `bupyeong-seniorcare-v3.9.4` ➔ **`bupyeong-seniorcare-v3.9.5`** (커밋 `9ed78bf`, main push)
    3. `check-smoking-zone/sw.js`: `inspection-v178` ➔ **`inspection-v179`** (커밋 `f3d520b`, main push)
    4. `sgds/sw.js`: `sgds-v72` ➔ **`sgds-v73`** (커밋 `b34c881`, main push)
    5. `catmap/sw.js`: `sgds-v121` ➔ **`sgds-v122`** (커밋 `b5f76ff`, main push)
    6. `wellriskkeeper/sw.js`: `wellriskkeeper-v1.2.4` ➔ **`wellriskkeeper-v1.2.5`** (커밋 `c5c1d63`, main push)
  - AITIP 플랫폼 본체: 현재 고객 모바일 웹에 별도 정적 SW 캐시를 강제하지 않아 수정 즉시 최신 주소 반영 확인.


---

### 19) MQTT 실시간 중추망 클라우드 환경 한계 분석 및 내일 Cloudflare 무료 퀵 터널(TryCloudflare) 실물 테스트 상세 계획 (2026-11-15)
- **사용자 지침**: "한가지 물어 볼께 mqtt는 로컬에서만 되는 거지?", "클라우드플레어 에서 테스트는 안되는 거 잖아", "테스트는 1번으로 해야겠네?", "우선 내일 작업하게 다음 ai가 그간의 과정을 충분히 쉽게 이해 할수 있도록 오버핸드 문서 업데이트 하자."
- **기술적 사실 및 한계 규명**:
  1. **현재 로컬 환경(`localhost:8989`)**: 개발 편의를 위해 초경량 WSS/MQTT 브릿지(`mqtt-bridge.mjs`)가 Node.js 프로세스로 24시간 가동되어 PC 내부에서 0.01초 직결 통신 수행.
  2. **Cloudflare Pages 단독 환경의 한계**: Pages Functions는 서버리스(Serverless, Stateless)로 주문 요청 시 0.001초 실행 후 프로세스가 즉시 소멸하므로, 24시간 상시 웹소켓 연결(Stateful Socket)을 유지해야 하는 MQTT 브로커를 단독으로 구동할 수 없음.
- **내일 출근 즉시 착수할 1번 대안(Cloudflare 무료 퀵 터널) 실행 절차**:
  1. **Quick Tunnel 가동**:
     - `cloudflared` 공식 단일 실행 파일 또는 npm 래퍼를 통해 `cloudflared tunnel --url http://localhost:8989` 실행.
     - Cloudflare가 즉시 임시 무료 보안 HTTPS/WSS 도메인(예: `https://aitip-live.trycloudflare.com`) 발급.
  2. **실물 스마트폰(LTE/5G) 원격 E2E 검증**:
     - 사용자 스마트폰에서 와이파이를 끄고 LTE 데이터로 `https://[임시도메인].trycloudflare.com/food/pwa/` 접속.
     - 메뉴 선택 및 주문 생성(`POST /api/food/orders`) 클릭.
     - PC 모니터의 점주 KDS(`http://localhost:8989/food/`) 화면에 새로고침 없이 0.01초 만에 주문 카드가 꽂히고 딩동 알림 재생 확인.
     - 매장 스마트 단말기(`DEV-CTI-882910`)에서 TastyPrinter ESC/POS 80mm 감열지 주방 전표 자동 인쇄 실측 증적 확보.
  3. **상용 프로덕션 로드맵 (DOC-17 규격)**:
     - 추후 운영 단계에서는 독립형 클라우드 브로커(Mosquitto/EMQX, MQTTS 8883 / WSS 443)를 가동하고, 식당 단말기가 아웃바운드 보안 터널로 상시 접속하는 정석 인프라 구축.


---

### 20) 슈퍼관리자(platform-admin) 단순 조회를 넘어선 실무형 '통합 관제탑(Control Tower)' 4대 축 고도화 로드맵 수립 (2026-11-15)
- **사용자 지침**: "내 생각은 슈퍼관리자 페이지 더 고도화 하여야 한다고 생각해, 지금 메유 나열하고 보여주기만 되어 있지, 상세하게 들어가면 업데이트하고 덧 붙힐께 많아. 너의 생각을 ㅇ얘기 해봐", "업데이크하고 내일 보자."
- **문제의식 및 신조 정합성 (The Core Creed)**:
  - 현재 슈퍼관리자는 데이터 목록을 단순히 나열하는 'Read-Only 대시보드'에 머물러 있어, 현장에서 분쟁이나 장애 발생 시 운영자가 즉각 개입할 수 있는 실행형 인터랙션 도구가 결여되어 있음.
  - 관리자가 버튼을 눌렀을 때 단말기에서 소리가 나고, 라이더에게 콜이 가며, 정산이 보류/집행되는 **진짜 살아있는 '실시간 통합 관제탑(Mission Control Tower)'**으로 고도화 필수.
- **슈퍼관리자 고도화 4대 핵심 축 및 상세 명세**:
  1. **축 1. 엣지 단말기 실시간 원격 제어 & MDM 통제소 (Live Edge Control)**:
     - 1초 단위 MQTT Heartbeat 생사 신호등(Online/Offline) 표시.
     - 원격 진단 액션: [원격 핑(Ping) 테스트], [주방 전표 원격 강제 테스트 출력], [단말기 원격 재부팅], [오프라인 큐 강제 동기화 플러시].
  2. **축 2. 가맹점 & 총판·대리점 거버넌스 및 영업 강제 제어 (Merchant & Territory Governance)**:
     - 악천후/긴급 상황 시 [영업 일시 정지(Pause) / 강제 오픈], [배달 반경 축소].
     - 8대 계층형 UID(`STR-11-650-01-56162-0001`) 기반 총판/대리점 수수료 분배율 설정 및 정산 계좌 1클릭 유효성 검증.
     - 메뉴/가격 일괄 승인 큐(Approval Queue) 및 부적합 품목 강제 반려.
  3. **축 3. 실시간 배차 모니터링 & CS 분쟁 중재 센터 (Dispatch & Dispute Center)**:
     - 조리 완료 후 10분 이상 라이더 미매칭 건 붉은색 사이렌 경보 표출.
     - 관리자 [수동 강제 배차(Override Dispatch)] 및 외주 배달대행사 즉각 이관.
     - CS 분쟁 원스톱 판정: 배달완료 사진(PoD)과 주방전표 나란히 비교 ➔ [라이더 과책 100%] / [가맹점 과책 100%] 판정 후 1클릭 고객 환불/포인트 지급.
  4. **축 4. D+1 익일 정산 & FDS(이상 금융 거래 탐지) 통제 (Settlement & FDS)**:
     - 카드사/PG사 승인 내역과 플랫폼 주문 원장 간 1원 단위 대사 불일치 감지 및 자동 보정.
     - 카드깡/이상 반복 결제 감지 시 [정산 지급 보류(Hold)] 및 계좌 동결.
     - 국세청 홈택스 표준 CSV 세무 리포트 1클릭 발행.
- **후속 AI 실행 과제**:
  - 내일 Cloudflare 무료 퀵 터널(TryCloudflare)을 통해 PWA 주문 ➔ KDS/단말기 실시간 인입 E2E 실측을 마친 후,
  - 위 4대 핵심 축 중 우선순위가 높은 **[축 1: 엣지 단말기 원격 MDM 액션 모달]** 및 **[축 2: 가맹점 영업 제어]**부터 실물 모달 및 백엔드 API를 단계별로 정밀 타격 코딩 착수할 것.

---

### 21) 양방향 실시간 E2E 완결, 영수증 1쪽 출력 정상화, Cloudflare Quick Tunnel 실물 검증 및 비용·기술 규명 (2026-11-16)

> **다음 AI를 위한 현재 상태 요약 (2026-11-16 기준)**:
> - **완료됨**: 로컬/외부(Quick Tunnel) 양방향 실시간 주문·상태 동기화, 80mm 영수증 1쪽 출력 CSS 수정, Cloudflare 100초 WebSocket 끊김 방지 30초 `PING` 하트비트 탑재.
> - **미구현/제약(Gap)**: 현재 로컬 `dev-server.mjs` + `food-service.mjs`(`store_data.json`)는 단일 매장 프로토타입이며, 주문 객체에 `store_id`가 아직 저장되지 않음. `wrangler.json`은 정적 `dist` 배포 설정만 있고 D1/Durable Objects 바인딩은 미연결 상태.

1. **KDS 실시간 수신 크래시 복구 및 단말기 UID 정규화 (완료)**:
   - 원인: `kds.js` 및 `receipt.js`에서 옵션 `opt.price`가 `undefined`일 때 `.toLocaleString()` 호출로 `TypeError`가 발생해 실시간 수신 렌더링이 중단됨.
   - 수정: `kds.js`·`receipt.js`에 null-safe 처리 적용, `merchant-portal/index.html`의 레거시 `dev_01m6z4term8923`을 정식 UID `DEV-CTI-882910`으로 교체 및 캐시 버스팅 적용.
   - 검증: 브라우저 콘솔 에러 0건, `/ws/realtime` HTTP 101 연결, 새로고침 없이 주문 즉시 상단 카드 삽입 확인.

2. **양방향 실시간 Live Track 구축 (완료)**:
   - 백엔드(`dev-server.mjs`): 주문 상태 변경 엔드포인트 4종(`/accept`, `/rider-status`, `/delivery-method`, `/dine-in-status`)에서 `mqttBridge.publish('aitip/orders/${orderId}/status', ...)` 발행.
   - 프론트엔드(`packages/services/food-delivery/customer-pwa/js/pwa-app.js` 및 `dist/food/pwa/js/pwa-app.js`): `renderLiveTrackTimeline()` 분리 및 `trackWs`로 `aitip/orders/${order.order_id}/status` 구독하여 점주 수락 즉시 타임라인 자동 갱신 확인.

3. **ESC/POS 80mm 영수증 5쪽 출력 및 1쪽 백지 문제 해결 (완료)**:
   - 원인 1 (5쪽 출력): `@media print`에서 `.portal-container`를 `visibility: hidden`으로 숨겨 레이아웃 높이가 남아 2~5쪽 빈 페이지 생성.
   - 원인 2 (1쪽 백지): `receipt.js`의 `openReceiptModal()`은 `#modal-print-receipt`에 `.show` 클래스를 추가하는데, `merchant.css` `@media print`는 `.active`를 기준으로 `.modal-overlay:not(.active) { display: none !important; }`를 적용해 모달까지 숨겨버림.
   - 수정: `packages/services/food-delivery/merchant-portal/merchant.css`(및 `dist/food/merchant.css`) `@media print`의 `.portal-container`를 `display: none !important;`로 전환하고, `.active` 선택자 4곳을 `.show`로 정밀 교정. 브라우저에서 `#modal-print-receipt.show` 가시성 및 `80mm` 폭 규칙 검증 완료 (실제 OS 인쇄 미리보기는 사용자 로컬 확인 대상).

4. **Cloudflare Quick Tunnel 실물 테스트 및 공식 문서 교차 규명 (완료)**:
   - 실행 환경: `Cloudflare.cloudflared` v2026.11.0 설치 후 `cloudflared tunnel --url http://localhost:8989` 가동(서울 `icn05` 엣지, `quic` 프로토콜) 및 외부 `https://.../food/pwa/` HTTP 200, `wss://.../ws/realtime` `CONNECTED`→`PING`→`PONG` 실측 통과.
   - 실물 스마트폰 주문 검증: LTE 스마트폰으로 `A-52` 주문 생성(`order_id`: `ord_01m7gpczcwwpk9qwjhjvwpk9qw`, `virtual_phone_id`: `vnm_01m7gpczcwkxzt27427pkxzt27`) 및 KDS/영수증 연동 확인.
   - **놓치기 쉬운 Cloudflare 기술 제약 (공식 문서 확인)**:
     - **100초 Idle Timeout**: Enterprise 외 모든 플랜(Quick Tunnel 포함)에서 양방향 무통신 100초 경과 시 WebSocket 강제 종료(설정 변경 불가). → `merchant-portal/js/app.js`(`initKdsLiveSync`) 및 `customer-pwa/js/pwa-app.js`(`trackWs`)에 **30초 주기 `{ type: 'PING' }` 하트비트** 탑재 및 `dist/` 동기화 완료(`mqtt-bridge.mjs`는 이미 `PONG` 응답 지원).
     - **Quick Tunnel 한도**: 동시 처리 요청(in-flight) 최대 200개(초과 시 `429`), SSE 미지원, 재시작 시 호스트명 변경(테스트 전용).
   - **비용·아키텍처 최신 기준 (Durable Objects)**:
     - SQLite 백엔드 기반 **Durable Objects는 Workers Free 플랜에서도 사용 가능** (일일 100,000 요청, 13,000 GB-s 컴퓨팅 시간, 5 GB 스토리지, 최대 100개 DO 클래스). Paid 플랜(\$5/월)은 월 100만 요청 + 400,000 GB-s 포함.
     - 상용 Workers 이식 시 일반 WebSocket은 유휴 대기 중에도 GB-s를 소모하므로 **반드시 WebSocket Hibernation API**를 적용해야 유휴 과금/한도 소모를 0으로 막을 수 있음.

5. **UID 실측 점검 및 남은 과제 (Next Steps)**:
   - `food-service.mjs`의 `generateTypeID(prefix)`는 Crockford Base32 ULID(`ord_`, `itm_`, `vnm_` + 26자)를 생성하며, DB Primary Key 조회 시 1~2ms 내 역추적 가능함.
   - **Gap**: 현재 프로토타입 `store_data.json`의 개별 주문 JSON(`A-52` 등)에는 `store_id` 필드가 저장되지 않음. 멀티 가맹점 D1 이식 시 `orders.store_id`(`STR-...`) 필수 적재 및 고객 영수증 UI에 매장명/순번 가독성 병기 유지 필요.
   - **다음 논의 과제**: 플랫폼관리자(`platform-admin`) 및 가맹점관리자(`merchant-portal`) 냉정한 실무 검토 및 고도화 우선순위 확정.

---

### 22) 슈퍼관리자 5대 IA 개편, Zero-PII 경계선, 멀티테넌트 RBAC·3대 제휴 실연동 및 내일 과제 (2026-11-16 오후)

> **다음 AI를 위한 현재 상태 요약 (2026-11-16 16:15 기준)**:
> - **완료됨**: 슈퍼관리자 5대 부서·역할 IA 개편(`packages/platform-admin/index.html`, `dist/admin/` 동기화 완료), Zero-PII IndexedDB(`cust_...`) ↔ 서버 포인트·배너 피드 연동, 단일 어드민 멀티테넌트 RBAC(`x-admin-role`·`x-tenant-id` 메뉴 게이팅 및 서버 403/데이터 격리), Search-First CS·환불, 대시보드 예외 우선 큐, `HQ_DIRECT` 직영 + 3대 제휴(`SALES_ALLY`/`SERVICE_ALLY`/`TECH_ALLY`) + 4종 법적 서약 표준 계약 모달, 가맹점/온보딩 실연동, `admin_data.json` 영속화.
> - **내일 최우선 과제**: **4자 통합 프로모션 아키텍처(PWA · 가맹점 · 영업조직/제휴사 · 슈퍼관리자) 구현**.

1. **오늘 완료된 주요 구현 및 기본설계서 반영 (`AITIP_PLATFORM_MASTER_DESIGN_2026.md` 6.4절, `DOC-18` 제11장)**:
   - **Zero-PII 아키텍처 실연동**:
     - 소비자 PWA(`packages/services/food-delivery/customer-pwa/js/zero-pii-idb.js`)에 `aitip_customer_zero_pii` IndexedDB 저장소를 구축해 익명 `cust_...`만 로컬 보관.
     - `dev-server.mjs`에 `GET /api/food/public-feed?customer_uid=...` 및 `POST /api/food/orders` 블랙리스트(`403`)·점검모드(`503`)·실결제 포인트 자동 적립 구현.
     - 관리자 `주문 분쟁·환불 & UID 관제` (`cs-refunds.js`), `포인트 원장 & 어뷰징 관제` (`points-ledger.js`) 구축 및 나열식 `<select>` 제거 -> Search-First + 서버 페이징(`?q=&page=&limit=`) 전환 완료.
   - **슈퍼관리자 5대 IA & 멀티테넌트 RBAC 실연동**:
     - 사이드바를 5대 기둥(1. 실시간 관제 & CS / 2. 가맹점·영업망·자산 / 3. 프로모션 & 포인트 / 4. 정산 & 세무 / 5. 플랫폼 설정 & 보안)으로 통합하고, `system-policies.js`에 시스템 정책과 서킷브레이커 탭 통합.
     - `admin-api.js`(`ROLE_ALLOWED_VIEWS`), `admin-app.js`(`applyRbacMenuGating`), `dev-server.mjs`(`x-admin-role`, `x-tenant-id` 검증)로 역할별 메뉴 가시성 및 `403`·소속 매장 격리 검증 통과.
     - `dashboard.js` 최상단에 예외 우선 관제 큐(`exceptions`: 미접수 주문, 미처리 CS 분쟁, 온보딩 심사 대기, 점검 모드) 배치.
   - **조직·직영·3대 제휴 & 역할 분리**:
     - `organization-tree.js`: `HQ_DIRECT`(본사 직영 0%) + `SALES_ALLY`(영업 제휴) / `SERVICE_ALLY`(서비스 제휴) / `TECH_ALLY`(기술 제휴) + 4섹션 표준 계약 모달(개인정보보호·Zero-PII 무단수집 금지·NDA·표준계약 4종 필수 검증) 구현 및 `packages/platform-admin/data/admin_data.json` 영속화.
     - `merchants.js` · `onboarding.js`: 가맹점 영업 토글(`/api/admin/stores/status`) 및 온보딩 승인(`/api/admin/onboarding/approve`) -> 가맹점 목록 반영 실연동, `#btn-go-onboarding` 해시 라우팅 연결, `showStoreDetailModal` `undefined` 필드(`rep_name`, `board_serial`, `mac_address`) 수정.
     - `service-zones.js`: 가맹점 고유 영역(배달 행정동·배달팁)을 본사에서 제거하고 **시·군·구 서비스 오픈 지역 · 긴급 배달 차단(`TOGGLE_DELIVERY_HALT`) · 5대 업종 스위치**로 역할 분리.
   - **실측 검증**:
     - `node --check`: 수정된 전 JS/MJS 파일 통과
     - HTTP API E2E: `RBAC 403`, `Tenant Scope(agn01=1 vs agn02=0)`, `Search-First A-53(total=1)`, `Dashboard exceptions`, `SALES_ALLY(201)`, `TOGGLE_DELIVERY_HALT(true->false)` 모두 정상 통과.

2. **내일 최우선 업무 (Tomorrow's Task — 4자 통합 프로모션 아키텍처 구현)**:
   - **검토 배경**: 현재 `/api/admin/promotions` 및 `promotions.js`는 `foodService.getCoupons()`(가맹점 자체 쿠폰)와 본사/제휴사 행사를 구분하지 않아 비용 부담 주체와 정산 분개가 불명확함.
   - **구현 대상 4개 접점**:
     1. **슈퍼관리자 (`platform-admin/js/modules/promotions.js`, `dev-server.mjs`)**:
        - 행사 주체 3분리: `PLATFORM`(본사 100%) | `ALLIANCE`(제휴사·영업조직 공동 분담 `cost_split`) | `MERCHANT`(가맹점 자체 100% 모니터링) 탭 분리.
        - 영업조직(총판·대리점·영업제휴사)의 지역/채널 행사 **`신청(REQUESTED)` -> `본사 승인(APPROVED)`** 큐 구현.
     2. **가맹점 관리자 (`merchant-portal/js/modules/coupons.js`)**:
        - 매장 자체 쿠폰 발행 유지 + 본사/제휴 공동 분담 행사에 대한 **점주 참여 동의(Opt-in/Opt-out)** 토글 추가.
     3. **소비자 PWA (`customer-pwa`)**:
        - 장바구니/결제 화면에서 **쿠폰 중복 적용 규칙(`플랫폼/제휴 쿠폰 1개 + 가맹점 쿠폰 1개 + 보유 포인트`)** 검증 및 선택 UI 구현.
        - `POST /api/food/orders` 시 `applied_promotions` 스냅샷(`platform_discount`, `alliance_discount`, `merchant_discount`, `point_used`) 적재로 사후 정산 대사 정합성 확보.

---

### 23) 하나로마트 위탁운영 포털(`mart-portal`) UI/UX 전면 개편, 3단계 표준 상품분류, 대항군 결함 수정 (2026-11-17 ~ 2026-11-18)

> **다음 AI를 위한 현재 상태 요약 (2026-11-18 16:25 기준)**:
> - **완료됨**: `mart-portal` 9개 전체 화면을 모던 커머스 어드민(`.mc-*` 읽기 중심 테이블 + 우측 슬라이드 드로어 + 다중 선택 일괄 액션 바 + 클릭형 KPI 스트립)으로 통일 개편. 마트 표준 3단계 상품분류(`대분류 > 중분류 > 소분류`, `mart-categories.js`)를 일반·신선(`catalog.js`) 및 전처리(`prep-catalog.js`)에 도입. 대항군(Red-Team) 검수를 통해 입력 상태 유실 버그 4종, 프론트↔백엔드 계약 불일치(`createPromotion`, `adjustOrderItem`), `0` 값 덮어쓰기/음수 미방어, 드로어 섹션 순서 오류 수정 완료.
> - **명시적 제외 결정**: `샵앤샵관리` 매뉴얼 검토 후 **매장 상품 POP 인쇄 기능은 플랫폼에서 아예 제외**하기로 사용자 확정.
> - **실행 상태**: `dev-server.mjs` `http://localhost:8989` (`task-5733`) 정상 가동 중, 수정된 백엔드/프론트 모듈 모두 `node --check` 및 HTTP `200` 확인 완료.

1. **사이드바·인프라 및 공통 기반 (`2026-11-17 ~ 11-18`)**:
   - 좌측 사이드바 7개 도메인 그룹(`1. 상품등록`, `2. 행사상품`, `3. 온라인 구성`, `4. 주문`, `5. 배송`, `6. 결제 및 정산`, `7. 마트관리`) 아코디언 구조(`packages/services/mart-logistics/mart-portal/index.html`, `mart.css`) 정비.
   - JPG/PNG → WebP 클라이언트 경량 변환(`js/utils/media-webp.js`) 및 `/api/mart/media/upload`(`med_*`) 연동.
   - `DOC-00` UID 체계(`MRT-11-650-01-47121-0001-A01`, `-U001`, `ORD-11-650-01-47121-0001-YYMMDD-0001`) 및 80mm 전표/A4 거래명세표 출력(`mart-receipt.js`) 연동.

2. **모던 커머스 어드민(`.mc-*`) 전면 개편 (`mart.css` 및 9개 모듈)**:
   - **공통 스타일 (`packages/services/mart-logistics/mart-portal/mart.css`)**: `.mc-page-header`, `.mc-surface`, `.mc-filter-bar`, `.mc-bulk-bar`, `.mc-table`, `.mc-pill`, `.mc-drawer` 우측 슬라이드 드로어 스타일 추가(기존 `.erp-*` 클래스 호환 유지).
   - **일반·신선 상품 (`js/modules/catalog.js`)**: 행마다 9개씩 깔려 있던 `input`/`select` 벽을 제거하고 읽기 중심 테이블 + 체크박스 다중 선택 일괄 액션 바(노출/결제범위/일괄 할인%) + 우측 드로어로 전환. 드로어 내 `할인(%) ↔ 행사가` 양방향 계산 및 실시간 예상 마진/역마진 경고 배지 제공.
   - **전처리 상품 (`js/modules/prep-catalog.js`)**: 3단계 표준 분류 + 전처리 공정 구분(`세척·탈피 / 절단·슬라이스 / 정선·소분 / 양념·가공`) 및 보관 필터, 우측 등록/수정/발주서 일괄 드로어 적용.
   - **행사·전단 (`js/modules/flyer-promo.js`)**: 원본 전단 대조 Split View + 결제범위 필터 + 단건 행사 룰 등록 드로어(`POST /api/mart/promotions`).
   - **온라인 구성 (`js/modules/pwa-control.js`)**: 좌측 설정 카드 + 우측 고정(`sticky`) 실시간 모바일 PWA 미리보기(`375px` / `768px` / `1200px` 전환 시 편집 상태 유지).
   - **주문관리 (`js/modules/orders.js`)**: 배민 B마트형 클릭형 상태 KPI 스트립(`전체/신규접수/피킹중/포장완료/배송완료`) + Medusa 스타일 주문상세/타임라인 드로어 + 품목별 실수량 정정/1클릭 `결품(0)`(`POST /api/mart/orders/adjust`) + 오프라인 주문 입력 드로어 분리.
   - **피킹·박싱·정산·마트정보 (`picking.js`, `boxing.js`, `settlement.js`, `mart-info.js`)**: 동일 `.mc-*` 카드/테이블/뱃지/버튼 톤으로 통일 완료.

3. **마트 표준 3단계 상품분류 체계 (`js/utils/mart-categories.js`)**:
   - `01 농산`, `02 축산`, `03 수산`, `04 가공식품`, `05 냉장·냉동·유제품`, `06 생활·비식품` 3단계 트리(`getL1List`, `getL2List`, `getL3List`, `buildCategoryPath`, `inferCategoryFromProduct`) 구축.
   - `catalog.js` 및 `prep-catalog.js` 드로어 최상단(`1. 표준 상품분류`)에 3단 연동 셀렉트 배치 및 신규 등록 시 과면세/운영구분 자동 추천.
   - `mart-service.mjs` `addProduct()` / `updateProduct()`에 `category_l1`, `category_l2`, `category_l3`, `category_path` 저장 반영.

4. **대항군(Red-Team) 검수 및 결함 수정 완료 항목**:
   - **입력 상태 유실 차단**: `catalog.js`, `prep-catalog.js`, `flyer-promo.js` 이미지 업로드 시 미리보기 박스만 부분 갱신, `orders.js` 오프라인 품목 추가/삭제 시 리스트만 부분 갱신, `pwa-control.js` 디바이스 전환 시 DOM 스타일만 전환해 미저장 입력값 보호.
   - **프론트↔백엔드 계약 일치**: `mart-service.mjs` `createPromotion()`에 `payment_scope` 및 `discount_pct` 저장 보강, `flyer-promo.js` 행사 유형 코드(`BOGO_1_PLUS_1`, `BOGO_2_PLUS_1`, `MIX_AND_MATCH`, `QTY_DISCOUNT`, `PRICE_DISCOUNT`) 및 `discount_pct` 통일, `orders.js`에서 `actual_qty ?? qty` 표시 및 `product_id || id || name` 매칭 통일.
   - **`0` 값 보존 및 음수 차단**: `??` 연산자 및 `Math.max(0, ...)` / `min="0"` 적용으로 재고 `0`, 안전재고 `0`, 행사가 `0`, 수수료 `0%` 정상 저장 보장.
   - **분류 추론 교정**: `양파/마늘/대파/고추`가 `양념채소(010203)`로 정확히 매핑되도록 정규식 우선순위 수정 (`국내산 깐마늘(대)` → `01 0102 010203` 검증 통과).

5. **내일 이어서 진행할 과제 (Next Steps)**:
   1. **사용자 화면 검수 후 세부 수정**: 새로 개편된 `mart-portal` 전 메뉴(`http://localhost:8989/mart/`)에 대한 사용자 피드백 반영.
   2. **UX 피드백·모바일 반응형 보완 (대항군 5번 잔여 항목)**:
      - 전 모듈 API 호출(`martApi.*`) `try/catch` + 공통 토스트(성공/오류 안내) 추가, `mart-info.js` 블로킹 `alert()` 제거 및 사원 삭제 확인 UX 추가.
      - `@media (max-width: 800px)` 모바일 뷰포트용 사이드바 토글 버튼(`index.html`/`mart.css`) 및 `orders.js`/`flyer-promo.js`/`pwa-control.js` 인라인 그리드 반응형 브레이크포인트 보강.
   3. **일괄 파서(`mart-catalog-parser.mjs`) 고도화**: POS CSV 분류코드 → `category_l1/l2/l3` 직접 매핑 및 전단/전처리 반복 업로드 시 바코드 충돌 방지.
   4. **플랫폼 전체 4자 통합 프로모션 아키텍처(22절 로드맵)** 및 `DOC-19` 슈퍼관리자 ↔ 마트 포털 통합 연동 이어서 진행.

---

### 24) 마트 실무 행사·진열 SSOT, 양방향 승인, 전단 미리보기, D1 전환 준비 & 통합 E2E 검증 (2026-11-19 ~ 2026-11-20)

> **다음 AI를 위한 현재 상태 요약 (2026-11-20 12:55 기준)**:
> - **완료됨**:
>   1. **행사-상품-PWA 진열 SSOT 연동**: `flyer-promo.js` 3번째 탭 `행사별 상품 연결`(`applied_promo_id` 양방향 동기화), `pwa-control.js`의 `PROMO_SHELF`/`CURATED_SHELF` 블록별 `[진열 상품 선택]` 서랍(`featured_product_ids` 저장, `draftFeaturedIds`로 검색 중 체크 상태 보존), 고객용 `pwa-app.js` 홈 블록 실연동 완료.
>   2. **동적 행사 유형 관리 & PWA 다중 행사 계산 엔진**: `금토일 특가`를 `DAY_OF_WEEK`(요일별 특가)로 일반화하고 마트별 커스텀 행사 유형 추가·숨김·삭제(`GET/POST/PATCH/DELETE /api/mart/promo-types`, `mart_promo_types`) 구축. `pwa-promo-engine.js`에서 `1+1`, `2+1`, `골라담기`, 요일 제한, 카드사 제한, 최대 할인 한도, 1인 한정 통합 계산 연동.
>   3. **양방향 등록 · 승인 거버넌스**: 마트 포털(`pwa-control.js` `+ 공동구매 등록`, `POST /api/mart/group-buys`) ➔ 슈퍼관리자(`/admin/` `mart-union.js`, `POST /api/admin/mart/group-buys/decide`) 승인 시 PWA 노출. 반대로 슈퍼관리자(`mart-union.js`, `POST /api/admin/mart/co-sell-products`)가 전국 공동판매 상품 배포 제안 ➔ 마트 포털(`catalog.js` `본부 배포 승인대기`, `POST /api/mart/products/approve`) 취급 승인/반려 구현.
>   4. **전단 일괄 파싱 고도화**: `mart-catalog-parser.mjs`에 카드사·요일·채널·최대할인·`applied_promo_id` 추출 추가, `POST /api/mart/import/preview` + `flyer-promo.js` 2단계(`1. 파싱 미리보기` ➔ `2. 확정 일괄 반영`) 검수 UI 및 기존 상품 자동 매칭(`MATCHED_EXISTING`) 적용.
>   5. **리팩토링 & D1 전환 준비**: `mart-seed.mjs`(272줄) 및 `catalog-helpers.js`(112줄) 분리, `docs/schema_aitip_v01.sql`에 신규 컬럼·복합 인덱스·`mart_promo_types` 반영, 루트 `wrangler.toml`, `packages/services/mart-logistics/migrations/0001_mart_d1_init.sql`, `packages/services/mart-logistics/backend/mart-d1-adapter.mjs`(`MartD1Adapter`) 생성.
> - **통합 E2E 검증 실측 결과 (`http://localhost:8989`, 2026-11-20)**:
>   - 마트 포털(`/mart/`), 고객 PWA(`/mart/pwa/`), 슈퍼관리자(`/admin/` `#mart-union`) 전 화면 HTTP `>= 400` 에러 `0건`, 콘솔 에러 `0건`.
>   - 검증 중 발견된 `flyer-promo.js:430` (`renderChannelBadge` 미정의) 즉시 수정 후 `1. 파싱 미리보기` 5건 검수 테이블 정상 렌더링 재검증 완료.
> - **남은 과제 / Gap (다음 작업 후보)**:
>   1. **Cloudflare D1 실제 런타임 연결**: 현재 `dev-server.mjs`의 `mart-service.mjs`는 로컬 JSON(`mart_data.json`) 기반이며, `MartD1Adapter`를 Workers 엔트리포인트에 연결하는 작업은 아직 미구현.
>   2. **마트(`mart-logistics`) MQTT 실시간 연동**: `packages/core/realtime/mqtt-bridge.mjs`는 `food-delivery`에만 연결되어 있고 `mart-logistics`에는 미연결 상태(`aitip/marts/{martId}/*` 토픽 연결 필요).
>   3. **`catalog.js` 추가 분할 & 관찰된 사소한 UI 보완**: `catalog.js`(987줄) 모달 분리, PWA 장바구니 `+/-` 버튼 대비 시인성 보완, `/admin/` `#dashboard`의 일부 샘플 가맹점 `undefined undefined` 권역 표시 및 1280px 상단 바 줄바꿈 보정.

---

### 25) 전단 CSV·배너 PWA 게시, 축산/전품목 분류 상세화, 행사 룰 수정·삭제 CRUD 완결 (2026-11-20 오후)

> **다음 AI를 위한 현재 상태 요약 (2026-11-20 16:15 기준)**:
> - **오늘 오후 추가 완료 항목**:
>   1. **전단 행사표 CSV 정석 업로드 & 전단 배너 PWA 실연동**:
>      - 실물 마트 전단지(다단 그리드·카드사 로고 이미지·전품목 1+1)는 정규식 OCR만으로 무인 자동화가 불가능함을 확인하고, **정석(전단 CSV 양식 다운로드/업로드 + 전단 이미지는 고객 PWA 상단 `FLYER_CAROUSEL` 배너 게시)**을 1차 메인으로 구현. (향후 비전 AI 초벌 추출 + `1. 파싱 미리보기` 검수 UI를 2차 보조 수단으로 확장 예정)
>      - `mart-catalog-parser.mjs`: `parseMartFlyerCsvRows` 추가 (`바코드, 상품명, 행사유형, 정상가, 행사가, 필요수량, 묶음가, 시작일, 종료일, 채널, 카드사`).
>      - `flyer-promo.js`: `[전단 CSV 양식]`, `[CSV/엑셀 업로드]`, `[PWA 배너 게시]`(`pwa_config.flyer_banners` 저장 ➔ `pwa-app.js` `FLYER_CAROUSEL` 이미지 슬라이더 노출) 및 `행사별 상품 연결` 탭 **대분류 필터 + 전체 선택/해제 체크박스** 추가.
>   2. **상품 표준 3단계 분류 상세화 & 과면세 단일화**:
>      - `mart-categories.js`: `02 축산`에서 `0204 오리 · 특수육` 분리 및 `0205 수입육 · 양념육` 신설, 전 대분류 실무 품목(`밀키트`, `통조림·즉석밥`, `주방·반려동물` 등) 및 `inferCategoryFromProduct()` 키워드 매핑 대폭 보강.
>      - `catalog.js`: 등록 드로어 내 구식 `#mp-cat`(공산품/농·수산/예약·정기) 드롭다운을 제거하고 `과면세 구분 *`(면세/과세) 단일 셀렉트로 정리(`category_type`은 대분류 코드 기반 자동 매핑).
>   3. **행사 룰 수정 · 삭제 CRUD 완결**:
>      - `mart-service.mjs` (`updatePromotion`, `deletePromotion`), `dev-server.mjs` (`PATCH/DELETE /api/mart/promotions`), `api.js`, `flyer-promo.js` (`[수정] · [복제] · [삭제]`) 구현.
>      - 수정 시 연결 상품(`applied_promo_id`)의 행사 조건 자동 동기화, 삭제 시 연결 상품 행사 자동 해제(정상가 복원) 보장.
>   4. **검증 및 서버 상태**: `dev-server.mjs` (`task-6458`, `http://localhost:8989`) 가동 중. `node --check` 및 `POST -> PATCH -> DELETE /api/mart/promotions`, `POST /api/mart/import/preview`, `inferCategoryFromProduct`, HTTP `200` 모두 실측 통과.
> - **내일 이어서 진행할 과제**:
>   1. **추가 화면/기능 수정 사항 확인**: 사용자 추가 피드백(관찰된 PWA `+/-` 버튼 대비, `/admin/` `#dashboard` `undefined undefined` 권역 보정, 추가 UI 개선 요청 등) 반영.
>   2. **전단 이미지 비전 AI 보조 추출 (`/api/mart/import/vision-preview`)** 또는 **Cloudflare D1 실제 런타임 연결 / 마트 MQTT 실시간 브릿지(`aitip/marts/{martId}/*`)** 중 사용자 지정 우선순위로 진행.

---

### 26) 80mm 실무 전표·바코드·자체문구, 공공데이터포털 HACCP 문서화, 정산 UI/UX 정비 (2026-11-21)

> **다음 AI를 위한 현재 상태 요약 (2026-11-21 19:15 기준)**:
> - **오늘 완료 항목**:
>   1. **실물 마트 규격 80mm 전표 & A4 거래명세표 고도화 (`mart-receipt.js`, `pwa-app.js`, `mart-info.js`, `mart_data.json`)**:
>      - `mart-receipt.js`: 순수 SVG `Code 39` 1D 바코드 생성기(`renderCode39Svg`) 탑재, 매장 헤더(`mart_name`, `biz_number`, `phone`, `address`), 배송모드(`당일배송`/`매장픽업`), 품목별 면세 `*` 표기 및 `barcode || product_id`·단가×수량=금액, 면세/과세공급가/부가세 10% 분리 집계, `promo_discount_total`, 보관 온도대 수량, 인수자 서명란, 하단 주문 UID Code 39 바코드 및 `@page { size: 80mm auto; margin: 3mm; }` 인쇄 CSS 적용. A4 거래명세표에도 `바코드/SKU`·`과면세` 컬럼 추가.
>      - 마트 자체 전표 문구 3종(`receipt_top_notice` 상단, `receipt_sub_notice` 마트 정보 아래, `receipt_bottom_notice` 주문바코드 위) 스키마(`mart_data.json`), 관리 입력 UI(`mart-info.js` `#mi-rcpt-top`, `#mi-rcpt-sub`, `#mi-rcpt-bottom`), 전표 조건부 출력(`mart-receipt.js`) 연동.
>      - `pwa-app.js`: 주문 생성(`#btn-submit-pwa-order`) 시 각 품목에 `barcode`, `tax_type` 포함 전달.
>   2. **공공데이터포털 HACCP API 연동 문서화 (`docs/DOC-20_공공데이터포털_HACCP_상품바코드_API_연동가이드.md`)**:
>      - `CertImgListServiceV3/getCertImgListServiceV3` 엔드포인트, Encoding/Decoding 인증키 설정 주의사항(`serviceKey=${apiKey}`), `mart-service.mjs`(`searchHaccpProducts`, `importExternalImageToMedia`), `dev-server.mjs`(`GET /api/mart/haccp/search`, `POST /api/mart/haccp/import-image`), `catalog.js`(`#btn-haccp-lookup`) 구조 및 Cloudflare Pages Functions(`functions/api/`) 미이관 Gap 명시.
>   3. **마트 정산 화면 SaaS 관점 정비 · UID 축약 · 검색/날짜 필터 추가 (`settlement.js`)**:
>      - 마트 포털(`settlement.js`)에서 세부 수수료(`위탁대행 5%`, `플랫폼 1.5%`) 개별 노출 및 합산 세금계산서 박스를 제거하고(세부 3자 수수료 원장은 슈퍼관리자 `/admin/` 영역으로 분리), `총 확정 매출 / 면세 / 과세 / 정산 공제 합계 / 마트 입금 예정액` 5종 KPI로 단순화.
>      - 내부 `ledger_id`(`mstl_...`), `facility_id`(`FAC-...`) 화면 표출 제거, `order_id` 축약 표시(`formatShortOrderNo`, 예: `261118-0001`, 마우스 오버 `title` 및 `data-order-id`에 전체 UID 보존).
>      - 통합 검색(`#stl-search`: 축약번호/끝자리/바코드 전체 `ORD-...`/수요처명 매칭) + 배송일 필터(`#stl-date`) + 검색 결과 합계 요약 바 추가.
> - **검증 및 서버 상태**:
>   - `node --check` 통과: `mart-receipt.js`, `pwa-app.js`, `mart-info.js`, `settlement.js` (`exit 0`).
>   - `mart_data.json` JSON 파싱 확인 및 `node scripts/build-pages.mjs` 빌드 완료 (`exit 0`).
>   - `dev-server.mjs` (`task-6808`, `http://localhost:8989`) 가동 중, `/mart/js/modules/mart-receipt.js`, `/mart/pwa/js/pwa-app.js`, `/mart/js/modules/mart-info.js`, `/mart/js/modules/settlement.js` HTTP `200` 및 `/api/mart/profile` 응답 실측 확인.
> - **내일 다시 기획 · 진행할 과제 (Next Steps)**:
>   1. **SaaS 플랫폼 정산·과금 정책 및 `/admin/` ↔ `/mart/` 역할 분리 재기획**: 슈퍼관리자(`/admin/`) 측 3자 수수료·알림톡·세금계산서 상세 원장과 마트 포털(`/mart/`) 실입금·청구 화면 간 정책 일관성 점검.
>   2. **전사 포털 UID 표시 및 검색 UX 통일 기획**: `orders.js` 등 마트/가맹점 테이블의 `주문 UID` 축약 표시(`YYMMDD-SEQ`) + 바코드/짧은번호/수요처 통합 검색 일관 적용 여부 결정.
>   3. **운영 인프라 이관 우선순위 확정**: `functions/api/` Cloudflare Pages Functions 이관(`HACCP_API_KEY` 시크릿, R2 미디어 업로드, D1 `MartD1Adapter` 런타임 연결) 및 `mart-logistics` MQTT 브릿지 연결.

---

### 27) 시범사업 피드백 기반 마트 운영 4대 고도화 및 전사 공통 페이지네이션 적용 (2026-11-22)

> **다음 AI를 위한 현재 상태 요약 (2026-11-22 16:02 기준)**:
> - **완료 항목 (대항목 1~4번 + 전사 공통 페이지네이션)**:
>   1. **대항목 1 — 당일 시세 일괄 업로드 · 오류 행만 재업로드 · 미니 엑셀 · `SYNC_FRESH` · 원클릭 롤백 (`channel-assign.js`, `mart-service.mjs`, `dev-server.mjs`, `api.js`)**:
>      - `POST /api/mart/prices/batch` (`applyDailyPriceBatch`), `GET /api/mart/prices/history` (`getUploadHistory`), `POST /api/mart/prices/rollback` (`rollbackUploadBatch`) 구현.
>      - 전체 재업로드 없이 오류 행만 인라인 수정·재업로드 또는 오류 CSV 내보내기 지원, 체크박스 선택 상품 미니 엑셀 다운로드, `SYNC_FRESH`(당일 신선 목록 미포함 기존 신선 상품 자동 품절), 업로드 직전 스냅샷 기반 원클릭 롤백 반영.
>   2. **대항목 2 — 재고 0 자동 품절 & 재고 상태 필터 (`catalog.js`, `b2b-app.js`)**:
>      - `catalog.js`에 재고 상태 필터(`OK`/`LOW`/`OUT`) 추가 및 `b2b-app.js`에서 `stock_qty === 0` 상품 품절 비활성화 처리.
>   3. **대항목 3 — 기획전 매대 진열 순서(`▲`/`▼`) & 매대 전용가 (`pwa-control.js`, `pwa-app.js`)**:
>      - 매대 내 진열 상품 순서 이동(`▲`/`▼`) 및 상품별 `shelf_price` 오버라이드(`shelf_overrides`) 저장·PWA 실반영 구현.
>   4. **대항목 4 — 할인 규칙 CSV 일괄 관리 & 선착순 한정수량 자동 종료 (`flyer-promo.js`, `mart-service.mjs`)**:
>      - `mart-service.mjs`: `createPromotion` (`total_limit_qty`, `used_qty: 0`), `updatePromotion` (`total_limit_qty`, `used_qty`, `status`: `ACTIVE`/`ENDED`/`PAUSED`), `createOrder` (`used_qty` 누적 후 `total_limit_qty > 0 && used_qty >= total_limit_qty` 시 자동 `ENDED` 전환 및 연결 상품 정상가 원복).
>      - `flyer-promo.js`: `RULES` 탭 `[할인 규칙 CSV 다운로드]` (`#btn-dl-promo-rules-csv`), `[할인 규칙 일괄 수정(CSV)]` (`#file-promo-rules-csv`), 등록 드로어 `#pm-total-limit` (`선착순 전체 한정수량`) 추가.
>   5. **전사 공통 하단 센터 페이지네이션 (`<< < 1 2 > >>`)**: `catalog.js`, `prep-catalog.js`, `channel-assign.js`, `daily-price.js`, `flyer-promo.js`, `orders.js`, `settlement.js` 마트 포털 전 주요 목록에 적용 완료.
>   6. **4~6번 대항목 상세보기 & 실중량 용어 정리**: `orders.js`, `picking.js`, `boxing.js`, `settlement.js` 전 모듈에 `[상세보기]` 버튼 및 우측 상세 드로어(전표·명세표 출력 연동) 추가, `실중량` 표현 제거 후 `결품·수량 정정`으로 통일.
>   7. **당일 시세 · 변동 독립 메뉴 & 사용 안내 모달**:
>      - `mart-portal/index.html` (`2. 판매 · 행사 적용 > 당일 시세 · 변동`, `/mart/js/app.js?v=20261122` 캐시 버스팅), `app.js`, `daily-price.js` 신설(실시간 시세·재고 즉시 수정, 일괄 CSV·오류 행 재업로드, `SYNC_FRESH`, 원클릭 롤백).
>      - `catalog.js` 상단 우측 원형 `?` 버튼(`#btn-catalog-help`) 및 사용 안내 모달(`#mc-catalog-help-modal`) 추가.
>   8. **허브·B2B·PWA UI/UX, 사업자 푸터 & B2B 발주 상세/수정·취소**:
>      - `packages/hub/index.html`: 컴팩트 3×2 대칭 6카드(1행 HQ·외식관리자·외식 PWA, 2행 마트관리자·마트 PWA·마트 B2B).
>      - `mart-b2b`: PC·태블릿 인증 카드 중앙 정렬(`.b2b-auth-stage`), 하단 사업자 푸터, `내 발주` `[상세보기]` + 피킹 전(`REQUESTED`) 수량 수정·발주 취소(`b2b-api.js`, `b2b-app.js`) 구현.
>      - `mart-pwa`, `food/pwa`: 관리자 기본정보(`mart`/`store`)와 실시간 연동되는 하단 사업자 푸터 추가(`food/pwa`는 `매장정보` 탭에서 중복 숨김).
>   9. **중간점검 리팩토링·ESM 순수화·D1/R2 스키마/인덱스/UID 일관성 정비**:
>      - `0001_mart_d1_init.sql` & `docs/schema_aitip_v01.sql`: `store_promotions` (`total_limit_qty`, `used_qty`, `status`, `idx_promotions_mart_status`), `orders` (`idx_orders_mart_delivery`/`idx_orders_mart_business_date`), `mart_adjustments` (`idx_adjustments_mart_order`), `mart_price_upload_batches` (`idx_price_batches_mart_created`), `mart_suppliers` 전표 자체문구 3종(`receipt_top_notice`, `receipt_sub_notice`, `receipt_bottom_notice`), `0001_mart_d1_init.sql` `products` 3단분류/B2B/`media_id` 동기화 완료.
>      - `mart-d1-adapter.mjs`: `createPromotion` 신규 필드 반영 및 `recordPriceUploadBatch`, `getPriceUploadBatches` 추가.
>      - `mart-price-batch.mjs` 분리 및 충돌 방지용 순차 ID 생성기 `nextMonotonicId(prefix)` 도입(`mart-service.mjs` 내 `Date.now()` 단독 ID 전면 교체).
>      - `mart-portal/js/utils/html.js` (`escapeHtml`, `esc`, `bindStopPropagation`) 신설로 10개 모듈 중복 이스케이프 함수 제거 및 인라인 `onclick="event.stopPropagation()"` 7건 완전 제거(`0건`).
>   10. **설계서 동기화**: `docs/DOC-19_하나로마트_위탁운영_PWA_몰_관리자_수퍼관리자_통합연동_설계서.md` 제12장 및 `docs/전사_다중_프로젝트_통합_플랫폼_표준_아키텍처_총람_v06.md` 제6장 `6) 전사 공통 운영 UI/UX 표준 규격` 업데이트 완료.
> - **검증 및 서버 상태**:
>   - `node --check`: `mart-logistics` 및 `food/pwa` 수정 모듈 모두 종료 코드 `0` 통과.
>   - `node scripts/build-pages.mjs` 빌드 완료 (`exit 0`).
>   - `dev-server.mjs` (`task-7614`, `http://localhost:8989`) 가동 중, `/`, `/mart/`, `/mart/pwa/`, `/mart/b2b/`, `/food/pwa/`, `/api/mart/catalog`, `/api/mart/prices/history` 모두 HTTP `200` 실측 확인.
> - **다음 이어서 진행할 과제 (Next Steps)**:
>   1. **운영 인프라 이관**: `functions/api/` Cloudflare Pages Functions 이관(`HACCP_API_KEY`, R2, D1 `MartD1Adapter`) 및 `mart-logistics` MQTT 실시간 브릿지 연결.
>   2. **SaaS 정산·UID 표시 일관성**: `/admin/` ↔ `/mart/` 정산 역할 분리 및 `orders.js` 등 전사 테이블 주문 UID 축약 표시(`YYMMDD-SEQ`) 적용 검토.

---

### 28) Cloudflare D1·R2 바인딩 복구, HACCP 5,206건 WebP 공용 풀 & 식약처 C005 분할 적재 (2026-11-23)

> **다음 AI를 위한 현재 상태 요약 (2026-11-23 20:28 기준)**:
> - **오늘 완료 항목**:
>   1. **Cloudflare Pages D1·R2 바인딩 복구 (`aitip-platform.pages.dev`)**:
>      - 루트에 바인딩이 비어 있던 `wrangler.json`이 `wrangler.toml`보다 우선 적용되어 런타임 `env.DB`/`env.MEDIA_PUBLIC`/`env.MEDIA_PRIVATE`가 `undefined`로 들어오던 원인 규명 및 `wrangler.json` 제거(`87ab765`).
>      - Pages `Production`/`Preview` 양쪽에 `DB` (`aitip-core-db`, `e56618aa-1047-4196-9e9d-a7384f09a427`), `MEDIA_PUBLIC` (`aitip-media-public`), `MEDIA_PRIVATE` (`aitip-media-private`) 및 `HACCP_API_KEY` 시크릿 정상 연결·실측 검증 완료 (`https://aitip-platform.pages.dev`).
>   2. **공용 바코드 카탈로그 스키마 & HACCP 5,206건 WebP 사전 적재**:
>      - `packages/services/mart-logistics/migrations/0002_shared_barcode_catalog.sql` 원격 `aitip-core-db` 적용(총 14테이블).
>      - `scripts/preload-haccp-barcodes.mjs`: HACCP `CertImgListServiceV3` 전체 147페이지(`14,602건`) 스캔 -> 유효 바코드+이미지 `5,213건` 추출 -> Python Pillow 12.2.0 실제 WebP 변환(최대 800px, quality=82) -> `node:crypto` AWS SigV4 R2 S3 API 직결 병렬 업로드(`shared/barcode/{barcode}.webp`, 영구 404 7건 제외 **5,206건** 적재 완료).
>      - UID 규칙 준수: `bar_0...` 30자 표준 Crockford Base32 ULID(`bar_[0-7]*`) 및 `ON CONFLICT(barcode) DO UPDATE` 적용.
>   3. **식약처 `C005`(바코드연계제품정보) 현행 생산분 1일차 1만 건 적재**:
>      - `C:\Users\user\Downloads\C005.csv.gz`(전체 `260,104행`) 중 `END_DT`(생산종료일) 공란인 현행 생산 유효 바코드 **`127,533건`** 필터링 완료.
>      - Cloudflare 무료 플랜 D1 일일 쓰기 한도(100,000 rows written/day, 건당 약 5 rows written) 고려하여 `scripts/import-c005-barcodes.mjs` 작성 및 1일차 `--offset=0 --limit=10000` 적재 완료 (`ON CONFLICT(barcode) DO NOTHING`으로 기존 HACCP WebP 5,206건 보존, 누적 **`15,058건`**, DB `5.19 MB`).
>   4. **API·마트 포털 UI·자가증식(`MERCHANT_INPUT`) 연동**:
>      - `mart-d1-adapter.mjs` (`lookupSharedBarcode`, `lookupSharedBarcodesBatch`, `contributeSharedBarcode`), `functions/api/mart/[[path]].js` (`GET /api/mart/catalog/barcode/:barcode`, `POST /api/mart/catalog/barcodes/lookup`, `GET /api/mart/media/public/*`, `GET /api/mart/haccp/search` D1 우선+실시간 HACCP 3.5s 폴백 병합, `POST /api/mart/haccp/import-image`, `POST /api/mart/products` 신규 `id` 생성 및 `MERCHANT_INPUT` 자동 축적) 구현 및 Pages 배포(`06c6802`).
>      - `mart-portal/js/api.js` (`lookupBarcodesBatch`), `catalog.js` (`#mp-name`/`#mp-barcode` Enter 키 조기 폼 제출 방지 및 자동 조회 `102e852`, 공용 WebP 직접 사용), `daily-price.js` (CSV 일괄 업로드 전 `lookupBarcodesBatch` 자동 매칭) 반영.
>   5. **인증키 로컬 보관 (Git 제외)**:
>      - `.env`(gitignored): `HACCP_API_KEY`, `R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `FSK_API_KEY` 저장.
>      - `docs/R2_S3_CREDENTIALS.local.md`: `.gitignore`에 `*.local.md` 추가하여 로컬 전용 보관.
> - **실측 검증 상태 (2026-11-23)**:
>   - `https://aitip-platform.pages.dev/api/mart/catalog/barcode/8809678470007` (`200`, `참군고구마칩`), `POST /api/mart/catalog/barcodes/lookup` (`200`, `count: 2`), `GET /api/mart/media/public/shared/barcode/8809678470007.webp` (`200`, `image/webp`, `16,412 bytes`), `GET /api/mart/haccp/search?q=너구리` (`200`, `순한너구리`·`얼큰한너구리` 2건) 실측 통과.
>   - 로컬 `dev-server.mjs` (`task-8289`, `http://localhost:8989`) 가동 중.
> - **다음 이어서 진행할 과제 (Next Steps)**:
>   1. **`C005` 현행 생산분 잔여 일일 분할 적재**: 내일 이후 하루 10,000건씩 이어서 실행 (`node scripts/import-c005-barcodes.mjs --apply --offset=10000 --limit=10000`, 전체 `127,533건` 완료까지 약 12일치 분할).
>   2. **`mart-logistics` MQTT 실시간 브릿지 연결** 및 **SaaS 정산(`/admin/` ↔ `/mart/`)·전사 테이블 주문 UID 축약 표시 통일**.

---

### 29) 마트 포털 2열 모달·결제수단·WebP 공용 이미지 풀·D1 수정 정합성 및 `C005` 일 1,000건 분할 전환 (2026-11-24 ~ 2026-11-25)

> **다음 AI를 위한 현재 상태 요약 (2026-11-25 16:26 기준)**:
> - **완료 항목 (2026-11-24 배포 완료, `main` 커밋 `f6cd537`~`0c43af1`, Pages 실서버 `https://fac5c604.aitip-platform.pages.dev`)**:
>   1. **중앙 오버레이 모달 & 2열 와이드 폼 통일 (`mart.css`, `catalog.js`, `prep-catalog.js`, `orders.js`)**:
>      - `.mc-drawer`를 중앙 오버레이 모달(`min(640px, 95vw)`)로 통일하고 `.mc-drawer--wide`(`min(980px, 96vw)`) + `.mc-drawer-grid-2`를 일반·신선 상품 등록/수정, 전처리 등록/수정, 오프라인 다품목 주문 입력(`#mo-draft-list` `max-height: 280px`)에 적용.
>      - `catalog.js`: 신선 대분류(`01`/`02`/`03`) HACCP 조회 가드, `'알수없음'` 정제, 행사 미적용 시 `sale_price = regPrice` 동기화.
>   2. **배정 화면 헤더 정리 & 당일 시세 복구 (`channel-assign.js`, `daily-price.js`, `mart.css`)**:
>      - `channel-assign.js` 중복 시세 버튼 3종을 `[현재 배정 목록 엑셀 다운로드]` + `[당일 시세 · 변동 바로가기]`로 정리.
>      - `daily-price.js:30` `martApi.getUploadHistory()` -> `martApi.getPriceUploadHistory()` 수정 및 `mart.css` `.mc-tabs`/`.mc-tab` 스타일 추가.
>   3. **결제·정산 화면 일반고객(B2C)/기관(B2B) 분리 및 결제 방법 추가 (`settlement.js`)**:
>      - 상단 `.mc-tabs`(`전체 내역` / `일반고객 결제 (B2C)` / `기관·경로당 정산 (B2B)`), 결제 수단 필터(`#stl-pay-method`), 테이블 `구분`·`결제 방법` 컬럼 및 상세 모달(정산 방식·공제액) 추가, 탭·필터 연동 5대 KPI 재계산 반영.
>   4. **외부 이미지 프록시 + 브라우저 WebP 변환 + `SHARED` 공용 풀 UID/검색 (`functions/api/mart/[[path]].js`, `dev-server.mjs`, `mart-d1-adapter.mjs`, `api.js`, `catalog.js`)**:
>      - `GET /api/mart/haccp/proxy-image?url=...` 프록시 추가 -> 브라우저 `fileToWebpDataUrl()`(최대 800px, `image/webp` 0.82) 변환 -> `POST /api/mart/media/upload`(`scope: 'SHARED'`)로 실제 WebP만 R2 저장.
>      - `SHARED` 공용 UID 정책: `media_objects`(`domain='SHARED'`, `region_code='00-000'`, `tenant_id='SHARED'`, `owner_type='PRODUCT'`), 표준 바코드는 `shared/barcode/{barcode}.webp`, 바코드 없는 다규격·신선 품목은 `shared/common-pool/{mediaId}.webp`(`original_file_name="{상품명} {규격}.webp"`).
>      - `GET /api/mart/media/shared?q=...`(`searchSharedMedia`) + `catalog.js` `[공용 이미지 검색]` 추가(재업로드 없이 기존 `media_id`/`image_url` 재사용). `haccp/import-image` `owner_type: 'MART_PRODUCT'` -> `'PRODUCT'` D1 `CHECK` 제약 위반 수정.
>   5. **D1 `upsertProduct()` 수정 정합성 보완 (`mart-d1-adapter.mjs`)**:
>      - 기존 행 조회·병합으로 부분 수정 시 미전달 필드 보존 + `ON CONFLICT(id) DO UPDATE SET`에 `cost_price`, `barcode_sku`, `category_type`, `category_path`, `spec`, `uom`, `tax_type`, `is_prep`, `storage_temp`, `safety_stock` 반영 완료.
> - **완료 항목 (2026-11-25)**:
>   6. **식약처 `C005` 일일 분할 적재량 1,000건으로 축소 조정 & 배치 실행**:
>      - `scripts/import-c005-barcodes.mjs` 기본 `--limit`을 `15000` -> `1000`으로 변경.
>      - `--apply --offset=11000 --limit=1000` 실행 완료 (`changes: 987`, `rows_written: 3,948`, DB `5.29 MB`).
>      - 현재 원격 D1(`aitip-core-db`) `shared_barcode_catalog` 누적 실측: **`17,034건`** (`HACCP 5,206` + `MFDS 11,828`).
>      - 로컬 개발 서버 `node dev-server.mjs` (`http://localhost:8989`, `task-9126`) 가동 중.
> - **다음 이어서 진행할 과제 (Next Steps)**:
>   1. **`C005` 잔여 일일 분할 적재 (일 1,000건 기준)**: 다음 실행 명령 `node scripts/import-c005-barcodes.mjs --apply --offset=12000 --limit=1000` (전체 `127,533건` 중 `12,000`까지 처리 완료).
>   2. **`mart-logistics` MQTT 실시간 브릿지 연결** 및 **SaaS 정산(`/admin/` ↔ `/mart/`)·전사 테이블 주문 UID 축약 표시 통일**.





