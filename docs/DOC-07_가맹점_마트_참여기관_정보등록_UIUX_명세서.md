# 🖥️ [DOC-07] 가맹점 · 마트 · 참여기관 정보등록 및 관리 UI/UX 명세서
## (ESM 모듈화 · API 계층 분리 · UID 무결성 · 0초 딜레이 인라인 인터페이스)

> **문서 번호**: AITIP-SPEC-UI-2026-DOC07  
> **표준 버전**: v1.0.0 (화면 UI/UX 및 프론트엔드 아키텍처 공식 표준)  
> **작성 일자**: 2026년 11월 8일  
> **준수 원칙**: **ESM 모듈화 (전역오염 0%) + 전용 API Service Layer 분리 + TypeID 무결성 + 눈/손 피로도 최소화**  
> **연관 문서**: `AITIP_PLATFORM_MASTER_DESIGN_2026.md`, `DOC-00`, `DOC-04`, `DOC-05`, `schema_aitip_v01.sql`

---

## 📌 1. UI/UX 아키텍처 철학 및 4대 절대 구현 원칙

기존 오픈소스(Enatega의 800줄 모달 지옥, SwadKart의 브라우저 alert 팝업)의 치명적인 결함을 전면 폐기하고,  
**"점주와 마트 관리자의 손과 눈을 편하게 해주는 직관적 초간편 인터페이스"**를 구축합니다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             프론트엔드 아키텍처 4대 절대 원칙                            │
├─────────────────────┬────────────────────────────────────────────────────────────────────┤
│ 1. 0초 모달 폐기    │ 단가/재고/품절 수정은 팝업 모달 없이 화면 위 인라인 그리드에서 즉시 입력 │
├─────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 2. ESM 모듈화 철칙  │ 전역 `window` 오염 금지, 단일 책임 원칙(SRP) 기반 명시적 `import/export`   │
├─────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 3. API 계층 분리    │ 컴포넌트 내 인라인 `fetch` 금지, 전용 `*ApiService.ts` 레이어로 통신 일원화│
├─────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 4. TypeID 무결성    │ 모든 엔티티는 표준 TypeID(`str_`, `prd_`, `cat_`, `prm_` 등) 100% 보존 │
└─────────────────────┴────────────────────────────────────────────────────────────────────┘
```

---

## 🏪 2. 일반 가맹점 (식당/골목가게) [정보 및 메뉴 등록] UI 명세

### 1) 화면 레이아웃 및 조작 동선 (와이어프레임)
* **화면 분할**: 좌측 매장 긴급 운영 컨트롤러(300px 고정) + 우측 인라인 메뉴/할인 그리드(가변 너비).
* **조작 동선**: 
  1. 점주는 카운터에 서서 좌측 스위치로 `[🟢 영업중/🔴 영업종료]`, `[배달 ON/OFF]`, `[포장 ON/OFF]`를 원터치 토글.
  2. 우측 그리드에서 메뉴명, 정상가, 할인가, 품절 여부를 엑셀처럼 더블클릭하거나 `Tab` 키로 연속 수정.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏪 [맛나분식] 가맹점 정보 및 메뉴 운영 센터                                    [저장 / 반영] │
├───────────────────────────┬─────────────────────────────────────────────────────────────────┤
│ [좌측: 원클릭 매장 상태]   │ [우측 메인: 탭별 초간편 등록·수정 영역]                         │
│                           │  [ 탭1. 메뉴/가격/할인 ]  [ 탭2. 영업시간/배달비 ]  [ 탭3. 정산 ]│
│ • 현재 상태: [🟢 영업중]  ├─────────────────────────────────────────────────────────────────┤
│   (누르면 즉시 🔴영업종료)│ 📋 [메뉴 및 할인 인라인 등록 그리드]                             │
│                           │ ┌─────────────────────────────────────────────────────────────┐ │
│ • 배달: [ON]  포장: [ON]  │ │ + 새 메뉴 추가 (Enter 치면 바로 행 추가)                     │ │
│   (원터치 스위치)         │ ├─────┬───────┬──────┬──────┬──────┬───────┬────────┬────────┤ │
│                           │ │사진 │메뉴명 │정상가│할인가│단위  │과세   │품절여부│삭제/순서│ │
│ • 최소주문: [12,000] 원   │ ├─────┼───────┼──────┼──────┼──────┼───────┼────────┼────────┤ │
│ • 조리시간: [ 15 ] 분     │ │[📷] │신라면 │ 5,000│ 4,500│1그릇 │[과세▼]│[ 판매 ]│ [≡] [×]│ │
│                           │ │[📷] │김밥   │ 4,000│ 4,000│1줄   │[과세▼]│[ 품절 ]│ [≡] [×]│ │
│ • 포장할인: [ 1,000] 원   │ └─────┴───────┴──────┴──────┴──────┴───────┴────────┴────────┤ │
│   (체크 시 전 메뉴 자동)  │ ※ 팝업창 없이 엑셀처럼 마우스 클릭이나 Tab키로 단가 즉시 수정! │
└───────────────────────────┴─────────────────────────────────────────────────────────────────┘
```

### 2) ESM 컴포넌트 구조 (`packages/frontend/src/components/merchant/`)
* `StoreStatusSidebar.vue`: 매장 상태, 배달/포장 온오프, 최소주문금액, 조리시간 원터치 패널.
* `MenuInlineGrid.vue`: 엑셀식 인라인 키보드 탐색 및 단가/할인/품절 편집 테이블.
* `WebpImageUploader.vue`: 이미지 드래그 앤 드롭 시 WebP 변환 및 물품명 연동 R2 키 업로드 컴포넌트.

### 3) API 서비스 계층 (`packages/frontend/src/services/merchantApi.ts`)
```typescript
import { apiClient } from './apiClient';
import type { StoreProfile, ProductItem, UpdateProductDto } from '../types';

export const merchantApi = {
  // 가맹점 기본 프로필 및 운영 상태 조회/갱신
  getStoreProfile: (storeId: string): Promise<StoreProfile> =>
    apiClient.get(`/api/v1/merchant/stores/${storeId}`),

  updateStoreStatus: (storeId: string, status: { isOpen: boolean; isDelivery: boolean; isTakeout: boolean }) =>
    apiClient.patch(`/api/v1/merchant/stores/${storeId}/status`, status),

  // 메뉴 목록 조회 및 인라인 수정 (D1 원자적 반영)
  getProducts: (storeId: string): Promise<ProductItem[]> =>
    apiClient.get(`/api/v1/merchant/stores/${storeId}/products`),

  updateProductInline: (storeId: string, productId: string, dto: UpdateProductDto) =>
    apiClient.put(`/api/v1/merchant/stores/${storeId}/products/${productId}`, dto),

  toggleProductAvailability: (storeId: string, productId: string, isAvailable: boolean) =>
    apiClient.patch(`/api/v1/merchant/stores/${storeId}/products/${productId}/availability`, { isAvailable }),

  // WebP 이미지 업로드 (물품명 연동)
  uploadProductImageWebp: (storeId: string, productId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post(`/api/v1/merchant/stores/${storeId}/products/${productId}/image`, formData);
  }
};
```

---

## 🛒 3. 단위농협 하나로마트 [엑셀 대량 등록 및 순회배송] UI 명세

### 1) 화면 레이아웃 (와이어프레임)
* **상단 대량 업로드 존**: 농협 POS 엑셀(CSV)을 드래그 앤 드롭하면 1초 만에 파싱 및 변경 내역 프리뷰.
* **하단 다단계 카테고리 그리드**: [채소/과일] [정육] [수산] [가공식품] [공산품] 탭 전환 및 바코드 고속 검색.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🛒 [단위농협 하나로마트] 상품 및 순회배송 관리 센터                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 📂 [엑셀(CSV) 일괄 등록 / 단가 수정 드래그 앤 드롭 존]                                       │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │  📥 하나로마트 POS 엑셀 파일을 이곳에 끌어다 놓으세요 (Drag & Drop)                     │ │
│ │  [양식 다운로드]  • 지원: 바코드(EAN-13), 상품명, 규격, 매입가, 정상가, 전단행사가, 재고  │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│  ➔ 업로드 프리뷰: "총 1,250개 품목 중 12개 가격 변동, 3개 신규 등록 확인됨" [1초 일괄 반영] │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🏷️ [카테고리별 상품 인라인 관리 그리드]                                                     │
│ [전체] [채소/과일] [정육] [수산] [가공식품] [공산품] | 🔍 [바코드/상품명 고속 검색        ]│
│ ┌────────────┬──────────────────┬────────┬────────┬───────┬──────┬─────────┬──────────────┐ │
│ │바코드(SKU) │상품명            │규격    │정상가  │행사가 │재고  │WebP사진 │행사기간      │ │
│ ├────────────┼──────────────────┼────────┼────────┼───────┼──────┼─────────┼──────────────┤ │
│ │880104301...│햇 흙당근         │1봉(500g│  2,500 │  1,980│  150 │[당근.webp│5/1 ~ 5/3     │ │
│ │880111723...│오리온 초코파이   │1박스   │  4,800 │  4,800│   45 │[파이.webp│상시          │ │
│ └────────────┴──────────────────┴────────┴────────┴───────┴──────┴─────────┴──────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2) API 서비스 계층 (`packages/frontend/src/services/martApi.ts`)
```typescript
import { apiClient } from './apiClient';

export const martApi = {
  // 엑셀(CSV) 파일 일괄 업로드 (D1 db.batch 처리)
  uploadBulkProductsCsv: (storeId: string, csvFile: File) => {
    const formData = new FormData();
    formData.append('file', csvFile);
    return apiClient.post(`/api/v1/merchant/mart/${storeId}/products/bulk-upload`, formData);
  },

  // 순회 배송 시간표 조회 및 설정
  getDeliverySchedules: (storeId: string) =>
    apiClient.get(`/api/v1/merchant/mart/${storeId}/schedules`),

  updateDeliverySchedules: (storeId: string, schedules: Array<{ slotOrder: number; cutoffTime: string; dispatchTime: string }>) =>
    apiClient.put(`/api/v1/merchant/mart/${storeId}/schedules`, { schedules })
};
```

---

## 👵 4. 참여기관 (시니어클럽) [2인 1조 배달단 및 경로당 매핑] UI 명세

### 1) 화면 레이아웃 (와이어프레임)
* 복지사가 어르신 명단을 키보드로 일일이 타이핑하지 않고, **마우스 드래그 앤 드롭으로 2인 1조 배달단을 편성하고 관할 경로당에 배정**합니다.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 👵 [시니어클럽] 노인일자리 상생 배달단 및 관할 경로당 편성                                  │
├───────────────────────────────┬───────────────────────────────┬─────────────────────────────┤
│ [1. 참여 어르신 명단 (대기)]  │ [2. 2인 1조 상생 배달단]      │ [3. 관할 경로당 배정]       │
│ • 김순자 (72세, 월수금 가능)  │ ┌───────────────────────────┐ │ ┌─────────────────────────┐ │
│ • 이영희 (68세, 화목 가능)    │ │ [은빛 1팀] (월/수/금 오전)│ │ │ [매화 경로당]           │ │
│ • 박철수 (75세, 매일 가능)    │ │ • 조장: 김순자 어르신     │ ➔│ • 1차 배송: 11:00        │ │
│                               │ │ • 조원: 박철수 어르신     │ │ │ • 담당: 은빛 1팀       │ │
│ ➔ 마우스로 끌어다 팀에 배치   │ └───────────────────────────┘ │ └─────────────────────────┘ │
└───────────────────────────────┴───────────────────────────────┴─────────────────────────────┘
```

### 2) API 서비스 계층 (`packages/frontend/src/services/seniorOrgApi.ts`)
```typescript
import { apiClient } from './apiClient';

export const seniorOrgApi = {
  // 2인 1조 상생 배달단 편성 조회 및 갱신
  getDeliveryTeams: (orgId: string) =>
    apiClient.get(`/api/v1/senior-org/${orgId}/teams`),

  createOrUpdateTeam: (orgId: string, teamData: { teamName: string; leaderUserId: string; memberUserId: string; activityDays: string[] }) =>
    apiClient.post(`/api/v1/senior-org/${orgId}/teams`, teamData),

  // 관할 경로당 및 배송 거점 매핑
  getDestinations: (orgId: string) =>
    apiClient.get(`/api/v1/senior-org/${orgId}/destinations`),

  assignTeamToDestination: (orgId: string, destinationId: string, teamId: string) =>
    apiClient.patch(`/api/v1/senior-org/${orgId}/destinations/${destinationId}/assign`, { teamId })
};
```

---

## 🤝 5. 제휴 영업 및 단말기 설치 [현장 검수] UI 명세

### 1) 본사 영업관리자 (`HQ_SALES_OPS`) 검수 대시보드
* 현장 기사가 모바일 PWA로 올린 4대 필수 증빙(전경 사진, CTI 배선 사진, 시험출력 사진, 점주 서명)을 1개 화면에서 나란히 검수.
* **[승인 및 단말기 원격 활성화]** 버튼 클릭 시, 단말기 WSS에 즉시 `DEVICE_ACTIVATED` 패킷이 발송되어 가동 시작.

### 2) API 서비스 계층 (`packages/frontend/src/services/agencyApi.ts`)
```typescript
import { apiClient } from './apiClient';

export const agencyApi = {
  // 기사 현장 설치 증빙 업로드
  submitInstallationProof: (installationId: string, formData: FormData) =>
    apiClient.post(`/api/v1/agency/installations/${installationId}/proof`, formData),

  // 본사 영업관리자의 설치 승인 및 단말기 활성화
  approveInstallation: (installationId: string) =>
    apiClient.post(`/api/v1/hq/sales/installations/${installationId}/approve`)
};
```

---

## 🔒 6. TypeID 프리픽스 무결성 매핑표 (UI ↔ API ↔ DB)

| UI 컴포넌트 도메인 | 대상 엔티티 | TypeID 프리픽스 | 예시 UID |
| :--- | :--- | :--- | :--- |
| 가맹점 / 마트 | 가맹점 상점 | `str_` | `str_01h2x0abc456` |
| 가맹점 / 마트 | 상품 / 메뉴 | `prd_` | `prd_01h2x4def789` |
| 가맹점 / 마트 | 카테고리 | `cat_` | `cat_01h3y1veg111` |
| 가맹점 / 마트 | 프로모션 / 할인 | `prm_` | `prm_01h3y8dsc222` |
| 마트 | 순회배송 슬롯 | `sch_` | `sch_01h4z0slt333` |
| 시니어 참여기관 | 참여기관 프로필 | `org_` | `org_01h4z5wlf444` |
| 시니어 참여기관 | 2인1조 배달단 | `stm_` | `stm_01h5a1tm555` |
| 시니어 참여기관 | 경로당 납품거점 | `dst_` | `dst_01h5a7dst666` |
| 제휴 영업망 | 제휴 대리점사 | `agn_` | `agn_01h6b2agn777` |
| 제휴 영업망 | 영업/설치 요원 | `agt_` | `agt_01h6b8agt888` |
| 제휴 영업망 | 단말기 설치건 | `ins_` | `ins_01h7c3ins999` |

본 명세서는 프론트엔드 UI 컴포넌트부터 백엔드 API 레이어, D1 데이터베이스까지 일관된 구조와 TypeID 무결성을 보장합니다.
