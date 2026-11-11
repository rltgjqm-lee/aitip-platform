/**
 * ============================================================================
 * AITIP Food Delivery Backend Service (ESM)
 * 소상공인 요식업 본체 코어 (90%) - 도메인 비즈니스 로직 및 영속 계층
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getUpcomingMajorHoliday, isNationalHoliday } from './korean-holidays.mjs';
import { createDefaultStoreProfile, normalizeStoreBlocks } from '../../../core/merchant-meta/store-profile-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store_data.json');

// Crockford Base32 인코딩 (TypeID 호환)
const CROCKFORD_CHARS = '0123456789abcdefghjkmnpqrstvwxyz';

function generateTypeID(prefix) {
  const timestamp = BigInt(Date.now());
  const randomBytes = crypto.randomBytes(10);
  
  let result = '';
  let timeVal = timestamp;
  for (let i = 0; i < 10; i++) {
    result = CROCKFORD_CHARS[Number(timeVal & 31n)] + result;
    timeVal >>= 5n;
  }
  
  for (let i = 0; i < 16; i++) {
    const idx = randomBytes[i % 10] % 32;
    result += CROCKFORD_CHARS[idx];
  }
  
  return `${prefix}_${result.slice(0, 26)}`;
}

// 초기 정규 시드 데이터 (바른치킨 서초본점)
function getInitialSeedData() {
  const storeId = 'str_01h7x8q4barunchicken001';
  
  const categories = [
    { id: 'cat_01h7x8main', name: '메인 치킨 (대표메뉴)', layout_type: 'CARD_DETAILED', display_order: 1 },
    { id: 'cat_01h7x8half', name: '반반 치킨 (내맘대로)', layout_type: 'CARD_DETAILED', display_order: 2 },
    { id: 'cat_01h7x8side', name: '사이드 & 안주', layout_type: 'GRID_2COL', display_order: 3 },
    { id: 'cat_01h7x8bevr', name: '음료 & 주류', layout_type: 'ROW_COMPACT', display_order: 4 }
  ];

  const optionGroups = [
    {
      group_id: 'optgrp_01h7x8part',
      group_name: '부위 선택 (필수)',
      is_required: true,
      min_select: 1,
      max_select: 1,
      options: [
        { option_id: 'opt_part_bone', option_name: '뼈 치킨 (기본)', additional_price: 0, is_default: true },
        { option_id: 'opt_part_boneless', option_name: '100% 닭다리 순살로 변경', additional_price: 2000, is_default: false },
        { option_id: 'opt_part_combo', option_name: '윙/봉 콤보로 변경', additional_price: 3000, is_default: false }
      ]
    },
    {
      group_id: 'optgrp_01h7x8spicy',
      group_name: '맛/맵기 강도 (필수)',
      is_required: true,
      min_select: 1,
      max_select: 1,
      options: [
        { option_id: 'opt_spicy_mild', option_name: '순한맛 (기본 담백)', additional_price: 0, is_default: true },
        { option_id: 'opt_spicy_normal', option_name: '보통맛 (신라면 정도)', additional_price: 0, is_default: false },
        { option_id: 'opt_spicy_hot', option_name: '매운맛 (불닭 맵기)', additional_price: 500, is_default: false }
      ]
    },
    {
      group_id: 'optgrp_01h7x8sauce',
      group_name: '추가 소스/토핑 (선택)',
      is_required: false,
      min_select: 0,
      max_select: 5,
      options: [
        { option_id: 'opt_add_mayo', option_name: '알싸 청양마요 소스', additional_price: 1500 },
        { option_id: 'opt_add_sweet', option_name: '달콤 양념 소스', additional_price: 1000 },
        { option_id: 'opt_add_radish', option_name: '아삭 치킨무 추가', additional_price: 500 },
        { option_id: 'opt_add_cola', option_name: '코카콜라 1.25L 사이즈업', additional_price: 2000 }
      ]
    },
    {
      group_id: 'optgrp_01h7x8side_opt',
      group_name: '함께 즐길 사이드 메뉴 (선택)',
      is_required: false,
      min_select: 0,
      max_select: 3,
      options: [
        { option_id: 'opt_side_cheeseball', option_name: '카사바칩 & 크림치즈볼 (5개)', additional_price: 6000 },
        { option_id: 'opt_side_fries', option_name: '모둠 감자튀김 & 버터갈릭', additional_price: 7000 },
        { option_id: 'opt_side_tteok', option_name: '매콤 국물 떡볶이', additional_price: 8500 },
        { option_id: 'opt_side_menbosha', option_name: '통새우 멘보샤 (4개)', additional_price: 8000 }
      ]
    },
    {
      group_id: 'optgrp_01h7x8bevr_opt',
      group_name: '시원한 음료 및 주류 (선택)',
      is_required: false,
      min_select: 0,
      max_select: 4,
      options: [
        { option_id: 'opt_bevr_beer500', option_name: '테라 생맥주 500cc (보냉 전용용기)', additional_price: 4500 },
        { option_id: 'opt_bevr_cola500', option_name: '코카콜라 (500ml PET)', additional_price: 2000 },
        { option_id: 'opt_bevr_colazero', option_name: '코카콜라 제로 (500ml PET)', additional_price: 2000 },
        { option_id: 'opt_bevr_sprite', option_name: '스프라이트 (500ml PET)', additional_price: 2000 },
        { option_id: 'opt_bevr_soju', option_name: '참이슬 후레쉬 (360ml)', additional_price: 5000 }
      ]
    }
  ];

  const products = [
    // 1. 메인 치킨 (대표메뉴)
    {
      product_id: 'prd_01h7x8brownrice',
      category_id: 'cat_01h7x8main',
      name: '현미바삭치킨',
      description: '국내산 햅쌀과 현미파우더로 극대화한 극상의 바삭함. 깨끗한 기름 1통에 58마리만 튀겨 더욱 바삭하고 담백합니다.',
      price: 18900,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300',
      option_group_ids: ['optgrp_01h7x8part', 'optgrp_01h7x8spicy', 'optgrp_01h7x8sauce', 'optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8redlobster',
      category_id: 'cat_01h7x8main',
      name: '대새레드치킨',
      description: '탱글탱글한 통 랍스터새우 4마리와 72시간 숙성 매콤 청양고추 소스가 어우러진 시그니처 프리미엄 치킨',
      price: 24900,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300',
      option_group_ids: ['optgrp_01h7x8part', 'optgrp_01h7x8sauce', 'optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8soy',
      category_id: 'cat_01h7x8main',
      name: '통곡물 간장치킨',
      description: '보리, 조, 수수 볶은 통곡물의 고소함과 특제 숙성 양조간장이 빚어낸 깊은 풍미의 프리미엄 치킨',
      price: 20900,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1527477321055-43615b629c95?w=300',
      option_group_ids: ['optgrp_01h7x8part', 'optgrp_01h7x8sauce', 'optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8sweet',
      category_id: 'cat_01h7x8main',
      name: '바른 양념치킨',
      description: '사과와 토마토로 자연스러운 단맛을 낸 30년 전통 비법 양념소스와 바삭한 튀김옷의 정석 치킨',
      price: 19900,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=300',
      option_group_ids: ['optgrp_01h7x8part', 'optgrp_01h7x8spicy', 'optgrp_01h7x8sauce', 'optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8mayo',
      category_id: 'cat_01h7x8main',
      name: '청양마요 순살치킨',
      description: '100% 닭다리살 순살치킨에 알싸한 청양고추와 부드러운 고소함의 수제 마요소스가 듬뿍 올라간 인기 메뉴',
      price: 21900,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=300',
      option_group_ids: ['optgrp_01h7x8sauce', 'optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'],
      created_at: new Date().toISOString()
    },

    // 2. 반반 치킨 (내맘대로)
    {
      product_id: 'prd_01h7x8halfhalf',
      category_id: 'cat_01h7x8half',
      name: '바른 반반치킨 (후라이드+양념)',
      description: '바삭한 현미후라이드와 매콤달콤한 비법 양념치킨을 반반씩 푸짐하게 즐기는 정석 메뉴',
      price: 19900,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300',
      option_group_ids: ['optgrp_01h7x8part', 'optgrp_01h7x8sauce', 'optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8halfsoy',
      category_id: 'cat_01h7x8half',
      name: '현미바삭 + 통곡물간장 반반',
      description: '극상의 바삭함 후라이드와 짭조름하고 고소한 간장치킨의 완벽한 밸런스 조합',
      price: 20900,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=300',
      option_group_ids: ['optgrp_01h7x8part', 'optgrp_01h7x8sauce', 'optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8halfred',
      category_id: 'cat_01h7x8half',
      name: '시그니처 대새반반 (대새레드+현미바삭)',
      description: '통랍스터새우의 매콤한 대새레드치킨과 담백고소한 현미바삭치킨의 최고 인기 세트',
      price: 22900,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300',
      option_group_ids: ['optgrp_01h7x8part', 'optgrp_01h7x8sauce', 'optgrp_01h7x8side_opt', 'optgrp_01h7x8bevr_opt'],
      created_at: new Date().toISOString()
    },

    // 3. 사이드 & 안주 (호프/홀/배달)
    {
      product_id: 'prd_01h7x8cheeseball',
      category_id: 'cat_01h7x8side',
      name: '카사바칩 & 크림치즈볼 (5개)',
      description: '열대작물 카사바 뿌리를 바삭하게 튀겨낸 칩과 모짜렐라+크림치즈가 꽉 찬 단짠 치즈볼 세트',
      price: 6000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8fries',
      category_id: 'cat_01h7x8side',
      name: '모둠 감자튀김 & 버터갈릭',
      description: '케이준 감자튀김, 웨지감자, 크링클컷 3종 모둠에 달콤 짭조름한 버터갈릭 시즈닝 듬뿍',
      price: 7000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8tteok',
      category_id: 'cat_01h7x8side',
      name: '매콤 국물 떡볶이',
      description: '치킨 기름진 맛을 싹 잡아주는 쫄깃한 밀떡과 어묵의 칼칼한 학교 앞 국물떡볶이',
      price: 8500,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8gizzard',
      category_id: 'cat_01h7x8side',
      name: '바삭 똥집튀김 & 꽈리고추',
      description: '쫄깃한 닭모래집(똥집)에 쌀파우더를 입혀 튀겨내고 알싸한 꽈리고추로 풍미를 더한 일품 안주',
      price: 12000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8golbaengi',
      category_id: 'cat_01h7x8side',
      name: '을지로식 골뱅이소면 무침',
      description: '탱글탱글한 유동골뱅이 한 통과 신선한 파채, 오이, 진미채를 매콤새콤 특제양념에 무쳐낸 소면 세트',
      price: 16000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8fishcake',
      category_id: 'cat_01h7x8side',
      name: '얼큰 부산어묵탕',
      description: '부산 90% 생선살 삼진어묵과 칼칼한 청양고추, 쑥갓, 무로 우려낸 따끈하고 시원한 국물 안주',
      price: 15000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8pollock',
      category_id: 'cat_01h7x8side',
      name: '바삭 먹태구이 & 고추마요',
      description: '오븐에 노릇노릇 바삭하게 구워낸 황태포와 특제 땡초간장마요 소스, 고소한 땅콩 세트',
      price: 14000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8menbosha',
      category_id: 'cat_01h7x8side',
      name: '바삭 통새우 멘보샤 (4개)',
      description: '식빵 사이에 100% 통새우 살을 두툼하게 채워 겉은 바삭하고 속은 촉촉한 고급 중화 사이드',
      price: 8000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },

    // 4. 음료 & 주류
    {
      product_id: 'prd_01h7x8draft500',
      category_id: 'cat_01h7x8bevr',
      name: '테라 생맥주 500cc (홀/캔실링)',
      description: '영하 2도 저온숙성 생맥주. 매장 식사 시 유리잔 제공, 배달/포장 시 탄산유지 전용 알루미늄 캔 실링 포장',
      price: 4500,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8draft1000',
      category_id: 'cat_01h7x8bevr',
      name: '테라 생맥주 1,000cc 피처',
      description: '여럿이 함께 시원하게 즐기는 1리터 대용량 저온 숙성 생맥주 피처',
      price: 8500,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8cassbottle',
      category_id: 'cat_01h7x8bevr',
      name: '카스 / 테라 병맥주 (500ml)',
      description: '언제나 상쾌하고 시원한 대한민국 대표 맥주 (주문 시 카스 또는 테라 선택 가능)',
      price: 5000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8sojuisul',
      category_id: 'cat_01h7x8bevr',
      name: '참이슬 후레쉬 (360ml)',
      description: '깨끗하고 부드러운 대나무 숯 4번 여과 국민 소주',
      price: 5000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8sojufirst',
      category_id: 'cat_01h7x8bevr',
      name: '처음처럼 (360ml)',
      description: '대관령 기슭 암반수로 만들어 더욱 부드러운 소주',
      price: 5000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8cola500',
      category_id: 'cat_01h7x8bevr',
      name: '코카콜라 (500ml PET)',
      description: '치킨에 빠질 수 없는 시원하고 짜릿한 오리지널 코카콜라',
      price: 2000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8cola125',
      category_id: 'cat_01h7x8bevr',
      name: '코카콜라 대용량 (1.25L PET)',
      description: '가족, 친구들과 넉넉하게 마시는 코카콜라 1.25리터 대용량 페트병',
      price: 3000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8colazero',
      category_id: 'cat_01h7x8bevr',
      name: '코카콜라 제로 (500ml PET)',
      description: '칼로리 걱정 없이 가볍고 상쾌하게 즐기는 제로 슈거 코카콜라',
      price: 2000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    },
    {
      product_id: 'prd_01h7x8sprite',
      category_id: 'cat_01h7x8bevr',
      name: '스프라이트 (500ml PET)',
      description: '레몬라임 향의 톡 쏘는 상쾌함을 전하는 스프라이트',
      price: 2000,
      discounted_price: null,
      status: 'AVAILABLE',
      image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300',
      option_group_ids: [],
      created_at: new Date().toISOString()
    }
  ];

  const storeInfo = {
    store_id: storeId,
    store_name: '바른치킨 서초본점',
    biz_number: '214-88-59124',
    owner_name: '홍길동',
    phone: '02-588-9258',
    address: '서울특별시 서초구 서초대로 34길 18 1층',
    operating_hours: '15:00 ~ 24:00 (연중무휴)',
    delivery_min_order: 15000,
    delivery_base_tip: 3000,
    delivery_tip_rules: [
      { min_amount: 15000, max_amount: 30000, tip: 3000 },
      { min_amount: 30000, max_amount: 50000, tip: 2000 },
      { min_amount: 50000, max_amount: 999999999, tip: 0 }
    ],
    is_open: true,
    store_operation_type: 'HYBRID', // 'DELIVERY_ONLY' | 'DINE_IN_CENTRIC' | 'HYBRID'
    nav_order: [
      'view-kds',
      'view-order-history',
      'view-menu-workspace',
      'view-option-manage',
      'view-store-workspace',
      'view-promotions',
      'view-reviews',
      'view-settlement'
    ],
    terminal_id: 'dev_01m6z4term8923',
    terminal_status: 'ONLINE',
    blocks: createDefaultStoreProfile(storeId, '바른치킨 서초본점')
  };

  // schema_aitip_v01.sql store_hours 규격 (0:일 ~ 6:토)
  const storeHours = [
    { day_of_week: 0, day_name: '일요일', open_time: '12:00', close_time: '24:00', break_start: null, break_end: null, is_closed: 0 },
    { day_of_week: 1, day_name: '월요일', open_time: '15:00', close_time: '24:00', break_start: null, break_end: null, is_closed: 0 },
    { day_of_week: 2, day_name: '화요일', open_time: '15:00', close_time: '24:00', break_start: null, break_end: null, is_closed: 0 },
    { day_of_week: 3, day_name: '수요일', open_time: '15:00', close_time: '24:00', break_start: null, break_end: null, is_closed: 0 },
    { day_of_week: 4, day_name: '목요일', open_time: '15:00', close_time: '24:00', break_start: null, break_end: null, is_closed: 0 },
    { day_of_week: 5, day_name: '금요일', open_time: '15:00', close_time: '24:00', break_start: null, break_end: null, is_closed: 0 },
    { day_of_week: 6, day_name: '토요일', open_time: '12:00', close_time: '24:00', break_start: null, break_end: null, is_closed: 0 }
  ];

  const liveOrders = [
    {
      order_id: 'ord_01h7x8live9910',
      short_display_id: 'A-24',
      status: 'PENDING',
      order_channel: 'ARS_VOICE',
      fulfillment_type: 'DELIVERY',
      customer_name: '서초동 고객',
      customer_phone: '010-9283-****',
      delivery_address: '서초구 서초대로 42길 11, 302호',
      distance_meters: 420,
      customer_memo: '문 앞에 두고 벨 눌러주세요 (아기가 자고 있어요)',
      items: [
        {
          item_id: 'itm_01h7x8ord01',
          product_id: 'prd_01h7x8brownrice',
          name: '현미바삭치킨',
          quantity: 1,
          base_price: 18900,
          selected_options: [
            { group_name: '부위 선택', option_name: '100% 닭다리 순살로 변경', price: 2000 },
            { group_name: '추가 소스/토핑', option_name: '알싸 청양마요 소스', price: 1500 }
          ],
          total_price: 22400
        }
      ],
      items_total: 22400,
      delivery_tip: 3000,
      discount_amount: 0,
      final_payment_amount: 25400,
      estimated_profit: 13800,
      payment_method: 'AITIP_ZERO_PAY',
      delivery_method: null,
      delivery_status: null,
      prep_time_minutes: null,
      rider_dispatch_status: 'WAITING_ACCEPT',
      kitchen_ticket_printed: false,
      created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString()
    },
    {
      order_id: 'ord_01h7x8live9911',
      short_display_id: 'A-25',
      status: 'ACCEPTED',
      order_channel: 'PWA',
      fulfillment_type: 'DELIVERY',
      customer_name: '반포동 고객',
      customer_phone: '010-4192-****',
      delivery_address: '서초구 서초대로 38길 9, 104동 502호',
      distance_meters: 650,
      customer_memo: '경비실 호출 후 현관 앞에 놓아주세요',
      items: [
        {
          item_id: 'itm_01h7x8ord02',
          product_id: 'prd_01h7x8halfhalf',
          name: '바른 반반치킨',
          quantity: 1,
          base_price: 19900,
          selected_options: [
            { group_name: '부위 선택', option_name: '뼈 치킨 (기본)', price: 0 }
          ],
          total_price: 19900
        },
        {
          item_id: 'itm_01h7x8ord03',
          product_id: 'prd_01h7x8cheeseball',
          name: '카사바칩 & 크림치즈볼 (5개)',
          quantity: 1,
          base_price: 6000,
          selected_options: [],
          total_price: 6000
        }
      ],
      items_total: 25900,
      delivery_tip: 3000,
      discount_amount: 0,
      final_payment_amount: 28900,
      estimated_profit: 15400,
      payment_method: 'CREDIT_CARD',
      delivery_method: null,
      delivery_status: null,
      prep_time_minutes: 20,
      rider_dispatch_status: 'WAITING_ACCEPT',
      kitchen_ticket_printed: true,
      created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
    },
    {
      order_id: 'ord_01h7x8live9912',
      short_display_id: 'A-26',
      status: 'ACCEPTED',
      order_channel: 'PWA',
      fulfillment_type: 'DELIVERY',
      customer_name: '역삼동 고객',
      customer_phone: '010-8812-****',
      delivery_address: '강남구 역삼로 14길 28, 4층',
      distance_meters: 2800,
      customer_memo: '도착 시 전화 부탁드립니다',
      items: [
        {
          item_id: 'itm_01h7x8ord04',
          product_id: 'prd_01h7x8redlobster',
          name: '대새레드치킨',
          quantity: 1,
          base_price: 24900,
          selected_options: [
            { group_name: '부위 선택', option_name: '윙/봉 콤보로 변경', price: 3000 }
          ],
          total_price: 27900
        }
      ],
      items_total: 27900,
      delivery_tip: 4500,
      discount_amount: 0,
      final_payment_amount: 32400,
      estimated_profit: 16800,
      payment_method: 'CREDIT_CARD',
      delivery_method: 'AGENCY',
      delivery_status: 'RIDER_REQUESTED',
      prep_time_minutes: 25,
      rider_dispatch_status: 'DISPATCH_REQUESTED',
      kitchen_ticket_printed: true,
      created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString()
    },
    {
      order_id: 'ord_01h7x8live9913',
      short_display_id: 'A-27',
      status: 'PENDING',
      order_channel: 'PWA',
      fulfillment_type: 'DELIVERY',
      ready_type: 'SCHEDULED',
      reserved_at: '18:30',
      scheduled_display: '오늘 18:30 도착 배달 예약',
      customer_name: '방배동 예약고객',
      customer_phone: '010-3321-****',
      delivery_address: '서초구 방배로 18길 12, 101동 1204호',
      distance_meters: 520,
      customer_memo: '★18시 30분 정시 도착 부탁드립니다 (아이들 생일파티)',
      items: [
        {
          item_id: 'itm_01h7x8ord05',
          product_id: 'prd_01h7x8brownrice',
          name: '현미바삭치킨',
          quantity: 2,
          base_price: 18900,
          selected_options: [],
          total_price: 37800
        },
        {
          item_id: 'itm_01h7x8ord06',
          product_id: 'prd_01h7x8cheeseball',
          name: '카사바칩 & 크림치즈볼 (5개)',
          quantity: 2,
          base_price: 6000,
          selected_options: [],
          total_price: 12000
        }
      ],
      items_total: 49800,
      delivery_tip: 2000,
      discount_amount: 0,
      final_payment_amount: 51800,
      estimated_profit: 28400,
      payment_method: 'AITIP_ZERO_PAY',
      delivery_method: null,
      delivery_status: null,
      prep_time_minutes: null,
      rider_dispatch_status: 'WAITING_ACCEPT',
      kitchen_ticket_printed: false,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    },
    {
      order_id: 'ord_01h7x8live9914',
      short_display_id: 'A-28',
      status: 'ACCEPTED',
      order_channel: 'PWA',
      fulfillment_type: 'TAKEOUT',
      ready_type: 'SCHEDULED',
      pickup_estimated_at: '19:00',
      reserved_at: '19:00',
      scheduled_display: '오늘 19:00 매장 포장 픽업 예약',
      customer_name: '서초동 직장인',
      customer_phone: '010-7741-****',
      delivery_address: '매장 직접 방문 포장',
      distance_meters: 0,
      customer_memo: '퇴근길에 19시 정각에 찾으러 가겠습니다. 갓 튀겨서 포장해주세요.',
      items: [
        {
          item_id: 'itm_01h7x8ord07',
          product_id: 'prd_01h7x8halfhalf',
          name: '바른 반반치킨',
          quantity: 1,
          base_price: 19900,
          selected_options: [],
          total_price: 19900
        }
      ],
      items_total: 19900,
      delivery_tip: 0,
      discount_amount: 0,
      final_payment_amount: 19900,
      estimated_profit: 11200,
      payment_method: 'CREDIT_CARD',
      delivery_method: 'SELF',
      delivery_status: 'COOKING',
      prep_time_minutes: 20,
      rider_dispatch_status: 'NO_RIDER_NEEDED',
      kitchen_ticket_printed: true,
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString()
    },
    {
      order_id: 'ord_01h7x8live9915',
      short_display_id: 'A-29',
      status: 'ACCEPTED',
      order_channel: 'PWA',
      fulfillment_type: 'DINE_IN',
      ready_type: 'SCHEDULED',
      table_no: '테이블 3번',
      guest_count: 4,
      reserved_at: '19:30',
      scheduled_display: '오늘 19:30 테이블 예약 (성인 4인)',
      customer_name: '김태호 (예약)',
      customer_phone: '010-5591-****',
      delivery_address: '매장 홀 [테이블 3번]',
      distance_meters: 0,
      customer_memo: '4명 방문합니다. 창가 자리 부탁드리고 생맥주 500cc 2잔은 도착하면 바로 주세요.',
      items: [
        {
          item_id: 'itm_01h7x8ord08',
          product_id: 'prd_01h7x8redlobster',
          name: '대새레드치킨',
          quantity: 1,
          base_price: 24900,
          selected_options: [
            { group_name: '부위 선택', option_name: '100% 닭다리 순살로 변경', price: 2000 }
          ],
          total_price: 26900
        },
        {
          item_id: 'itm_01h7x8ord09',
          product_id: 'prd_01h7x8cheeseball',
          name: '카사바칩 & 크림치즈볼 (5개)',
          quantity: 1,
          base_price: 6000,
          selected_options: [],
          total_price: 6000
        }
      ],
      items_total: 32900,
      delivery_tip: 0,
      deposit_amount: 10000,
      discount_amount: 0,
      final_payment_amount: 32900,
      estimated_profit: 18500,
      payment_method: 'CREDIT_CARD',
      delivery_method: 'SELF',
      delivery_status: 'TABLE_RESERVED',
      prep_time_minutes: 25,
      rider_dispatch_status: 'NO_RIDER_NEEDED',
      kitchen_ticket_printed: true,
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    }
  ];

  const initialReviews = [
    {
      id: 'rev_01h7x8review000000000001',
      order_id: 'ord_01h7x8live9901',
      buyer_name: '서초*랑',
      product_rating: 5,
      delivery_rating: 5,
      content: '기름이 진짜 깨끗한 게 느껴져요. 튀김옷이 바삭하고 현미향이 고소해서 부모님도 맛있게 드셨습니다. 배달도 25분 만에 총알같이 왔네요!',
      menu_summary: '현미바삭치킨 (순살 변경, 청양마요)',
      owner_reply: '정성스런 리뷰 감사드립니다 고객님! 깨끗한 기름 원칙을 지키며 항상 바삭하게 튀겨내겠습니다. 행복한 하루 되세요!',
      owner_replied_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'rev_01h7x8review000000000002',
      order_id: 'ord_01h7x8live9902',
      buyer_name: '반포*식가',
      product_rating: 4,
      delivery_rating: 5,
      content: '대새레드치킨 랍스터새우 실하고 양념도 맛있게 매워요. 다만 맵기 보통맛인데도 생각보다 매워서 매운 거 못 드시는 분은 순한맛 추천합니다.',
      menu_summary: '대새레드치킨, 크림치즈볼 (5개)',
      owner_reply: null,
      owner_replied_at: null,
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'rev_01h7x8review000000000003',
      order_id: 'ord_01h7x8live9903',
      buyer_name: '치킨*러버',
      product_rating: 5,
      delivery_rating: 4,
      content: '반반치킨 정석입니다. 후라이드는 바삭하고 양념은 너무 달지 않아서 좋아요. 치즈볼도 따뜻하게 왔습니다. 단골 예약입니다.',
      menu_summary: '바른 반반치킨',
      owner_reply: '단골 예약이라니 너무 힘이 납니다 고객님! 늘 처음처럼 깨끗하고 맛있는 치킨으로 보답하겠습니다. 감사합니다!',
      owner_replied_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    }
  ];

  // 매장 식사(홀) 테이블 현황 시드 데이터
  const tables = [
    { id: 'tbl_01', table_no: '테이블 1번', capacity: 4, section: '창가석', status: 'VACANT', current_reservation_id: null },
    { id: 'tbl_02', table_no: '테이블 2번', capacity: 2, section: '중앙 홀', status: 'OCCUPIED', seated_at: '18:20', guest_count: 2, current_reservation_id: null, memo: '현장 고객 식사 중' },
    { id: 'tbl_03', table_no: '테이블 3번', capacity: 4, section: '창가석', status: 'RESERVED', reservation_time: '19:30', guest_count: 4, reserved_by: '김태호', current_reservation_id: 'res_01', memo: '대새레드치킨 선주문 조리대기' },
    { id: 'tbl_04', table_no: '테이블 4번', capacity: 4, section: '중앙 홀', status: 'VACANT', current_reservation_id: null },
    { id: 'tbl_05', table_no: '테이블 5번', capacity: 4, section: '중앙 홀', status: 'VACANT', current_reservation_id: null },
    { id: 'tbl_06', table_no: '단체룸 A', capacity: 8, section: 'VIP 룸', status: 'WAITING_CONFIRM', reservation_time: '20:00', guest_count: 6, reserved_by: '이영희', current_reservation_id: 'res_02', memo: '생일 가족 모임' }
  ];

  // 실시간 홀 예약 목록 시드 데이터
  const dineInReservations = [
    {
      id: 'res_01',
      order_id: 'ord_01h7x8live9915',
      display_seq: 'A-29',
      customer_name: '김태호',
      customer_phone: '010-5591-****',
      guest_count: 4,
      table_no: '테이블 3번',
      reserved_date: '2026-11-10',
      reserved_time: '19:30',
      status: 'CONFIRMED',
      pre_ordered: true,
      menu_summary: '대새레드치킨 1마리, 카사바칩 & 크림치즈볼(5개)',
      total_amount: 32900,
      special_request: '4명 방문합니다. 창가 자리 부탁드리고 생맥주 500cc 2잔은 도착하면 바로 주세요.',
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    },
    {
      id: 'res_02',
      order_id: null,
      display_seq: 'R-02',
      customer_name: '이영희',
      customer_phone: '010-3124-****',
      guest_count: 6,
      table_no: '단체룸 A',
      reserved_date: '2026-11-10',
      reserved_time: '20:00',
      status: 'WAITING',
      pre_ordered: false,
      menu_summary: '현장 주문 예정',
      total_amount: 0,
      special_request: '가족 생일 모임입니다. 조용한 방과 케이크 냉장 보관 부탁드립니다.',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    },
    {
      id: 'res_03',
      order_id: null,
      display_seq: 'R-01',
      customer_name: '박지훈',
      customer_phone: '010-8877-****',
      guest_count: 2,
      table_no: '테이블 1번',
      reserved_date: '2026-11-10',
      reserved_time: '17:30',
      status: 'COMPLETED',
      pre_ordered: true,
      menu_summary: '현미바삭치킨 1마리',
      total_amount: 18900,
      special_request: '창가 빠른 식사',
      created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString()
    }
  ];

  return {
    store: storeInfo,
    store_hours: storeHours,
    holiday_settings: {
      auto_holiday_closed: false,
      major_holiday_preset: 'NORMAL_OPEN',
      custom_closures: []
    },
    categories,
    option_groups: optionGroups,
    products,
    live_orders: liveOrders,
    reviews: initialReviews,
    tables,
    dinein_reservations: dineInReservations
  };
}

class FoodDeliveryService {
  constructor() {
    this.data = null;
    this.loadData();
  }

  loadData() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.data = getInitialSeedData();
        this.saveData();
      }
    } catch (err) {
      console.error('[FoodService] Failed to load data, fallback to seeds:', err);
      this.data = getInitialSeedData();
    }
  }

  saveData() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[FoodService] Failed to save data:', err);
    }
  }

  // 1. 매장 기본정보 조회 및 수정
  getStoreInfo() {
    return this.data.store;
  }

  updateStoreInfo(updates) {
    if (!updates || typeof updates !== 'object') {
      throw new Error('유효하지 않은 매장 정보 데이터입니다.');
    }
    // UID(store_id) 훼손 방지
    const originalStoreId = this.data.store.store_id;
    this.data.store = {
      ...this.data.store,
      ...updates,
      store_id: originalStoreId // UID 절대 사수
    };
    this.saveData();
    return this.data.store;
  }

  // 1-1. 배달 가능 지역 및 주문금액별 배달팁 구간 조회
  getDeliveryRules() {
    if (!this.data.store.delivery_regions) {
      this.data.store.delivery_regions = ['서초1동', '서초2동', '서초3동', '서초4동', '역삼1동', '방배본동', '반포1동'];
    }
    if (!this.data.store.delivery_tip_rules) {
      this.data.store.delivery_tip_rules = [
        { min: 15000, max: 30000, tip: 3000 },
        { min: 30000, max: 50000, tip: 2000 },
        { min: 50000, max: 99999999, tip: 0 }
      ];
    }
    return {
      regions: this.data.store.delivery_regions,
      tip_rules: this.data.store.delivery_tip_rules
    };
  }

  // 1-2. 배달 가능 지역 및 배달팁 구간 영속 저장
  updateDeliveryRules({ regions, tip_rules }) {
    if (Array.isArray(regions)) {
      this.data.store.delivery_regions = regions.map(r => String(r).trim()).filter(Boolean);
    }
    if (Array.isArray(tip_rules)) {
      this.data.store.delivery_tip_rules = tip_rules.map(rule => ({
        min: Number(rule.min) || 0,
        max: Number(rule.max) || 99999999,
        tip: Number(rule.tip) || 0
      }));
    }
    this.saveData();
    return this.getDeliveryRules();
  }

  // 1-3. 매장 7일 요일별 영업시간 조회 및 수정 (DOC-05 / schema_aitip_v01.sql 규격)
  getStoreHours() {
    if (!this.data.store_hours) {
      this.data.store_hours = getInitialSeedData().store_hours;
      this.saveData();
    }
    return this.data.store_hours;
  }

  updateStoreHours(hoursArray) {
    if (!Array.isArray(hoursArray)) {
      throw new Error('영업시간 목록(hours) 배열이 필요합니다.');
    }

    const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

    for (const h of hoursArray) {
      if (typeof h.day_of_week !== 'number' || h.day_of_week < 0 || h.day_of_week > 6) {
        throw new Error(`유효하지 않은 요일입니다: ${h.day_of_week}`);
      }

      // 가드레일: break pair
      const hasBreakStart = !!h.break_start;
      const hasBreakEnd = !!h.break_end;
      if (hasBreakStart !== hasBreakEnd) {
        throw new Error('휴게시간(브레이크타임)은 시작시각과 종료시각이 둘 다 존재해야 합니다.');
      }

      // 가드레일: is_closed
      if (h.is_closed === 0) {
        if (!h.open_time || !h.close_time) {
          throw new Error('영업일에는 오픈시간과 마감시간이 필수입니다.');
        }
        if (!timeRegex.test(h.open_time) || !timeRegex.test(h.close_time)) {
          throw new Error('시간 형식은 HH:MM이어야 합니다.');
        }
      }
    }

    this.data.store_hours = hoursArray;
    this.saveData();
    return this.data.store_hours;
  }

  // 1-2. 공휴일 자동휴무 및 명절 원클릭 설정 조회
  getHolidaySettings() {
    if (!this.data.holiday_settings) {
      this.data.holiday_settings = {
        auto_holiday_closed: false,
        major_holiday_preset: 'NORMAL_OPEN',
        custom_closures: []
      };
      this.saveData();
    }
    const upcomingMajor = getUpcomingMajorHoliday();
    return {
      settings: this.data.holiday_settings,
      upcoming_major: upcomingMajor
    };
  }

  // 1-3. 공휴일 자동휴무 및 명절 원클릭 설정 저장
  updateHolidaySettings({ auto_holiday_closed, major_holiday_preset }) {
    if (!this.data.holiday_settings) {
      this.data.holiday_settings = {
        auto_holiday_closed: false,
        major_holiday_preset: 'NORMAL_OPEN',
        custom_closures: []
      };
    }
    if (typeof auto_holiday_closed === 'boolean') {
      this.data.holiday_settings.auto_holiday_closed = auto_holiday_closed;
    }
    if (major_holiday_preset) {
      this.data.holiday_settings.major_holiday_preset = major_holiday_preset;
    }
    this.saveData();
    return this.getHolidaySettings();
  }

  // 1-4. 가맹점 개인사유 임시휴무 등록 (여름휴가, 매장공사 등)
  addCustomClosure({ title, start_date, end_date, reason }) {
    if (!title || !start_date || !end_date) {
      throw new Error('휴무명과 시작일, 종료일은 필수 항목입니다.');
    }
    if (!this.data.holiday_settings) {
      this.data.holiday_settings = {
        auto_holiday_closed: false,
        major_holiday_preset: 'NORMAL_OPEN',
        custom_closures: []
      };
    }
    const newClosure = {
      id: generateTypeID('stc'),
      title: title.trim(),
      start_date,
      end_date,
      reason: (reason || '').trim(),
      created_at: new Date().toISOString()
    };
    this.data.holiday_settings.custom_closures.push(newClosure);
    this.saveData();
    return newClosure;
  }

  // 1-5. 가맹점 개인사유 임시휴무 삭제
  deleteCustomClosure(closureId) {
    if (!this.data.holiday_settings || !Array.isArray(this.data.holiday_settings.custom_closures)) {
      return false;
    }
    const prevLen = this.data.holiday_settings.custom_closures.length;
    this.data.holiday_settings.custom_closures = this.data.holiday_settings.custom_closures.filter(c => c.id !== closureId);
    this.saveData();
    return this.data.holiday_settings.custom_closures.length < prevLen;
  }

  // 2. 3단 메뉴 카탈로그 전체 조회
  getMenuCatalog() {
    return {
      categories: this.data.categories,
      option_groups: this.data.option_groups,
      products: this.data.products
    };
  }

  // 2-1. 카테고리 신규 등록 (TypeID 발급)
  createCategory({ name }) {
    if (!name || !name.trim()) {
      throw new Error('카테고리명은 필수 입력 항목입니다.');
    }
    const newCategory = {
      id: generateTypeID('cat'),
      name: name.trim(),
      display_order: (this.data.categories?.length || 0) + 1
    };
    if (!this.data.categories) {
      this.data.categories = [];
    }
    this.data.categories.push(newCategory);
    this.saveData();
    return newCategory;
  }

  // 2-2. 옵션 그룹 신규 등록 (TypeID 발급)
  createOptionGroup({ group_name, is_required = false, min_select = 0, max_select = 1, options = [] }) {
    if (!group_name || !group_name.trim()) {
      throw new Error('옵션 그룹명은 필수 입력 항목입니다.');
    }
    const newGroup = {
      group_id: generateTypeID('optgrp'),
      group_name: group_name.trim(),
      is_required: Boolean(is_required),
      min_select: Number(min_select) || 0,
      max_select: Number(max_select) || 1,
      options: Array.isArray(options) ? options.map(opt => ({
        option_id: opt.option_id || generateTypeID('opt'),
        option_name: (opt.option_name || '').trim(),
        additional_price: Number(opt.additional_price) || 0,
        is_default: Boolean(opt.is_default)
      })) : []
    };
    if (!this.data.option_groups) {
      this.data.option_groups = [];
    }
    this.data.option_groups.push(newGroup);
    this.saveData();
    return newGroup;
  }

  // 3. 신규 메뉴 등록
  createMenuItem({ category_id, name, description, price, option_group_ids }) {
    if (!name || !price || isNaN(price) || price < 0) {
      throw new Error('메뉴명과 올바른 가격을 입력해야 합니다.');
    }

    const catExists = this.data.categories.some(c => c.id === category_id);
    const assignedCatId = catExists ? category_id : this.data.categories[0].id;

    const newProduct = {
      product_id: generateTypeID('prd'),
      category_id: assignedCatId,
      name: name.trim(),
      description: (description || '').trim(),
      price: Number(price),
      discounted_price: null,
      status: 'AVAILABLE',
      option_group_ids: Array.isArray(option_group_ids) ? option_group_ids : ['optgrp_01h7x8part'],
      created_at: new Date().toISOString()
    };

    this.data.products.push(newProduct);
    this.saveData();
    return newProduct;
  }

  // 4. 메뉴 가격 실시간 수정
  updateMenuItemPrice(productId, newPrice, newDiscountedPrice = null) {
    const product = this.data.products.find(p => p.product_id === productId);
    if (!product) {
      throw new Error(`메뉴를 찾을 수 없습니다. (ID: ${productId})`);
    }

    if (isNaN(newPrice) || newPrice < 0) {
      throw new Error('유효하지 않은 가격입니다.');
    }

    product.price = Number(newPrice);
    if (newDiscountedPrice !== null && !isNaN(newDiscountedPrice) && Number(newDiscountedPrice) >= 0) {
      product.discounted_price = Number(newDiscountedPrice);
    } else {
      product.discounted_price = null;
    }

    this.saveData();
    return product;
  }

  // 5. 메뉴 판매 상태 (AVAILABLE / SOLDOUT / HIDDEN) 변경
  updateMenuItemStatus(productId, newStatus) {
    const validStatuses = ['AVAILABLE', 'SOLDOUT', 'HIDDEN'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`허용되지 않은 메뉴 상태값입니다: ${newStatus}`);
    }

    const product = this.data.products.find(p => p.product_id === productId);
    if (!product) {
      throw new Error(`메뉴를 찾을 수 없습니다. (ID: ${productId})`);
    }

    product.status = newStatus;
    this.saveData();
    return product;
  }

  // 6. 실시간 KDS 주문 목록 조회
  getLiveOrders() {
    return this.data.live_orders;
  }

  // 6b. 신규 주문 생성 (PWA / 모바일 웹 / ARS)
  createOrder(orderData) {
    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw new Error('주문할 상품 항목이 없습니다.');
    }

    const validFulfillmentTypes = ['DELIVERY', 'TAKEOUT', 'DINE_IN'];
    const fulfillmentType = validFulfillmentTypes.includes(orderData.fulfillment_type)
      ? orderData.fulfillment_type
      : 'DELIVERY';

    const orderId = generateTypeID('ord');
    const seqNum = (this.data.live_orders?.length || 0) + 30;
    const shortDisplayId = `A-${seqNum}`;

    const items = orderData.items.map((it) => ({
      item_id: generateTypeID('itm'),
      product_id: it.product_id || it.id || '',
      name: it.name || '메뉴',
      quantity: Number(it.quantity) || 1,
      base_price: Number(it.base_price) || Number(it.price) || 0,
      selected_options: Array.isArray(it.selected_options) ? it.selected_options : [],
      total_price: Number(it.total_price) || (Number(it.price || 0) * (Number(it.quantity) || 1))
    }));

    const itemsTotal = items.reduce((sum, it) => sum + it.total_price, 0);
    const deliveryTip = fulfillmentType === 'DELIVERY' ? (Number(orderData.delivery_tip) || 3000) : 0;
    const discountAmount = Number(orderData.discount_amount) || 0;
    const finalPaymentAmount = itemsTotal + deliveryTip - discountAmount;
    const estimatedProfit = Math.round(itemsTotal * 0.58);

    // 0504 가상 안심번호(DOC-13 규격) 발급 처리
    const useVirtualPhone = orderData.use_virtual_phone !== false;
    let virtualPhoneInfo = null;
    if (useVirtualPhone) {
      const vnmId = generateTypeID('vnm');
      const vnmNumber = `0504-${Math.floor(2000 + Math.random() * 8000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1시간 수명

      virtualPhoneInfo = {
        id: vnmId,
        virtual_phone: vnmNumber,
        order_id: orderId,
        real_customer_phone: orderData.customer_phone || '010-0000-0000',
        status: 'BOUND',
        bound_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      };

      if (!this.data.virtual_numbers) {
        this.data.virtual_numbers = [];
      }
      this.data.virtual_numbers.unshift(virtualPhoneInfo);
    }

    // 도로명 + 상세 주소 결합
    let resolvedAddress = orderData.delivery_address || '';
    if (orderData.road_address) {
      resolvedAddress = orderData.detail_address
        ? `${orderData.road_address} ${orderData.detail_address}`
        : orderData.road_address;
    } else if (!resolvedAddress) {
      resolvedAddress = fulfillmentType === 'DINE_IN'
        ? `매장 홀 [${orderData.table_no || '지정테이블'}]`
        : (fulfillmentType === 'TAKEOUT' ? '방문 포장 픽업' : '서울특별시 서초구 서초대로 34길 18');
    }

    const newOrder = {
      order_id: orderId,
      short_display_id: shortDisplayId,
      status: 'PENDING',
      order_channel: orderData.order_channel || 'PWA',
      fulfillment_type: fulfillmentType,
      customer_name: orderData.customer_name || '모바일 고객',
      customer_phone: orderData.customer_phone || '010-0000-0000',
      use_virtual_phone: useVirtualPhone,
      virtual_phone: virtualPhoneInfo ? virtualPhoneInfo.virtual_phone : null,
      virtual_phone_id: virtualPhoneInfo ? virtualPhoneInfo.id : null,
      virtual_phone_expires_at: virtualPhoneInfo ? virtualPhoneInfo.expires_at : null,
      road_address: orderData.road_address || null,
      detail_address: orderData.detail_address || null,
      postal_code: orderData.postal_code || null,
      delivery_address: resolvedAddress,
      distance_meters: fulfillmentType === 'DELIVERY' ? (Number(orderData.distance_meters) || 500) : 0,
      customer_memo: orderData.customer_memo || '',
      items,
      items_total: itemsTotal,
      delivery_tip: deliveryTip,
      discount_amount: discountAmount,
      final_payment_amount: finalPaymentAmount,
      estimated_profit: estimatedProfit,
      payment_method: orderData.payment_method || 'AITIP_ZERO_PAY',
      delivery_method: null,
      delivery_status: null,
      prep_time_minutes: null,
      rider_dispatch_status: 'WAITING_ACCEPT',
      kitchen_ticket_printed: false,
      created_at: new Date().toISOString()
    };

    if (fulfillmentType === 'DINE_IN') {
      newOrder.table_no = orderData.table_no || '테이블 1번';
      newOrder.guest_count = Number(orderData.guest_count) || 2;
      newOrder.reserved_at = orderData.reserved_at || '19:30';
      newOrder.ready_type = orderData.table_no_is_fixed ? 'NOW' : 'SCHEDULED';
      newOrder.scheduled_display = orderData.table_no_is_fixed
        ? `매장 ${newOrder.table_no} 즉시 착석 주문`
        : `오늘 ${newOrder.reserved_at} 테이블 예약 (${newOrder.guest_count}인)`;

      // 홀 예약 목록(dinein_reservations) 연동 추가
      if (!this.data.dinein_reservations) {
        this.data.dinein_reservations = [];
      }
      const reservationId = generateTypeID('res');
      const menuSummary = items.map(it => `${it.name} ${it.quantity}개`).join(', ');

      const reservationRecord = {
        id: reservationId,
        order_id: orderId,
        display_seq: shortDisplayId,
        customer_name: newOrder.customer_name,
        customer_phone: newOrder.customer_phone,
        guest_count: newOrder.guest_count,
        table_no: newOrder.table_no,
        reserved_date: new Date().toISOString().slice(0, 10),
        reserved_time: newOrder.reserved_at,
        status: orderData.table_no_is_fixed ? 'CONFIRMED' : 'WAITING',
        pre_ordered: true,
        menu_summary: menuSummary,
        total_amount: finalPaymentAmount,
        special_request: newOrder.customer_memo,
        created_at: new Date().toISOString()
      };
      this.data.dinein_reservations.unshift(reservationRecord);

      // 테이블 상태 동기화
      const tables = this.getDineInTables();
      const matchedTable = tables.find(t => t.table_no === newOrder.table_no);
      if (matchedTable) {
        if (orderData.table_no_is_fixed) {
          matchedTable.status = 'OCCUPIED';
          matchedTable.guest_count = newOrder.guest_count;
          matchedTable.memo = menuSummary;
        } else {
          matchedTable.status = 'WAITING_CONFIRM';
          matchedTable.reservation_time = newOrder.reserved_at;
          matchedTable.reserved_by = newOrder.customer_name;
          matchedTable.current_reservation_id = reservationId;
          matchedTable.memo = menuSummary;
        }
      }
    }

    if (!Array.isArray(this.data.live_orders)) {
      this.data.live_orders = [];
    }
    this.data.live_orders.unshift(newOrder);
    this.saveData();

    return newOrder;
  }

  // 6c. 단일 주문 상세 조회
  getOrderById(orderId) {
    if (!this.data.live_orders) return null;
    return this.data.live_orders.find(o => o.order_id === orderId) || null;
  }

  // 6d. NextOrders & Hyperlocal-Delivery 표준 실시간 주문 추적 라이프사이클
  getOrderTrack(orderId) {
    const order = this.getOrderById(orderId);
    if (!order) return null;

    // 타임라인 단계 정의
    const timeline = [
      { step: 'PLACED', label: '주문 접수', time: order.created_at, done: true },
      { step: 'ACCEPTED', label: '매장 조리중', time: order.accepted_at || null, done: ['ACCEPTED', 'COOKING', 'READY', 'DISPATCHED', 'DELIVERED'].includes(order.status) },
      { step: 'READY', label: order.fulfillment_type === 'DELIVERY' ? '배달 출발 준비' : (order.fulfillment_type === 'TAKEOUT' ? '포장 준비 완료' : '테이블 준비 완료'), time: order.ready_at || null, done: ['READY', 'DISPATCHED', 'DELIVERED'].includes(order.status) },
      { step: 'DISPATCHED', label: order.fulfillment_type === 'DELIVERY' ? '라이더 배달중' : '픽업/착석 대기', time: order.dispatched_at || null, done: ['DISPATCHED', 'DELIVERED'].includes(order.status) },
      { step: 'DELIVERED', label: order.fulfillment_type === 'DELIVERY' ? '배달 완료' : '이용 완료', time: order.delivered_at || null, done: order.status === 'DELIVERED' }
    ];

    // 남은 예상 시간(ETA) 계산 (분 단위)
    const prep = order.prep_time_minutes || 25;
    const elapsedMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / (60 * 1000));
    const remainingMinutes = Math.max(0, prep - elapsedMinutes);

    return {
      order_id: order.order_id,
      short_display_id: order.short_display_id,
      status: order.status,
      fulfillment_type: order.fulfillment_type,
      items: order.items,
      final_payment_amount: order.final_payment_amount,
      delivery_address: order.delivery_address,
      road_address: order.road_address,
      detail_address: order.detail_address,
      postal_code: order.postal_code,
      use_virtual_phone: order.use_virtual_phone,
      virtual_phone: order.virtual_phone,
      virtual_phone_expires_at: order.virtual_phone_expires_at,
      customer_memo: order.customer_memo,
      created_at: order.created_at,
      prep_time_minutes: prep,
      remaining_minutes: order.status === 'DELIVERED' ? 0 : remainingMinutes,
      rider_dispatch_status: order.rider_dispatch_status,
      delivery_status: order.delivery_status,
      timeline
    };
  }

  // 7. 실시간 주문 접수 (조리시간 설정, 주방 출력 트리거)
  acceptOrder(orderId, prepTimeMinutes = 25) {
    const order = this.data.live_orders.find(o => o.order_id === orderId);
    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다. (ID: ${orderId})`);
    }

    order.status = 'ACCEPTED';
    order.prep_time_minutes = Number(prepTimeMinutes);
    order.rider_dispatch_status = 'DISPATCHED';
    order.kitchen_ticket_printed = true;
    order.accepted_at = new Date().toISOString();

    this.saveData();
    return order;
  }

  // 7-1. 라이더 배차 상태 단계별 전이
  updateRiderStatus(orderId, riderStatus) {
    const validStatuses = ['WAITING_ACCEPT', 'DISPATCH_REQUESTED', 'DISPATCHED', 'PICKED_UP', 'COMPLETED'];
    if (!validStatuses.includes(riderStatus)) {
      throw new Error(`유효하지 않은 라이더 배차 상태입니다: ${riderStatus}`);
    }
    const order = this.data.live_orders.find(o => o.order_id === orderId);
    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다. (ID: ${orderId})`);
    }
    order.rider_dispatch_status = riderStatus;
    if (riderStatus === 'COMPLETED') {
      order.status = 'COMPLETED';
    }
    this.saveData();
    return order;
  }

  // 7-2. 하이브리드 배달 방식 (자체 배달 vs 대행사 호출) 단계별 전이
  updateDeliveryMethod(orderId, { delivery_method, status }) {
    const validMethods = ['SELF', 'AGENCY'];
    if (!validMethods.includes(delivery_method)) {
      throw new Error(`유효하지 않은 배달 방식입니다: ${delivery_method}`);
    }

    const order = this.data.live_orders.find(o => o.order_id === orderId);
    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다. (ID: ${orderId})`);
    }

    order.delivery_method = delivery_method;

    if (delivery_method === 'SELF') {
      // 자체 배달의 경우: 대행사 미호출, 점주 직접 배송
      const validSelfStatuses = ['IN_TRANSIT', 'COMPLETED'];
      const targetStatus = status || 'IN_TRANSIT';
      if (!validSelfStatuses.includes(targetStatus)) {
        throw new Error(`유효하지 않은 자체 배달 상태입니다: ${targetStatus}`);
      }

      order.delivery_status = (targetStatus === 'COMPLETED') ? 'DELIVERED' : 'SELF_DELIVERING';
      order.rider_dispatch_status = (targetStatus === 'COMPLETED') ? 'COMPLETED' : 'SELF_DISPATCHED';
      if (targetStatus === 'COMPLETED') {
        order.status = 'COMPLETED';
      }
    } else {
      // 대행사 배달의 경우: 대행사 라이더 배차 요청
      order.delivery_status = 'RIDER_REQUESTED';
      order.rider_dispatch_status = 'DISPATCH_REQUESTED';
    }

    this.saveData();
    return order;
  }

  // 7-2b. 매장 식사(DINE_IN) 테이블 고객 착석 및 식사 완료 처리
  updateDineInStatus(orderId, { status }) {
    const validStatuses = ['SEATED', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`유효하지 않은 매장 식사 상태입니다: ${status}`);
    }
    const order = this.data.live_orders.find(o => o.order_id === orderId);
    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다. (ID: ${orderId})`);
    }
    order.delivery_status = (status === 'SEATED') ? 'SEATED' : 'DINE_COMPLETED';
    if (status === 'COMPLETED') {
      order.status = 'COMPLETED';
    }
    this.saveData();
    return order;
  }

  // 7-2c. 매장 관리 메뉴(사이드바) 순서 및 매장 운영 타입 변경
  updateStoreNavOrder(navOrder) {
    if (!Array.isArray(navOrder)) throw new Error('올바른 메뉴 순서 배열이어야 합니다.');
    this.data.store.nav_order = navOrder;
    this.saveData();
    return { store: this.data.store };
  }

  updateStoreType(storeType) {
    const validTypes = ['DELIVERY_ONLY', 'DINE_IN_CENTRIC', 'HYBRID'];
    if (!validTypes.includes(storeType)) throw new Error('올바른 매장 운영 타입이어야 합니다.');
    this.data.store.store_operation_type = storeType;
    this.saveData();
    return { store: this.data.store };
  }

  // 7-2e. 5대 업종 공통 가맹점 메타 블록 (주차/위치/시설/공지) 업데이트
  updateStoreBlocks(rawBlocks) {
    if (!this.data.store) {
      this.data.store = getInitialSeedData().store;
    }
    const normalized = normalizeStoreBlocks(rawBlocks);
    this.data.store.blocks = {
      ...(this.data.store.blocks || {}),
      ...normalized
    };
    this.saveData();
    return { success: true, blocks: this.data.store.blocks, store: this.data.store };
  }

  // 7-2d. 매장 식사(홀) 테이블 현황 및 실시간 예약 관리
  getDineInTables() {
    if (!this.data.tables) {
      this.data.tables = getInitialSeedData().tables;
      this.saveData();
    }
    return this.data.tables;
  }

  getDineInReservations() {
    if (!this.data.dinein_reservations) {
      this.data.dinein_reservations = getInitialSeedData().dinein_reservations;
      this.saveData();
    }
    return this.data.dinein_reservations;
  }

  confirmDineInReservation(reservationId) {
    const res = this.getDineInReservations().find(r => r.id === reservationId);
    if (!res) throw new Error(`예약 정보를 찾을 수 없습니다: ${reservationId}`);
    res.status = 'CONFIRMED';
    
    // 테이블 상태를 '예약 확정(RESERVED)'으로 동기화
    if (res.table_no) {
      const table = this.getDineInTables().find(t => t.table_no === res.table_no);
      if (table) {
        table.status = 'RESERVED';
        table.reservation_time = res.reserved_time;
        table.guest_count = res.guest_count;
        table.reserved_by = res.customer_name;
        table.current_reservation_id = res.id;
      }
    }
    this.saveData();
    return { reservation: res, tables: this.data.tables };
  }

  seatDineInReservation(reservationId, targetTableNo) {
    const res = this.getDineInReservations().find(r => r.id === reservationId);
    if (!res) throw new Error(`예약 정보를 찾을 수 없습니다: ${reservationId}`);
    res.status = 'SEATED';
    const finalTable = targetTableNo || res.table_no;
    res.table_no = finalTable;

    // 해당 테이블을 '식사 중(OCCUPIED)'으로 전환
    const table = this.getDineInTables().find(t => t.table_no === finalTable);
    if (table) {
      table.status = 'OCCUPIED';
      table.seated_at = new Date().toTimeString().slice(0, 5);
      table.guest_count = res.guest_count;
      table.current_reservation_id = res.id;
      table.memo = `${res.customer_name} 고객 식사 중 (${res.menu_summary || '주문완료'})`;
    }

    // 연관된 라이브 주문이 있는 경우 주문 상태도 SEATED로 동기화
    if (res.order_id) {
      const order = this.data.live_orders.find(o => o.order_id === res.order_id);
      if (order) order.delivery_status = 'SEATED';
    }

    this.saveData();
    return { reservation: res, tables: this.data.tables };
  }

  completeDineInReservation(reservationId, targetTableNo) {
    const res = this.getDineInReservations().find(r => r.id === reservationId);
    if (res) {
      res.status = 'COMPLETED';
      if (res.order_id) {
        const order = this.data.live_orders.find(o => o.order_id === res.order_id);
        if (order) {
          order.delivery_status = 'DINE_COMPLETED';
          order.status = 'COMPLETED';
        }
      }
    }

    // 테이블을 빈 테이블(VACANT)로 초기화
    const tableToFree = targetTableNo || (res ? res.table_no : null);
    if (tableToFree) {
      const table = this.getDineInTables().find(t => t.table_no === tableToFree);
      if (table) {
        table.status = 'VACANT';
        table.current_reservation_id = null;
        table.seated_at = null;
        table.reservation_time = null;
        table.guest_count = null;
        table.reserved_by = null;
        table.memo = null;
      }
    }

    this.saveData();
    return { success: true, tables: this.data.tables };
  }

  cancelDineInReservation(reservationId, reason) {
    const res = this.getDineInReservations().find(r => r.id === reservationId);
    if (!res) throw new Error(`예약 정보를 찾을 수 없습니다: ${reservationId}`);
    res.status = 'CANCELED';
    res.cancel_reason = reason || '점주 사정(만석)으로 취소';

    if (res.table_no) {
      const table = this.getDineInTables().find(t => t.table_no === res.table_no);
      if (table && table.current_reservation_id === res.id) {
        table.status = 'VACANT';
        table.current_reservation_id = null;
      }
    }

    this.saveData();
    return { reservation: res, tables: this.data.tables };
  }

  // 7-3. 고객 리뷰 목록 조회
  getReviews() {
    if (!this.data.reviews) {
      this.data.reviews = getInitialSeedData().reviews;
      this.saveData();
    }
    return this.data.reviews;
  }

  // 7-3. 고객 리뷰 사장님 답글 등록 및 수정
  replyReview(reviewId, replyText) {
    if (!this.data.reviews) {
      this.data.reviews = getInitialSeedData().reviews;
    }
    const review = this.data.reviews.find(r => r.id === reviewId);
    if (!review) {
      throw new Error(`리뷰를 찾을 수 없습니다. (ID: ${reviewId})`);
    }
    review.owner_reply = replyText && replyText.trim() ? replyText.trim() : null;
    review.owner_replied_at = replyText && replyText.trim() ? new Date().toISOString() : null;
    this.saveData();
    return review;
  }

  // 7-4. DOC-12 악성 리뷰 24시간 임시 블라인드 소명 요청
  requestReviewBlind(reviewId, reason) {
    if (!this.data.reviews) {
      this.data.reviews = getInitialSeedData().reviews;
    }
    const review = this.data.reviews.find(r => r.id === reviewId);
    if (!review) {
      throw new Error(`리뷰를 찾을 수 없습니다. (ID: ${reviewId})`);
    }
    review.blind_status = 'TEMPORARY_BLIND';
    review.blind_reason = (reason || '점주 소명 신청 (24시간 임시 블라인드)').trim();
    review.blind_requested_at = new Date().toISOString();
    this.saveData();
    return review;
  }

  // 8. 가게 할인 쿠폰 목록 조회 및 신규 발행
  getCoupons() {
    if (!this.data.coupons) {
      this.data.coupons = [
        {
          id: generateTypeID('cpn'),
          name: '첫 주문 고객 2,000원 할인',
          discount_amount: 2000,
          min_order_amount: 20000,
          valid_until: '상시 발급',
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        },
        {
          id: generateTypeID('cpn'),
          name: '단골 우대 3,000원 감사쿠폰',
          discount_amount: 3000,
          min_order_amount: 35000,
          valid_until: '2026-11-30',
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        }
      ];
      this.saveData();
    }
    return this.data.coupons;
  }

  createCoupon({ name, discount_amount, min_order_amount, valid_until }) {
    if (!name || !discount_amount) {
      throw new Error('쿠폰명과 할인 금액은 필수 항목입니다.');
    }
    const newCoupon = {
      id: generateTypeID('cpn'),
      name: name.trim(),
      discount_amount: Number(discount_amount),
      min_order_amount: Number(min_order_amount) || 0,
      valid_until: valid_until ? valid_until.trim() : '상시 발급',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    if (!this.data.coupons) {
      this.data.coupons = [];
    }
    this.data.coupons.push(newCoupon);
    this.saveData();
    return newCoupon;
  }

  // 9. 국세청 홈택스 표준 부가세 신고서 CSV 파일 생성
  exportTaxCsv({ year = 2026, month = 11 }) {
    const overview = this.getSettlementOverview({ year, month });
    const report = overview.tax_report;
    const rows = [
      ['과세구분', '공급가액(원)', '부가가치세(원)', '합계금액(원)', '국세청_전자신고항목'],
      ['1. 신용카드 매출전표 발행분', report.card.supply, report.card.vat, report.card.total, '신용카드·현금영수증 발행분'],
      ['2. 현금영수증 발행분', report.cash.supply, report.cash.vat, report.cash.total, '신용카드·현금영수증 발행분'],
      ['3. 기타(간편결제·포인트) 매출분', report.other.supply, report.other.vat, report.other.total, '기타(정규영수증 외 매출)'],
      ['과세표준 신고 합계', report.total.supply, report.total.vat, report.total.total, '과세표준 합계'],
      [],
      ['[매입세액 공제 증빙]', '공급가액(원)', '세액(원)', '합계(원)', '세금계산서상태'],
      ['PG사 결제대행 수수료 매입', report.pg_fee_expense.supply, report.pg_fee_expense.vat, report.pg_fee_expense.total, '국세청 전송완료']
    ];
    return '\uFEFF' + rows.map(r => r.join(',')).join('\n');
  }

  // 8. 정산 및 부가세 세무 증빙 대사 원장 조회 (D1 merchant_daily_bi_snapshots 규격)
  getSettlementOverview({ year = 2026, month = 11 }) {
    // 11월 1일~8일 실제 스냅샷 데이터
    const historicalSnapshots = [
      { business_date: '2026-11-01', order_count: 24, gross_sales: 580000, delivery_tips: 72000, pg_fees: 16300, net_payout: 635700, payout_status: 'COMPLETED', payout_date: '2026-11-02' },
      { business_date: '2026-11-02', order_count: 16, gross_sales: 382000, delivery_tips: 45000, pg_fees: 10675, net_payout: 416325, payout_status: 'COMPLETED', payout_date: '2026-11-03' },
      { business_date: '2026-11-03', order_count: 18, gross_sales: 425000, delivery_tips: 51000, pg_fees: 11900, net_payout: 464100, payout_status: 'COMPLETED', payout_date: '2026-11-04' },
      { business_date: '2026-11-04', order_count: 15, gross_sales: 360000, delivery_tips: 42000, pg_fees: 10050, net_payout: 391950, payout_status: 'COMPLETED', payout_date: '2026-11-05' },
      { business_date: '2026-11-05', order_count: 19, gross_sales: 458000, delivery_tips: 54000, pg_fees: 12800, net_payout: 499200, payout_status: 'COMPLETED', payout_date: '2026-11-06' },
      { business_date: '2026-11-06', order_count: 28, gross_sales: 685000, delivery_tips: 81000, pg_fees: 19150, net_payout: 746850, payout_status: 'COMPLETED', payout_date: '2026-11-09' },
      { business_date: '2026-11-07', order_count: 32, gross_sales: 792000, delivery_tips: 93000, pg_fees: 22125, net_payout: 862875, payout_status: 'COMPLETED', payout_date: '2026-11-09' },
      { business_date: '2026-11-08', order_count: 29, gross_sales: 710000, delivery_tips: 84000, pg_fees: 19850, net_payout: 774150, payout_status: 'COMPLETED', payout_date: '2026-11-09' }
    ];

    // 오늘(2026-11-09) 실시간 주문 기반 정산 계산
    const liveOrders = this.data.live_orders || [];
    let todayGrossSales = 0;
    let todayDeliveryTips = 0;
    let todayOrderCount = liveOrders.length;

    for (const ord of liveOrders) {
      todayGrossSales += Number(ord.items_total || ord.final_payment_amount || 0);
      todayDeliveryTips += Number(ord.delivery_tip || 0);
    }
    // 기본 모의 주문 추가분 (오늘 누적)
    todayGrossSales = Math.max(todayGrossSales, 428000);
    todayDeliveryTips = Math.max(todayDeliveryTips, 54000);
    todayOrderCount = Math.max(todayOrderCount, 18);

    const todayPgFees = Math.round((todayGrossSales + todayDeliveryTips) * 0.025); // 2.5% PG망 수수료
    const todayNetPayout = (todayGrossSales + todayDeliveryTips) - todayPgFees;

    const todayRecord = {
      business_date: '2026-11-09',
      order_count: todayOrderCount,
      gross_sales: todayGrossSales,
      delivery_tips: todayDeliveryTips,
      pg_fees: todayPgFees,
      net_payout: todayNetPayout,
      payout_status: 'PENDING',
      payout_date: '2026-11-10'
    };

    const allRecords = [...historicalSnapshots, todayRecord];

    // 월간 누적 합계 산출
    let totalGrossSales = 0;
    let totalPgFees = 0;
    let totalNetPayout = 0;
    let totalOrders = 0;
    let completedPayout = 0;
    let pendingPayout = 0;

    for (const r of allRecords) {
      totalGrossSales += (r.gross_sales + r.delivery_tips);
      totalPgFees += r.pg_fees;
      totalNetPayout += r.net_payout;
      totalOrders += r.order_count;
      if (r.payout_status === 'COMPLETED') {
        completedPayout += r.net_payout;
      } else {
        pendingPayout += r.net_payout;
      }
    }

    // 홈택스 부가세 신고용 실제 세무 분기 집계 (신용카드 70%, 간편결제 20%, 현금영수증 10%)
    const cardSales = Math.round(totalGrossSales * 0.70);
    const otherSales = Math.round(totalGrossSales * 0.20);
    const cashSales = totalGrossSales - cardSales - otherSales;

    const calcTax = (amt) => {
      const supply = Math.round(amt / 1.1);
      return { total: amt, supply, vat: amt - supply };
    };

    const taxBreakdown = {
      card: calcTax(cardSales),
      cash: calcTax(cashSales),
      other: calcTax(otherSales),
      total: calcTax(totalGrossSales),
      pg_fee_expense: {
        total: totalPgFees,
        supply: Math.round(totalPgFees / 1.1),
        vat: totalPgFees - Math.round(totalPgFees / 1.1)
      }
    };

    return {
      year,
      month,
      daily_records: allRecords,
      summary: {
        total_orders: totalOrders,
        total_gross_sales: totalGrossSales,
        total_pg_fees: totalPgFees,
        total_net_payout: totalNetPayout,
        completed_payout: completedPayout,
        pending_payout: pendingPayout
      },
      tax_report: taxBreakdown
    };
  }
}

export const foodService = new FoodDeliveryService();
