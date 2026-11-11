# 🏛️ AITIP 플랫폼 내부 구조 및 통합 UID 체계 표준 명세서
## (Internal Architecture, Directory Scaffolding & Unified UID Standard)

> **문서 번호**: AITIP-SPEC-INTERNAL-UID-2026-V2  
> **표준 버전**: v2.0.0 (Master Production Standard)  
> **기준 일시**: 2026-11-08  
> **적용 범위**: Cloudflare Workers/D1, 엣지 스마트 단말기(C/LVGL), 프론트엔드 5대 포털(PWA/PC웹)  
> **핵심 원칙**: 내부 중추망(`transport/`)과 외부 4대 관문(`adapters/`)의 엄격한 경계 분리, 가맹점 0원 443 터널, UID 무결성, PII 암호화

---

## 📌 1. 전사 플랫폼 내부 디렉터리 스캐폴딩 (Scaffolding Specification)

프로젝트 루트(`aitip-platform/`)의 모든 모듈은 기술과 관심사에 따라 5대 독립 물리 영역으로 엄격히 격리됩니다.

```
aitip-platform/
│
├── .agents/                                # AI 행동 강령 및 핵심 신조
│   └── AGENTS.md                           # 절대 신조: 상생, 정직한 조언, 거짓말/꼼수 금지
├── docs/                                   # 전사 마스터 규격서 (DOC-00 ~ DOC-06)
│   ├── DOC-00_AITIP_통합_UID_체계_표준_명세서.md
│   ├── AITIP_PLATFORM_MASTER_DESIGN_2026.md
│   ├── AITIP_Smart_CTI_Terminal_Joint_Hardware_Specification_v1.0.md
│   └── AITIP_INTERNAL_STRUCTURE_AND_UID_SPEC.md (본 문서)
│
├── migrations/                             # Cloudflare D1 번호순 마이그레이션 폴더
│   ├── 0001_initial_baseline.sql           # 기본 17개 테이블 DDL
│   └── 0002_print_jobs.sql                 # Outbox 큐(print_jobs), order_alerts, refund_jobs
│
├── scripts/                                # 무결성 검증 및 빌드 스크립트
│   └── test_schema_integrity.py            # D1 마이그레이션 순차 적용 검증 스위트 (100% 무결성)
│
├── tools/                                  # 개발 및 자동화 테스트 도구
│   └── device-simulator/                   # 단말기 통신/오프라인/ACK 유실 자동화 테스트용 가상 기기
│
├── HANDOVER_AITIP_PLATFORM.md              # 일일 엔지니어링 공정 일지
│
└── packages/
    │
    ├── contracts/                          # [언어 독립 공통 계약: Zero Secret]
    │   ├── schemas/                        # JSON Schema (단일 진실 공급원)
    │   │   ├── order.schema.json           # 주문 생성 요청/응답 규격
    │   │   ├── print-job.schema.json       # Outbox 인쇄 작업 규격
    │   │   ├── device-event.schema.json    # 내부 단말기 WSS/MQTTS 프로토콜 규격
    │   │   └── agent-order.schema.json     # 🤖 외부 AI 에이전트 A2A 주문 발주 규격
    │   └── test-vectors/                   # 언어별 검증용 테스트 픽스처셋
    │       ├── typeid-samples.json         # DOC-00 15대 접두사 유효/거부 샘플
    │       └── escpos-fixture.bin          # 표준 80mm ESC/POS 기준 바이너리
    │
    ├── backend/                            # [Cloudflare Workers / D1 / DO 백엔드]
    │   ├── index.js                        # Workers Fetch 핸들러 엔트리
    │   ├── security/                       # [서버 전용 비밀 & 암호화] (외부 절대 비노출)
    │   │   ├── cipher.js                   # AES-256-GCM (_enc 암호화)
    │   │   ├── hmac.js                     # HMAC-SHA256 (_hmac 검색 색인 생성)
    │   │   └── keys.js                     # wrangler secret & pii_key_ver 관리
    │   ├── middlewares/                    # 공통 파이프라인
    │   │   ├── auth.js                     # JWT 검증 & store_members/facility_members 소속 인가
    │   │   ├── device-auth.js              # 단말기 Ed25519 서명 챌린지 검증
    │   │   ├── rate-limit.js               # 단말/IP별 요청 제한
    │   │   └── error-handler.js            # PII 마스킹 에러 응답기
    │   ├── transport/                      # 🏠 [우리 플랫폼 내부 전용 통신 중추망]
    │   │   ├── mqtt/                       # MQTTS 브로커 ➔ 단말기 직결 세션 및 QoS 1 발행
    │   │   └── ws/                         # Durable Objects WSS 백본 & 2중 타이머 관리
    │   ├── adapters/                       # 🚪 4대 외부 연동 독립 게이트웨이
    │   │   ├── delivery/                   # 1. 상업 배달 외주 (생각대로, 부릉, 바로고)
    │   │   │   ├── delivery-gateway.interface.js
    │   │   │   ├── barogo.adapter.js
    │   │   │   ├── vroong.adapter.js
    │   │   │   └── delivery-webhook.router.js
    │   │   ├── payment/                    # 2. 결제사 (토스페이먼츠, 이니시스 등)
    │   │   │   ├── payment-gateway.interface.js
    │   │   │   ├── toss.adapter.js
    │   │   │   └── payment-webhook.router.js
    │   │   ├── consignment/                # 3. 하나로마트 위탁 운영 (일자리 사업단 총괄 관리)
    │   │   │   ├── picking-orders.router.js# 일자리 사업단 피킹 지시서 발행
    │   │   │   ├── out-of-stock.router.js  # 매대 결품 즉시 부분 취소
    │   │   │   └── consignment-statement.js# 마트 원가 vs 위탁수수료 대사서
    │   │   └── agent/                      # 4. 🤖 외부 AI 에이전트 A2A 주문 수신 게이트웨이
    │   │       ├── agent-discovery.router.js# 외부 AI용 매장/메뉴 탐색
    │   │       ├── agent-negotiation.service.js# AI 대화형 조건 협상
    │   │       ├── agent-order.router.js   # 외부 AI ➔ 단말기 직결 주문 발주
    │   │       └── mcp-server.js           # Anthropic/Google MCP 서버
    │   ├── modules/                        # 기능별 수직 분할 모듈 (Prepared Stmt 반환 패턴)
    │   │   ├── orders/                     # 주문 생성(D1 batch 원자적), 손님 위변조 차단 단가 계산
    │   │   ├── print-jobs/                 # Outbox 큐 관리, 만료 처리, ACK 수신
    │   │   ├── products/                   # 메뉴 관리(점주 자유 수정), 엑셀 대량 업로드, 단말 긴급 품절
    │   │   ├── stores/                     # 매장 정보, 영업시간, 지역별 배달비 규칙
    │   │   └── settlements/                # 식당 매출 통계 리포트 & 마트 격주/월마감 대사
    │   └── cron/
    │       ├── escalation-sweeper.js       # 1분 주기 미알림 주문 감시 최종 안전망
    │       └── daily-settlement.js         # 매시간 주기 매장별 cutoff 기준 매출 집계
    │
    ├── edge-device/                        # [AITIP 스마트 단말기 C / Embedded Linux / LVGL]
    │   ├── cti-driver/                     # Dual RJ-9 수화기 DPDT 바이패스 & Si3050 DAA 드라이버
    │   ├── print-spooler/                  # UART 프린터 드라이버 & 로컬 멱등 저장소
    │   ├── transport-client/               # 443 WSS / MQTTS 클라이언트 (30초 핑, 지수 백오프)
    │   ├── ota/                            # A/B 파티션 서명 검증 펌웨어 업데이트
    │   └── ui/                             # LVGL 경량 터치 GUI (RK3566 / Allwinner H616)
    │
    └── frontend/                           # [독립 PWA 및 웹 포털 (Vite)]
        ├── api/                            # 공통 API Client 레이어 (fetch 인라인 절대 금지)
        ├── pwa-order/                      # 고객 배달 & 경로당 공구 주문 PWA
        ├── pwa-merchant/                   # 점주 스마트폰용 원격 관리 & 2차 비상 수락 PWA
        ├── pwa-rider/                      # 시니어 배달단 PWA (배송 & 안부확인 촬영)
        ├── mart-portal/                    # 하나로마트 PC 전용 백오피스 웹 (엑셀 대량등록/마감대사)
        └── admin-dashboard/                # 지자체 및 일자리 기관 총괄 관리 콘솔
```

---

## 🔑 2. AITIP 통합 UID 및 식별자 체계 표준 (DOC-00 기반)

### 2.1 3계층 식별자 분리 원칙
1. **제1계층 : 내부 고유 식별자 (Machine PK / FK)**:
   - 전사 표준: **TypeID** (RFC 9562 UUIDv7 + Crockford Base32 26자).
   - 밀리초 타임스탬프 내장, 분산 환경 충돌 0%.
2. **제2계층 : 일일 표시 순번 (Human Sequence)**:
   - 규격: `display_seq INTEGER NOT NULL CHECK (display_seq > 0)`.
   - 판매자(`store_id` 또는 `mart_id`)와 영업일(`business_date`) 단위로 매일 1부터 시작.
   - 단말기 화면 및 영수증에는 앱이 `"주문-01"`, `"식자재-14"` 등 가독성 코드로 조합 표기.
3. **제3계층 : 외부/비즈니스 식별자 (Domain Business Code)**:
   - 사업자등록번호(`biz_reg_no`), 경로당 시설코드(`facility_code`), 농협ERP코드(`nh_erp_code`).
   - 내부 테이블 조인의 외래키로 절대 사용하지 않으며, 보조 유니크 인덱스로만 관리.

---

### 2.2 전사 15대 TypeID 공식 접두사 및 발급 주체

모든 TypeID는 **`접두사_` + `26자리 Crockford Base32`**로 구성되며 총 길이는 30자(단, `call_`은 31자)입니다:

| 접두사 | 대상 엔티티 | 고정 길이 | 발급 주체 | 정규표현식 / CHECK 제약 규칙 |
| :--- | :--- | :---: | :---: | :--- |
| `usr_` | 사용자 (소비자, 점주, 배송원) | 30자 | **서버** | `length(id)=30 AND id GLOB 'usr_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `org_` | 지자체 및 운영기관 (시니어클럽 등) | 30자 | **서버** | `length(id)=30 AND id GLOB 'org_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `biz_` | 사업단 (어르신 배송단 등) | 30자 | **서버** | `length(id)=30 AND id GLOB 'biz_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `wrk_` | 배송 참여자 (어르신 배송원) | 30자 | **서버** | `length(id)=30 AND id GLOB 'wrk_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `str_` | 소상공인 식당 가맹점 | 30자 | **서버** | `length(id)=30 AND id GLOB 'str_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `mrt_` | 단위농협 하나로마트 공급처 | 30자 | **서버** | `length(id)=30 AND id GLOB 'mrt_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `fac_` | 수용 시설 (경로당, 복지센터 등) | 30자 | **서버** | `length(id)=30 AND id GLOB 'fac_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `dev_` | AITIP 스마트 단말기 하드웨어 | 30자 | **서버** | `length(id)=30 AND id GLOB 'dev_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `prd_` | 상품 및 음식 메뉴 | 30자 | **서버** | `length(id)=30 AND id GLOB 'prd_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `ord_` | 통합 주문 원장 | 30자 | **서버** | `length(id)=30 AND id GLOB 'ord_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `itm_` | 주문 상세 품목 (옵션/세금 스냅샷) | 30자 | **서버** | `length(id)=30 AND id GLOB 'itm_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `dlv_` | 배송 세션 원장 | 30자 | **서버** | `length(id)=30 AND id GLOB 'dlv_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `pay_` | 결제 원장 | 30자 | **서버** | `length(id)=30 AND id GLOB 'pay_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `set_` | 정산 원장 | 30자 | **서버** | `length(id)=30 AND id GLOB 'set_[0-7]*' AND substr(id,5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |
| `call_`| 단말기 CTI 수신 통화 세션 | **31자** | **서버** | `length(id)=31 AND id GLOB 'call_[0-7]*' AND substr(id,6) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'` |

> **⚠️ 발급 주체 절대 원칙**:  
> 클라이언트는 트랜잭션 TypeID(`ord_`, `pay_`, `itm_` 등)를 절대로 직접 생성하지 않습니다. 클라이언트는 오직 **중복 방지용 멱등성 키(`client_request_id`: 8~64자 난수 문자열)**만 발급하며, 모든 TypeID는 서버가 원자적 트랜잭션 시점에 단독 발급합니다.

---

### 2.3 내부 하위 큐 및 규칙 테이블 식별자 (D1 AUTOINCREMENT 원칙)
외부에 독립 노출되지 않는 대량 적재 큐와 매장 종속 하위 행은 **D1 내부 정수 대리키(`INTEGER PRIMARY KEY AUTOINCREMENT`)**를 사용합니다:
- `print_jobs.id` (인쇄 Outbox 큐)
- `order_alerts.id` (에스컬레이션 알림 이력)
- `refund_jobs.id` (자동 취소 환불 Outbox 큐)
- `store_hours.id` (가맹점 요일별 영업시간)
- `store_delivery_fee_rules.id` (가맹점 지역별 추가 배달비 규칙)

---

### 2.4 개인정보(PII) 보안 식별 및 검색 체계 (`_enc` & `_hmac`)
데이터베이스 전 테이블에서 평문 전화번호, 계좌번호, 상세주소 저장을 원천 차단합니다:

```
[클라이언트 입력] ➔ "010-1234-5678"
       │
       ├─ (1) AES-256-GCM 암호화 ─────> phone_enc  (복호화 전용, Base64 문자열)
       │
       └─ (2) HMAC-SHA256 해시 ───────> phone_hmac (동등 비교 검색 전용, 64자리 소문자 Hex)
```

- **`*_enc`**: 애플리케이션 계층에서 AES-256-GCM으로 암호화하여 저장하며 키 버전(`pii_key_ver >= 1`)을 동반 관리합니다.
- **`*_hmac`**: 전용 서버 시크릿 키로 생성한 HMAC-SHA256 해시이며, DB 수준에서 다음 제약을 강제합니다:
  ```sql
  CONSTRAINT chk_phone_hmac CHECK (length(phone_hmac) = 64 AND phone_hmac NOT GLOB '*[^0-9a-f]*')
  ```
- 전화번호로 사용자를 조회할 때는 입력값의 HMAC을 계산하여 `WHERE phone_hmac = ?`로 조회합니다.

---

## 🛡️ 3. 결론

본 명세서는 **소상공인 가맹점 O2O 본체와 하나로마트 위탁 복지 파생 생태계**를 지탱하는 가장 견고한 뼈대이며, 전 개발 영역(백엔드, 하드웨어 펌웨어, 프론트엔드 포털)은 본 문서의 디렉터리 경로 및 UID 규칙을 100% 예외 없이 준수해야 합니다.
