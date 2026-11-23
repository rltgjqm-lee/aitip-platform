/**
 * 마트 표준 3단계 상품분류 마스터 (대분류 > 중분류 > 소분류) (ESM)
 * POS 대/중/소 코드 및 과면세/운영구분 기본값 연계
 */

export const MART_CATEGORIES = [
  {
    code: '01',
    name: '농산',
    default_category_type: 'FRESH',
    default_tax_type: 'EXEMPT',
    children: [
      {
        code: '0101',
        name: '과일',
        children: [
          { code: '010101', name: '사과 · 배' },
          { code: '010102', name: '감귤 · 만감류' },
          { code: '010103', name: '포도 · 거봉 · 샤인' },
          { code: '010104', name: '딸기 · 토마토 · 수박' },
          { code: '010105', name: '수입과일 (바나나·오렌지·키위)' },
          { code: '010106', name: '견과 · 밤 · 대추' }
        ]
      },
      {
        code: '0102',
        name: '채소',
        children: [
          { code: '010201', name: '엽채류 (상추·시금치·배추)' },
          { code: '010202', name: '근채류 (당근·무·감자·고구마)' },
          { code: '010203', name: '양념채소 (양파·마늘·대파·고추)' },
          { code: '010204', name: '버섯 · 나물류' },
          { code: '010205', name: '과채류 (오이·호박·가지·파프리카)' }
        ]
      },
      {
        code: '0103',
        name: '양곡 · 잡곡',
        children: [
          { code: '010301', name: '백미 · 현미' },
          { code: '010302', name: '잡곡 · 콩 · 보리' }
        ]
      }
    ]
  },
  {
    code: '02',
    name: '축산',
    default_category_type: 'FRESH',
    default_tax_type: 'EXEMPT',
    children: [
      {
        code: '0201',
        name: '한돈 · 돼지고기',
        children: [
          { code: '020101', name: '삼겹살 · 목살' },
          { code: '020102', name: '앞다리 · 뒷다리 · 찌개용' },
          { code: '020103', name: '갈비 · 등갈비 · 특수부위' }
        ]
      },
      {
        code: '0202',
        name: '한우 · 소고기',
        children: [
          { code: '020201', name: '등심 · 안심 · 채끝' },
          { code: '020202', name: '국거리 · 불고기용' },
          { code: '020203', name: '사골 · 양지 · 차돌 · 국물용' }
        ]
      },
      {
        code: '0203',
        name: '계육 · 계란',
        children: [
          { code: '020301', name: '생닭 · 백숙 · 닭볶음탕' },
          { code: '020302', name: '일반란 · 유정란 · 메추리알' },
          { code: '020303', name: '닭가슴살 · 닭다리 · 부분육' }
        ]
      },
      {
        code: '0204',
        name: '오리 · 특수육',
        children: [
          { code: '020401', name: '생오리 · 오리로스 · 주물럭' },
          { code: '020402', name: '훈제오리 · 슬라이스' },
          { code: '020403', name: '양고기 · 염소 · 기타 특수육' }
        ]
      },
      {
        code: '0205',
        name: '수입육 · 양념육',
        children: [
          { code: '020501', name: '수입 소고기 (미국·호주산)' },
          { code: '020502', name: '수입 돼지고기' },
          { code: '020503', name: '양념갈비 · 양념불고기 · 제육' }
        ]
      }
    ]
  },
  {
    code: '03',
    name: '수산',
    default_category_type: 'FRESH',
    default_tax_type: 'EXEMPT',
    children: [
      {
        code: '0301',
        name: '선어 · 생선',
        children: [
          { code: '030101', name: '고등어 · 갈치 · 삼치' },
          { code: '030102', name: '굴비 · 조기 · 동태' }
        ]
      },
      {
        code: '0302',
        name: '갑각 · 패류 · 연체',
        children: [
          { code: '030201', name: '오징어 · 낙지 · 문어' },
          { code: '030202', name: '새우 · 꽃게 · 조개류' },
          { code: '030203', name: '전복 · 굴 · 멍게 · 패류' }
        ]
      },
      {
        code: '0303',
        name: '건어물 · 해조 · 수산가공',
        children: [
          { code: '030301', name: '김 · 미역 · 다시마' },
          { code: '030302', name: '멸치 · 황태 · 오징어채' },
          { code: '030303', name: '회 · 초밥 · 젓갈류' }
        ]
      }
    ]
  },
  {
    code: '04',
    name: '가공식품',
    default_category_type: 'B2B_INDUSTRIAL',
    default_tax_type: 'TAXABLE',
    children: [
      {
        code: '0401',
        name: '라면 · 면류',
        children: [
          { code: '040101', name: '봉지라면 · 멀티팩' },
          { code: '040102', name: '컵라면 · 용기면' },
          { code: '040103', name: '국수 · 당면 · 파스타' }
        ]
      },
      {
        code: '0402',
        name: '과자 · 스낵 · 빵',
        children: [
          { code: '040201', name: '스낵 · 봉지과자' },
          { code: '040202', name: '비스킷 · 초콜릿 · 캔디' }
        ]
      },
      {
        code: '0403',
        name: '장류 · 조미료 · 소스',
        children: [
          { code: '040301', name: '고추장 · 된장 · 간장' },
          { code: '040302', name: '설탕 · 소금 · 식용유 · 참기름' },
          { code: '040303', name: '식초 · 케찹 · 마요네즈 · 소스' }
        ]
      },
      {
        code: '0404',
        name: '음료 · 생수 · 커피',
        children: [
          { code: '040401', name: '생수 · 탄산수 · 탄산음료' },
          { code: '040402', name: '커피 · 차 · 주스' }
        ]
      },
      {
        code: '0405',
        name: '통조림 · 즉석밥 · 간편식',
        children: [
          { code: '040501', name: '참치 · 스팸 · 통조림' },
          { code: '040502', name: '즉석밥 · 컵밥 · 카레 · 짜장' },
          { code: '040503', name: '시리얼 · 잼 · 견과바' }
        ]
      }
    ]
  },
  {
    code: '05',
    name: '냉장·냉동·유제품',
    default_category_type: 'B2B_INDUSTRIAL',
    default_tax_type: 'TAXABLE',
    children: [
      {
        code: '0501',
        name: '우유 · 유제품',
        children: [
          { code: '050101', name: '흰우유 · 가공유' },
          { code: '050102', name: '요구르트 · 치즈 · 버터' }
        ]
      },
      {
        code: '0502',
        name: '두부 · 콩나물 · 어묵',
        children: [
          { code: '050201', name: '찌개 · 부침두부' },
          { code: '050202', name: '어묵 · 맛살 · 햄' }
        ]
      },
      {
        code: '0503',
        name: '냉동간편식 · 밀키트 · 김치',
        children: [
          { code: '050301', name: '만두 · 돈까스 · 볶음밥' },
          { code: '050302', name: '포기김치 · 반찬류' },
          { code: '050303', name: '냉장 · 냉동 밀키트 · 국탕류' },
          { code: '050304', name: '아이스크림 · 빙과' }
        ]
      }
    ]
  },
  {
    code: '06',
    name: '생활·비식품',
    default_category_type: 'B2B_INDUSTRIAL',
    default_tax_type: 'TAXABLE',
    children: [
      {
        code: '0601',
        name: '세제 · 위생 · 헤어바디',
        children: [
          { code: '060101', name: '세탁세제 · 섬유유연제' },
          { code: '060102', name: '주방세제 · 샴푸 · 치약 · 바디' }
        ]
      },
      {
        code: '0602',
        name: '화장지 · 주방 · 생활잡화',
        children: [
          { code: '060201', name: '롤화장지 · 물티슈 · 키친타올' },
          { code: '060202', name: '위생백 · 일회용품' },
          { code: '060203', name: '프라이팬 · 냄비 · 조리도구' },
          { code: '060204', name: '반려동물 사료 · 간식' }
        ]
      }
    ]
  }
];

export function getL1List() {
  return MART_CATEGORIES;
}

export function getL2List(l1Code) {
  const l1 = MART_CATEGORIES.find(c => c.code === l1Code);
  return l1 ? l1.children : [];
}

export function getL3List(l1Code, l2Code) {
  const l2 = getL2List(l1Code).find(c => c.code === l2Code);
  return l2 ? l2.children : [];
}

export function buildCategoryPath(l1Code, l2Code, l3Code) {
  const l1 = MART_CATEGORIES.find(c => c.code === l1Code);
  if (!l1) return '';
  const l2 = l1.children.find(c => c.code === l2Code);
  if (!l2) return l1.name;
  const l3 = l2.children.find(c => c.code === l3Code);
  return l3 ? `${l1.name} > ${l2.name} > ${l3.name}` : `${l1.name} > ${l2.name}`;
}

export function inferCategoryFromProduct(p = {}) {
  if (p.category_l1) {
    return {
      l1: p.category_l1,
      l2: p.category_l2 || '',
      l3: p.category_l3 || '',
      path: p.category_path && p.category_path !== '-' ? p.category_path : buildCategoryPath(p.category_l1, p.category_l2, p.category_l3)
    };
  }
  const text = `${p.name || ''} ${p.category_path || ''}`.toLowerCase();
  if (/훈제오리|오리/.test(text)) return { l1: '02', l2: '0204', l3: /훈제/.test(text) ? '020402' : '020401', path: /훈제/.test(text) ? '축산 > 오리 · 특수육 > 훈제오리 · 슬라이스' : '축산 > 오리 · 특수육 > 생오리 · 오리로스 · 주물럭' };
  if (/양념갈비|양념불고기|제육/.test(text)) return { l1: '02', l2: '0205', l3: '020503', path: '축산 > 수입육 · 양념육 > 양념갈비 · 양념불고기 · 제육' };
  if (/계란|달걀|유정란|메추리알/.test(text)) return { l1: '02', l2: '0203', l3: '020302', path: '축산 > 계육 · 계란 > 일반란 · 유정란 · 메추리알' };
  if (/생닭|닭볶음탕|닭가슴살|닭다리|백숙/.test(text)) return { l1: '02', l2: '0203', l3: '020301', path: '축산 > 계육 · 계란 > 생닭 · 백숙 · 닭볶음탕' };
  if (/삼겹|목살|돼지|한돈/.test(text)) return { l1: '02', l2: '0201', l3: '020101', path: '축산 > 한돈 · 돼지고기 > 삼겹살 · 목살' };
  if (/한우|소고기|등심/.test(text)) return { l1: '02', l2: '0202', l3: '020201', path: '축산 > 한우 · 소고기 > 등심 · 안심 · 채끝' };
  if (/거봉|포도|사과|배|감귤|딸기/.test(text)) return { l1: '01', l2: '0101', l3: '010103', path: '농산 > 과일 > 포도 · 거봉 · 샤인' };
  if (/양파|마늘|대파|고추|양념채소/.test(text)) return { l1: '01', l2: '0102', l3: '010203', path: '농산 > 채소 > 양념채소 (양파·마늘·대파·고추)' };
  if (/당근|감자|무|고구마/.test(text)) return { l1: '01', l2: '0102', l3: '010202', path: '농산 > 채소 > 근채류 (당근·무·감자·고구마)' };
  if (/밀키트|국탕/.test(text)) return { l1: '05', l2: '0503', l3: '050303', path: '냉장·냉동·유제품 > 냉장간편식 · 밀키트 · 김치 > 냉장 · 냉동 밀키트 · 국탕류' };
  if (/만두|돈까스/.test(text)) return { l1: '05', l2: '0503', l3: '050301', path: '냉장·냉동·유제품 > 냉장간편식 · 밀키트 · 김치 > 만두 · 돈까스 · 볶음밥' };
  if (/우유|요구르트|치즈/.test(text)) return { l1: '05', l2: '0501', l3: /우유/.test(text) ? '050101' : '050102', path: '냉장·냉동·유제품 > 우유 · 유제품' };
  if (/참치|스팸|햇반|컵밥|카레/.test(text)) return { l1: '04', l2: '0405', l3: /참치|스팸/.test(text) ? '040501' : '040502', path: '가공식품 > 통조림 · 즉석밥 · 간편식' };
  if (/라면|신라면|진라면/.test(text)) return { l1: '04', l2: '0401', l3: '040101', path: '가공식품 > 라면 · 면류 > 봉지라면 · 멀티팩' };
  if (/스낵|새우깡|양파링|과자/.test(text)) return { l1: '04', l2: '0402', l3: '040201', path: '가공식품 > 과자 · 스낵 · 빵 > 스낵 · 봉지과자' };
  if (/설탕|고추장|된장|간장/.test(text)) return { l1: '04', l2: '0403', l3: '040302', path: '가공식품 > 장류 · 조미료 · 소스 > 설탕 · 소금 · 식용유 · 참기름' };
  if (p.category_type === 'FRESH') return { l1: '01', l2: '0102', l3: '', path: '농산 > 채소' };
  return { l1: '04', l2: '0401', l3: '', path: '가공식품 > 라면 · 면류' };
}
