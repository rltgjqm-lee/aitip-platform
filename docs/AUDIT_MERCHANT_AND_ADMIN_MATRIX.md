# 가맹점관리자(Merchant Portal) & 플랫폼관리자(Platform Admin) 전수 대조 기준표 (SSOT Matrix)

> **문서 목적 (Next-AI Readability First)**:  
> 이 문서는 향후 5대 서비스 및 관리자 포털 검토 시 추측이나 엉뚱한 요약을 원천 차단하기 위해, **실제 소스 코드를 라인 단위로 추적하여 작성한 1:1 기능-API-백엔드-저장소 대조 기준표**입니다.  
> **기준 일자**: 2026-11-16  
> **조사 범위**:  
> - 가맹점관리자: `packages/services/food-delivery/merchant-portal/` ↔ `dev-server.mjs` ↔ `packages/services/food-delivery/backend/food-service.mjs`  
> - 플랫폼관리자: `packages/platform-admin/` ↔ `dev-server.mjs` ↔ `packages/platform-admin/data/`

---

## 1. 가맹점관리자 (`merchant-portal`) 전수 대조 매트릭스

### 1.1 사이드바·상단바·주요 뷰 대조표

| 메뉴 / 하위 기능 | 프론트 UI & 모듈 | API 클라이언트 (`js/api.js`) | 백엔드 (`dev-server.mjs` / `food-service.mjs`) | 저장소 & 실제 상태 | 핵심 결함 / Gap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **상단 바 스위치** (`영업중`, `배달접수`, `포장접수`) | `index.html:137-160` (`#switch-store-open`, 나머지 2개 ID 없음) | 없음 | 없음 | **껍데기 (미연동)** | JS 이벤트 리스너 자체가 없음 |
| **사이드바 스마트 단말기 상태** (`DEV-CTI-882910`) | `index.html:105-116` | 없음 | `POST /api/food/telephony/simulate` (`238-253`) | **정적 HTML** (전화 모달만 MQTT 연동) | 실시간 단말기 Heartbeat 상태 반영 안 됨 |
| **실시간 주문 접수 (KDS)** (`#view-kds`) | `index.html:187-244`, `kds.js`, `app.js:97-208` | `getLiveOrders`, `acceptOrder`, `updateDeliveryMethod`, `updateDineInStatus` | `GET /api/food/orders/live`, `POST .../accept`, `PATCH .../delivery-method`, `.../dine-in-status` | **실동작** (`store_data.json` + WS `/ws/realtime`) | `kds.js:394` 포장 준비완료 버튼이 없는 함수 `merchantApi.completeOrder()` 호출 |
| **80mm 전표/영수증 인쇄** (`#modal-print-receipt`) | `index.html:1381-1401`, `receipt.js` | 없음 (메모리 주문 객체 렌더링) | 없음 (`window.print()`) | **실동작** (1쪽 출력 CSS 교정 완료) | 실물 ESC/POS 시리얼/브릿지 전송은 미연동 |
| **홀·테이블 예약 관리** (`#view-dinein-workspace`) | `index.html:180-182`, `dinein.js` | `getDineInTables`, `getDineInReservations`, `confirm/seat/complete/cancel` | `dev-server.mjs:338-381` -> `food-service.mjs:1519-1630` | **실동작** (`store_data.json`) | `#btn-open-walkin-modal`(`dinein.js:40`), `.btn-seat-direct`(`124`) 리스너 없음 |
| **매장·테이블 QR 인쇄** (`#modal-qr-manager`) | `dinein.js:387-394`, `barcode-generator.js` | 없음 (클라이언트 SVG 생성) | 없음 | **실동작** (`window.print()`) | - |
| **주문 내역 조회** (`#view-order-history`) | `index.html:249-298` (`A-24`, `A-23`) | 없음 | 없음 | **정적 HTML 더미** | 검색/조회/엑셀 다운로드 기능 전무 |
| **메뉴판: 카테고리 추가** (`#modal-create-category`) | `index.html:1062-1083`, `menu.js` | `createCategory` | `POST /api/food/categories` | **실동작** (`store_data.json`) | 순서 이동(`data-move-up/down`) 및 삭제(`data-del-cat`)는 메모리 전용 |
| **메뉴판: 신규 메뉴 등록** (`#modal-create-menu`) | `index.html:1088-1213`, `menu.js:379-427`, `app.js:591-613` | `createMenuItem` (`name, description, price, category_id`만 전송) | `POST /api/food/menu` -> `food-service.mjs:1117-1140` | **반쪽 연동** (`store_data.json`) | **이미지 파일 폐기**(미리보기만 하고 미전송), 할인가/옵션체크 무시, 채널/예약여부는 메모리 전용 |
| **메뉴판: 메뉴 수정/삭제** (`#modal-edit-menu`) | `index.html:1218-1359`, `menu.js:248-317` | `updatePrice(id, price)`, `updateStatus(id, status)`만 호출 | `PATCH /api/food/menu/:id/price`, `.../status` | **반쪽 연동** | **이름·카테고리·할인가·설명·이미지URL·삭제**는 메모리 전용 (`PUT/PATCH /api/food/menu/:id` 부재) |
| **메뉴판: 상품 이미지 업로드** | `app.js:591-613` (`FileReader` DataURL 미리보기), `index.html:1231-1240` (`#edit-image-url`) | **없음** | **없음 (R2/멀티파트 업로드 API 부재)** | **미구현 (껍데기)** | `dragover`/`drop` 리스너 없음, 5MB 용량 검증 없음, 시드 데이터만 Unsplash URL 사용 |
| **옵션 그룹 설정** (`#view-option-manage`) | `index.html:334-349`, `1406-1443`, `menu.js:429-508` | `createOptionGroup` | `POST /api/food/option-groups` | **반쪽 연동** | `#opt-items-input-list` 입력값 무시하고 `'기본 선택'` 하드코딩 전송. 삭제/항목추가는 메모리 전용 |
| **가게 관리 1~3탭** (기본/블록/영업시간/휴무/배달팁) | `index.html:372-687`, `store.js`, `store-blocks.js`, `delivery.js` | `updateStoreInfo`, `updateStoreType`, `updateStoreHours`, `updateDeliveryRules`, `holidays` | `dev-server.mjs:89-150`, `318-336` | **실동작** (`store_data.json`) | `store.js:361-378` `Promise.all` 4개 요청을 3개 변수로 받는 버그, 긴급 영업정지(클라이언트 타이머), 거리/심야 할증 미저장 |
| **가게 관리 4탭** (`#panel-store-pickup` 매장 픽업) | `index.html:690-722` | 없음 | 없음 | **껍데기 (미연동)** | `#switch-pickup-enable`, 할인/조리시간/메모 JS에서 읽거나 저장하지 않음 |
| **가게 쿠폰 & 리뷰이벤트** (`#view-promotions`) | `index.html:728-782`, `coupons.js` | `GET/POST /api/food/coupons` | `dev-server.mjs:407-416` | **반쪽 연동** | 쿠폰 중지(`data-pause-coupon`)는 메모리 전용, **리뷰 약속 이벤트 카드**는 정적 HTML |
| **고객 리뷰 관리** (`#view-reviews`) | `index.html:787-804`, `reviews.js` | `getReviews`, `replyReview`, `blindReview` | `dev-server.mjs:384-404` | **실동작** (`store_data.json`) | - |
| **정산 관리** (`#view-settlement`) | `index.html:809-1052`, `settlement.js` | `getSettlement`, `tax-csv` | `dev-server.mjs:153-174` -> `food-service.mjs:1722-1839` | **반쪽 연동** | 1탭 캘린더와 CSV 다운로드만 동작. **요약 카드 3종·2탭 건별 원장·3탭 세무자료는 정적 HTML 더미** |

---

## 2. 플랫폼관리자 (`platform-admin`) 전수 대조 매트릭스

> **총괄 실측 결론**: `dev-server.mjs`에는 `/api/admin/*` 라우트가 **단 1개도 존재하지 않습니다.**  
> `packages/platform-admin/js/admin-api.js:734-754`의 `request()`는 `/api/admin/*` 호출 실패(404) 시 `catch`에서 무조건 `filterMockData()`(`admin-api.js:16-728` 하드코딩 배열)를 반환합니다. **실동작 백엔드 CRUD 0건.**

| 메뉴 / 하위 기능 | 프론트 UI & 모듈 | API (`admin-api.js`) | 백엔드 실체 | 상태 판정 | 핵심 결함 / Gap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **로그인 / 권한 전환** (`#login-modal-overlay`, `#tenant-switcher`) | `auth.js:10-96`, `admin-app.js:142-172` | `login/getCurrentUser/logout` (`localStorage` + `presets`) | 없음 | **Mock** | 프리셋 ID 불일치(`dst_seoul` vs `dst_01seoul`), 테넌트 전환 시 데이터 필터링 미적용 |
| **1. 통합 경영 대시보드** (`view-dashboard`) | `dashboard.js:19-367` | `getDashboardMetrics`, `getStores` 등 | 없음 (`404` -> `filterMockData`) | **Mock (조회전용)** | `data/addressData.json`(287줄) 미사용, `erp-filter.js` 일부 시도만 하드코딩 |
| **2. 실시간 주문 스트림** (`view-orders`) | `admin-app.js:275-398` | `getLiveOrders()` (`/api/admin/orders/live`) | 없음 (`/api/food/orders/live` 미연결) | **Mock (조회전용)** | 실제 KDS 주문(`A-52` 등)과 미연동, 하드코딩 3건만 표출 |
| **3. 전국 배송망 쿼드러플 관제** (`view-riders`) | `riders-dispatch.js:15-155` | `getRiders()` | 없음 | **Mock + 버그** | `status_code` vs `status` 키 불일치로 상태 카운트 `0` 표시, `+ 신규 라이더 등록` 무반응 |
| **4. 가맹점 계약 & 매장 관리** (`view-merchants`) | `merchants.js:19-247` | `getStores`, `getMarts` 등 | 없음 | **Mock (조회전용)** | `#btn-go-onboarding` 해시 링크만 변경되고 화면 이동 안 됨 |
| **5. 신규 입점 온보딩 심사** (`view-onboarding`) | `onboarding.js:106-183` | 없음 | 없음 | **Mock (Stub)** | 승인/보완요청/신규등록 모두 `alert()` 처리, `#btn-cancel-onboarding` 무반응 |
| **6. 단말기 S/N 인벤토리 & MDM** (`view-hardware`) | `hardware-mdm.js:15-184` | `getDevices()` | 없음 | **Mock + Stub** | `#btn-ota-batch`, `+ 신규 단말기 출고 등록` 무반응, 재부팅/OTA는 `alert()` |
| **7. 광역 총판 / 지역 대리점 / 협력사** (`view-distributors/agencies/partners`) | `organization-tree.js:22-166` | `getDistributors/Agencies/Partners` | 없음 | **Mock + Dead** | `.btn-impersonate-from-row` 클릭 리스너 없음 |
| **8. 제휴사 API & 서킷브레이커** (`view-integrations`) | `partner-integrations.js:9-94` | 없음 (`adminApi` 미사용) | 없음 | **Mock + Dead** | 서킷 토글은 DOM 상태만 변경, `Webhook 로그`/`신규 연동`/`설정` 버튼 무반응 |
| **9. 결제 & 3자 대사 정산 관제** (`view-settlement-merchants`) | `payments-control.js:12-454` | `getPaymentTransactions()`, **`getPaymentTechnicalMetrics()`(없음)** | 없음 | **Mock + 런타임 에러** | **Technical 탭 클릭 시 `TypeError` 발생**, `즉시 재전송`/`#btn-print-receipt` 무반응 |
| **10. 유통망 세무 정산 센터** (`view-settlement-taxes`) | `settlement-taxes.js:11-392` | `getTaxSettlements()`, **`updateTaxType()`(없음)** | 없음 | **Mock + 런타임 에러** | **3.3%/10% 세금유형 토글 클릭 시 `TypeError` 발생**, CSV/일괄지급 `alert()` |
| **11. 임직원 RBAC & 감사 로그** (`view-accounts`) | `iam-audit.js:9-125` | 없음 | 없음 | **Mock (조회전용)** | 하드코딩 감사로그 5건 + 정적 테이블 |
| **12. 알림톡 템플릿 & 점검 모드** (`view-policies`) | `admin-app.js:486-493` (`renderGenericView`) | 없음 | 없음 | **Stub (미구현)** | `"데이터 연결 준비 중"` 안내문만 표출, 사이드바 타이틀 매핑도 누락 |

---

## 3. GitHub(Enatega/StackFood/6amMart) & 국내 배달플랫폼 대비 간과된 필수 메뉴

| 대상 포털 | 간과된 메뉴 / 기능 | 현장·법적 필요성 및 우선순위 |
| :--- | :--- | :--- |
| **가맹점관리자** | **원산지 표기 & 알레르기 유발성분 관리** | **[법적 필수]** 식품위생법상 원산지 누락·오표기 시 과태료 대상 (메뉴/가게 설정 모두 부재) |
| **가맹점관리자** | **메뉴/옵션 1클릭 "오늘만 품절" 및 영업 임시중지 연동** | **[최다 빈도]** KDS/메뉴 리스트에서 즉시 품절 전환, 상단 스위치 실백엔드 연동, 미수락 2회 연속 자동 영업중지 |
| **가맹점관리자** | **매출·인기메뉴·취소율 통계 리포트 & 직원(Staff) 권한 & CSV 일괄등록** | 다인 매장 운영 및 사장님 일/월별 매출 추이 확인용 |
| **플랫폼관리자** | **소비자(회원) 통합 관리 & CS 분쟁·환불·블랙리스트 센터** | **[치명 누락]** 가맹점·라이더 메뉴만 있고 고객 회원 조회·분쟁 중재·환불 원장 메뉴가 통째로 없음 |
| **플랫폼관리자** | **지도 기반 배달 권역(Geo-fence) & 배너/공지/캠페인 관리** | 고객 PWA 상단 배너·긴급 공지·플랫폼 쿠폰 제어 및 지역 배달대행 권역 설정 |
| **플랫폼관리자** | **5대 서비스 멀티모듈 통합 스위처** | 요식업 외 마트·뷰티·병원·숙박 서비스별 활성화/수수료 정책 제어 |

---

## 4. 권장 우선순위 로드맵 (다음 실행 과제)

1. **가맹점관리자 실무 완결 (Phase A)**:
   - 상품 이미지 업로드 파이프라인 구현 (로컬 `dev-server.mjs` 정적 업로드/DataURL 크기제한 + 상용 R2 Presigned URL 규격) 및 메뉴 전체 필드 수정/삭제(`PUT/DELETE /api/food/menu/:id`), 옵션 항목 CRUD 영속화
   - 상단 스위치(`영업중/배달/포장`), 매장 픽업(4탭), 포장 준비완료(`completeOrder`), `store.js` `Promise.all` 버그 수정
   - **원산지 표기** 및 **주문 내역 조회/정산 원장 실데이터 연동**
2. **플랫폼관리자 껍데기 탈피 (Phase B)**:
   - `payments-control.js`, `settlement-taxes.js`, `riders-dispatch.js` 런타임 에러 및 필터 버그 즉시 제거
   - `dev-server.mjs`에 `/api/admin/*` 실라우트 신설 (`food-service.mjs` 실시간 주문·매장·정산·단말기 데이터 직결)
   - 누락된 **고객/CS 분쟁·환불 센터** 및 **배너/정책 관리(`view-policies`)** 신설
