/**
 * ============================================================================
 * AITIP 전사 공통 도메인 모델 및 데이터 계약 (@aitip/contracts)
 * 규격: STD-ENTERPRISE-MASTER-2026-V20 / Cloudflare D1 (schema_aitip_v01.sql)
 * 특성: Zero Secret, 순수 TypeScript 인터페이스 (ESM 모듈)
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. 27대 TypeID Crockford Base32 정렬형 고유 식별자 브랜드 타입 (DOC-00)
// ----------------------------------------------------------------------------
export type StoreId = `str_${string}`;            // 30자: 소상공인 요식업/가맹점
export type MartId = `mrt_${string}`;             // 30자: 단위농협 하나로마트/식재료 공급사
export type ProductId = `prd_${string}`;          // 30자: 메뉴 품목 / 마트 단품 상품
export type OrderId = `ord_${string}`;            // 30자: 주문 원장
export type OrderItemId = `itm_${string}`;        // 30자: 주문 상세 품목
export type UserId = `usr_${string}`;             // 30자: 일반/시니어/점주 회원
export type FacilityId = `fac_${string}`;         // 30자: 경로당/복지시설
export type PromotionId = `prm_${string}`;        // 30자: 프로모션/쿠폰

// ----------------------------------------------------------------------------
// 2. 도메인 공통 Enum & 리터럴 유니온 (D1 CHECK 제약조건 100% 일치)
// ----------------------------------------------------------------------------
export type OrderType = 'GENERAL' | 'FOOD_SUPPLY';
export type FulfillmentType = 'DELIVERY' | 'TAKEOUT' | 'DINE_IN';
export type OrderChannel = 'ARS' | 'PWA' | 'KIOSK' | 'POS';
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';
export type TaxType = 'TAXABLE' | 'TAX_FREE' | 'ZERO_TAX';
export type OrderItemStatus = 'ACTIVE' | 'CANCELED' | 'SUBSTITUTED';

// ----------------------------------------------------------------------------
// 3. 🍕 [식당 전용 전략] 복합 계층 옵션 트리 모델 (Option Tree)
// ----------------------------------------------------------------------------
export interface MenuOptionItem {
  option_id: string;               // 옵션 항목 고유키 (예: 'opt_bone_free')
  option_name: string;             // 옵션명 (예: '순살로 변경', '양념소스 추가')
  additional_price: number;        // 추가 금액 (>= 0, 예: 2000)
  is_default?: boolean;            // 기본 선택 여부
}

export interface MenuOptionGroup {
  group_id: string;                // 옵션 그룹 고유키 (예: 'grp_meat_type')
  group_name: string;              // 그룹명 (예: '부위 선택', '맛 선택')
  is_required: boolean;            // 필수 선택 여부 (true면 min_select >= 1)
  min_select: number;              // 최소 선택 개수
  max_select: number;              // 최대 선택 개수
  options: MenuOptionItem[];       // 하위 옵션 목록
}

export interface SelectedOption {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  additional_price: number;
}

// ----------------------------------------------------------------------------
// 4. 🛒 [마트 전용 전략] 바코드 및 피킹 모델 (Barcode & Picking)
// ----------------------------------------------------------------------------
export interface MartBarcodeItem {
  barcode_sku: string;             // 880 표준 바코드
  aisle_location?: string;         // 매대 위치 (예: '1F-청과-A03')
  is_weighted: boolean;            // 중량/계량 상품 여부
  expected_weight_g?: number;      // 기준 중량
}

// ----------------------------------------------------------------------------
// 5. 🏪 핵심 엔티티 인터페이스 (D1 스키마와 1:1 매핑)
// ----------------------------------------------------------------------------
export interface Store {
  id: StoreId;
  business_name: string;
  biz_reg_no: string;
  food_license_no?: string | null;
  store_category: string;
  business_day_cutoff: string;     // '04:00' (정산 마감 시각)
  phone_enc: string;
  phone_hmac: string;
  pii_key_ver: number;
  road_address: string;
  min_order_amount: number;
  created_at: number;
  updated_at: number;
}

export interface Product {
  id: ProductId;
  store_id: StoreId | null;        // 요식업 가맹점 외래키 (마트와 배타적)
  mart_id: MartId | null;          // 마트 공급사 외래키
  category_id?: string | null;
  name: string;
  price: number;                   // 단가 (>= 0)
  original_price?: number | null;
  barcode_sku?: string | null;     // 마트 전용
  option_groups?: MenuOptionGroup[]; // 식당 옵션 트리
  is_active: boolean;
  is_sold_out: boolean;
  created_at: number;
  updated_at: number;
}

export interface Order {
  id: OrderId;
  client_request_id: string;       // 멱등성 보장 키 (8~64자)
  store_id: StoreId | null;        // 치킨집/음식점 ID
  mart_id: MartId | null;          // 마트 공급사 ID (store_id와 배타적)
  buyer_user_id: UserId | null;
  caller_phone_enc?: string | null;
  caller_phone_hmac?: string | null;
  buyer_facility_id?: FacilityId | null;
  order_type: OrderType;
  fulfillment_type: FulfillmentType;
  order_channel: OrderChannel;
  table_no?: string | null;
  pickup_estimated_at?: number | null;
  business_date: string;           // 'YYYY-MM-DD'
  display_seq: number;             // 일간 표시 순번 (A-01 -> 1)
  delivery_fee: number;
  discount_amount: number;
  promotion_id?: PromotionId | null;
  total_amount: number;            // 주문 총액
  canceled_amount: number;
  final_paid_amount?: number | null;
  order_status: OrderStatus;
  delivery_address_enc: string;
  is_disposable_needed: 0 | 1;
  kitchen_memo?: string | null;
  delivery_memo?: string | null;
  pii_key_ver: number;
  created_at: number;
  updated_at: number;
}

export interface OrderItem {
  id: OrderItemId;
  order_id: OrderId;
  product_id: ProductId;
  item_name: string;
  unit_price: number;
  quantity: number;
  tax_type: TaxType;
  total_price: number;             // (unit_price + 옵션가) * quantity
  options_selected_json?: string | null; // SelectedOption[] 직렬화 JSON
  kitchen_mods_json?: string | null;     // 주방 특별 조리 요청
  item_status: OrderItemStatus;
  cancel_reason?: string | null;
  created_at: number;
}

// ----------------------------------------------------------------------------
// 6. 🚀 [Walking Skeleton] 최소 실행 단위 주문 생성 API 요청/응답 규격
// ----------------------------------------------------------------------------
export interface CreateOrderItemInput {
  product_id: ProductId;
  quantity: number;
  selected_options?: SelectedOption[];
  kitchen_mod?: string;
}

export interface CreateOrderRequest {
  client_request_id: string;       // 클라이언트 생성 멱등성 UUID/TypeID
  store_id: StoreId;               // 소상공인 치킨집 ID
  buyer_user_id?: UserId;
  caller_phone?: string;           // 비회원 주문자 전화번호 (서버에서 enc/hmac 처리)
  fulfillment_type: FulfillmentType;
  order_channel: OrderChannel;
  delivery_address: string;        // 배달 주소 (서버에서 enc 처리)
  is_disposable_needed: boolean;
  kitchen_memo?: string;
  delivery_memo?: string;
  items: CreateOrderItemInput[];
}

export interface CreateOrderResponse {
  success: boolean;
  order_id: OrderId;
  display_seq: number;
  total_amount: number;
  status: OrderStatus;
  created_at: number;
}
