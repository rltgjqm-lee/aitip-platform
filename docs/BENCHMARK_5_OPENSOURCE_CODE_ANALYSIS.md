# 🔬 [BENCHMARK-01] 5대 배달 오픈소스 원천 코드베이스 정밀 완독 총람 (최종 개편판)
## (SwadKart · TastyPrinter · Enatega · NextOrders · Hyperlocal Delivery 소스코드 라인 바이 라인 정밀 해부 및 AITIP 이식 규격)

> **문서 번호**: AITIP-BENCHMARK-2026-V03 (5대 소스 전수 완독 최종 개편판)  
> **분석 일자**: 2026년 11월 7일  
> **분석 대상 레포지토리 (로컬 클론 위치)**:
> 1. `references/swadkart/` (theunstopabble/SwadKart - MERN 배달 플랫폼)
> 2. `references/tastyprinter/` (foximler/TastyPrinter - ESC/POS 열전사 프린터 제어기)
> 3. `references/enatega/` (enatega/food-delivery-singlevendor - 3대 독립 앱 React Native & GraphQL)
> 4. `references/nextorders/` (nextorders/food - Nuxt 3 & Zod 모듈식 배달/포장 PWA)
> 5. `references/hyperlocal-delivery/` (NIRU0802/hyperlocal-delivery - 외식+마트 결합 및 Leaflet 트래킹)  
> **표준 인프라 결합**: Cloudflare Workers + D1 + Durable Objects WSS + 라즈베리 파이 단말기  
> **연관 문서**: `AITIP_PLATFORM_MASTER_DESIGN_2026.md`, `DOC-01` ~ `DOC-06`

---

## 📌 1. 분석 개요 및 5대 소스 종합 비교 매트릭스

AITIP 차세대 상생 플랫폼은 배달의민족형 소상공인 O2O 본체와 하드웨어 단말기, 그리고 경로당 급식 및 마트 장보기 공동구매 파생 서비스를 결합한 고도화된 시스템입니다.
이를 밑바닥부터 시행착오 없이 구축하기 위해, 전 세계에서 검증된 5대 오픈소스의 원천 소스코드를 로컬에 내려받아 파일 단위, 라인 단위로 정밀 완독했습니다.

### 5대 오픈소스 종합 비교표

| 비교 항목 | 1. SwadKart | 2. TastyPrinter | 3. Enatega | 4. NextOrders | 5. Hyperlocal Delivery | AITIP 차세대 플랫폼 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **핵심 기술스택** | Node.js, Express, MongoDB, Socket.io | Python, python-escpos, Raw Socket | React Native, GraphQL, Apollo, Node.js | Nuxt 3, Vue 3, Zod, TailwindCSS | Next.js 14, React, Leaflet, Zustand | Cloudflare Workers, D1 (SQLite), DO WSS |
| **주문 트랜잭션** | Mongoose 세션 트랜잭션 (ACID) | 단일 HTTP POST 수신 후 상태 갱신 | GraphQL Mutation 기반 상태 전이 | 메모리/KV 기반 함수형 재계산 | API 라우트 기반 REST 통신 | Cloudflare D1 `db.batch()` 원자적 처리 |
| **재고 차감 방식** | `countInStock: { $gte: qty }` 원자적 락 | 재고 관리 로직 부재 | 프런트엔드 수량 비교 후 차감 | 품목별 인크리먼트/디크리먼트 | 단순 배열 필터링 | D1 `UPDATE products SET stock - ? WHERE stock >= ?` |
| **영수증 출력** | 브라우저 윈도우 인쇄 | 포트 9100 / `/dev/usb/lp0` ESC/POS 바이트 | 없음 (모바일 화면 표출) | 없음 (웹 확인) | 없음 (웹 확인) | Workers 에지 ESC/POS 바이트 생성 ➔ USB 직결 |
| **배달 상태 관리** | 엄격 전이 맵 (`VALID_TRANSITIONS`) | 플래그 기반 (`order_printed: 0/1`) | 타임스탬프 큐 (`status_queue`) | Zod Enum (`OrderStatusSchema`) | 타임라인 배열 (`timeline[]`) | D1 `status_history_json` ISO 타임스탬프 큐 |
| **라이더 배차** | GeoJSON 5km 반경 자동 탐색 | 라이더 기능 부재 | GraphQL Subscription 실시간 푸시 | 배달/포장 단순 선택 | 좌표 보간 기반 실시간 이동 렌더링 | Durable Objects 실시간 브로드캐스트 + 2인1조 실버배달 |
| **공동구매 엔진** | 방장/참여자 카트 분리 및 비례분할 | 없음 | 없음 | 없음 | 복수 카테고리 장바구니 통합 | 경로당 급식 묶음발주 및 하나로마트 마을공구 직결 |
| **배달 완료 검증** | 4자리 암호학적 OTP (5회 오입력 락) | 없음 | 라이더 완료 버튼 수동 터치 | 주문 상태 완료 전이 | 상태 완료 전이 | 카카오 알림톡 4자리 OTP + 복지사/이장님 서명 |
| **지도 관제** | Google Maps API (유료 과금) | 지도 기능 부재 | Google Maps React Native | 지도 기능 부재 | Leaflet + OpenStreetMap (비용 0원) | Leaflet + 국토교통부 VWorld 무료 항공 타일맵 |

---

## 💎 2. [소스 1] SwadKart 심층 완독 (MERN + Redis + Socket.io)

### 1) 주문 컨트롤러 트랜잭션 및 재고 원자적 락 (`backend/controllers/orderController.js`)
* **라인 71~75 (MongoDB 세션 트랜잭션)**:
  ```javascript
  const session = await mongoose.startSession();
  session.startTransaction();
  ```
  주문서 생성, 재고 차감, 쿠폰/포인트 소모가 단일 트랜잭션으로 체결되며 중간 실패 시 전면 롤백됩니다.
* **라인 150~160 (피크타임 재고 경쟁 원자적 차감)**:
  ```javascript
  await Product.findOneAndUpdate(
    { _id: item.product, countInStock: { $gte: item.qty } },
    { $inc: { countInStock: -item.qty } },
    { session, returnDocument: "after" }
  );
  ```
  남은 재고가 요청 수량 이상(`$gte`)일 때만 원자적으로 차감하여, 동시 접속 시 발생하는 마이너스 재고 오염을 차단합니다.
* **라인 175~211 (서버 사이드 금액 강제 재계산)**:
  클라이언트가 전송한 임의 가격을 배제하고, DB의 기본 단가(`dbProduct.price`)에 선택된 옵션(`dbVariant.price`)과 추가메뉴(`dbAddon.price`)를 백엔드에서 강제 재합산하여 변조를 방지합니다.
* **라인 598~605 (엄격한 상태 전이 맵)**:
  ```javascript
  VALID_TRANSITIONS = {
    Placed: ["Preparing", "Cancelled"],
    Preparing: ["Ready", "Cancelled"],
    Ready: ["Out for Delivery"],
    "Out for Delivery": ["Delivered"]
  };
  ```
  비정상적인 상태 건너뛰기를 차단하며, 배달 완료는 오직 라이더의 OTP 검증 통과 시에만 진입하도록 제어합니다.
* **라인 667~685 (GeoJSON 5km 반경 라이더 원자적 배차)**:
  `$nearSphere: { $geometry: { type: "Point", coordinates: [lng, lat] }, $maxDistance: 5000 }` 조건으로 매장 반경 5km 이내 라이더를 검색하고, `isAvailable: true` 조건을 걸어 1명의 라이더에게만 배타적으로 배차합니다.

### 2) 공동구매 모델 및 비용 분할 알고리즘 (`groupOrderModel.js` & `groupOrderController.js`)
* **라인 8~36 (방장/참여자 이원화 장바구니)**:
  `host`(방장), `restaurant`(가맹점), `inviteCode`(8자리 난수), `expiresAt`(마감시간), `members`(참여자 배열: 각 참여자별 개별 담은 품목 목록 보관).
* **라인 155~166 (배송비 비례 분할 공식)**:
  ```javascript
  const splits = groupOrder.members.map((m) => {
    const myItemsTotal = m.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const subtotal = myItemsTotal || (memberCount > 0 ? safeTotalValue / memberCount : 0);
    const shareDelivery = groupOrder.splitType === "equal"
      ? equalShareDelivery
      : (safeTotalValue > 0 ? safeDeliveryFee * (subtotal / safeTotalValue) : 0);
    const shareTax = groupOrder.splitType === "equal"
      ? equalShareTax
      : (subtotal * (safeTaxPercent / 100));
    const total = subtotal + shareDelivery + shareTax + (m.tip || 0);
    return { userId: m.user, name: m.name, subtotal, shareDelivery, shareTax, tip: m.tip || 0, total };
  });
  ```
  `equal`(균등 분할)과 `itemwise`(주문금액 비례 분할)을 제공하여, 소액 구매 어르신이 과도한 배송비를 부담하지 않도록 보호합니다.

### 3) 4자리 암호학적 OTP 배달 완료 검증 (`deliveryController.js` 라인 203~260)
* **라인 93~95**: `order.deliveryOTP = crypto.randomInt(1000, 10000)` 암호학적 난수 생성.
* **라인 220~237 (5회 오입력 락)**: `if (order.otpAttempts >= 5) return res.status(429)`로 브루트포스 해킹을 차단.
* **라인 248~251 (COD 현금결제 자동수납)**: 현장 현금결제 주문인 경우 배달 완료와 동시에 `isPaid: true` 자동 전이.
* **라인 259~260 (라이더 가용상태 즉시 복구)**: 배달 완료 직후 라이더의 `isAvailable: true`를 복구하여 다음 배차를 수신하도록 처리.

### 4) 실시간 동적 ETA 산출 엔진 (`etaController.js` 라인 1~80)
* **ETA 산출 공식**: `ETA = 현재시각 + 조리시간(prepTime) + 배달이동시간(travelTime) + 버퍼(buffer)`
* **조리시간 산출**: `calculatePrepTime = base(10분) + itemCount * 2분` (최대 45분 캡).
* **이동시간 산출**: `calculateTravelTime = distanceKm * 4분` (도심 시속 15km/h 환산 기준).
* **피크타임 버퍼**: 점심(11:30~13:30) 및 저녁(18:00~20:30) 시간대 자동 판별하여 `+10분`, 일반 시간대 `+5분` 가산.
* **AITIP 적용점**: 구글 맵스 거리행렬 API의 고액 과금을 제거하고, Cloudflare Workers 에지에서 반경 좌표 기반으로 밀리초 단위 즉시 연산.

### 5) 재고 부족 알림 및 일괄 보충 (`inventoryController.js` 라인 1~80)
* **임계치 기반 재고 모니터링**: `countInStock <= threshold` 조건으로 품절 임박 상품을 식별하고, 점주 대시보드에 즉시 경고 표출.
* **일괄 재고 보충 (`bulkRestock`)**: 다중 품목에 대해 `$inc: { countInStock: qty }`로 한 번의 통신으로 재고를 보충.

### 6) 식자재 원가 BOM 및 스케줄링 모델 (`productModel.js` 라인 73~105)
* `ingredients`: 식재료명, 투입량, 단위(`kg`, `g`, `ml`, `piece`), 단위 원가(`unitCost`), 목표 원가율(`foodCostPercentage`).
* `autoDisable`: 재고 0 도달 시 자동으로 판매 상태를 비활성화(`isAvailable: false`).
* `schedule`: 요일(`Mon`~`Sun`) 및 시작/종료 시각 설정으로 조식/중식/석식 배송 시간대별 메뉴 자동 노출 제어.

### 7) 점주 대시보드의 사운드 한계 및 AITIP 극복 (`RestaurantOwnerDashboard.jsx`)
* **원천 코드의 한계 (라인 176~195)**: 일반 브라우저 `<audio>` 태그를 사용하여 주방 소음 환경에서 볼륨이 너무 작고, 브라우저 자동재생 정책(Autoplay Policy)으로 인해 점주가 화면을 먼저 누르지 않으면 에러와 함께 무음 처리됨.
* **AITIP 기술 혁신**: 라즈베리 파이 Kiosk에 `--autoplay-policy=no-user-gesture-required` 플래그를 주입하고, **Web Audio API `GainNode`를 통해 디지털 게인을 2.5배 부스트(Boost)**하여 85dB 이상의 고주파 알림음을 강제 송출.

---

## 🖨️ 3. [소스 2] TastyPrinter 심층 완독 (ESC/POS 열전사 프린터 제어)

### 1) 표준 포트 9100 Raw Socket 및 리눅스 장치 파일 제어 (`main.py` 라인 1~49)
* **포트 9100 소켓 통신**: 네트워크 열전사 프린터의 표준 Raw 포트인 9100으로 ESC/POS 바이너리 패킷을 전송. 라즈베리 파이 환경에서는 USB 직결 장치 파일인 `/dev/usb/lp0`로 바이트 스트림을 직접 파이프.
* **프린터 활성 검증 (`checkPrinterAlive`)**: 인쇄 패킷 송신 전 소켓 연결 핑을 수행하여 단말기 다운 여부를 사전 점검.

### 2) 2대 출력 뷰 완전 분리 (`main.py` 라인 50~104)
* **주방 조리용 전표 (`generate_kitchenview`)**:
  `p.set(font='b', size='2x', bold=1)`: 조리사가 2미터 거리에서도 즉시 확인할 수 있도록 메뉴명과 요청사항을 2배 굵은 글씨로 인쇄. 결제 금액이나 고객 연락처는 완전히 배제하고 `Item_comments`와 옵션(`Item_mods`)만 강조.
* **카운터/라이더용 영수증 (`generate_expoview`)**:
  고객명, 안심번호, 배달 상세주소, 품목별 단가, 최종 결제금액을 표준 크기(`size='normal'`)로 꼼꼼하게 표출.

### 3) 중복 출력 방어 메커니즘 (`main.py` 라인 109~125)
* `x.order_printed == 0`인 신규 주문만 인쇄 루틴을 실행하고, 출력 완료 직후 즉시 `update_print_status(order_id, 1)`을 호출하여 단말기 재부팅 시 반복 출력 사고를 100% 방지.
* **AITIP의 통신 혁신**: TastyPrinter의 15초 주기 HTTP Polling 루프를 폐기하고, **Cloudflare Durable Objects 기반 웹소켓(WSS 포트 443) 단말기 푸시** 방식을 도입하여 지연시간을 15초에서 50ms 이내로 단축.

---

## 📱 4. [소스 3] Enatega 심층 완독 (고객·라이더·어드민 3대 독립 앱)

### 1) 주문 상태 전이 큐 및 감사 추적 (`CustomerApp/src/apollo/server.js` 라인 173~179)
```graphql
status_queue {
  pending
  preparing
  picked
  delivered
  cancelled
}
```
* 각 상태 전이 시점의 ISO 타임스탬프를 큐 형태로 영구 보존하여 배달 지연 분쟁을 완벽히 방지 (AITIP D1 `orders.status_history_json` 테이블과 1:1 대응).

### 2) 라이더 배차 실시간 WSS 구독 (`RiderApp/src/apollo/queries.js` 라인 60~65)
* `subscription SubscriptionAssignRider($riderId: String!)`:
  라이더 앱이 백그라운드 웹소켓을 유지하며 신규 배차 콜을 실시간 수신 (AITIP의 Durable Objects `ws/rider/{courierUid}`와 매핑).

### 3) 라이더 배달 상세 화면 및 지도 앱 연동 (`RiderApp/src/screens/OrderDetail/OrderDetail.js`)
* 라인 20: `linkToMapsApp` 함수로 고객 주소 터치 시 카카오맵/네이버지도/티맵 외부 내비게이션으로 원클릭 연동.
* 라인 78~90: 배달 완료 시 `FlashMessage` 안내 후 즉시 화면을 자동 닫고 신규 배차 대기 모드로 복귀.

### 4) 어드민 실시간 관제 및 라이더 재배차 모달 (`Admin Dashboard/src/components/Order/Order.jsx`)
* 라인 350~450: 현재 배차된 라이더명 조회, 주문 상태 강제 전이(PICKED, DELIVERED), 사유 입력 검증(`validateReason`)을 통한 비정상 거래 감사 로그 기록.

---

## 🛒 5. [소스 4] NextOrders 심층 완독 (수수료 0% 독립형 PWA)

### 1) Zod 기반 엄격한 데이터 스키마 (`packages/food-schema/src/types/order.ts`)
* **라인 4~8 (`DeliveryMethodSchema`)**: `z.enum(['deliveryByCourier', 'selfPickup'])`.
* **라인 10~11 (`TimeTypeSchema`)**: `z.enum(['asap', 'scheduled'])` (즉시 배달 vs 예약 배달).
* **라인 37~48 (`OrderDeliveryAddressSchema`)**:
  `street`, `flat`(동/호수), `intercom`(공동현관 비밀번호), `entrance`, `floor`, `addressNote`, `lat`, `lon` 등 한국 아파트 및 다세대 주택 환경에 필수적인 상세 주소 필드를 완벽 지원.

### 2) 모바일 반응형 카트 드로어 및 3단 스위처 (`Cart/DeliveryMethodSwitch.vue`)
* 라인 31~42: `tabItems`를 통해 배달과 포장을 탭 전환.
* **AITIP 적용**: 일반 식당의 2단 스위처를 넘어, **`[일반 식당 배달]` vs `[경로당 급식 공구]` vs `[하나로마트 마을 장보기 공구]` 3단 탭 스위처**로 확장 구현.

### 3) 예약 배송 시간 슬롯 선택기 (`form/OrderTime.vue` 라인 1~70)
* `asap`(즉시 배달)과 `channelStore.timeSlots` 기반의 시간대별 예약 배달 슬롯을 지원하며, 선택 슬롯 마감 시 즉시 기본값으로 재설정되고 토스트 알림을 제공. 경로당 정기 급식 배송(오전 11:30~12:00) 예약에 완벽히 부합.

### 4) 함수형 장바구니 수량 조정 및 자동 정리 (`apps/essence/server/services/order.ts`)
* 라인 61~72 (`recalculateOrder`): 품목별 수량과 단가를 곱하여 총액을 산출하는 순수 함수.
* 라인 236~244: 품목 수량이 0 이하로 감소 시 배열에서 자동으로 필터링 제거하여 장바구니 무결성 유지.

---

## 🗺️ 6. [소스 5] Hyperlocal Delivery 심층 완독 (외식+마트 & Leaflet 지도)

### 1) 비용 0원 Leaflet 실시간 배송 트래킹 (`components/OrderTrackingMap.tsx`)
* 라인 28~32: 구글 맵스 유료 과금을 방어하고 오픈소스 Leaflet + 오픈스트리트맵(한국 환경: 국토교통부 VWorld 무료 타일) 연동.
* 라인 34~53: `L.divIcon`을 활용한 커스텀 마커 표출:
  * 🍽️ 식당 마커 (적색)
  * 🏠 배달지 마커 (녹색)
  * 🚴 라이더 마커 (청색)
* 라인 93~100: 라이더의 실시간 좌표 수신 시 `riderMarker.setLatLng([newLat, newLng])`로 지도 위 부드러운 위치 갱신 애니메이션 구현.

### 2) 하단 슬라이드업 플로팅 카트 바 (`components/CartSidebar.tsx` 라인 25~62)
* 장바구니에 1개 이상의 품목이 담기는 즉시 화면 하단에 주황색 플로팅 바가 팝업되며 총 품목 수와 소계 금액을 표출. 어르신 전용 고대비 화면에서도 메뉴를 고르다가 주문서로 손쉽게 진입할 수 있는 직관적인 UX를 제공.

### 3) 외식(QuickBite)과 마트(QuickMart)의 통합 카탈로그
* `app/admin/quickbite` 및 `app/admin/quickmart`로 음식점과 생필품 마트를 동일 플랫폼 내에서 완벽히 수용하여, 가맹점 특성에 맞는 상품 등록 및 재고 관리를 지원.

---

## 🏆 7. AITIP 차세대 상생 플랫폼 종합 이식 규격 매트릭스

| AITIP 플랫폼 설계 도메인 | 벤치마크 원천 오픈소스 레퍼런스 | AITIP 차세대 구현 방식 (Cloudflare + 라즈베리 파이) |
| :--- | :--- | :--- |
| **주문 트랜잭션 및 재고 락** | SwadKart `orderController.js` (L71-160) | Cloudflare D1 `db.batch()` 기반 단일 원자적 쿼리 체결 및 마이너스 재고 차단 |
| **공동구매 및 배송비 분할** | SwadKart `groupOrderController.js` (L133-169) | D1 `group_orders` 테이블 및 경로당/마을 비례분할 알고리즘 직결 |
| **배달 완료 및 OTP 검증** | SwadKart `deliveryController.js` (L203-260) | 카카오 알림톡 4자리 암호학적 OTP 검증 (5회 오입력 차단) |
| **동적 ETA 산출** | SwadKart `etaController.js` (L1-80) | Workers 에지에서 거리/조리시간/피크시간 자동 연산 (API 비용 0원) |
| **주방/영수증 ESC/POS 출력** | TastyPrinter `main.py` (L50-104) | 주방용 2배 굵은 글씨 / 카운터용 표준 듀얼 뷰 분리, CP949 한글 바이너리 출력 |
| **단말기 실시간 웹소켓** | Enatega Rider WSS & TastyPrinter | Cloudflare Durable Objects WSS (포트 443) 사설 공유기(NAT) 무설정 통과 (<50ms) |
| **주문 상태 전이 감사** | Enatega `status_queue` (L173-179) | D1 `orders.status_history_json` 타임스탬프 큐 영구 보존 |
| **모바일 카트 및 3단 전환** | NextOrders `DeliveryMethodSwitch.vue` | 일반배달 / 경로당급식 / 마트장보기 3단 스위처 및 어르신 큰 글씨 모바일 PWA |
| **예약 배송 시간 슬롯** | NextOrders `OrderTime.vue` (L1-70) | 경로당 정기 점심 급식 예약 시간대 슬롯 선택기 직결 |
| **실시간 배달 관제 지도** | Hyperlocal `OrderTrackingMap.tsx` (L1-145) | 국토교통부 VWorld 무료 타일맵 결합 Leaflet 3점(식당/고객/라이더) 관제 |
| **주방 고주파 딩동벨** | SwadKart Dashboard 오디오 한계 극복 | Web Audio API `GainNode` 2.5배 디지털 게인 부스트 + Kiosk 자동재생 보장 |
| **유선전화 자동수신 CTI** | AITIP 단독 하드웨어 혁신 | 라즈베리 파이 USB 모뎀(`/dev/ttyACM0`) AT 커맨드 자동응답 + 카카오 알림톡 발송 |

---

> 본 분석 문서는 5대 오픈소스의 원천 소스코드를 전수 정밀 완독하여 도출되었으며, `docs/` 내 전체 기획서(`DOC-01` ~ `DOC-06`)의 기술적 구현 근거로 100% 매핑됩니다.
