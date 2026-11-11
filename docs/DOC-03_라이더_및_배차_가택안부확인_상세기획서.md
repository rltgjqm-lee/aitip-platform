# 🛵 [DOC-03] 라이더 배차 및 라스트마일 배송 상세 기획서
## (실시간 WSS 관제 · D1 원자적 배차 락 · 시니어클럽 2인1조 배달단 · 사진/서명 R2 비공개 증빙)

> **문서 번호**: AITIP-SPEC-DELIV-2026-DOC03  
> **표준 버전**: v4.0.0 (D1 RDBMS 정합성 및 오픈소스 벤치마크 검증 완료)  
> **작성 일자**: 2026년 11월 7일  
> **표준 인프라**: **Cloudflare Workers (Edge API) + Durable Objects (WSS 관제) + Cloudflare D1 (RDBMS) + Cloudflare R2 (비공개 증빙 스토리지)**  
> **연관 문서**: `DOC-00_AITIP_통합_UID_체계_표준_명세서.md`, `DOC-01_소비자_및_경로당_멀티디바이스_주문인터페이스_기획서.md`, `DOC-02_가맹점_및_AITIP단말기_하드웨어연동_상세기획서.md`, `DOC-04_Cloudflare_D1_통합데이터베이스_스키마_명세서.md`, `DOC-05_Cloudflare_Workers_API_엔드포인트_및_웹소켓_통신_명세서.md`

---

## 📌 1. 기획 개요 및 듀얼 배송망 구조

AITIP 배송 시스템은 소상공인 외식업 음식 배달을 담당하는 **'상업 배달 라이더'**와, 단위농협 하나로마트의 식자재 및 생필품을 경로당 및 가정으로 순회 배송하는 **'공공 노인일자리 상생 배달단(시니어클럽 2인 1조)'**을 단일 플랫폼 내에서 수용하는 **듀얼 트랙 라스트마일 아키텍처**를 채택합니다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                          AITIP 듀얼 트랙 라스트마일 배송망 구조                          │
├────────────────────────────────────────────┬─────────────────────────────────────────────┤
│      [트랙 A: 일반 상업 배달 라이더]       │     [트랙 B: 공공 노인일자리 시니어 배달단]  │
├────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ • 소상공인 외식업(식당/카페) 음식 퀵 배달  │ • 단위농협 하나로마트 B2B 식자재 & B2C 장보기│
│ • 오토바이 / 전기 자전거 / 도보 라이더     │ • 노인일자리 공익활동 참여자 (2인 1조 팀)   │
│ • 단독 라이더 배차 (`workers`)             │ • 팀 단위 배차 (`work_teams` + `workers`)   │
│ • 속도 중심 (주문 후 20~30분 이내 배송)    │ • 거점 순회 배송 (오전/오후 지정 시간대 납품)│
│ • 증빙: 현장 배송 완료 사진 R2 업로드     │ • 증빙: 경로당 수령인 전자서명 + 물품 사진  │
└────────────────────────────────────────────┴─────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **설계 원칙 (Scope 명확화 및 비현실적 요소 배제)**:
> 1. **비현실적인 구두 4자리 OTP 배제**: 경로당 고령 수령자에게 4자리 인증번호 구두 확인을 강제하는 방식은 현장 혼란과 마찰을 유발하므로 전면 배제합니다.
> 2. **복지 돌봄 영역과 유통 배송의 분리**: 고독사 예방을 위한 가택 안부 확인 설문(식사·안색·주거환경 3대 체크리스트)은 돌봄 전문 플랫폼(WellRisk)의 고유 영역이므로, AITIP 배송 명세에서는 제외하고 순수 **물류 배송·식자재 검수·인계 증빙**에 집중합니다.
> 3. **R2 비공개 객체 기반 증빙**: 배송 완료 증빙(인계 사진 및 수령인 서명)은 공개 URL이 아닌 Cloudflare R2 비공개 버킷에 격리 저장하며, 관리자 및 고객 콘솔에는 15분 만료 서명 URL(Presigned URL)로 안전하게 제공합니다.

---

## 📱 2. 라이더 모바일 PWA 핵심 워크플로우

설치 없이 모바일 브라우저(Chrome, Safari 등)에서 즉시 구동되는 **반응형 웹 애플리케이션(PWA)**으로 구현하여 기기 진입 장벽을 최소화합니다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                            5단계 배송 세션 라이프사이클                                  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ [1. 배차 알림/수락] ➔ [2. 가맹점/마트 도착] ➔ [3. 물품 픽업] ➔ [4. 배송지 도착] ➔ [5. 완료 증빙]│
│    (WSS 브로드캐스팅)     (D1 원자적 락)       (바코드/주문확인)     (실시간 GPS 관제)    (사진/서명 R2) │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1) 5대 오픈소스 벤치마크 기반 핵심 구현 패턴

| 벤치마크 프로젝트 | 반영 기능 | AITIP 표준 구현 방식 |
| :--- | :--- | :--- |
| **Hyperlocal-Delivery** | 반경 기반 WSS 라이더 브로드캐스팅 및 원자적 선착순 배차 락 | Durable Objects 위치 허브를 통한 반경 2km 이내 라이더 WSS 푸시 및 Cloudflare D1 원자적 조건부 UPDATE |
| **Enatega** | 상태 머신 기반 배송 단계 제어 및 실시간 GPS 트래킹 | `ASSIGNED` ➔ `PICKED_UP` ➔ `IN_TRANSIT` ➔ `ARRIVED` ➔ `COMPLETED` 전이 규칙 엄수 |
| **NextOrders** | PWA 모바일 오프라인 내성 (Network Resiliency) | 엘리베이터/지하 등 통신 음영 지역에서 IndexedDB에 서명/완료 데이터 임시 적재 후 온라인 복귀 시 자동 백그라운드 동기화 |
| **TastyPrinter** | 픽업지 영수증 식별 | 단말기에서 인쇄된 접수번호(`display_code`, 예: A-01)를 대조하여 오배송 방지 |
| **SwadKart** | 라이더 기본 정보 관리 | SwadKart의 레거시 MongoDB(`findOneAndUpdate`) 코드를 전면 배제하고 D1 SQL 트랜잭션으로 표준화 |

---

## 🔒 3. Cloudflare D1 기반 원자적 배차 락 (동시 배정 방지)

MongoDB 기반 레거시 코드(`User.findOneAndUpdate`)를 완전히 제거하고, Cloudflare D1 RDBMS의 원자적 `UPDATE` 쿼리와 조건절(Guard Condition)을 활용하여 다수의 라이더가 동시에 '수락' 버튼을 누르더라도 정확히 1명에게만 배차가 성립되도록 보장합니다.

### 1) 원자적 배차 수락 쿼리 (Edge Worker)

```sql
-- D1 원자적 배차 수락 (1개 트랜잭션 / 원자적 실행)
UPDATE workers
SET 
    status = 'IN_TRANSIT',
    current_order_id = :order_id,
    updated_at = unixepoch()
WHERE id = :worker_id
  AND status = 'ACTIVE'
  AND current_order_id IS NULL;
```

```typescript
// Worker API 계층 검증 로직 (DOC-05 정합)
const result = await env.DB.prepare(`
  UPDATE workers
  SET status = 'IN_TRANSIT', current_order_id = ?1, updated_at = unixepoch()
  WHERE id = ?2 AND status = 'ACTIVE' AND current_order_id IS NULL
`).bind(orderId, workerId).run();

if (result.meta.changes !== 1) {
  // 이미 다른 주문을 수행 중이거나 오프라인 상태
  return Response.json(
    { error: { code: "WORKER_NOT_AVAILABLE", message: "배차 가능한 상태가 아닙니다." } },
    { status: 409 }
  );
}

// delivery_sessions 테이블에 세션 생성
const sessionId = generateTypeID("del");
await env.DB.prepare(`
  INSERT INTO delivery_sessions (
    id, order_id, worker_id, status, assigned_at
  ) VALUES (?1, ?2, ?3, 'ASSIGNED', unixepoch())
`).bind(sessionId, orderId, workerId).run();
```

---

## 📸 4. 배송 완료 증빙 (사진 및 수령인 전자서명 워크플로우)

경로당 어르신이나 일반 소비자가 외출 중이거나 비대면 수령을 원할 때, 분쟁 없는 투명한 배송 완료를 위해 이중 증빙 체계를 가동합니다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                         배송 완료 증빙 데이터 흐름 (R2 Private)                          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ [라이더 PWA]                                                                             │
│   ├── 현장 사진 촬영 (WebP 압축, 최대 1024px) ─────────────┐                             │
│   └── 수령인 전자 서명 (Canvas 벡터 ➔ PNG 변환) ───────────┤                             │
│                                                            ▼                             │
│                                            [Cloudflare Workers API]                      │
│                                                            │                             │
│                   ┌────────────────────────────────────────┴─────────────────────┐       │
│                   ▼                                                              ▼       │
│        [Cloudflare R2 Private Bucket]                             [Cloudflare D1 RDBMS]  │
│        • deliveries/{del_id}/proof.webp                           • photo_proof_object_key│
│        • deliveries/{del_id}/signature.png                        • signature_object_key │
│                                                                   • status = 'COMPLETED' │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1) D1 배송 세션 완료 처리 쿼리

```sql
UPDATE delivery_sessions
SET 
    status = 'COMPLETED',
    photo_proof_object_key = :proof_key,
    signature_object_key = :sig_key,
    completed_at = unixepoch()
WHERE id = :delivery_session_id
  AND status IN ('IN_TRANSIT', 'ARRIVED');
```

```sql
-- 배송 완료와 동시에 주문 상태 업데이트 (D1 db.batch)
UPDATE orders
SET 
    status = 'DELIVERED',
    updated_at = unixepoch()
WHERE id = :order_id
  AND status = 'DISPATCHED';
```

---

## 👥 5. [공공 상생 트랙] 시니어클럽 2인 1조 배달단 운영 모델

단위농협 하나로마트(`mrt_`)에서 경로당(`fac_`)으로 납품되는 대용량 쌀, 양곡, 식자재, 김치 등 무거운 물품의 안전한 배송을 위해 지역 시니어클럽과 연계한 **2인 1조 팀 배달 체계**를 지원합니다.

### 1) 팀 배차 데이터 매핑 구조

* `work_teams` (`wtm_`): 노인일자리 공익활동 사업단 단위 팀 엔티티 (`team_name`, `leader_worker_id`, `organization_id`).
* `workers` (`wrk_`): 팀에 소속된 시니어 참여자 (`work_team_id` 외래키 매핑).
* 배차 시 알림은 팀장(Leader) 단말기로 전달되며, 수락 시 조원 전체가 해당 배송에 연동됩니다.

### 2) 경로당 식자재 B2B 검수 및 인계 워크플로우

1. **하나로마트 물품 인수**: 배달단이 마트 검수 구역에서 식자재 박스 수량 및 냉장/냉동 패키징을 확인.
2. **경로당 도착 및 인계**:
   * 경로당 회장 또는 총무(`facility_members`) 대면 확인.
   * 손상 여부 검수 후 경로당 관리자 서명을 PWA 태블릿/스마트폰 화면에 수령 (`signature_object_key`).
   * 납품된 식자재 전체 박스를 경로당 현판과 함께 현장 촬영 (`photo_proof_object_key`).
3. **D1 감사 로그 적재**: `delivery_events` (`dev_`) 테이블에 위치 좌표와 함께 `DELIVERY_HANDOVER` 이벤트 원자적 저장.

---

## 🛡️ 6. 데이터 보안 및 개인정보(PII) 격리 준수

`DOC-00` 및 `DOC-04`에 규정된 보안 및 프라이버시 원칙을 100% 준수합니다:

1. **소비자 연락처 마스킹**:
   * 라이더 PWA 화면에는 고객의 원본 휴대폰 번호(`phone_enc`)가 평문으로 노출되지 않으며, 가상 안심번호 또는 가운데 4자리 마스킹(`010-****-5678`) 형태로만 표시됩니다.
2. **배송 주소 암호화 격리**:
   * 라이더에게는 배송에 필요한 주소 텍스트만 전달되며, 배송 완료(`COMPLETED`) 처리 즉시 모바일 클라이언트 캐시(IndexedDB)에서 개인 식별 데이터가 영구 삭제됩니다.
3. **위치 추적 데이터 보존 정책**:
   * 배송 세션 중 3초 주기로 수신된 GPS 궤적 로그는 배송 완료 후 분쟁 방지를 위해 30일간 보관된 뒤 자동 만료(TTL) 처리됩니다.

---

## 📊 7. 관련 데이터베이스 엔티티 매핑 요약

| 테이블명 | TypeID 접두사 | 담당 역할 | 주요 제약 및 검증 규칙 |
| :--- | :--- | :--- | :--- |
| `workers` | `wrk_` | 배달 라이더 / 시니어 참여자 | `status` IN ('ACTIVE', 'IN_TRANSIT', 'INACTIVE'), `phone_hmac` 유니크 |
| `work_teams` | `wtm_` | 시니어 2인 1조 팀 | `leader_worker_id` 외래키 참조 |
| `delivery_sessions` | `del_` | 단일 배송 수행 건 | `order_id` 외래키, `photo_proof_object_key`, `signature_object_key` R2 키 저장 |
| `delivery_events` | `dev_` | 배송 상태 전이 감사 로그 | `event_type` ('ASSIGNED', 'PICKUP', 'ARRIVED', 'COMPLETED'), GPS 좌표 저장 |
