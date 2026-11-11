/**
 * ============================================================================
 * 대한민국 법정 공휴일 및 명절 캘린더 엔진 (Korean Holidays Engine)
 * O2O 배달 플랫폼 업계 표준: 점주가 날짜를 일일이 수동 타이핑하지 않도록
 * 국경일 자동 휴무 및 다가오는 설/추석 명절 원클릭 프리셋을 제공합니다.
 * ============================================================================
 */

// 2026 ~ 2027 대한민국 법정 공휴일 및 명절 데이터베이스
export const KOREAN_HOLIDAYS_DB = [
  // 2026년 법정 공휴일 및 명절
  { date: '2026-01-01', name: '신정 (새해 첫날)', type: 'NATIONAL' },
  { date: '2026-02-16', name: '설날 연휴 (전날)', type: 'MAJOR_SEOL', holiday_group: '2026_SEOL' },
  { date: '2026-02-17', name: '설날 당일', type: 'MAJOR_SEOL_MAIN', holiday_group: '2026_SEOL' },
  { date: '2026-02-18', name: '설날 연휴 (다음날)', type: 'MAJOR_SEOL', holiday_group: '2026_SEOL' },
  { date: '2026-03-01', name: '삼일절', type: 'NATIONAL' },
  { date: '2026-03-02', name: '삼일절 대체공휴일', type: 'SUBSTITUTE' },
  { date: '2026-05-05', name: '어린이날', type: 'NATIONAL' },
  { date: '2026-05-24', name: '부처님오신날', type: 'NATIONAL' },
  { date: '2026-05-25', name: '부처님오신날 대체공휴일', type: 'SUBSTITUTE' },
  { date: '2026-06-06', name: '현충일', type: 'NATIONAL' },
  { date: '2026-08-15', name: '광복절', type: 'NATIONAL' },
  { date: '2026-08-17', name: '광복절 대체공휴일', type: 'SUBSTITUTE' },
  { date: '2026-09-24', name: '추석 연휴 (전날)', type: 'MAJOR_CHUSEOK', holiday_group: '2026_CHUSEOK' },
  { date: '2026-09-25', name: '추석 당일', type: 'MAJOR_CHUSEOK_MAIN', holiday_group: '2026_CHUSEOK' },
  { date: '2026-09-26', name: '추석 연휴 (다음날)', type: 'MAJOR_CHUSEOK', holiday_group: '2026_CHUSEOK' },
  { date: '2026-10-03', name: '개천절', type: 'NATIONAL' },
  { date: '2026-10-05', name: '개천절 대체공휴일', type: 'SUBSTITUTE' },
  { date: '2026-10-09', name: '한글날', type: 'NATIONAL' },
  { date: '2026-12-25', name: '성탄절', type: 'NATIONAL' },

  // 2027년 주요 명절 (미리 준비)
  { date: '2027-01-01', name: '신정 (새해 첫날)', type: 'NATIONAL' },
  { date: '2027-02-06', name: '설날 연휴 (전날)', type: 'MAJOR_SEOL', holiday_group: '2027_SEOL' },
  { date: '2027-02-07', name: '설날 당일', type: 'MAJOR_SEOL_MAIN', holiday_group: '2027_SEOL' },
  { date: '2027-02-08', name: '설날 연휴 (다음날)', type: 'MAJOR_SEOL', holiday_group: '2027_SEOL' },
  { date: '2027-09-14', name: '추석 연휴 (전날)', type: 'MAJOR_CHUSEOK', holiday_group: '2027_CHUSEOK' },
  { date: '2027-09-15', name: '추석 당일', type: 'MAJOR_CHUSEOK_MAIN', holiday_group: '2027_CHUSEOK' },
  { date: '2027-09-16', name: '추석 연휴 (다음날)', type: 'MAJOR_CHUSEOK', holiday_group: '2027_CHUSEOK' }
];

/**
 * 특정 날짜가 법정 공휴일인지 확인
 */
export function isNationalHoliday(dateStr) {
  return KOREAN_HOLIDAYS_DB.some(h => h.date === dateStr);
}

/**
 * 기준일 이후 다가오는 대표 명절(설날 또는 추석) 정보 및 원클릭 프리셋 생성
 * @param {string} [baseDateStr] 기준일(기본: 오늘 날짜)
 */
export function getUpcomingMajorHoliday(baseDateStr = null) {
  const today = baseDateStr ? new Date(baseDateStr) : new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // 다가오는 명절 그룹 검색
  const majorGroups = [
    {
      id: '2026_CHUSEOK',
      name: '2026년 추석 명절 연휴',
      mainDate: '2026-09-25',
      startDate: '2026-09-24',
      endDate: '2026-09-26',
      defaultNotice: '풍성한 한가위 명절 보내세요. 9월 27일부터 정상 영업합니다.'
    },
    {
      id: '2027_SEOL',
      name: '2027년 설날 명절 연휴',
      mainDate: '2027-02-07',
      startDate: '2027-02-06',
      endDate: '2027-02-08',
      defaultNotice: '새해 복 많이 받으세요. 2월 9일부터 정상 영업합니다.'
    },
    {
      id: '2027_CHUSEOK',
      name: '2027년 추석 명절 연휴',
      mainDate: '2027-09-15',
      startDate: '2027-09-14',
      endDate: '2027-09-16',
      defaultNotice: '풍성한 한가위 명절 보내세요. 9월 17일부터 정상 영업합니다.'
    }
  ];

  // 오늘 이후거나 오늘 진행 중인 가장 가까운 명절
  const upcoming = majorGroups.find(g => g.endDate >= todayIso) || majorGroups[0];

  return {
    group_id: upcoming.id,
    holiday_name: upcoming.name,
    start_date: upcoming.startDate,
    end_date: upcoming.endDate,
    main_date: upcoming.mainDate,
    default_notice: upcoming.defaultNotice,
    // 원클릭 프리셋 3가지
    presets: [
      {
        mode: 'MAIN_ONLY',
        label: `${upcoming.name.includes('추석') ? '추석' : '설날'} 당일만 휴무`,
        start_date: upcoming.mainDate,
        end_date: upcoming.mainDate,
        notice: `명절 당일(${upcoming.mainDate}) 하루 쉬어갑니다.`
      },
      {
        mode: 'ALL_DAYS',
        label: `명절 연휴 전체(${upcoming.startDate.slice(5)}~${upcoming.endDate.slice(5)}) 휴무`,
        start_date: upcoming.startDate,
        end_date: upcoming.endDate,
        notice: upcoming.defaultNotice
      },
      {
        mode: 'NORMAL_OPEN',
        label: '명절 정상 영업 (휴무 없음)',
        start_date: null,
        end_date: null,
        notice: '명절 연휴에도 맛있는 치킨으로 정상 영업합니다!'
      }
    ]
  };
}
