export const defaultStore = {
  "store_id": "str_01h7x8q4barunchicken001",
  "store_name": "바른치킨 서초본점",
  "biz_number": "214-88-59124",
  "owner_name": "홍길동",
  "phone": "02-588-9258",
  "address": "서울특별시 서초구 서초대로 34길 18 1층",
  "operating_hours": "15:00 ~ 24:00 (연중무휴)",
  "delivery_min_order": 15000,
  "delivery_base_tip": 3000,
  "delivery_tip_rules": [
    {
      "min_amount": 15000,
      "max_amount": 30000,
      "tip": 3000
    },
    {
      "min_amount": 30000,
      "max_amount": 50000,
      "tip": 2000
    },
    {
      "min_amount": 50000,
      "max_amount": 999999999,
      "tip": 0
    }
  ],
  "is_open": true,
  "store_operation_type": "HYBRID",
  "nav_order": [
    "group-orders",
    "group-store",
    "group-menu",
    "group-marketing",
    "group-settlement"
  ],
  "terminal_id": "dev_01m6z4term8923",
  "terminal_status": "ONLINE",
  "delivery_regions": [
    "서초1동",
    "서초2동",
    "서초3동",
    "서초4동",
    "역삼1동",
    "방배본동",
    "반포1동"
  ],
  "blocks": {
    "notice": "100% 국내산 바른 치킨!",
    "parking": {
      "type": "FREE",
      "capacity_text": "매장 앞 4대 완비",
      "details": "편하게 방문하세요"
    },
    "location_guide": {
      "subway_station": "2호선 서초역 1번 출구",
      "walking_time_minutes": 3,
      "landmark_hint": "골목 50m"
    },
    "facilities": [
      "parking",
      "wifi",
      "group_seat",
      "reservation"
    ],
    "legal_notices": {
      "origin_or_license": ""
    }
  }
};

export const defaultCategories = [
  {
    "id": "cat_01h7x8main",
    "name": "메인 치킨 (대표메뉴)",
    "layout_type": "CARD_DETAILED",
    "display_order": 1
  },
  {
    "id": "cat_01h7x8half",
    "name": "반반 치킨 (내맘대로)",
    "layout_type": "CARD_DETAILED",
    "display_order": 2
  },
  {
    "id": "cat_01h7x8side",
    "name": "사이드 & 안주",
    "layout_type": "GRID_2COL",
    "display_order": 3
  },
  {
    "id": "cat_01h7x8bevr",
    "name": "음료 & 주류",
    "layout_type": "ROW_COMPACT",
    "display_order": 4
  }
];

export const defaultOptionGroups = [
  {
    "group_id": "optgrp_01h7x8part",
    "group_name": "부위 선택 (필수)",
    "is_required": true,
    "min_select": 1,
    "max_select": 1,
    "options": [
      {
        "option_id": "opt_part_bone",
        "option_name": "뼈 치킨 (기본)",
        "additional_price": 0,
        "is_default": true
      },
      {
        "option_id": "opt_part_boneless",
        "option_name": "100% 닭다리 순살로 변경",
        "additional_price": 2000,
        "is_default": false
      },
      {
        "option_id": "opt_part_combo",
        "option_name": "윙/봉 콤보로 변경",
        "additional_price": 3000,
        "is_default": false
      }
    ]
  },
  {
    "group_id": "optgrp_01h7x8spicy",
    "group_name": "맛/맵기 강도 (필수)",
    "is_required": true,
    "min_select": 1,
    "max_select": 1,
    "options": [
      {
        "option_id": "opt_spicy_mild",
        "option_name": "순한맛 (기본 담백)",
        "additional_price": 0,
        "is_default": true
      },
      {
        "option_id": "opt_spicy_normal",
        "option_name": "보통맛 (신라면 정도)",
        "additional_price": 0,
        "is_default": false
      },
      {
        "option_id": "opt_spicy_hot",
        "option_name": "매운맛 (불닭 맵기)",
        "additional_price": 500,
        "is_default": false
      }
    ]
  },
  {
    "group_id": "optgrp_01h7x8sauce",
    "group_name": "추가 소스/토핑 (선택)",
    "is_required": false,
    "min_select": 0,
    "max_select": 5,
    "options": [
      {
        "option_id": "opt_add_mayo",
        "option_name": "알싸 청양마요 소스",
        "additional_price": 1500
      },
      {
        "option_id": "opt_add_sweet",
        "option_name": "달콤 양념 소스",
        "additional_price": 1000
      },
      {
        "option_id": "opt_add_radish",
        "option_name": "아삭 치킨무 추가",
        "additional_price": 500
      },
      {
        "option_id": "opt_add_cola",
        "option_name": "코카콜라 1.25L 사이즈업",
        "additional_price": 2000
      }
    ]
  },
  {
    "group_id": "optgrp_01h7x8side_opt",
    "group_name": "함께 즐길 사이드 메뉴 (선택)",
    "is_required": false,
    "min_select": 0,
    "max_select": 3,
    "options": [
      {
        "option_id": "opt_side_cheeseball",
        "option_name": "카사바칩 & 크림치즈볼 (5개)",
        "additional_price": 6000
      },
      {
        "option_id": "opt_side_fries",
        "option_name": "모둠 감자튀김 & 버터갈릭",
        "additional_price": 7000
      },
      {
        "option_id": "opt_side_tteok",
        "option_name": "매콤 국물 떡볶이",
        "additional_price": 8500
      },
      {
        "option_id": "opt_side_menbosha",
        "option_name": "통새우 멘보샤 (4개)",
        "additional_price": 8000
      }
    ]
  },
  {
    "group_id": "optgrp_01h7x8bevr_opt",
    "group_name": "시원한 음료 및 주류 (선택)",
    "is_required": false,
    "min_select": 0,
    "max_select": 4,
    "options": [
      {
        "option_id": "opt_bevr_beer500",
        "option_name": "테라 생맥주 500cc (보냉 전용용기)",
        "additional_price": 4500
      },
      {
        "option_id": "opt_bevr_cola500",
        "option_name": "코카콜라 (500ml PET)",
        "additional_price": 2000
      },
      {
        "option_id": "opt_bevr_colazero",
        "option_name": "코카콜라 제로 (500ml PET)",
        "additional_price": 2000
      },
      {
        "option_id": "opt_bevr_sprite",
        "option_name": "스프라이트 (500ml PET)",
        "additional_price": 2000
      },
      {
        "option_id": "opt_bevr_soju",
        "option_name": "참이슬 후레쉬 (360ml)",
        "additional_price": 5000
      }
    ]
  }
];

export const defaultProducts = [
  {
    "product_id": "prd_01h7x8brownrice",
    "category_id": "cat_01h7x8main",
    "name": "현미바삭치킨",
    "description": "국내산 햅쌀과 현미파우더로 극대화한 극상의 바삭함. 깨끗한 기름 1통에 58마리만 튀겨 더욱 바삭하고 담백합니다.",
    "price": 18900,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300",
    "option_group_ids": [
      "optgrp_01h7x8part",
      "optgrp_01h7x8spicy",
      "optgrp_01h7x8sauce",
      "optgrp_01h7x8side_opt",
      "optgrp_01h7x8bevr_opt"
    ],
    "created_at": "2026-11-10T05:23:01.941Z"
  },
  {
    "product_id": "prd_01h7x8redlobster",
    "category_id": "cat_01h7x8main",
    "name": "대새레드치킨",
    "description": "탱글탱글한 통 랍스터새우 4마리와 72시간 숙성 매콤 청양고추 소스가 어우러진 시그니처 프리미엄 치킨",
    "price": 24900,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300",
    "option_group_ids": [
      "optgrp_01h7x8part",
      "optgrp_01h7x8sauce",
      "optgrp_01h7x8side_opt",
      "optgrp_01h7x8bevr_opt"
    ],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8soy",
    "category_id": "cat_01h7x8main",
    "name": "통곡물 간장치킨",
    "description": "보리, 조, 수수 볶은 통곡물의 고소함과 특제 숙성 양조간장이 빚어낸 깊은 풍미의 프리미엄 치킨",
    "price": 20900,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1527477321055-43615b629c95?w=300",
    "option_group_ids": [
      "optgrp_01h7x8part",
      "optgrp_01h7x8sauce",
      "optgrp_01h7x8side_opt",
      "optgrp_01h7x8bevr_opt"
    ],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8sweet",
    "category_id": "cat_01h7x8main",
    "name": "바른 양념치킨",
    "description": "사과와 토마토로 자연스러운 단맛을 낸 30년 전통 비법 양념소스와 바삭한 튀김옷의 정석 치킨",
    "price": 19900,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=300",
    "option_group_ids": [
      "optgrp_01h7x8part",
      "optgrp_01h7x8spicy",
      "optgrp_01h7x8sauce",
      "optgrp_01h7x8side_opt",
      "optgrp_01h7x8bevr_opt"
    ],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8mayo",
    "category_id": "cat_01h7x8main",
    "name": "청양마요 순살치킨",
    "description": "100% 닭다리살 순살치킨에 알싸한 청양고추와 부드러운 고소함의 수제 마요소스가 듬뿍 올라간 인기 메뉴",
    "price": 21900,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=300",
    "option_group_ids": [
      "optgrp_01h7x8sauce",
      "optgrp_01h7x8side_opt",
      "optgrp_01h7x8bevr_opt"
    ],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8halfhalf",
    "category_id": "cat_01h7x8half",
    "name": "바른 반반치킨 (후라이드+양념)",
    "description": "바삭한 현미후라이드와 매콤달콤한 비법 양념치킨을 반반씩 푸짐하게 즐기는 정석 메뉴",
    "price": 19900,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300",
    "option_group_ids": [
      "optgrp_01h7x8part",
      "optgrp_01h7x8sauce",
      "optgrp_01h7x8side_opt",
      "optgrp_01h7x8bevr_opt"
    ],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8halfsoy",
    "category_id": "cat_01h7x8half",
    "name": "현미바삭 + 통곡물간장 반반",
    "description": "극상의 바삭함 후라이드와 짭조름하고 고소한 간장치킨의 완벽한 밸런스 조합",
    "price": 20900,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1562967914-608f82629710?w=300",
    "option_group_ids": [
      "optgrp_01h7x8part",
      "optgrp_01h7x8sauce",
      "optgrp_01h7x8side_opt",
      "optgrp_01h7x8bevr_opt"
    ],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8halfred",
    "category_id": "cat_01h7x8half",
    "name": "시그니처 대새반반 (대새레드+현미바삭)",
    "description": "통랍스터새우의 매콤한 대새레드치킨과 담백고소한 현미바삭치킨의 최고 인기 세트",
    "price": 22900,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300",
    "option_group_ids": [
      "optgrp_01h7x8part",
      "optgrp_01h7x8sauce",
      "optgrp_01h7x8side_opt",
      "optgrp_01h7x8bevr_opt"
    ],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8cheeseball",
    "category_id": "cat_01h7x8side",
    "name": "카사바칩 & 크림치즈볼 (5개)",
    "description": "열대작물 카사바 뿌리를 바삭하게 튀겨낸 칩과 모짜렐라+크림치즈가 꽉 찬 단짠 치즈볼 세트",
    "price": 6000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8fries",
    "category_id": "cat_01h7x8side",
    "name": "모둠 감자튀김 & 버터갈릭",
    "description": "케이준 감자튀김, 웨지감자, 크링클컷 3종 모둠에 달콤 짭조름한 버터갈릭 시즈닝 듬뿍",
    "price": 7000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8tteok",
    "category_id": "cat_01h7x8side",
    "name": "매콤 국물 떡볶이",
    "description": "치킨 기름진 맛을 싹 잡아주는 쫄깃한 밀떡과 어묵의 칼칼한 학교 앞 국물떡볶이",
    "price": 8500,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1628294895950-9805252327bc?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8gizzard",
    "category_id": "cat_01h7x8side",
    "name": "바삭 똥집튀김 & 꽈리고추",
    "description": "쫄깃한 닭모래집(똥집)에 쌀파우더를 입혀 튀겨내고 알싸한 꽈리고추로 풍미를 더한 일품 안주",
    "price": 12000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8golbaengi",
    "category_id": "cat_01h7x8side",
    "name": "을지로식 골뱅이소면 무침",
    "description": "탱글탱글한 유동골뱅이 한 통과 신선한 파채, 오이, 진미채를 매콤새콤 특제양념에 무쳐낸 소면 세트",
    "price": 16000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8fishcake",
    "category_id": "cat_01h7x8side",
    "name": "얼큰 부산어묵탕",
    "description": "부산 90% 생선살 삼진어묵과 칼칼한 청양고추, 쑥갓, 무로 우려낸 따끈하고 시원한 국물 안주",
    "price": 15000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1555126634-323283e090fa?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8pollock",
    "category_id": "cat_01h7x8side",
    "name": "바삭 먹태구이 & 고추마요",
    "description": "오븐에 노릇노릇 바삭하게 구워낸 황태포와 특제 땡초간장마요 소스, 고소한 땅콩 세트",
    "price": 14000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8menbosha",
    "category_id": "cat_01h7x8side",
    "name": "바삭 통새우 멘보샤 (4개)",
    "description": "식빵 사이에 100% 통새우 살을 두툼하게 채워 겉은 바삭하고 속은 촉촉한 고급 중화 사이드",
    "price": 8000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8draft500",
    "category_id": "cat_01h7x8bevr",
    "name": "테라 생맥주 500cc (홀/캔실링)",
    "description": "영하 2도 저온숙성 생맥주. 매장 식사 시 유리잔 제공, 배달/포장 시 탄산유지 전용 알루미늄 캔 실링 포장",
    "price": 4500,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8draft1000",
    "category_id": "cat_01h7x8bevr",
    "name": "테라 생맥주 1,000cc 피처",
    "description": "여럿이 함께 시원하게 즐기는 1리터 대용량 저온 숙성 생맥주 피처",
    "price": 8500,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8cassbottle",
    "category_id": "cat_01h7x8bevr",
    "name": "카스 / 테라 병맥주 (500ml)",
    "description": "언제나 상쾌하고 시원한 대한민국 대표 맥주 (주문 시 카스 또는 테라 선택 가능)",
    "price": 5000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8sojuisul",
    "category_id": "cat_01h7x8bevr",
    "name": "참이슬 후레쉬 (360ml)",
    "description": "깨끗하고 부드러운 대나무 숯 4번 여과 국민 소주",
    "price": 5000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8sojufirst",
    "category_id": "cat_01h7x8bevr",
    "name": "처음처럼 (360ml)",
    "description": "대관령 기슭 암반수로 만들어 더욱 부드러운 소주",
    "price": 5000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8cola500",
    "category_id": "cat_01h7x8bevr",
    "name": "코카콜라 (500ml PET)",
    "description": "치킨에 빠질 수 없는 시원하고 짜릿한 오리지널 코카콜라",
    "price": 2000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8cola125",
    "category_id": "cat_01h7x8bevr",
    "name": "코카콜라 대용량 (1.25L PET)",
    "description": "가족, 친구들과 넉넉하게 마시는 코카콜라 1.25리터 대용량 페트병",
    "price": 3000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8colazero",
    "category_id": "cat_01h7x8bevr",
    "name": "코카콜라 제로 (500ml PET)",
    "description": "칼로리 걱정 없이 가볍고 상쾌하게 즐기는 제로 슈거 코카콜라",
    "price": 2000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  },
  {
    "product_id": "prd_01h7x8sprite",
    "category_id": "cat_01h7x8bevr",
    "name": "스프라이트 (500ml PET)",
    "description": "레몬라임 향의 톡 쏘는 상쾌함을 전하는 스프라이트",
    "price": 2000,
    "discounted_price": null,
    "status": "AVAILABLE",
    "image_url": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300",
    "option_group_ids": [],
    "created_at": "2026-11-10T05:23:01.943Z"
  }
];

export const defaultReviews = [
  {
    "id": "rev_01h7x8review000000000001",
    "order_id": "ord_01h7x8live9901",
    "buyer_name": "서초*랑",
    "product_rating": 5,
    "delivery_rating": 5,
    "content": "기름이 진짜 깨끗한 게 느껴져요. 튀김옷이 바삭하고 현미향이 고소해서 부모님도 맛있게 드셨습니다. 배달도 25분 만에 총알같이 왔네요!",
    "menu_summary": "현미바삭치킨 (순살 변경, 청양마요)",
    "owner_reply": "정성스런 리뷰 감사드립니다 고객님! 깨끗한 기름 원칙을 지키며 항상 바삭하게 튀겨내겠습니다. 행복한 하루 되세요!",
    "owner_replied_at": "2026-11-09T00:07:41.673Z",
    "created_at": "2026-11-08T22:07:41.673Z"
  },
  {
    "id": "rev_01h7x8review000000000002",
    "order_id": "ord_01h7x8live9902",
    "buyer_name": "반포*식가",
    "product_rating": 4,
    "delivery_rating": 5,
    "content": "대새레드치킨 랍스터새우 실하고 양념도 맛있게 매워요. 다만 맵기 보통맛인데도 생각보다 매워서 매운 거 못 드시는 분은 순한맛 추천합니다.",
    "menu_summary": "대새레드치킨, 크림치즈볼 (5개)",
    "owner_reply": null,
    "owner_replied_at": null,
    "created_at": "2026-11-09T19:07:41.673Z"
  },
  {
    "id": "rev_01h7x8review000000000003",
    "order_id": "ord_01h7x8live9903",
    "buyer_name": "치킨*러버",
    "product_rating": 5,
    "delivery_rating": 4,
    "content": "반반치킨 정석입니다. 후라이드는 바삭하고 양념은 너무 달지 않아서 좋아요. 치즈볼도 따뜻하게 왔습니다. 단골 예약입니다.",
    "menu_summary": "바른 반반치킨",
    "owner_reply": "단골 예약이라니 너무 힘이 납니다 고객님! 늘 처음처럼 깨끗하고 맛있는 치킨으로 보답하겠습니다. 감사합니다!",
    "owner_replied_at": "2026-11-09T22:07:41.673Z",
    "created_at": "2026-11-09T21:07:41.673Z"
  }
];
