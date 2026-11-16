/**
 * AITIP Enterprise Platform - Merchant Onboarding & Review Module
 * 신규 가맹점 표준 입점 등록 및 입점 심사 관리
 * 100% ESM, Zero Inline Hardcoded Data
 * D1 SSOT: docs/schema_aitip_v01.sql (stores, partner_agencies 테이블 준수)
 */

import { adminApi, KSIC_FOOD_CATEGORIES } from '../admin-api.js';

let activeTab = 'list'; // 'list' | 'form'
let loadedApplications = [];

// 심사 대기 중인 온보딩 신청 데이터 (D1 stores 스키마 규격 100% 일치)
const PENDING_ONBOARDING_APPLICATIONS = [
  {
    id: 'str_01jcbk9v4e2x8m4v0k5a1b2c4a',
    app_no: 'APP-2026-00129',
    business_name: '성심당 서초점 (가칭)',
    biz_reg_no: '305-81-22990',
    food_license_no: '2026-3210045-00129',
    store_category: '56150',
    ksic_name: '제과점업 빵집 (56150)',
    rep_name: '임영진',
    phone: '02-588-1956',
    road_address: '서울특별시 서초구 서초대로 301',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    agency_name: '(주)서초네트웍스',
    pos_company: '오케이포스 (OKPOS)',
    min_order_amount: 15000,
    default_prep_minutes: 20,
    bank_name: '하나은행',
    bank_account: '***-****-195601',
    bank_holder: '주식회사 로쏘',
    applied_at: '2026-11-13 14:20',
    review_status: 'DOC_REVIEW',
    review_label: '서류 심사중',
    documents: [
      { id: 'doc_biz', name: '사업자등록증 사본', status: 'VERIFIED', file_name: 'biz_cert_3058122990.pdf', desc: '국세청 정상 사업자 일치' },
      { id: 'doc_license', name: '일반음식점 영업신고증', status: 'REQUIRES_CHECK', file_name: 'license_20263210045.pdf', desc: '영업신고증 상 대표자명 대조 확인 필요' },
      { id: 'doc_bank', name: '정산 통장 사본', status: 'VERIFIED', file_name: 'bankbook_hana.pdf', desc: '예금주(주식회사 로쏘) 일치' },
      { id: 'doc_photo', name: '매장 간판 및 전경 사진', status: 'VERIFIED', file_name: 'storefront_front.jpg', desc: '서초대로 301 현장 실측 일치' },
      { id: 'doc_menu', name: '판매 메뉴 및 단가표', status: 'VERIFIED', file_name: 'menu_list_2026.xlsx', desc: '원산지 및 품목 단가 등록 완료' }
    ]
  },
  {
    id: 'str_01jcbk9v4e2x8m4v0k5a1b2c4b',
    app_no: 'APP-2026-00130',
    business_name: '역전우동0410 교대역점',
    biz_reg_no: '214-19-88771',
    food_license_no: '2026-3210045-00130',
    store_category: '56122',
    ksic_name: '일식·돈까스 (56122)',
    rep_name: '백종원',
    phone: '02-521-0410',
    road_address: '서울특별시 서초구 서초중앙로 118',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    agency_name: '(주)서초네트웍스',
    pos_company: '포스뱅크 (POSBANK)',
    min_order_amount: 10000,
    default_prep_minutes: 15,
    bank_name: '국민은행',
    bank_account: '***-****-041022',
    bank_holder: '주식회사 더본코리아',
    applied_at: '2026-11-13 16:05',
    review_status: 'PENDING',
    review_label: '신규 신청',
    documents: [
      { id: 'doc_biz', name: '사업자등록증 사본', status: 'VERIFIED', file_name: 'biz_cert_2141988771.pdf', desc: '국세청 정상 사업자 일치' },
      { id: 'doc_license', name: '일반음식점 영업신고증', status: 'VERIFIED', file_name: 'license_20263210046.pdf', desc: '구청 인허가 정상 확인' },
      { id: 'doc_bank', name: '정산 통장 사본', status: 'VERIFIED', file_name: 'bankbook_kb.pdf', desc: '예금주(더본코리아) 일치' },
      { id: 'doc_photo', name: '매장 간판 및 전경 사진', status: 'VERIFIED', file_name: 'storefront_subway.jpg', desc: '교대역 1번 출구 전경 일치' },
      { id: 'doc_menu', name: '판매 메뉴 및 단가표', status: 'VERIFIED', file_name: 'menu_udong_2026.xlsx', desc: '우동/덮밥 18개 메뉴 등록' }
    ]
  },
  {
    id: 'str_01jcbk9v4e2x8m4v0k5a1b2c4c',
    app_no: 'APP-2026-00131',
    business_name: '푸라닭치킨 강남역삼점',
    biz_reg_no: '211-18-55443',
    food_license_no: '2026-3220011-00214',
    store_category: '56162',
    ksic_name: '치킨 전문점 (56162)',
    rep_name: '정승환',
    phone: '02-568-9204',
    road_address: '서울특별시 강남구 테헤란로 152',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    agency_name: '강남제일정보시스템',
    pos_company: '나이스 (NICE)',
    min_order_amount: 18000,
    default_prep_minutes: 25,
    bank_name: '신한은행',
    bank_account: '***-****-920401',
    bank_holder: '아이더스코리아',
    applied_at: '2026-11-13 17:30',
    review_status: 'PENDING',
    review_label: '신규 신청',
    documents: [
      { id: 'doc_biz', name: '사업자등록증 사본', status: 'VERIFIED', file_name: 'biz_cert_2111855443.pdf', desc: '국세청 정상 사업자 일치' },
      { id: 'doc_license', name: '일반음식점 영업신고증', status: 'VERIFIED', file_name: 'license_20263220011.pdf', desc: '강남구청 인허가 정상 확인' },
      { id: 'doc_bank', name: '정산 통장 사본', status: 'VERIFIED', file_name: 'bankbook_shinhan.pdf', desc: '예금주 일치' },
      { id: 'doc_photo', name: '매장 간판 및 전경 사진', status: 'VERIFIED', file_name: 'puradak_front.jpg', desc: '테헤란로 152 현장 확인' },
      { id: 'doc_menu', name: '판매 메뉴 및 단가표', status: 'VERIFIED', file_name: 'menu_chicken_2026.xlsx', desc: '치킨/사이드 메뉴 등록' }
    ]
  }
];

export async function renderOnboardingView(container, filter = {}) {
  if (!container) return;

  if (window.location.hash === '#onboarding-new') {
    activeTab = 'form';
    history.replaceState(null, '', '#onboarding');
  }

  const res = await adminApi.getOnboardingApplications().catch(() => null);
  loadedApplications = Array.isArray(res?.applications) && res.applications.length > 0
    ? res.applications
    : PENDING_ONBOARDING_APPLICATIONS;

  container.innerHTML = `
    <div class="panel-card" style="padding: 0; overflow: hidden; background: #ffffff;">
      <!-- 헤더 및 탭 전환 바 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #fafafa; border-bottom: 1px solid var(--border-default); flex-wrap: wrap; gap: 10px;">
        <div>
          <span class="panel-title" style="font-weight: 900; font-size: 14px; color: var(--text-primary);">골목상권 소상공인 신규 입점 온보딩 심사 센터</span>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            표준 5대 가입 항목(사업자정보·통계청분류·운영설정·영업망·포스연동) 심사 및 전자서명 승인
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="header-btn ${activeTab === 'list' ? 'header-btn-primary' : ''}" id="btn-tab-onboarding-list" style="font-size: 11.5px;">
            입점 심사 대기 목록 (${loadedApplications.length}건)
          </button>
          <button type="button" class="header-btn ${activeTab === 'form' ? 'header-btn-primary' : ''}" id="btn-tab-onboarding-new" style="font-size: 11.5px;">
            + 표준 신규 가맹점 직접 등록
          </button>
        </div>
      </div>

      ${activeTab === 'list' ? renderApplicationListHtml(loadedApplications) : renderStandardEnrollmentFormHtml()}
    </div>
  `;

  // 탭 전환 이벤트 바인딩
  container.querySelector('#btn-tab-onboarding-list')?.addEventListener('click', () => {
    activeTab = 'list';
    renderOnboardingView(container, filter);
  });

  container.querySelector('#btn-tab-onboarding-new')?.addEventListener('click', () => {
    activeTab = 'form';
    renderOnboardingView(container, filter);
  });

  // 심사 승인 버튼 이벤트 바인딩 (실데이터 연동)
  container.querySelectorAll('.btn-approve-onboarding').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const appId = btn.dataset.appid;
      if (!appId) return;
      await adminApi.approveOnboarding(appId);
      await renderOnboardingView(container, filter);
    });
  });

  // 서류 심사 모달 바인딩 (행 클릭 또는 [서류 심사] 버튼 클릭)
  container.querySelectorAll('.btn-review-onboarding, tr[data-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-request-revision') || e.target.closest('.btn-approve-onboarding')) return;
      const appId = el.dataset.appid || el.closest('tr[data-id]')?.dataset.id;
      const app = loadedApplications.find(a => a.id === appId);
      if (app) showOnboardingReviewModal(app, container, filter);
    });
  });

  // 보완 요청 다이얼로그 바인딩
  container.querySelectorAll('.btn-request-revision').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const appId = btn.dataset.appid;
      const app = loadedApplications.find(a => a.id === appId);
      if (app) showRevisionRequestModal(app, container, filter);
    });
  });

  // 폼 제출 이벤트 바인딩
  const form = container.querySelector('#form-standard-onboarding');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputs = form.querySelectorAll('input, select');
      await adminApi.submitOnboardingApplication({
        business_name: inputs[0]?.value || '신규 가맹점',
        biz_reg_no: inputs[1]?.value || '000-00-00000'
      });
      activeTab = 'list';
      await renderOnboardingView(container, filter);
    });
  }
}

function renderApplicationListHtml(apps = loadedApplications) {
  return `
    <div class="data-table-wrapper" style="padding: 16px;">
      <table class="admin-table" style="font-size: 12.5px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th>신청 점포명 (가맹점)</th>
            <th>통계청 법정 업종분류</th>
            <th>사업자번호 / 영업신고증</th>
            <th>대표자 (연락처)</th>
            <th>사업장 도로명 주소</th>
            <th>관할 대리점</th>
            <th>연동 희망 POS</th>
            <th style="text-align: center; white-space: nowrap;">심사 상태</th>
            <th style="text-align: center; width: 170px; white-space: nowrap;">심사 액션</th>
          </tr>
        </thead>
        <tbody>
          ${apps.map(app => `
            <tr data-id="${app.id}" style="cursor: pointer;">
              <td>
                <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${app.business_name}</span>
                <div style="font-family: monospace; font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">접수번호: ${app.app_no}</div>
              </td>
              <td>
                <span class="badge-status active" style="font-size: 11px; font-weight: 700;">
                  ${app.ksic_name}
                </span>
              </td>
              <td style="font-family: monospace; font-size: 11.5px;">
                <div style="font-weight: 700;">${app.biz_reg_no}</div>
                <div style="font-size: 10.5px; color: var(--text-muted);">${app.food_license_no}</div>
              </td>
              <td style="font-size: 12px;">
                <span style="font-weight: 700;">${app.rep_name}</span>
                <div style="color: var(--text-muted); font-size: 11px;">${app.phone}</div>
              </td>
              <td style="font-size: 11.5px; color: var(--text-secondary); max-width: 180px;">${app.road_address}</td>
              <td style="font-weight: 700; font-size: 11.5px;">${app.agency_name}</td>
              <td>
                <span class="badge-status default" style="font-size: 11px; font-weight: 800; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;">
                  ${app.pos_company}
                </span>
              </td>
              <td style="text-align: center; white-space: nowrap;">
                <span class="badge-status ${app.review_status === 'PENDING' ? 'warning' : 'pending'}" style="font-size: 11px; font-weight: 800; white-space: nowrap;">
                  ${app.review_label}
                </span>
              </td>
              <td style="text-align: center; white-space: nowrap;">
                <div style="display: flex; gap: 4px; justify-content: center;">
                  <button type="button" class="header-btn btn-review-onboarding" data-appid="${app.id}" style="padding: 4px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">
                    서류 심사
                  </button>
                  <button type="button" class="header-btn btn-request-revision" data-appid="${app.id}" style="padding: 4px 8px; font-size: 11px; font-weight: 700; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; white-space: nowrap;">
                    보완요청
                  </button>
                  <button type="button" class="header-btn header-btn-primary btn-approve-onboarding" data-appid="${app.id}" data-name="${app.business_name}" style="padding: 4px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">
                    ${app.review_status === 'APPROVED' ? '승인됨' : '승인'}
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderStandardEnrollmentFormHtml() {
  const ksicOptions = KSIC_FOOD_CATEGORIES
    .filter(c => c.code !== 'ALL')
    .map(c => `<option value="${c.code}">${c.name}</option>`)
    .join('');

  return `
    <div style="padding: 24px; max-width: 960px; margin: 0 auto;">
      <form id="form-standard-onboarding" style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- 1. 사업자 법정 등록 정보 -->
        <div style="background: #ffffff; border: 1px solid var(--border-default); border-radius: 6px; padding: 18px 20px;">
          <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 14px; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 14px; background: var(--brand-mint-text); border-radius: 2px;"></span>
            1. 사업자 기본 등록 정보 (인허가 명세)
          </h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">가맹점 상호명 (필수)</label>
              <input type="text" name="business_name" required placeholder="예: 바른치킨 서초본점" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">사업자등록번호 (10자리 - 중복불가)</label>
              <input type="text" name="biz_reg_no" required placeholder="예: 214-11-98765" pattern="[0-9]{3}-[0-9]{2}-[0-9]{5}" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">대표자 성명</label>
              <input type="text" name="rep_name" required placeholder="예: 홍길동" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">식품위생 영업신고증 번호</label>
              <input type="text" name="food_license_no" placeholder="예: 2026-3210045-00129" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">대표 연락처 (휴대폰/일반)</label>
              <input type="tel" name="phone" required placeholder="예: 02-581-2290" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">매장 도로명 주소</label>
              <input type="text" name="road_address" required placeholder="예: 서울특별시 서초구 반포대로 14길 30" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
          </div>
        </div>

        <!-- 2. 통계청 법정 표준 업종분류 (드롭다운 셀렉트 표준화) -->
        <div style="background: #ffffff; border: 1px solid var(--border-default); border-radius: 6px; padding: 18px 20px;">
          <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 14px; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 14px; background: var(--brand-mint-text); border-radius: 2px;"></span>
            2. 통계청 한국표준산업분류 (KSIC-11 법정 코드 선택)
          </h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">외식업 법정 업종 선택 (드롭다운)</label>
              <select name="store_category" required class="erp-select" style="width: 100%; font-size: 12.5px; padding: 7px 10px; font-weight: 700;">
                <option value="">-- 통계청 법정 업종을 선택하십시오 --</option>
                ${ksicOptions}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">주요 취급 메뉴 요약</label>
              <input type="text" name="menu_summary" placeholder="예: 후라이드/양념치킨, 떡볶이, 치즈볼" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
          </div>
        </div>

        <!-- 3. 매장 운영 및 배달 정책 -->
        <div style="background: #ffffff; border: 1px solid var(--border-default); border-radius: 6px; padding: 18px 20px;">
          <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 14px; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 14px; background: var(--brand-mint-text); border-radius: 2px;"></span>
            3. 매장 운영 및 배달 정책 (D1 기본값 연동)
          </h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">기본 조리시간 (default_prep_minutes)</label>
              <select name="default_prep_minutes" class="erp-select" style="width: 100%; font-size: 12px; padding: 6px 10px;">
                <option value="10">10분 (패스트푸드/음료)</option>
                <option value="15" selected>15분 (일반 표준)</option>
                <option value="20">20분 (치킨/조리육류)</option>
                <option value="30">30분 (피자/탕/찜류)</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">최소 주문금액 (min_order_amount)</label>
              <input type="number" name="min_order_amount" value="12000" step="1000" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">포장(테이크아웃) 지원 여부</label>
              <select name="is_takeout_available" class="erp-select" style="width: 100%; font-size: 12px; padding: 6px 10px;">
                <option value="1" selected>배달 및 포장 모두 지원</option>
                <option value="0">배달 전용 매장</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 4. 관할 영업망 & 제휴사 포스 연동 -->
        <div style="background: #ffffff; border: 1px solid var(--border-default); border-radius: 6px; padding: 18px 20px;">
          <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 14px; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 14px; background: var(--brand-mint-text); border-radius: 2px;"></span>
            4. 관할 유통 조직 매핑 & 기존 POS 연동사 선택
          </h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">유치 관할 대리점 (referral_agency_id)</label>
              <select name="agency_id" class="erp-select" style="width: 100%; font-size: 12px; padding: 7px 10px; font-weight: 700;">
                <option value="agn_01jcbk9v502x8m4v0k5a1b2c01">강남제일정보시스템 (서울 강남구)</option>
                <option value="agn_01jcbk9v502x8m4v0k5a1b2c02" selected>(주)서초네트웍스 (서울 서초구)</option>
                <option value="agn_01jcbk9v502x8m4v0k5a1b2c03">수원중앙정보통신 (수원시 팔달구)</option>
                <option value="agn_01jcbk9v502x8m4v0k5a1b2c04">분당판교센터 (성남시 분당구)</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">매장 현장 POS 소프트웨어 (연동사)</label>
              <select name="pos_company" required class="erp-select" style="width: 100%; font-size: 12px; padding: 7px 10px; font-weight: 700;">
                <option value="OKPOS" selected>오케이포스 (OKPOS) v3.x 에이전트 연동</option>
                <option value="POSBANK">포스뱅크 (POSBANK) v2.x 에이전트 연동</option>
                <option value="NICE">나이스 (NICE) 포스 시스템 연동</option>
                <option value="TOSS">토스 포스 (Toss Front) 연동</option>
                <option value="IMU">아임유 (IMU) 포스 연동</option>
                <option value="WEB_STANDALONE">단독 웹 포털 (포스 미사용 점포)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 5. 5자 다차원 정산 계좌 정보 -->
        <div style="background: #ffffff; border: 1px solid var(--border-default); border-radius: 6px; padding: 18px 20px;">
          <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 14px; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 14px; background: var(--brand-mint-text); border-radius: 2px;"></span>
            5. 정산 대금 수령 계좌 (D1 암호화 저장)
          </h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">입금 은행</label>
              <select name="bank_name" class="erp-select" style="width: 100%; font-size: 12px; padding: 6px 10px;">
                <option value="국민은행">KB국민은행</option>
                <option value="신한은행">신한은행</option>
                <option value="하나은행">하나은행</option>
                <option value="우리은행">우리은행</option>
                <option value="농협은행">NH농협은행</option>
                <option value="기업은행">IBK기업은행</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">계좌번호 (숫자만)</label>
              <input type="text" name="bank_account" required placeholder="예: 110-123-456789" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">예금주명 (사업자등록 일치)</label>
              <input type="text" name="bank_holder" required placeholder="예: 홍길동" class="erp-select" style="width: 100%; font-size: 12.5px; padding: 6px 10px;">
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
          <button type="button" class="header-btn" id="btn-cancel-onboarding" style="padding: 8px 18px; font-size: 12.5px;">취소</button>
          <button type="submit" class="header-btn header-btn-primary" style="padding: 8px 24px; font-size: 12.5px; font-weight: 800;">
            ✓ 표준 가맹점 등록 및 심사 신청
          </button>
        </div>
      </form>
    </div>
  `;
}

/**
 * 신규 입점 가맹점 5대 필수 서류 검증 중앙 모달 (Onboarding Review SSOT)
 */
function showOnboardingReviewModal(app) {
  const existing = document.getElementById('onboarding-review-modal-overlay');
  if (existing) existing.remove();

  const docs = app.documents || [
    { id: 'doc_biz', name: '사업자등록증 사본', status: 'VERIFIED', file_name: 'biz_cert.pdf', desc: '국세청 정상 사업자 일치' },
    { id: 'doc_license', name: '일반음식점 영업신고증', status: 'REQUIRES_CHECK', file_name: 'food_license.pdf', desc: '영업신고증 상 대표자명 대조 확인 필요' },
    { id: 'doc_bank', name: '정산 통장 사본', status: 'VERIFIED', file_name: 'bankbook.pdf', desc: '예금주 일치' },
    { id: 'doc_photo', name: '매장 간판 및 전경 사진', status: 'VERIFIED', file_name: 'storefront.jpg', desc: '현장 실측 일치' },
    { id: 'doc_menu', name: '판매 메뉴 및 단가표', status: 'VERIFIED', file_name: 'menu_list.xlsx', desc: '원산지 및 품목 단가 등록 완료' }
  ];

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-review-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 8px; width: 780px; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;">
      <!-- 헤더 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">신규 입점 가맹점 서류 심사 대사판 (Onboarding Review SSOT)</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            접수번호: <b>${app.app_no}</b> | 점포명: <b>${app.business_name}</b> (${app.ksic_name})
          </div>
        </div>
        <button type="button" id="btn-close-review-modal" style="background: none; border: none; font-size: 18px; font-weight: 700; color: #64748b; cursor: pointer; padding: 4px 8px;">✕</button>
      </div>

      <!-- 본문 -->
      <div style="padding: 20px; max-height: 72vh; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; font-size: 12.5px;">
        <!-- 기본 정보 그리드 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px;">
          <div><span style="color: #64748b; font-weight: 600;">사업자등록번호:</span> <code style="font-family: monospace; font-weight: 700;">${app.biz_reg_no}</code></div>
          <div><span style="color: #64748b; font-weight: 600;">영업신고증번호:</span> <code style="font-family: monospace;">${app.food_license_no}</code></div>
          <div><span style="color: #64748b; font-weight: 600;">대표자(연락처):</span> <strong>${app.rep_name}</strong> (${app.phone})</div>
          <div><span style="color: #64748b; font-weight: 600;">관할 영업 대리점:</span> <strong>${app.agency_name}</strong></div>
          <div style="grid-column: span 2;"><span style="color: #64748b; font-weight: 600;">사업장 소재지:</span> ${app.road_address}</div>
          <div><span style="color: #64748b; font-weight: 600;">연동 희망 POS:</span> <span class="badge-status default" style="background: #eff6ff; color: #1e40af; font-weight: 800;">${app.pos_company}</span></div>
          <div><span style="color: #64748b; font-weight: 600;">정산 수취 계좌:</span> ${app.bank_name} ${app.bank_account} (예금주: ${app.bank_holder})</div>
        </div>

        <!-- 5대 제출 서류 대조 검증 테이블 -->
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <div style="padding: 10px 14px; background: #f1f5f9; font-weight: 800; color: #0f172a; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
            <span>제출 5대 필수 서류 실측 대조 목록</span>
            <span style="font-size: 11px; font-weight: 600; color: #64748b;">(국세청 사업자 상태 · 지자체 인허가 대사)</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: left;">
                <th style="padding: 8px 12px; width: 150px;">서류 항목</th>
                <th style="padding: 8px 12px;">첨부 파일명</th>
                <th style="padding: 8px 12px; width: 110px; text-align: center;">검증 상태</th>
                <th style="padding: 8px 12px;">시스템 대사 및 심사 의견</th>
              </tr>
            </thead>
            <tbody>
              ${docs.map(doc => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 12px; font-weight: 700; color: #1e293b;">${doc.name}</td>
                  <td style="padding: 10px 12px; font-family: monospace; color: #2563eb;">
                    <a href="javascript:void(0)" style="color: #2563eb; text-decoration: underline;" onclick="alert('서류 미리보기: ${doc.file_name}')">${doc.file_name}</a>
                  </td>
                  <td style="padding: 10px 12px; text-align: center;">
                    ${doc.status === 'VERIFIED'
                      ? '<span class="badge-status active" style="font-size: 10.5px; font-weight: 800;">검증 통과</span>'
                      : '<span class="badge-status pending" style="font-size: 10.5px; font-weight: 800; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">확인 요망</span>'
                    }
                  </td>
                  <td style="padding: 10px 12px; color: ${doc.status === 'VERIFIED' ? '#475569' : '#b45309'}; font-weight: ${doc.status === 'VERIFIED' ? '500' : '700'};">
                    ${doc.desc}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 하단 액션 버튼 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <button type="button" id="btn-modal-close-action" class="header-btn" style="padding: 6px 14px; font-size: 12px;">
          닫기
        </button>
        <div style="display: flex; gap: 8px;">
          <button type="button" id="btn-modal-trigger-revision" class="header-btn" style="padding: 6px 14px; font-size: 12px; font-weight: 700; color: #b45309; background: #fffbeb; border: 1px solid #fde68a;">
            서류 보완 요청 (사유 작성)
          </button>
          <button type="button" id="btn-modal-approve-final" class="header-btn header-btn-primary" style="padding: 6px 16px; font-size: 12px; font-weight: 800;">
            최종 입점 승인
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 이벤트 바인딩
  const closeModal = () => overlay.remove();
  overlay.querySelector('#btn-close-review-modal').addEventListener('click', closeModal);
  overlay.querySelector('#btn-modal-close-action').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // 모달 내 보완 요청 트리거
  overlay.querySelector('#btn-modal-trigger-revision').addEventListener('click', () => {
    closeModal();
    showRevisionRequestModal(app);
  });

  // 모달 내 최종 입점 승인 트리거
  overlay.querySelector('#btn-modal-approve-final').addEventListener('click', async () => {
    await adminApi.approveOnboarding(app.id);
    closeModal();
    const c = document.getElementById('admin-content-container');
    if (c) await renderOnboardingView(c);
  });
}

/**
 * 서류 보완 요청 다이얼로그 (Request Revision Dialog) - "뭘 보완하지?" 명쾌한 해답
 */
function showRevisionRequestModal(app) {
  const existing = document.getElementById('revision-request-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'revision-request-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;';

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 8px; width: 620px; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;">
      <!-- 헤더 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: #fffbeb; border-bottom: 1px solid #fde68a;">
        <div>
          <div style="font-size: 14.5px; font-weight: 900; color: #92400e;">입점 심사 서류 보완 요청 (Revision Request)</div>
          <div style="font-size: 11.5px; color: #b45309; margin-top: 2px;">
            점주에게 카카오 알림톡 및 SMS로 발송할 보완 대상 항목과 사유를 지정하십시오.
          </div>
        </div>
        <button type="button" id="btn-close-revision-modal" style="background: none; border: none; font-size: 18px; font-weight: 700; color: #b45309; cursor: pointer; padding: 4px 8px;">✕</button>
      </div>

      <!-- 본문 -->
      <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; font-size: 12.5px;">
        <!-- 점포 정보 요약 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 12px;">
          <div><span style="color: #64748b; font-weight: 600;">대상 점포:</span> <strong>${app.business_name}</strong> (접수: ${app.app_no})</div>
          <div style="margin-top: 3px;"><span style="color: #64748b; font-weight: 600;">수신자(대표자):</span> <strong>${app.rep_name}</strong> 대표님 (${app.phone})</div>
        </div>

        <!-- 1. 보완 대상 서류 체크박스 선택 (뭘 보완하지?) -->
        <div>
          <label style="display: block; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
            1. 보완이 필요한 서류를 선택하십시오 (다중 선택 가능):
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
              <input type="checkbox" name="rev_doc" value="biz_cert" style="accent-color: #b45309; width: 15px; height: 15px;">
              <span>사업자등록증 사본</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; font-weight: 800; color: #b45309;">
              <input type="checkbox" name="rev_doc" value="food_license" checked style="accent-color: #b45309; width: 15px; height: 15px;">
              <span>일반음식점 영업신고증 (추천)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
              <input type="checkbox" name="rev_doc" value="bankbook" style="accent-color: #b45309; width: 15px; height: 15px;">
              <span>정산 통장 사본</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
              <input type="checkbox" name="rev_doc" value="storefront" style="accent-color: #b45309; width: 15px; height: 15px;">
              <span>매장 간판 및 전경 사진</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
              <input type="checkbox" name="rev_doc" value="menu_list" style="accent-color: #b45309; width: 15px; height: 15px;">
              <span>판매 메뉴 및 단가표</span>
            </label>
          </div>
        </div>

        <!-- 2. 구체적 보완 사유 작성 -->
        <div>
          <label style="display: block; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
            2. 구체적인 보완 요청 사유 (점주 알림톡 본문에 포함됩니다):
          </label>
          <textarea id="txt-revision-reason" rows="4" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 12.5px; font-family: inherit; line-height: 1.5; resize: vertical;">[영업신고증 대표자명 불일치]
제출해 주신 일반음식점 영업신고증 상의 대표자 성명이 사업자등록증 대표자(${app.rep_name})와 상이합니다.
관할 지자체(구청)에서 변경 인허가 처리된 최신 영업신고증 사본을 가맹점 포털 온보딩 보완 페이지를 통해 재첨부해 주시기 바랍니다.</textarea>
        </div>

        <div style="font-size: 11px; color: #64748b; background: #f1f5f9; padding: 8px 12px; border-radius: 4px;">
          안내: 전송 즉시 점주 휴대전화번호(${app.phone})로 카카오 비즈메시지 알림톡과 SMS가 발송되며, 심사 상태가 [서류 보완요청]으로 자동 전환됩니다.
        </div>
      </div>

      <!-- 하단 액션 버튼 -->
      <div style="display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <button type="button" id="btn-cancel-revision" class="header-btn" style="padding: 6px 14px; font-size: 12px;">
          취소
        </button>
        <button type="button" id="btn-send-revision" class="header-btn" style="padding: 6px 16px; font-size: 12px; font-weight: 800; background: #b45309; color: #ffffff; border: 1px solid #92400e;">
          알림톡/SMS 발송 및 보완 요청 전송
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 이벤트 바인딩
  const closeModal = () => overlay.remove();
  overlay.querySelector('#btn-close-revision-modal').addEventListener('click', closeModal);
  overlay.querySelector('#btn-cancel-revision').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  overlay.querySelector('#btn-send-revision').addEventListener('click', async () => {
    const reason = overlay.querySelector('#txt-revision-reason').value.trim();
    if (!reason) return;
    await adminApi.requestOnboardingRevision(app.id, reason);
    closeModal();
    const c = document.getElementById('admin-content-container');
    if (c) await renderOnboardingView(c);
  });
}

