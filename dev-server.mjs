import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foodService } from './packages/services/food-delivery/backend/food-service.mjs';
import { martService } from './packages/services/mart-logistics/backend/mart-service.mjs';
import { mqttBridge } from './packages/core/realtime/mqtt-bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8989;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Helper: JSON 요청 바디 파싱
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

const ADMIN_DATA_FILE = path.join(__dirname, 'packages', 'platform-admin', 'data', 'admin_data.json');

function saveAdminState() {
  if (!globalThis.__aitipAdminState) return;
  try {
    const s = globalThis.__aitipAdminState;
    const serializable = {
      ...s,
      blacklistedUids: Array.from(s.blacklistedUids || [])
    };
    fs.mkdirSync(path.dirname(ADMIN_DATA_FILE), { recursive: true });
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(serializable, null, 2), 'utf8');
  } catch (err) {
    console.warn('[AdminState Save Error]', err.message);
  }
}

function ensureAdminState() {
  if (!globalThis.__aitipAdminState) {
    let loaded = null;
    try {
      if (fs.existsSync(ADMIN_DATA_FILE)) {
        loaded = JSON.parse(fs.readFileSync(ADMIN_DATA_FILE, 'utf8'));
      }
    } catch (_) {
      loaded = null;
    }
    const defaults = {
      blacklistedUids: new Set(['cust_01jcb_abuse_991']),
      extraStores: [],
      onboardingApps: [
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
          business_name: '봉피양 양재직영점',
          biz_reg_no: '211-86-99102',
          food_license_no: '2026-3210045-00130',
          store_category: '56111',
          ksic_name: '한식 일반 음식점업 (56111)',
          rep_name: '박상민',
          phone: '02-572-8840',
          road_address: '서울특별시 서초구 강남대로 212',
          agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
          agency_name: '강남제일정보시스템',
          pos_company: '유니온포스',
          min_order_amount: 18000,
          default_prep_minutes: 25,
          bank_name: '신한은행',
          bank_account: '***-****-884012',
          bank_holder: '(주)봉피양',
          applied_at: '2026-11-15 10:05',
          review_status: 'READY_APPROVAL',
          review_label: '승인 대기',
          documents: [
            { id: 'doc_biz', name: '사업자등록증 사본', status: 'VERIFIED', file_name: 'biz_2118699102.pdf', desc: '정상 사업자' },
            { id: 'doc_license', name: '일반음식점 영업신고증', status: 'VERIFIED', file_name: 'lic_00130.pdf', desc: '정상 확인' },
            { id: 'doc_bank', name: '정산 통장 사본', status: 'VERIFIED', file_name: 'bank_shinhan.pdf', desc: '예금주 일치' }
          ]
        }
      ],
      csDisputes: [
        {
          dispute_id: 'dsp_20261116_01',
          order_id: 'ord_01m7gw30a5yayfxexxdbyayfxe',
          customer_uid: 'cust_01jcb_pwa_88412',
          reason_code: 'DELIVERY_DELAY',
          reason_label: '배달 지연(45분 초과)',
          requested_amount: 3000,
          refunded_amount: 0,
          status: 'OPEN',
          memo: '고객 PWA 문의함 접수 (PII 미저장, 안심번호 만료됨)',
          created_at: new Date().toISOString()
        }
      ],
      pointPolicy: {
        earn_rate_pct: 1.0,
        min_use_points: 1000,
        expiry_days: 365,
        require_hash_auth: true
      },
      pointLedger: [
        {
          tx_id: 'ptx_20261116_01',
          customer_uid: 'cust_01jcb_pwa_88412',
          order_id: 'ord_01m7gw30a5yayfxexxdbyayfxe',
          delta: 240,
          balance_after: 3240,
          type: 'EARN_ORDER',
          bearer: 'PLATFORM',
          memo: '실결제 1% 자동 적립',
          created_at: new Date().toISOString()
        },
        {
          tx_id: 'ptx_20261116_02',
          customer_uid: 'cust_01jcb_abuse_991',
          order_id: '',
          delta: -3000,
          balance_after: 0,
          type: 'REVOKE_ABUSE',
          bearer: 'PLATFORM',
          memo: '단기간 다중 기기 초기화 의심 회수',
          created_at: new Date().toISOString()
        }
      ],
      banners: [
        {
          id: 'bnr_01',
          title: '첫 주문 Zero-Pay 결제 시 2,000P 즉시 적립',
          target_app: 'CUSTOMER_PWA',
          placement: 'HOME_TOP',
          active: true,
          period: '2026-11-01 ~ 2026-11-30'
        },
        {
          id: 'bnr_02',
          title: '[공지] 개인정보 서버 미저장(Zero-PII) 안심 주문 정책 안내',
          target_app: 'CUSTOMER_PWA',
          placement: 'NOTICE_BAR',
          active: true,
          period: '상시 노출'
        }
      ],
      serviceModules: [
        { code: 'FOOD', name: '음식 배달/포장', active: true, active_stores: 1, fee_pct: 1.5 },
        { code: 'MART', name: '단위농협 하나로마트', active: true, active_stores: 1, fee_pct: 1.0 },
        { code: 'BEAUTY', name: '뷰티/미용 예약', active: false, active_stores: 0, fee_pct: 2.0 },
        { code: 'HOSPITAL', name: '병원/약국 접수', active: false, active_stores: 0, fee_pct: 0.0 },
        { code: 'STAY', name: '숙박/로컬 스테이', active: false, active_stores: 0, fee_pct: 2.5 }
      ],
      deliveryZones: [
        { zone_id: 'zn_seocho_01', sido: '서울특별시', sigungu: '서초구', dongs: '서초1~4동, 반포동', base_radius_km: 3.5, base_fee: 3000, active: true },
        { zone_id: 'zn_gangnam_01', sido: '서울특별시', sigungu: '강남구', dongs: '역삼1~2동, 논현동', base_radius_km: 3.0, base_fee: 3500, active: true }
      ],
      systemPolicies: {
        maintenance_mode: false,
        maintenance_notice: '시스템 정기 점검 중입니다. 잠시 후 다시 이용해 주세요.',
        pii_retention_hours_after_delivery: 24,
        alimtalk_ars_order_body: '[AITIP] #{store_name}입니다. 아래 버튼을 눌러 바로 메뉴를 보고 주문하실 수 있습니다.',
        alimtalk_ars_order_btn_label: '주문하기',
        alimtalk_ars_order_btn_url: 'https://aitip-platform.pages.dev/food/pwa/?storeId=#{store_id}',
        alimtalk_order_accept: '[AITIP] #{store_name}에서 주문을 접수했습니다. (예상 #{prep_min}분)',
        alimtalk_order_accept_btn_label: '실시간 주문 확인',
        alimtalk_order_accept_btn_url: 'https://aitip-platform.pages.dev/food/pwa/?trackOrderId=#{order_id}',
        alimtalk_delivery_done: '[AITIP] 배달이 완료되었습니다. 안심번호는 1시간 후 자동 파기됩니다.'
      },
      distributors: [
        {
          id: 'HQ_DIRECT',
          code: 'HQ-00',
          name: '본사 직영 (HQ Direct)',
          sido_code: '00',
          sido_name: '전국 직할',
          rep_name: '본사 운영본부',
          phone: '1588-0000',
          commission_rate: 0.0,
          is_direct: true,
          status: 'ACTIVE',
          agencies_count: 1,
          stores_count: 0,
          monthly_gmv: 0
        },
        {
          id: 'dst_01jcbk9v502x8m4v0k5a1b2c01',
          code: 'DST-11',
          name: '서울특별시 광역총판',
          sido_code: '11',
          sido_name: '서울특별시',
          rep_name: '김서울',
          phone: '02-500-1100',
          commission_rate: 0.3,
          is_direct: false,
          status: 'ACTIVE',
          agencies_count: 2,
          stores_count: 1,
          monthly_gmv: 634300
        }
      ],
      agencies: [
        {
          id: 'HQ_DIRECT_AGENCY',
          code: 'AGN-00-00',
          distributor_id: 'HQ_DIRECT',
          distributor_name: '본사 직영 (HQ Direct)',
          name: '본사 직영 관리팀',
          region: '전국 직영점',
          rep_name: '직영총괄',
          phone: '1588-0001',
          commission_rate: 0.0,
          is_direct: true,
          status: 'ACTIVE',
          stores_count: 0,
          monthly_gmv: 0
        },
        {
          id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
          code: 'AGN-11-01',
          distributor_id: 'dst_01jcbk9v502x8m4v0k5a1b2c01',
          distributor_name: '서울특별시 광역총판',
          name: '강남제일정보시스템',
          region: '서울 서초구·강남구',
          rep_name: '이강남',
          phone: '02-588-1001',
          commission_rate: 0.5,
          is_direct: false,
          status: 'ACTIVE',
          stores_count: 1,
          monthly_gmv: 634300
        },
        {
          id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
          code: 'AGN-11-02',
          distributor_id: 'dst_01jcbk9v502x8m4v0k5a1b2c01',
          distributor_name: '서울특별시 광역총판',
          name: '(주)서초네트웍스',
          region: '서울 서초구',
          rep_name: '박서초',
          phone: '02-588-2002',
          commission_rate: 0.5,
          is_direct: false,
          status: 'ACTIVE',
          stores_count: 0,
          monthly_gmv: 0
        }
      ],
      partners: [
        {
          id: 'ptr_01jcbk9v502x8m4v0k5a1b2c01',
          code: 'PTR-VAN-01',
          name: '한국정보통신(KICC) VAN 협력사',
          category: 'VAN/POS 단말기 설치',
          rep_name: '정협력',
          phone: '02-2100-3300',
          commission_rate: 0.1,
          status: 'ACTIVE'
        }
      ],
      platformCoupons: [
        {
          id: 'pc_platform_01',
          issuer_type: 'PLATFORM',
          alliance_name: '본사(플랫폼)',
          name: '상생 플랫폼 첫주문 2,000원 할인',
          discount_amount: 2000,
          min_order_amount: 15000,
          valid_until: '2026-12-31',
          cost_split: { platform: 100, alliance: 0, merchant: 0 },
          status: 'ACTIVE'
        },
        {
          id: 'pc_alliance_01',
          issuer_type: 'ALLIANCE',
          alliance_name: 'NH농협 제로페이',
          name: '제로페이 결제 시 1,500원 공동 할인',
          discount_amount: 1500,
          min_order_amount: 12000,
          valid_until: '2026-12-31',
          cost_split: { platform: 50, alliance: 50, merchant: 0 },
          status: 'ACTIVE'
        }
      ],
      promoRequests: [
        {
          id: 'pr_req_01',
          requester_role: 'SALES_ALLY',
          requester_name: '서초소상공인연합회',
          title: '서초 상권 주말 2,000원 상생 쿠폰',
          discount_amount: 2000,
          min_order_amount: 18000,
          valid_until: '2026-12-31',
          cost_split: { platform: 30, alliance: 70, merchant: 0 },
          status: 'REQUESTED',
          created_at: '2026-11-17 08:30'
        }
      ],
      merchantPromoOptOuts: {},
      auditLogs: [
        {
          id: 'aud_init_01',
          actor_role: 'HQ_SUPER',
          tenant_id: 'hq',
          action: 'SYSTEM_BOOT',
          target: 'PLATFORM_ADMIN',
          detail: '슈퍼관리자 감사 원장 초기화 완료',
          created_at: new Date().toISOString()
        }
      ],
      payoutRequests: [
        {
          id: 'pay_req_01',
          payee_type: 'STORE',
          payee_id: 'STR-11-650-01-56162-0001',
          payee_name: '바른치킨 서초본점',
          gross_amount: 634300,
          platform_promo_reimburse: 750,
          alliance_promo_reimburse: 750,
          net_payout: 635800,
          bank_info: '신한은행 110-***-****',
          status: 'PENDING',
          requested_at: '2026-11-17 09:00'
        },
        {
          id: 'pay_req_02',
          payee_type: 'AGENCY',
          payee_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
          payee_name: '강남제일정보시스템',
          gross_amount: 420000,
          platform_promo_reimburse: 0,
          alliance_promo_reimburse: 0,
          net_payout: 406140,
          bank_info: '국민은행 010-***-**** (3.3% 공제)',
          status: 'PENDING',
          requested_at: '2026-11-17 09:05'
        }
      ]
    };
    if (loaded && typeof loaded === 'object') {
      globalThis.__aitipAdminState = {
        ...defaults,
        ...loaded,
        systemPolicies: { ...defaults.systemPolicies, ...(loaded.systemPolicies || {}) },
        distributors: Array.isArray(loaded.distributors) && loaded.distributors.length ? loaded.distributors : defaults.distributors,
        agencies: Array.isArray(loaded.agencies) && loaded.agencies.length ? loaded.agencies : defaults.agencies,
        partners: Array.isArray(loaded.partners) && loaded.partners.length ? loaded.partners : defaults.partners,
        platformCoupons: Array.isArray(loaded.platformCoupons) && loaded.platformCoupons.length ? loaded.platformCoupons : defaults.platformCoupons,
        promoRequests: Array.isArray(loaded.promoRequests) && loaded.promoRequests.length ? loaded.promoRequests : defaults.promoRequests,
        auditLogs: Array.isArray(loaded.auditLogs) && loaded.auditLogs.length ? loaded.auditLogs : defaults.auditLogs,
        payoutRequests: Array.isArray(loaded.payoutRequests) && loaded.payoutRequests.length ? loaded.payoutRequests : defaults.payoutRequests,
        merchantPromoOptOuts: loaded.merchantPromoOptOuts && typeof loaded.merchantPromoOptOuts === 'object' ? loaded.merchantPromoOptOuts : {},
        blacklistedUids: new Set(Array.isArray(loaded.blacklistedUids) ? loaded.blacklistedUids : Array.from(defaults.blacklistedUids))
      };
    } else {
      globalThis.__aitipAdminState = defaults;
      saveAdminState();
    }
  }
  return globalThis.__aitipAdminState;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS 프리플라이트
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. API 헬스체크
  if (pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'UP',
      platform: 'AITIP-Platform',
      port: PORT,
      timestamp: new Date().toISOString(),
      services: {
        'food-delivery': 'ACTIVE',
        'mart-logistics': 'ACTIVE',
        'core-backbone': 'ACTIVE'
      }
    });
  }

  // --------------------------------------------------------------------------
  // 1-0. 플랫폼 슈퍼관리자 실데이터 직결 API (/api/admin/*)
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/admin/')) {
    if (method === 'POST') {
      res.on('finish', () => {
        if (res.statusCode < 400) saveAdminState();
      });
    }
    try {
      const adminState = ensureAdminState();
      const adminRole = String(req.headers['x-admin-role'] || 'HQ_SUPER').toUpperCase();
      const tenantId = String(req.headers['x-tenant-id'] || 'hq');

      // 멀티테넌트 RBAC 액션 권한 강제 (DOC-18 제11장)
      if (method === 'POST') {
        const isPartnerOrRegional = ['DISTRIBUTOR', 'AGENCY', 'SALES_ALLY', 'SERVICE_ALLY', 'TECH_ALLY'].includes(adminRole);
        const restrictedForRegional = ['/api/admin/cs/refund', '/api/admin/cs/blacklist', '/api/admin/points/', '/api/admin/promotions', '/api/admin/zones', '/api/admin/policies', '/api/admin/org/'];
        if (isPartnerOrRegional && restrictedForRegional.some(p => pathname.startsWith(p))) {
          return sendJson(res, 403, { error: `권한 거부(${adminRole}): 해당 관리 액션은 본사 권한이 필요합니다.` });
        }
        if (adminRole === 'HQ_CS' && ['/api/admin/policies', '/api/admin/zones', '/api/admin/org/'].some(p => pathname.startsWith(p))) {
          return sendJson(res, 403, { error: '권한 거부(HQ_CS): 시스템 정책/조직 변경 권한이 없습니다.' });
        }
      }
      if (pathname === '/api/admin/orders/live' && method === 'GET') {
        const store = foodService.getStoreInfo() || {};
        const live = foodService.getLiveOrders() || [];
        const orders = live.map(o => ({
          id: o.order_id,
          order_seq: o.short_display_id || o.order_id,
          seller_type: 'STORE',
          seller_id: store.store_id || 'STR-11-650-01-56162-0001',
          store_name: store.store_name || '바른치킨 서초본점',
          fulfillment_type: o.fulfillment_type || 'DELIVERY',
          items_desc: Array.isArray(o.items) && o.items.length > 0
            ? (o.items.length > 1 ? `${o.items[0].name} 외 ${o.items.length - 1}건` : `${o.items[0].name} × ${o.items[0].quantity || 1}`)
            : '주문 항목',
          amount: Number(o.final_payment_amount || 0),
          asset_type: o.payment_method || 'CARD',
          asset_label: o.payment_method === 'AITIP_ZERO_PAY' ? '제로페이' : (o.payment_method === 'CARD' ? '신용카드' : (o.payment_method || '간편결제')),
          status: o.status || 'PENDING',
          rider_name: o.delivery_method === 'SELF' ? '점주 직접배달' : (o.fulfillment_type === 'TAKEOUT' ? '방문포장' : '배정대기'),
          created_at: o.created_at ? new Date(o.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'
        }));
        return sendJson(res, 200, { success: true, orders });
      }

      if (pathname === '/api/admin/dashboard' && method === 'GET') {
        const store = foodService.getStoreInfo() || {};
        const live = foodService.getLiveOrders() || [];
        const totalGmv = live.reduce((s, o) => s + Number(o.final_payment_amount || 0), 0);
        return sendJson(res, 200, {
          success: true,
          timestamp: new Date().toISOString(),
          metrics: {
            total_gmv_today: totalGmv,
            total_orders_today: live.length,
            active_terminals: 1,
            total_terminals: 1,
            terminal_uptime_rate: 100.0,
            active_stores: store.is_open !== false ? 1 : 0,
            active_marts: 1,
            active_facilities: 1,
            pending_approvals: live.filter(o => o.status === 'PENDING').length,
            multi_asset_today: {
              credit_card: { amount: totalGmv, share_pct: 100.0 },
              card_points: { amount: 0, share_pct: 0.0 },
              local_currency: { amount: 0, share_pct: 0.0 },
              stablecoin: { amount: 0, share_pct: 0.0 }
            }
          },
          exceptions: {
            pending_orders: live.filter(o => o.status === 'PENDING').length,
            open_disputes: (adminState.csDisputes || []).filter(d => d.status === 'OPEN').length,
            pending_onboarding: (adminState.onboardingApps || []).filter(a => a.review_status !== 'APPROVED').length,
            maintenance_mode: Boolean(adminState.systemPolicies?.maintenance_mode)
          }
        });
      }

      if (pathname === '/api/admin/stores' && method === 'GET') {
        const store = foodService.getStoreInfo() || {};
        const live = foodService.getLiveOrders() || [];
        const totalGmv = live.reduce((s, o) => s + Number(o.final_payment_amount || 0), 0);
        const extra = globalThis.__aitipAdminState?.extraStores || [];
        let storesList = [
          {
            id: store.store_id || 'STR-11-650-01-56162-0001',
            name: store.store_name || '바른치킨 서초본점',
            biz_number: store.biz_number || '214-88-59124',
            owner_name: store.owner_name || '홍길동',
            rep_name: store.owner_name || '홍길동',
            phone: store.phone || '02-588-9258',
            address: store.address || '서울특별시 서초구 서초대로 34길 18',
            ksic_code: '56162',
            ksic_name: '치킨 전문점',
            agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
            agency_name: '강남제일정보시스템',
            device_id: 'DEV-CTI-882910',
            devices_cnt: 1,
            today_orders: live.length,
            today_gmv: totalGmv,
            status: store.is_open !== false ? 'OPEN' : 'PAUSED'
          },
          ...extra
        ];
        if (adminRole === 'AGENCY' && tenantId !== 'hq') {
          storesList = storesList.filter(s => s.agency_id === tenantId);
        } else if (adminRole === 'DISTRIBUTOR' && tenantId !== 'hq') {
          const childAgencyIds = new Set((adminState.agencies || []).filter(a => a.distributor_id === tenantId).map(a => a.id));
          storesList = storesList.filter(s => childAgencyIds.has(s.agency_id));
        }
        return sendJson(res, 200, {
          success: true,
          stores: storesList
        });
      }

      if (pathname === '/api/admin/stores/status' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { store_id } = body || {};
        const mainStore = foodService.getStoreInfo() || {};
        const mainId = mainStore.store_id || 'STR-11-650-01-56162-0001';
        if (!store_id || store_id === mainId) {
          const nextOpen = mainStore.is_open === false;
          if (typeof foodService.updateStoreInfo === 'function') {
            foodService.updateStoreInfo({ is_open: nextOpen });
          } else {
            mainStore.is_open = nextOpen;
            foodService.saveData();
          }
          return sendJson(res, 200, { success: true, store_id: mainId, status: nextOpen ? 'OPEN' : 'PAUSED' });
        }
        const extraTarget = (globalThis.__aitipAdminState?.extraStores || []).find(s => s.id === store_id);
        if (!extraTarget) return sendJson(res, 404, { error: '가맹점을 찾을 수 없습니다.' });
        extraTarget.status = extraTarget.status === 'OPEN' ? 'PAUSED' : 'OPEN';
        return sendJson(res, 200, { success: true, store_id, status: extraTarget.status });
      }

      if (pathname === '/api/admin/onboarding' && method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          applications: globalThis.__aitipAdminState?.onboardingApps || []
        });
      }

      if (pathname === '/api/admin/onboarding/approve' && method === 'POST') {
        const body = await parseJsonBody(req);
        const apps = globalThis.__aitipAdminState?.onboardingApps || [];
        const app = apps.find(a => a.id === body?.id);
        if (!app) return sendJson(res, 404, { error: '신청 건을 찾을 수 없습니다.' });
        app.review_status = 'APPROVED';
        app.review_label = '입점 승인 완료';
        const seq = String((globalThis.__aitipAdminState.extraStores.length || 0) + 2).padStart(4, '0');
        const newStoreId = `STR-11-650-01-${app.store_category || '56111'}-${seq}`;
        const exists = globalThis.__aitipAdminState.extraStores.some(s => s.biz_number === app.biz_reg_no);
        if (!exists) {
          globalThis.__aitipAdminState.extraStores.push({
            id: newStoreId,
            name: app.business_name,
            biz_number: app.biz_reg_no,
            owner_name: app.rep_name,
            phone: app.phone,
            address: app.road_address,
            ksic_code: app.store_category || '56111',
            ksic_name: app.ksic_name || '외식 가맹점',
            agency_id: app.agency_id,
            agency_name: app.agency_name,
            device_id: `DEV-CTI-8829${seq.slice(-2)}`,
            today_orders: 0,
            today_gmv: 0,
            status: 'OPEN'
          });
        }
        return sendJson(res, 200, { success: true, application: app, issued_store_id: newStoreId });
      }

      if (pathname === '/api/admin/onboarding/revision' && method === 'POST') {
        const body = await parseJsonBody(req);
        const apps = globalThis.__aitipAdminState?.onboardingApps || [];
        const app = apps.find(a => a.id === body?.id);
        if (!app) return sendJson(res, 404, { error: '신청 건을 찾을 수 없습니다.' });
        app.review_status = 'REVISION_REQUESTED';
        app.review_label = '서류 보완 요청됨';
        app.revision_reason = body?.reason || '서류 재확인 필요';
        return sendJson(res, 200, { success: true, application: app });
      }

      if (pathname === '/api/admin/onboarding/apply' && method === 'POST') {
        const body = await parseJsonBody(req);
        const app = {
          id: `str_${Date.now()}`,
          app_no: `APP-2026-${String(Math.floor(10000 + Math.random() * 89999))}`,
          business_name: body?.business_name || '신규 신청 가맹점',
          biz_reg_no: body?.biz_reg_no || '000-00-00000',
          food_license_no: body?.food_license_no || '-',
          store_category: body?.store_category || '56111',
          ksic_name: body?.ksic_name || '외식업',
          rep_name: body?.rep_name || '대표자',
          phone: body?.phone || '-',
          road_address: body?.road_address || '-',
          agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
          agency_name: body?.agency_name || '강남제일정보시스템',
          pos_company: body?.pos_company || '자체 POS',
          min_order_amount: Number(body?.min_order_amount || 15000),
          default_prep_minutes: Number(body?.default_prep_minutes || 20),
          bank_name: body?.bank_name || '국민은행',
          bank_account: '***-****-0000',
          bank_holder: body?.rep_name || '대표자',
          applied_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
          review_status: 'DOC_REVIEW',
          review_label: '서류 심사중',
          documents: []
        };
        globalThis.__aitipAdminState.onboardingApps.unshift(app);
        return sendJson(res, 201, { success: true, application: app });
      }

      if (pathname === '/api/admin/cs/disputes' && method === 'GET') {
        const live = foodService.getLiveOrders() || [];
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
        const mappedOrders = live.map(o => ({
          order_id: o.order_id,
          short_display_id: o.short_display_id,
          customer_uid: o.customer_uid || 'cust_01jcb_pwa_88412',
          amount: Number(o.final_payment_amount || 0),
          status: o.status || 'PENDING',
          created_at: o.created_at
        }));
        const filteredOrders = q
          ? mappedOrders.filter(o =>
              String(o.order_id || '').toLowerCase().includes(q) ||
              String(o.short_display_id || '').toLowerCase().includes(q) ||
              String(o.customer_uid || '').toLowerCase().includes(q)
            )
          : mappedOrders;
        const offset = (page - 1) * limit;
        return sendJson(res, 200, {
          success: true,
          disputes: adminState.csDisputes,
          blacklisted_uids: Array.from(adminState.blacklistedUids),
          orders_total: filteredOrders.length,
          recent_orders: filteredOrders.slice(offset, offset + limit)
        });
      }

      if (pathname === '/api/admin/cs/refund' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { order_id, customer_uid, refund_amount, reason_code, memo } = body || {};
        if (!order_id) return sendJson(res, 400, { error: 'order_id가 필요합니다.' });
        const amt = Number(refund_amount || 0);
        const live = foodService.getLiveOrders() || [];
        const target = live.find(o => o.order_id === order_id);
        if (target && amt >= Number(target.final_payment_amount || 0)) {
          target.status = 'CANCELLED';
          foodService.saveData();
        }
        const entry = {
          dispute_id: `dsp_${Date.now()}`,
          order_id,
          customer_uid: customer_uid || target?.customer_uid || 'cust_01jcb_pwa_88412',
          reason_code: reason_code || 'ADMIN_REFUND',
          reason_label: reason_code === 'FULL_CANCEL' ? '관리자 전액 취소/환불' : '부분 환불 보상',
          requested_amount: amt,
          refunded_amount: amt,
          status: 'REFUNDED',
          memo: memo || 'Zero-PII PG TID 기준 환불 완료',
          created_at: new Date().toISOString()
        };
        adminState.csDisputes.unshift(entry);
        return sendJson(res, 200, { success: true, dispute: entry });
      }

      if (pathname === '/api/admin/cs/blacklist' && method === 'POST') {
        const body = await parseJsonBody(req);
        const uid = body?.customer_uid;
        if (!uid) return sendJson(res, 400, { error: 'customer_uid가 필요합니다.' });
        if (adminState.blacklistedUids.has(uid)) {
          adminState.blacklistedUids.delete(uid);
        } else {
          adminState.blacklistedUids.add(uid);
        }
        return sendJson(res, 200, {
          success: true,
          blacklisted_uids: Array.from(adminState.blacklistedUids)
        });
      }

      if (pathname === '/api/admin/points/ledger' && method === 'GET') {
        const balances = {};
        for (const tx of adminState.pointLedger) {
          balances[tx.customer_uid] = (balances[tx.customer_uid] || 0) + Number(tx.delta || 0);
        }
        return sendJson(res, 200, {
          success: true,
          policy: adminState.pointPolicy,
          ledger: adminState.pointLedger,
          balances,
          total_liability: Object.values(balances).reduce((s, v) => s + Math.max(0, v), 0)
        });
      }

      if (pathname === '/api/admin/points/adjust' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { customer_uid, delta, type, bearer, memo } = body || {};
        if (!customer_uid || !Number(delta)) {
          return sendJson(res, 400, { error: 'customer_uid와 0이 아닌 delta가 필요합니다.' });
        }
        const prev = adminState.pointLedger
          .filter(t => t.customer_uid === customer_uid)
          .reduce((s, t) => s + Number(t.delta || 0), 0);
        const nextBal = Math.max(0, prev + Number(delta));
        const tx = {
          tx_id: `ptx_${Date.now()}`,
          customer_uid,
          order_id: '',
          delta: Number(delta),
          balance_after: nextBal,
          type: type || (Number(delta) > 0 ? 'ADMIN_GRANT' : 'ADMIN_REVOKE'),
          bearer: bearer || 'PLATFORM',
          memo: memo || '관리자 수동 조정',
          created_at: new Date().toISOString()
        };
        adminState.pointLedger.unshift(tx);
        return sendJson(res, 200, { success: true, tx });
      }

      if (pathname === '/api/admin/points/policy' && method === 'POST') {
        const body = await parseJsonBody(req);
        adminState.pointPolicy = { ...adminState.pointPolicy, ...body };
        return sendJson(res, 200, { success: true, policy: adminState.pointPolicy });
      }

      if (pathname === '/api/admin/promotions' && method === 'GET') {
        const merchantCoupons = (typeof foodService.getCoupons === 'function' ? foodService.getCoupons() : []).map(c => ({
          ...c,
          issuer_type: 'MERCHANT',
          store_name: foodService.getStoreInfo()?.store_name || '바른치킨 서초본점',
          cost_split: { platform: 0, alliance: 0, merchant: 100 }
        }));
        return sendJson(res, 200, {
          success: true,
          banners: (adminState.banners || []).map(b => ({ issuer_type: 'PLATFORM', ...b })),
          platform_coupons: adminState.platformCoupons || [],
          merchant_coupons: merchantCoupons,
          promo_requests: adminState.promoRequests || [],
          alliances: adminState.partners || [],
          coupons: [...(adminState.platformCoupons || []), ...merchantCoupons]
        });
      }

      if (pathname === '/api/admin/promotions' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (body?.kind === 'BANNER_TOGGLE' && body.id) {
          const b = adminState.banners.find(x => x.id === body.id);
          if (b) b.active = !b.active;
          return sendJson(res, 200, { success: true, banners: adminState.banners });
        }
        if (body?.kind === 'BANNER_CREATE') {
          const newB = {
            id: `bnr_${Date.now()}`,
            issuer_type: body.issuer_type || 'PLATFORM',
            alliance_name: body.alliance_name || '',
            title: body.title || '신규 프로모션 배너',
            target_app: body.target_app || 'CUSTOMER_PWA',
            placement: body.placement || 'HOME_TOP',
            active: true,
            period: body.period || '상시 노출'
          };
          adminState.banners.unshift(newB);
          return sendJson(res, 200, { success: true, banner: newB });
        }
        if (body?.kind === 'COUPON_CREATE') {
          const issuerType = body.issuer_type === 'ALLIANCE' ? 'ALLIANCE' : 'PLATFORM';
          const pShare = Number(body.platform_share ?? (issuerType === 'PLATFORM' ? 100 : 50));
          const aShare = Number(body.alliance_share ?? (issuerType === 'PLATFORM' ? 0 : 50));
          const mShare = Number(body.merchant_share ?? 0);
          const c = {
            id: `pc_${Date.now()}`,
            issuer_type: issuerType,
            alliance_name: issuerType === 'ALLIANCE' ? (body.alliance_name || '제휴사') : '본사(플랫폼)',
            name: body.name || '플랫폼 감사 쿠폰',
            discount_amount: Number(body.discount_amount || 2000),
            min_order_amount: Number(body.min_order_amount || 15000),
            valid_until: body.valid_until || '2026-12-31',
            cost_split: { platform: pShare, alliance: aShare, merchant: mShare },
            status: 'ACTIVE'
          };
          adminState.platformCoupons.unshift(c);
          return sendJson(res, 200, { success: true, coupon: c });
        }
        if (body?.kind === 'COUPON_TOGGLE' && body.id) {
          const c = (adminState.platformCoupons || []).find(x => x.id === body.id);
          if (!c) return sendJson(res, 404, { error: '쿠폰을 찾을 수 없습니다.' });
          c.status = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
          return sendJson(res, 200, { success: true, coupon: c });
        }
        if (body?.kind === 'PROMO_REQUEST_CREATE') {
          const reqItem = {
            id: `pr_req_${Date.now()}`,
            requester_role: adminRole,
            requester_name: body.requester_name || '지역 영업조직',
            title: body.title || '지역 상생 프로모션',
            discount_amount: Number(body.discount_amount || 2000),
            min_order_amount: Number(body.min_order_amount || 15000),
            valid_until: body.valid_until || '2026-12-31',
            cost_split: {
              platform: Number(body.platform_share || 0),
              alliance: Number(body.alliance_share || 100),
              merchant: Number(body.merchant_share || 0)
            },
            status: 'REQUESTED',
            created_at: new Date().toISOString().slice(0, 16).replace('T', ' ')
          };
          adminState.promoRequests.unshift(reqItem);
          return sendJson(res, 201, { success: true, request: reqItem });
        }
        if (body?.kind === 'PROMO_REQUEST_DECIDE' && body.id) {
          const r = (adminState.promoRequests || []).find(x => x.id === body.id);
          if (!r) return sendJson(res, 404, { error: '승인 요청을 찾을 수 없습니다.' });
          const decision = body.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
          r.status = decision;
          if (decision === 'APPROVED') {
            adminState.platformCoupons.unshift({
              id: `pc_req_${Date.now()}`,
              issuer_type: 'ALLIANCE',
              alliance_name: r.requester_name,
              name: r.title,
              discount_amount: r.discount_amount,
              min_order_amount: r.min_order_amount,
              valid_until: r.valid_until,
              cost_split: r.cost_split,
              status: 'ACTIVE'
            });
          }
          return sendJson(res, 200, { success: true, request: r });
        }
        return sendJson(res, 400, { error: '지원하지 않는 프로모션 요청입니다.' });
      }

      if (pathname === '/api/admin/zones' && method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          modules: adminState.serviceModules,
          zones: adminState.deliveryZones
        });
      }

      if (pathname === '/api/admin/zones' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (body?.kind === 'TOGGLE_MODULE' && body.code) {
          const m = adminState.serviceModules.find(x => x.code === body.code);
          if (m) m.active = !m.active;
          return sendJson(res, 200, { success: true, modules: adminState.serviceModules });
        }
        if (body?.kind === 'TOGGLE_ZONE' && body.zone_id) {
          const z = adminState.deliveryZones.find(x => x.zone_id === body.zone_id);
          if (z) z.active = !z.active;
          return sendJson(res, 200, { success: true, zones: adminState.deliveryZones });
        }
        if (body?.kind === 'TOGGLE_DELIVERY_HALT' && body.zone_id) {
          const z = adminState.deliveryZones.find(x => x.zone_id === body.zone_id);
          if (z) z.emergency_delivery_halt = !z.emergency_delivery_halt;
          return sendJson(res, 200, { success: true, zones: adminState.deliveryZones });
        }
        if (body?.kind === 'ADD_ZONE') {
          const z = {
            zone_id: `zn_${Date.now()}`,
            sido: body.sido || '서울특별시',
            sigungu: body.sigungu || '송파구',
            note: body.note || '영업망·배송망 개시',
            emergency_delivery_halt: false,
            active: true
          };
          adminState.deliveryZones.push(z);
          return sendJson(res, 200, { success: true, zone: z });
        }
        return sendJson(res, 400, { error: '지원하지 않는 권역/업종 요청입니다.' });
      }

      if (pathname === '/api/admin/policies' && method === 'GET') {
        return sendJson(res, 200, { success: true, policies: adminState.systemPolicies });
      }

      if (pathname === '/api/admin/policies' && method === 'POST') {
        const body = await parseJsonBody(req);
        adminState.systemPolicies = { ...adminState.systemPolicies, ...body };
        adminState.auditLogs.unshift({
          id: `aud_${Date.now()}`,
          actor_role: adminRole,
          tenant_id: tenantId,
          action: 'POLICY_UPDATE',
          target: 'SYSTEM_POLICIES',
          detail: `점검모드=${Boolean(adminState.systemPolicies.maintenance_mode)}, 파기=${adminState.systemPolicies.pii_retention_hours_after_delivery}h`,
          created_at: new Date().toISOString()
        });
        return sendJson(res, 200, { success: true, policies: adminState.systemPolicies });
      }

      if (pathname === '/api/admin/audit-logs' && method === 'GET') {
        return sendJson(res, 200, { success: true, logs: adminState.auditLogs || [] });
      }

      if (pathname === '/api/admin/reviews/blind-queue' && method === 'GET') {
        const reviews = typeof foodService.getReviews === 'function' ? foodService.getReviews() : [];
        return sendJson(res, 200, { success: true, reviews });
      }

      if (pathname === '/api/admin/reviews/decide' && method === 'POST') {
        const body = await parseJsonBody(req);
        const reviews = typeof foodService.getReviews === 'function' ? foodService.getReviews() : [];
        const target = reviews.find(r => r.review_id === body?.review_id || r.id === body?.review_id);
        if (!target) return sendJson(res, 404, { error: '리뷰를 찾을 수 없습니다.' });
        const decision = body?.decision === 'APPROVED' ? 'BLINDED' : 'ACTIVE';
        target.status = decision;
        target.blind_status = decision;
        foodService.saveData();
        adminState.auditLogs.unshift({
          id: `aud_${Date.now()}`,
          actor_role: adminRole,
          tenant_id: tenantId,
          action: 'REVIEW_BLIND_DECIDE',
          target: body?.review_id,
          detail: `리뷰 블라인드 결정: ${decision}`,
          created_at: new Date().toISOString()
        });
        return sendJson(res, 200, { success: true, review: target });
      }

      if (pathname === '/api/admin/payouts' && method === 'GET') {
        return sendJson(res, 200, { success: true, payouts: adminState.payoutRequests || [] });
      }

      if (pathname === '/api/admin/payouts/decide' && method === 'POST') {
        const body = await parseJsonBody(req);
        const target = (adminState.payoutRequests || []).find(p => p.id === body?.id);
        if (!target) return sendJson(res, 404, { error: '지급 요청을 찾을 수 없습니다.' });
        target.status = body?.decision === 'HELD' ? 'HELD' : 'APPROVED';
        target.decided_at = new Date().toISOString();
        adminState.auditLogs.unshift({
          id: `aud_${Date.now()}`,
          actor_role: adminRole,
          tenant_id: tenantId,
          action: 'PAYOUT_DECIDE',
          target: target.payee_name,
          detail: `정산 지급 ${target.status} (${Number(target.net_payout || 0).toLocaleString()}원)`,
          created_at: new Date().toISOString()
        });
        return sendJson(res, 200, { success: true, payout: target });
      }

      if (pathname === '/api/admin/distributors' && method === 'GET') {
        const allAgencies = (adminState.agencies || []).map(a => ({
          ...a,
          region_name: a.region_name || a.region || '-',
          merchants_cnt: a.merchants_cnt ?? a.stores_count ?? 0,
          devices_cnt: a.devices_cnt ?? 0,
          monthly_gmv: Number(a.monthly_gmv || 0),
          gmv_share_rate: a.gmv_share_rate ?? ((Number(a.commission_rate || 0)) / 100),
          margin_amount: Number(a.margin_amount ?? Math.round((Number(a.monthly_gmv || 0) * Number(a.commission_rate || 0)) / 100))
        }));
        const distributors = (adminState.distributors || []).map(d => {
          const childAgencies = allAgencies.filter(a => a.distributor_id === d.id);
          return {
            ...d,
            territory_name: d.territory_name || d.sido_name || '전국',
            agencies_cnt: childAgencies.length,
            merchants_cnt: d.merchants_cnt ?? d.stores_count ?? 0,
            devices_cnt: d.devices_cnt ?? 0,
            monthly_gmv: Number(d.monthly_gmv || 0),
            overriding_rate: d.overriding_rate ?? ((Number(d.commission_rate || 0)) / 100),
            margin_amount: Number(d.margin_amount ?? Math.round((Number(d.monthly_gmv || 0) * Number(d.commission_rate || 0)) / 100)),
            agencies: childAgencies
          };
        });
        return sendJson(res, 200, { success: true, distributors });
      }
      if (pathname === '/api/admin/agencies' && method === 'GET') {
        const agencies = (adminState.agencies || []).map(a => ({
          ...a,
          region_name: a.region_name || a.region || '-',
          merchants_cnt: a.merchants_cnt ?? a.stores_count ?? 0,
          devices_cnt: a.devices_cnt ?? 0,
          monthly_gmv: Number(a.monthly_gmv || 0),
          gmv_share_rate: a.gmv_share_rate ?? ((Number(a.commission_rate || 0)) / 100),
          margin_amount: Number(a.margin_amount ?? Math.round((Number(a.monthly_gmv || 0) * Number(a.commission_rate || 0)) / 100))
        }));
        return sendJson(res, 200, { success: true, agencies });
      }
      if (pathname === '/api/admin/partners' && method === 'GET') {
        return sendJson(res, 200, { success: true, partners: adminState.partners || [] });
      }

      if (pathname === '/api/admin/marts' && method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          marts: [
            {
              id: 'MRT-11-650-01-47121-0001',
              name: '서초농협 하나로마트 양재점',
              biz_number: '214-82-00912',
              rep_name: '김농협',
              phone: '02-579-8001',
              address: '서울특별시 서초구 청계산로 10',
              specialty: '신선농산물 · 정육 · 당일장보기',
              devices_cnt: 2,
              today_orders: 12,
              today_gmv: 584000,
              status: 'OPEN'
            }
          ]
        });
      }

      if (pathname === '/api/admin/devices' && method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          devices: [
            {
              id: 'DEV-CTI-882910',
              serial_no: 'AITIP-SN-2026-0001',
              board_serial: 'AITIP-SN-2026-0001',
              mac_address: 'B8:27:EB:14:8A:21',
              model: 'AITIP-KDS-PRO-15',
              store_id: 'STR-11-650-01-56162-0001',
              store_name: '바른치킨 서초본점',
              agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
              status: 'ONLINE',
              firmware: 'v2.4.1',
              last_heartbeat: new Date().toISOString()
            }
          ]
        });
      }

      if (pathname === '/api/admin/riders' && method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          riders: [
            { id: 'wrk_01', name: '김도현', agency_name: '강남제일정보시스템', status_code: 'DELIVERING', vehicle: '이륜차', current_order_id: 'ord_01m7gw30a5yayfxexxdbyayfxe', today_deliveries: 14 },
            { id: 'wrk_02', name: '박성민', agency_name: '(주)서초네트웍스', status_code: 'PICKING_UP', vehicle: '이륜차', current_order_id: 'ord_01m7gpczcwwpk9qwjhjvwpk9qw', today_deliveries: 9 },
            { id: 'wrk_03', name: '윤태민', agency_name: '본사 직영 관리팀', status_code: 'STANDBY', vehicle: '전기차', current_order_id: '', today_deliveries: 6 }
          ]
        });
      }

      if (pathname === '/api/admin/payments/transactions' && method === 'GET') {
        const live = foodService.getLiveOrders() || [];
        const promoSummary = live.reduce((acc, o) => {
          const ap = o.applied_promotions || {};
          acc.platform_discount += Number(ap.platform_discount || 0);
          acc.alliance_discount += Number(ap.alliance_discount || 0);
          acc.merchant_discount += Number(ap.merchant_discount || 0);
          acc.point_used += Number(ap.point_used || 0);
          return acc;
        }, { platform_discount: 0, alliance_discount: 0, merchant_discount: 0, point_used: 0 });
        return sendJson(res, 200, {
          success: true,
          promo_summary: promoSummary,
          transactions: live.slice(0, 15).map(o => {
            const amt = Number(o.final_payment_amount || 0);
            return {
              id: `tx_${o.order_id}`,
              order_id: o.order_id,
              paid_at: o.created_at ? new Date(o.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
              seller_name: '바른치킨 서초본점',
              store_name: '바른치킨 서초본점',
              asset_type: o.payment_method === 'AITIP_ZERO_PAY' ? '제로페이' : '신용카드',
              orig_amount: amt,
              settled_amount: amt,
              diff: 0,
              recon_status: 'MATCHED',
              recon_status_label: '3자 대사 일치',
              notes: `전표 ${o.short_display_id || o.order_id} 정상 매입`
            };
          })
        });
      }

      if (pathname === '/api/admin/settlements/taxes' && method === 'GET') {
        const items = [
          { id: 'tax_01', entity_name: '강남제일정보시스템', biz_no: '211-88-12345', base_amount: 4200000, tax_type: 'WITHHOLDING_3_3', doc_no: 'WTH-202611-01', status: 'READY' },
          { id: 'tax_02', entity_name: '(주)서초네트웍스', biz_no: '214-81-55910', base_amount: 3100000, tax_type: 'TAX_INVOICE_10', doc_no: 'NTS-202611-02', status: 'ISSUED' }
        ];
        return sendJson(res, 200, {
          success: true,
          summary: {
            total_base_amount: 7300000,
            withholding_pool: 4200000,
            invoice_pool: 3100000
          },
          items
        });
      }

      if (pathname === '/api/admin/org/create' && method === 'POST') {
        const body = await parseJsonBody(req);
        const kind = body?.kind || 'AGENCY';
        const ag = body?.agreements || {};
        if (!ag.privacy_consent || !ag.zero_pii_pledge || !ag.nda_pledge || !ag.standard_contract) {
          return sendJson(res, 400, { error: '필수 법적 동의 및 서약서(개인정보보호·Zero-PII·비밀유지·표준계약)를 모두 확인해 주십시오.' });
        }
        if (!body?.name || !body?.biz_number || !body?.rep_name || !body?.bank_name || !body?.bank_account || !body?.bank_holder) {
          return sendJson(res, 400, { error: '법인/상호명, 사업자등록번호, 대표자명 및 정산 계좌 정보는 필수입니다.' });
        }

        const initialStatus = body.approve_immediately ? 'ACTIVE' : 'CONTRACT_REVIEW';
        const contractMeta = {
          biz_number: body.biz_number,
          address: body.address || '-',
          tax_type: body.tax_type || 'TAX_INVOICE_10',
          bank_name: body.bank_name,
          bank_account: body.bank_account,
          bank_holder: body.bank_holder,
          contract_start: body.contract_start || '2026-11-16',
          contract_end: body.contract_end || '2027-11-15',
          deposit_amount: Number(body.deposit_amount || 0),
          initial_devices: Number(body.initial_devices || 0),
          documents: body.documents || { biz_cert: true, bankbook: true, surety_bond: false },
          agreements: {
            privacy_consent: true,
            zero_pii_pledge: true,
            nda_pledge: true,
            standard_contract: true,
            signed_at: new Date().toISOString()
          },
          status: initialStatus
        };

        if (kind === 'DISTRIBUTOR') {
          const item = {
            id: `dst_${Date.now()}`,
            code: body.code || `DST-${String((adminState.distributors?.length || 0) + 10)}`,
            name: body.name,
            sido_code: body.sido_code || '41',
            sido_name: body.region || '경기도',
            rep_name: body.rep_name,
            phone: body.phone || '-',
            commission_rate: Number(body.commission_rate ?? 0.3),
            is_direct: Boolean(body.is_direct),
            agencies_count: 0,
            stores_count: 0,
            monthly_gmv: 0,
            ...contractMeta
          };
          adminState.distributors.push(item);
          return sendJson(res, 201, { success: true, item });
        }
        if (kind === 'PARTNER' || kind === 'SALES_ALLY' || kind === 'SERVICE_ALLY' || kind === 'TECH_ALLY') {
          const allianceLabel = kind === 'SALES_ALLY' ? '영업 제휴' : kind === 'SERVICE_ALLY' ? '서비스 제휴' : '기술 제휴';
          const item = {
            id: `ptr_${Date.now()}`,
            code: body.code || `ALY-${String((adminState.partners?.length || 0) + 1).padStart(2, '0')}`,
            alliance_type: kind === 'PARTNER' ? 'TECH_ALLY' : kind,
            alliance_label: allianceLabel,
            name: body.name,
            category: body.region || allianceLabel,
            rep_name: body.rep_name,
            phone: body.phone || '-',
            commission_rate: Number(body.commission_rate ?? 0.1),
            ...contractMeta
          };
          adminState.partners.push(item);
          return sendJson(res, 201, { success: true, item });
        }
        const parentDist = (adminState.distributors || []).find(d => d.id === body.parent_id) || adminState.distributors?.[0];
        const isDirect = Boolean(body.is_direct) || parentDist?.id === 'HQ_DIRECT';
        const item = {
          id: `agn_${Date.now()}`,
          code: body.code || `AGN-${String((adminState.agencies?.length || 0) + 1).padStart(2, '0')}`,
          distributor_id: parentDist?.id || 'HQ_DIRECT',
          distributor_name: parentDist?.name || '본사 직영 (HQ Direct)',
          name: body.name,
          region: body.region || '서울',
          rep_name: body.rep_name,
          phone: body.phone || '-',
          commission_rate: isDirect ? 0.0 : Number(body.commission_rate ?? 0.5),
          is_direct: isDirect,
          stores_count: 0,
          monthly_gmv: 0,
          ...contractMeta
        };
        adminState.agencies.push(item);
        return sendJson(res, 201, { success: true, item });
      }

      if (pathname === '/api/admin/org/approve' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { kind, id } = body || {};
        const list = kind === 'DISTRIBUTOR' ? adminState.distributors
          : kind === 'PARTNER' ? adminState.partners
          : adminState.agencies;
        const target = (list || []).find(x => x.id === id);
        if (!target) return sendJson(res, 404, { error: '조직을 찾을 수 없습니다.' });
        target.status = 'ACTIVE';
        return sendJson(res, 200, { success: true, item: target });
      }

      if (pathname === '/api/admin/org/toggle-status' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { kind, id } = body || {};
        const list = kind === 'DISTRIBUTOR' ? adminState.distributors
          : kind === 'PARTNER' ? adminState.partners
          : adminState.agencies;
        const target = (list || []).find(x => x.id === id);
        if (!target) return sendJson(res, 404, { error: '조직을 찾을 수 없습니다.' });
        target.status = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return sendJson(res, 200, { success: true, item: target });
      }
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // 1-1. 외식업(Food Delivery) 백엔드 REST API
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/food/')) {
    try {
      // 1) 매장 정보
      if (pathname === '/api/food/store') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getStoreInfo());
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = foodService.updateStoreInfo(body);
          return sendJson(res, 200, { success: true, store: updated });
        }
      }

      // 1-1) 7일 요일별 영업시간 & 브레이크타임 (DOC-05 / schema_aitip_v01.sql 규격)
      if (pathname === '/api/food/store/hours') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getStoreHours());
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = foodService.updateStoreHours(body.hours || body);
          return sendJson(res, 200, { success: true, hours: updated });
        }
      }

      // 1-1-1) 배달 지역 및 배달팁 구간 영속화
      if (pathname === '/api/food/store/delivery-rules') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getDeliveryRules());
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = foodService.updateDeliveryRules(body);
          return sendJson(res, 200, { success: true, ...updated });
        }
      }

      // 1-2) 국경일 자동휴무 및 명절 원클릭 프리셋
      if (pathname === '/api/food/store/holidays') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getHolidaySettings());
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = foodService.updateHolidaySettings(body);
          return sendJson(res, 200, { success: true, ...updated });
        }
      }

      // 1-3) 개인사유 임시휴무 등록
      if (pathname === '/api/food/store/holidays/custom') {
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const item = foodService.addCustomClosure(body);
          return sendJson(res, 201, { success: true, closure: item });
        }
      }

      const customClosureMatch = pathname.match(/^\/api\/food\/store\/holidays\/custom\/([^/]+)$/);
      if (customClosureMatch && method === 'DELETE') {
        const closureId = customClosureMatch[1];
        const deleted = foodService.deleteCustomClosure(closureId);
        return sendJson(res, 200, { success: deleted });
      }

      // 1-4) 정산 대사 원장 및 부가세 세무 증빙 (D1 규격 실측 집계)
      if (pathname === '/api/food/settlement') {
        if (method === 'GET') {
          const year = Number(url.searchParams.get('year')) || 2026;
          const month = Number(url.searchParams.get('month')) || 11;
          const overview = foodService.getSettlementOverview({ year, month });
          return sendJson(res, 200, overview);
        }
      }

      // 1-5) 홈택스 표준 부가세 신고용 CSV 실물 다운로드
      if (pathname === '/api/food/settlement/tax-csv') {
        if (method === 'GET') {
          const year = Number(url.searchParams.get('year')) || 2026;
          const month = Number(url.searchParams.get('month')) || 11;
          const csvText = foodService.exportTaxCsv({ year, month });
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="hometax_vat_report_${year}_${month}.csv"`,
          });
          return res.end(csvText);
        }
      }

      // 2) 3단 메뉴 카탈로그
      if (pathname === '/api/food/menu') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getMenuCatalog());
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const newProduct = foodService.createMenuItem(body);
          return sendJson(res, 201, { success: true, product: newProduct });
        }
      }

      // 2-0-a) 메뉴 일괄 등록: POST /api/food/menu/bulk
      if (pathname === '/api/food/menu/bulk' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = foodService.createMenuItemsBulk(body.items);
        return sendJson(res, 201, { success: true, ...result });
      }

      // 2-0) 상품 이미지 업로드 (로컬 data/uploads 저장 · 상용 R2 호환 계약)
      if (pathname === '/api/food/upload-image' && method === 'POST') {
        const body = await parseJsonBody(req);
        const dataUrl = String(body.dataUrl || '');
        const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
          return sendJson(res, 400, { error: '지원하지 않는 이미지 형식입니다. (PNG/JPG/WebP/GIF)' });
        }
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
          return sendJson(res, 413, { error: '이미지 크기는 최대 5MB까지 업로드 가능합니다.' });
        }
        const uploadsDir = path.join(__dirname, 'packages', 'services', 'food-delivery', 'backend', 'data', 'uploads');
        fs.mkdirSync(uploadsDir, { recursive: true });
        const fileName = `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
        return sendJson(res, 201, { success: true, image_url: `/api/food/uploads/${fileName}` });
      }

      // 2-0-1) 업로드 이미지 정적 서빙
      const uploadMatch = pathname.match(/^\/api\/food\/uploads\/([A-Za-z0-9_.-]+)$/);
      if (uploadMatch && method === 'GET') {
        const safeName = path.basename(uploadMatch[1]);
        const filePath = path.join(__dirname, 'packages', 'services', 'food-delivery', 'backend', 'data', 'uploads', safeName);
        if (!fs.existsSync(filePath)) {
          return sendJson(res, 404, { error: '이미지를 찾을 수 없습니다.' });
        }
        const ext = path.extname(safeName).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
        return res.end(fs.readFileSync(filePath));
      }

      // 2-1) 카테고리 추가: POST /api/food/categories
      if (pathname === '/api/food/categories' && method === 'POST') {
        const body = await parseJsonBody(req);
        const newCategory = foodService.createCategory(body);
        return sendJson(res, 201, { success: true, category: newCategory });
      }

      // 2-2) 옵션그룹 추가: POST /api/food/option-groups
      if (pathname === '/api/food/option-groups' && method === 'POST') {
        const body = await parseJsonBody(req);
        const newGroup = foodService.createOptionGroup(body);
        return sendJson(res, 201, { success: true, option_group: newGroup });
      }

      // 3) 메뉴 가격 수정: /api/food/menu/:id/price
      const priceMatch = pathname.match(/^\/api\/food\/menu\/([^/]+)\/price$/);
      if (priceMatch && method === 'PATCH') {
        const productId = priceMatch[1];
        const body = await parseJsonBody(req);
        const updated = foodService.updateMenuItemPrice(productId, body.price, body.discounted_price);
        return sendJson(res, 200, { success: true, product: updated });
      }

      // 4) 메뉴 판매 상태 수정: /api/food/menu/:id/status
      const statusMatch = pathname.match(/^\/api\/food\/menu\/([^/]+)\/status$/);
      if (statusMatch && method === 'PATCH') {
        const productId = statusMatch[1];
        const body = await parseJsonBody(req);
        const updated = foodService.updateMenuItemStatus(productId, body.status);
        return sendJson(res, 200, { success: true, product: updated });
      }

      // 4-1) 메뉴 전체 수정 / 삭제: PUT / DELETE /api/food/menu/:id
      const menuItemMatch = pathname.match(/^\/api\/food\/menu\/([^/]+)$/);
      if (menuItemMatch && method === 'PUT') {
        const productId = menuItemMatch[1];
        const body = await parseJsonBody(req);
        const updated = foodService.updateMenuItem(productId, body);
        return sendJson(res, 200, { success: true, product: updated });
      }
      if (menuItemMatch && method === 'DELETE') {
        const productId = menuItemMatch[1];
        const removed = foodService.deleteMenuItem(productId);
        return sendJson(res, 200, { success: true, deleted_id: removed.product_id });
      }

      // 5) 실시간 주문 (KDS)
      if (pathname === '/api/food/orders/live' && method === 'GET') {
        return sendJson(res, 200, foodService.getLiveOrders());
      }

      // 5-0-0) 가맹점 공동 프로모션 참여 동의(Opt-in/Opt-out) API
      if (pathname === '/api/food/promotions/joint' && method === 'GET') {
        const adminState = ensureAdminState();
        const storeId = url.searchParams.get('store_id') || foodService.getStoreInfo()?.store_id || 'STR-11-650-01-56162-0001';
        const optOuts = new Set(adminState.merchantPromoOptOuts?.[storeId] || []);
        const list = (adminState.platformCoupons || [])
          .filter(c => c.status === 'ACTIVE')
          .map(c => ({ ...c, opted_in: !optOuts.has(c.id) }));
        return sendJson(res, 200, { success: true, store_id: storeId, promotions: list });
      }

      if (pathname === '/api/food/promotions/opt-in' && method === 'POST') {
        const body = await parseJsonBody(req);
        const adminState = ensureAdminState();
        const storeId = body?.store_id || foodService.getStoreInfo()?.store_id || 'STR-11-650-01-56162-0001';
        const couponId = body?.coupon_id;
        if (!couponId) return sendJson(res, 400, { error: 'coupon_id가 필요합니다.' });
        const list = adminState.merchantPromoOptOuts[storeId] || [];
        const idx = list.indexOf(couponId);
        let optedIn;
        if (idx >= 0) {
          list.splice(idx, 1);
          optedIn = true;
        } else {
          list.push(couponId);
          optedIn = false;
        }
        adminState.merchantPromoOptOuts[storeId] = list;
        saveAdminState();
        return sendJson(res, 200, { success: true, store_id: storeId, coupon_id: couponId, opted_in: optedIn });
      }

      // 5-0) 소비자 PWA 공개 피드 (배너·공지·점검모드·Zero-PII 포인트 잔액·적용가능 쿠폰): GET /api/food/public-feed
      if (pathname === '/api/food/public-feed' && method === 'GET') {
        const custUid = url.searchParams.get('customer_uid') || '';
        const storeId = url.searchParams.get('store_id') || foodService.getStoreInfo()?.store_id || 'STR-11-650-01-56162-0001';
        const adminState = ensureAdminState();
        const activeBanners = (adminState?.banners || []).filter(b => b.active);
        const optOuts = new Set(adminState?.merchantPromoOptOuts?.[storeId] || []);
        const platformCoupons = (adminState?.platformCoupons || []).filter(c => c.status === 'ACTIVE' && !optOuts.has(c.id));
        const merchantCoupons = typeof foodService.getCoupons === 'function' ? foodService.getCoupons() : [];
        const pointBalance = custUid && adminState?.pointLedger
          ? adminState.pointLedger
              .filter(tx => tx.customer_uid === custUid)
              .reduce((sum, tx) => sum + Number(tx.delta || 0), 0)
          : 0;
        return sendJson(res, 200, {
          success: true,
          customer_uid: custUid,
          point_balance: Math.max(0, pointBalance),
          banners: activeBanners,
          platform_coupons: platformCoupons,
          merchant_coupons: merchantCoupons,
          maintenance_mode: Boolean(adminState?.systemPolicies?.maintenance_mode),
          maintenance_notice: adminState?.systemPolicies?.maintenance_notice || ''
        });
      }

      // 5-1) 신규 주문 생성 (PWA / 모바일 웹): POST /api/food/orders
      if (pathname === '/api/food/orders' && method === 'POST') {
        const body = await parseJsonBody(req);
        const adminState = ensureAdminState();
        if (adminState?.systemPolicies?.maintenance_mode) {
          return sendJson(res, 503, { error: adminState.systemPolicies.maintenance_notice || '시스템 점검 중입니다.' });
        }
        if (body?.customer_uid && adminState?.blacklistedUids?.has(body.customer_uid)) {
          return sendJson(res, 403, { error: '이용이 제한된 고객 식별자(UID)입니다.' });
        }

        // 4자 프로모션 중복 규칙 검증 및 부담 주체 스냅샷 (플랫폼/제휴 1개 + 가맹점 1개 + 포인트)
        const ap = body?.applied_promotions || {};
        const itemsSubtotal = Array.isArray(body?.items)
          ? body.items.reduce((s, it) => s + (Number(it.total_price) || (Number(it.price || 0) * (Number(it.quantity) || 1))), 0)
          : 0;
        let platformDiscount = 0;
        let allianceDiscount = 0;
        let merchantDiscount = 0;
        let pointUsed = 0;

        if (ap.platform_coupon_id) {
          const pc = (adminState.platformCoupons || []).find(c => c.id === ap.platform_coupon_id && c.status === 'ACTIVE');
          if (pc && itemsSubtotal >= Number(pc.min_order_amount || 0)) {
            const amt = Number(pc.discount_amount || 0);
            const pRatio = Number(pc.cost_split?.platform ?? 100) / 100;
            const aRatio = Number(pc.cost_split?.alliance ?? 0) / 100;
            const mRatio = Number(pc.cost_split?.merchant ?? 0) / 100;
            platformDiscount += Math.round(amt * pRatio);
            allianceDiscount += Math.round(amt * aRatio);
            merchantDiscount += Math.round(amt * mRatio);
          }
        }
        if (ap.merchant_coupon_id && typeof foodService.getCoupons === 'function') {
          const mc = foodService.getCoupons().find(c => (c.id === ap.merchant_coupon_id || c.coupon_id === ap.merchant_coupon_id));
          if (mc && itemsSubtotal >= Number(mc.min_order_amount || 0)) {
            merchantDiscount += Number(mc.discount_amount || 0);
          }
        }
        if (Number(ap.point_used || 0) > 0 && body?.customer_uid) {
          const currBal = (adminState.pointLedger || [])
            .filter(t => t.customer_uid === body.customer_uid)
            .reduce((s, t) => s + Number(t.delta || 0), 0);
          pointUsed = Math.min(Math.max(0, currBal), Math.floor(Number(ap.point_used)));
          if (pointUsed > 0) {
            adminState.pointLedger.unshift({
              tx_id: `ptx_use_${Date.now()}`,
              customer_uid: body.customer_uid,
              order_id: 'pending',
              delta: -pointUsed,
              balance_after: currBal - pointUsed,
              type: 'USE_ORDER',
              bearer: 'PLATFORM',
              memo: '주문 포인트 사용 차감',
              created_at: new Date().toISOString()
            });
          }
        }

        const totalDiscount = platformDiscount + allianceDiscount + merchantDiscount + pointUsed;
        if (totalDiscount > 0) {
          body.discount_amount = totalDiscount;
        }

        const newOrder = foodService.createOrder(body);
        newOrder.applied_promotions = {
          platform_coupon_id: ap.platform_coupon_id || null,
          merchant_coupon_id: ap.merchant_coupon_id || null,
          platform_discount: platformDiscount,
          alliance_discount: allianceDiscount,
          merchant_discount: merchantDiscount,
          point_used: pointUsed,
          total_discount: totalDiscount
        };
        if (body?.customer_uid) {
          newOrder.customer_uid = body.customer_uid;
        }
        foodService.saveData();

        // 실결제 비례 포인트 자동 적립 (Zero-PII 원장)
        const earnRate = Number(adminState?.pointPolicy?.earn_rate_pct || 0);
        const earned = body?.customer_uid && earnRate > 0
          ? Math.floor((Number(newOrder.final_payment_amount || 0) * earnRate) / 100)
          : 0;
        if (earned > 0 && adminState?.pointLedger) {
          const prevBal = adminState.pointLedger
            .filter(t => t.customer_uid === body.customer_uid)
            .reduce((s, t) => s + Number(t.delta || 0), 0);
          adminState.pointLedger.unshift({
            tx_id: `ptx_${Date.now()}`,
            customer_uid: body.customer_uid,
            order_id: newOrder.order_id,
            delta: earned,
            balance_after: Math.max(0, prevBal) + earned,
            type: 'EARN_ORDER',
            bearer: 'PLATFORM',
            memo: `주문(${newOrder.short_display_id}) ${earnRate}% 자동 적립`,
            created_at: new Date().toISOString()
          });
          saveAdminState();
        } else if (pointUsed > 0) {
          saveAdminState();
        }

        // DOC-17 제4장: 실시간 MQTT 중추망 브로드캐스트 발행 (0.01초 단말기/KDS 직결)
        const storeId = newOrder.store_id || foodService.getStoreInfo()?.store_id || 'STR-11-650-01-56162-0001';
        mqttBridge.publish(`aitip/stores/${storeId}/orders`, newOrder);

        return sendJson(res, 201, { success: true, order: newOrder, earned_points: earned });
      }

      // 5-1-1) CTI 모의 전화 인입 테스트용 API: POST /api/food/telephony/simulate
      if (pathname === '/api/food/telephony/simulate' && method === 'POST') {
        const body = await parseJsonBody(req);
        const callerPhone = body.caller_phone || '010-5882-9258';
        const deviceId = body.device_id || 'DEV-CTI-882910';
        const telephonyEvent = {
          device_id: deviceId,
          caller_phone: callerPhone,
          call_time: new Date().toISOString(),
          ring_count: body.ring_count || 1,
          line_no: body.line_no || 1,
          customer_name: body.customer_name || '단골손님 (홍길동)',
          recent_orders: foodService.getLiveOrders().slice(0, 3)
        };
        mqttBridge.publish(`aitip/devices/${deviceId}/telephony`, telephonyEvent);
        return sendJson(res, 200, { success: true, event: telephonyEvent });
      }

      // 5-2) 실시간 주문 추적 조회 (PWA 고객용): GET /api/food/orders/:id/track
      const trackMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/track$/);
      if (trackMatch && method === 'GET') {
        const orderId = trackMatch[1];
        const trackData = foodService.getOrderTrack(orderId);
        if (!trackData) {
          return sendJson(res, 404, { success: false, error: '주문 내역을 찾을 수 없습니다.' });
        }
        return sendJson(res, 200, { success: true, track: trackData });
      }

      // 5-3) 단일 주문 상세 조회: GET /api/food/orders/:id
      const singleOrderMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)$/);
      if (singleOrderMatch && method === 'GET') {
        const orderId = singleOrderMatch[1];
        const order = foodService.getOrderById(orderId);
        if (!order) {
          return sendJson(res, 404, { success: false, error: '주문 내역을 찾을 수 없습니다.' });
        }
        return sendJson(res, 200, { success: true, order });
      }

      // 6) 주문 수락: /api/food/orders/:id/accept
      const acceptMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/accept$/);
      if (acceptMatch && method === 'POST') {
        const orderId = acceptMatch[1];
        const body = await parseJsonBody(req);
        const accepted = foodService.acceptOrder(orderId, body.prep_time_minutes);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || accepted);
        return sendJson(res, 200, { success: true, order: accepted });
      }

      // 6-0) 주문 완료 처리: /api/food/orders/:id/complete
      const completeMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/complete$/);
      if (completeMatch && method === 'POST') {
        const orderId = completeMatch[1];
        const completed = foodService.completeOrder(orderId);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || completed);
        return sendJson(res, 200, { success: true, order: completed });
      }

      // 6-1) 라이더 배차 상태 변경: /api/food/orders/:id/rider-status
      const riderStatusMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/rider-status$/);
      if (riderStatusMatch && method === 'PATCH') {
        const orderId = riderStatusMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateRiderStatus(orderId, body.rider_dispatch_status);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || updatedOrder);
        return sendJson(res, 200, { success: true, order: updatedOrder });
      }

      // 6-2) 하이브리드 배달 방식 (자체 배달 vs 대행 호출): /api/food/orders/:id/delivery-method
      const deliveryMethodMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/delivery-method$/);
      if (deliveryMethodMatch && method === 'PATCH') {
        const orderId = deliveryMethodMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateDeliveryMethod(orderId, body);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || updatedOrder);
        return sendJson(res, 200, { success: true, order: updatedOrder });
      }

      // 6-3) 매장 식사(DINE_IN) 테이블 착석/완료: /api/food/orders/:id/dine-in-status
      const dineInStatusMatch = pathname.match(/^\/api\/food\/orders\/([^/]+)\/dine-in-status$/);
      if (dineInStatusMatch && method === 'PATCH') {
        const orderId = dineInStatusMatch[1];
        const body = await parseJsonBody(req);
        const updatedOrder = foodService.updateDineInStatus(orderId, body);
        mqttBridge.publish(`aitip/orders/${orderId}/status`, foodService.getOrderTrack(orderId) || updatedOrder);
        return sendJson(res, 200, { success: true, order: updatedOrder });
      }

      // 6-4) 매장 사이드바 메뉴 순서 저장: PUT /api/food/store/nav-order
      if (pathname === '/api/food/store/nav-order' && method === 'PUT') {
        const body = await parseJsonBody(req);
        const result = foodService.updateStoreNavOrder(body.nav_order);
        return sendJson(res, 200, { success: true, store: result.store });
      }

      // 6-5) 매장 운영 형태(배달전문 vs 홀중심 vs 복합): PUT /api/food/store/operation-type
      if (pathname === '/api/food/store/operation-type' && method === 'PUT') {
        const body = await parseJsonBody(req);
        const result = foodService.updateStoreType(body.store_operation_type);
        return sendJson(res, 200, { success: true, store: result.store });
      }

      // 6-5b) 5대 업종 공통 가맹점 메타 블록 (주차/위치/시설/공지): PUT /api/food/store/blocks
      if (pathname === '/api/food/store/blocks' && method === 'PUT') {
        const body = await parseJsonBody(req);
        const result = foodService.updateStoreBlocks(body);
        return sendJson(res, 200, result);
      }

      // 6-6) 매장 식사(홀) 테이블 현황: GET /api/food/dinein/tables
      if (pathname === '/api/food/dinein/tables' && method === 'GET') {
        return sendJson(res, 200, foodService.getDineInTables());
      }

      // 6-7) 홀 예약 목록: GET /api/food/dinein/reservations
      if (pathname === '/api/food/dinein/reservations' && method === 'GET') {
        return sendJson(res, 200, foodService.getDineInReservations());
      }

      // 6-8) 홀 예약 승인(확정): POST /api/food/dinein/reservations/:id/confirm
      const resConfirmMatch = pathname.match(/^\/api\/food\/dinein\/reservations\/([^/]+)\/confirm$/);
      if (resConfirmMatch && method === 'POST') {
        const resId = resConfirmMatch[1];
        const result = foodService.confirmDineInReservation(resId);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 6-9) 홀 고객 착석(SEATED): POST /api/food/dinein/reservations/:id/seat
      const resSeatMatch = pathname.match(/^\/api\/food\/dinein\/reservations\/([^/]+)\/seat$/);
      if (resSeatMatch && method === 'POST') {
        const resId = resSeatMatch[1];
        const body = await parseJsonBody(req).catch(() => ({}));
        const result = foodService.seatDineInReservation(resId, body.table_no);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 6-10) 식사 완료 및 퇴장(COMPLETED): POST /api/food/dinein/reservations/:id/complete
      const resCompleteMatch = pathname.match(/^\/api\/food\/dinein\/reservations\/([^/]+)\/complete$/);
      if (resCompleteMatch && method === 'POST') {
        const resId = resCompleteMatch[1];
        const body = await parseJsonBody(req).catch(() => ({}));
        const result = foodService.completeDineInReservation(resId, body.table_no);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 6-11) 예약 거절/취소: POST /api/food/dinein/reservations/:id/cancel
      const resCancelMatch = pathname.match(/^\/api\/food\/dinein\/reservations\/([^/]+)\/cancel$/);
      if (resCancelMatch && method === 'POST') {
        const resId = resCancelMatch[1];
        const body = await parseJsonBody(req).catch(() => ({}));
        const result = foodService.cancelDineInReservation(resId, body.reason);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 7) 고객 리뷰 목록: GET /api/food/reviews
      if (pathname === '/api/food/reviews' && method === 'GET') {
        return sendJson(res, 200, foodService.getReviews());
      }

      // 7-1) 리뷰 사장님 답글: POST /api/food/reviews/:id/reply
      const reviewReplyMatch = pathname.match(/^\/api\/food\/reviews\/([^/]+)\/reply$/);
      if (reviewReplyMatch && method === 'POST') {
        const reviewId = reviewReplyMatch[1];
        const body = await parseJsonBody(req);
        const updatedReview = foodService.replyReview(reviewId, body.reply);
        return sendJson(res, 200, { success: true, review: updatedReview });
      }

      // 7-2) DOC-12 악성 리뷰 24시간 임시 블라인드 소명: POST /api/food/reviews/:id/blind
      const reviewBlindMatch = pathname.match(/^\/api\/food\/reviews\/([^/]+)\/blind$/);
      if (reviewBlindMatch && method === 'POST') {
        const reviewId = reviewBlindMatch[1];
        const body = await parseJsonBody(req);
        const updatedReview = foodService.requestReviewBlind(reviewId, body.reason);
        return sendJson(res, 200, { success: true, review: updatedReview });
      }

      // 8) 가게 쿠폰 목록 및 신규 발행: /api/food/coupons
      if (pathname === '/api/food/coupons') {
        if (method === 'GET') {
          return sendJson(res, 200, foodService.getCoupons());
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const newCoupon = foodService.createCoupon(body);
          return sendJson(res, 201, { success: true, coupon: newCoupon });
        }
      }

      return sendJson(res, 404, { error: 'Unknown food API endpoint' });
    } catch (apiErr) {
      return sendJson(res, 400, { error: apiErr.message });
    }
  }

  // 2. 루트 허브 대시보드 (오리지널 화이트 & 민트 테마, 이모지 0%, 4대 정규 서비스 완전체)
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AITIP 플랫폼 서비스 관제 허브 (:8989)</title>
  <style>
    :root {
      --bg-app: #f4f6f8;
      --bg-surface: #ffffff;
      --border-default: #e5e8eb;
      --border-strong: #d1d6db;
      --text-primary: #191f28;
      --text-secondary: #4e5968;
      --text-muted: #8b95a1;
      --brand-mint: #2ac1bc;
      --brand-mint-hover: #22a7a2;
      --brand-mint-light: #e6f7f6;
      --brand-mint-text: #0e706c;
      --nh-green: #007749;
      --nh-green-light: #eafbf3;
      --food-orange: #c25e00;
      --food-orange-light: #fff8eb;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif; }
    body {
      background: var(--bg-app);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
    }
    .header { text-align: center; margin-bottom: 36px; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--brand-mint-light);
      color: var(--brand-mint-text);
      font-weight: 700;
      font-size: 12.5px;
      padding: 5px 14px;
      border-radius: 9999px;
      border: 1px solid #b3ebe8;
      margin-bottom: 14px;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--brand-mint);
    }
    h1 {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    .subtitle {
      color: var(--text-secondary);
      font-size: 14.5px;
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      max-width: 920px;
      width: 100%;
    }
    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: 14px;
      padding: 26px;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: var(--brand-mint);
      box-shadow: 0 10px 24px -6px rgba(42, 193, 188, 0.2);
    }
    .card-top {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 12px;
    }
    .card-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-icon-box svg {
      width: 24px;
      height: 24px;
      stroke-width: 2;
      fill: none;
    }
    .card-title-wrap h2 {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .card-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: 700;
    }
    .card-desc {
      color: var(--text-secondary);
      font-size: 13.5px;
      line-height: 1.6;
      margin: 10px 0 20px 0;
    }
    .card-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 800;
      font-size: 13.5px;
      padding-top: 14px;
      border-top: 1px solid #f1f3f5;
    }
    .footer {
      margin-top: 36px;
      text-align: center;
      font-size: 12.5px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="status-pill">
      <span class="status-dot"></span>
      포트 8989 로컬 통합 가동 중
    </div>
    <h1>AITIP 플랫폼 서비스 관제 허브</h1>
    <p class="subtitle">소상공인 외식업 본체 코어와 단위농협 하나로마트 유통망 통합 런처</p>
  </div>

  <div class="grid">
    <!-- 1. 소비자 주문 모바일 PWA (최우선 배치) -->
    <a href="/food/pwa/" class="card" style="border-top: 4px solid var(--brand-mint);" target="_blank">
      <div>
        <div class="card-top">
          <div class="card-icon-box" style="background: var(--brand-mint-light); color: var(--brand-mint-text);">
            <svg viewBox="0 0 24 24" stroke="currentColor"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
          </div>
          <div class="card-title-wrap">
            <h2>소비자 모바일 주문 (PWA)</h2>
            <span class="card-badge" style="background: var(--brand-mint-light); color: var(--brand-mint-text);">모바일 웹앱 · 주문 결제</span>
          </div>
        </div>
        <p class="card-desc">배달 · 포장 · 매장식사 3-Way 주문, 써브웨이식 4단계 풀코스 옵션 위저드, 실시간 영수증 & 테이블 QR 인쇄</p>
      </div>
      <div class="card-action" style="color: var(--brand-mint-text);">
        <span>고객 주문 앱 열기</span>
        <svg style="width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.5; fill: none;" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </div>
    </a>

    <!-- 2. 소상공인 치킨집 매장 포털 -->
    <a href="/food/" class="card" style="border-top: 4px solid var(--food-orange);" target="_blank">
      <div>
        <div class="card-top">
          <div class="card-icon-box" style="background: var(--food-orange-light); color: var(--food-orange);">
            <svg viewBox="0 0 24 24" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
          <div class="card-title-wrap">
            <h2>소상공인 가맹점 포털</h2>
            <span class="card-badge" style="background: var(--food-orange-light); color: var(--food-orange);">외식업 본체 코어 (90%)</span>
          </div>
        </div>
        <p class="card-desc">배민 외식업광장급 셀프서비스, 주방 KDS 주문 접수, 조리 예상시간 선택, 옵션트리 품절 관리, BOM 원가 계산기</p>
      </div>
      <div class="card-action" style="color: var(--food-orange);">
        <span>가맹점 포털 열기</span>
        <svg style="width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.5; fill: none;" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </div>
    </a>

    <!-- 3. 단위농협 하나로마트 백오피스 -->
    <a href="/mart/" class="card" style="border-top: 4px solid var(--nh-green);" target="_blank">
      <div>
        <div class="card-top">
          <div class="card-icon-box" style="background: var(--nh-green-light); color: var(--nh-green);">
            <svg viewBox="0 0 24 24" stroke="currentColor"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          </div>
          <div class="card-title-wrap">
            <h2>단위농협 하나로마트 백오피스</h2>
            <span class="card-badge" style="background: var(--nh-green-light); color: var(--nh-green);">식품사막화 방지 유통망</span>
          </div>
        </div>
        <p class="card-desc">0.1초 아침 POS 엑셀 시세 차분 동기화, 매대 동선별 피킹 지시서, 바코드 SKU 진열, DOC-11 결품 듀얼 영수증</p>
      </div>
      <div class="card-action" style="color: var(--nh-green);">
        <span>마트 포털 열기</span>
        <svg style="width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.5; fill: none;" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </div>
    </a>

    <!-- 4. 플랫폼 마스터 관리자 (HQ) -->
    <a href="/admin/" class="card" style="border-top: 4px solid var(--brand-mint);" target="_blank">
      <div>
        <div class="card-top">
          <div class="card-icon-box" style="background: var(--brand-mint-light); color: var(--brand-mint-text);">
            <svg viewBox="0 0 24 24" stroke="currentColor"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
          </div>
          <div class="card-title-wrap">
            <h2>플랫폼 마스터 관리자 (HQ)</h2>
            <span class="card-badge" style="background: var(--brand-mint-light); color: var(--brand-mint-text);">전사 통합 관제 & 정산 (DOC-18)</span>
          </div>
        </div>
        <p class="card-desc">전국 17개 총판 · 226개 대리점 3계층 유통망, 다중자산(카드/포인트/지역화폐/코인) 3자 대사 정산, 스마트 단말기 MDM 관제</p>
      </div>
      <div class="card-action" style="color: var(--brand-mint-text);">
        <span>관리자 포털 열기</span>
        <svg style="width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.5; fill: none;" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </div>
    </a>
  </div>

  <div class="footer">
    AITIP Platform · Cloudflare D1 Architecture (278 Integrity Tests Passed) · Local Port 8989
  </div>
</body>
</html>`);
    return;
  }

  // Trailing slash redirect for base paths
  if (pathname === '/food/pwa') {
    res.writeHead(302, { 'Location': '/food/pwa/' });
    res.end();
    return;
  }
  if (pathname === '/food') {
    res.writeHead(302, { 'Location': '/food/' });
    res.end();
    return;
  }
  if (pathname === '/admin') {
    res.writeHead(302, { 'Location': '/admin/' });
    res.end();
    return;
  }
  if (pathname === '/mart') {
    res.writeHead(302, { 'Location': '/mart/' });
    res.end();
    return;
  }

  // 3-0. 전사 공용 코어 ESM 모듈 서빙 (/core/*)
  if (pathname.startsWith('/core/')) {
    const subpath = pathname.replace(/^\/core\//, '');
    const filePath = path.join(__dirname, 'packages', 'core', subpath);
    serveStatic(filePath, res);
    return;
  }

  // --------------------------------------------------------------------------
  // 2-0. 하나로마트 위탁(대행) 운영 백엔드 API (/api/mart/*)
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/mart/')) {
    try {
      if (pathname === '/api/mart/profile' && method === 'GET') {
        return sendJson(res, 200, { success: true, mart: martService.getMartProfile() });
      }
      if (pathname === '/api/mart/profile' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const mart = martService.updateMartProfile(body || {});
        return sendJson(res, 200, { success: true, mart });
      }
      if (pathname === '/api/mart/staff' && method === 'GET') {
        return sendJson(res, 200, { success: true, staff: martService.getStaff() });
      }
      if (pathname === '/api/mart/staff' && (method === 'POST' || method === 'PATCH')) {
        const body = await parseJsonBody(req);
        const staff = martService.saveStaff(body || {});
        return sendJson(res, method === 'POST' ? 201 : 200, { success: true, staff });
      }
      if (pathname === '/api/mart/staff' && method === 'DELETE') {
        const body = await parseJsonBody(req);
        const removed = martService.deleteStaff(body?.staff_id);
        return sendJson(res, 200, { success: true, removed });
      }
      if (pathname === '/api/mart/catalog' && method === 'GET') {
        return sendJson(res, 200, { success: true, ...martService.getCatalog() });
      }
      if (pathname === '/api/mart/products' && method === 'POST') {
        const body = await parseJsonBody(req);
        const item = martService.addProduct(body);
        return sendJson(res, 201, { success: true, product: item });
      }
      if (pathname === '/api/mart/products' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const item = martService.updateProduct(body || {});
        return sendJson(res, 200, { success: true, product: item });
      }
      if (pathname === '/api/mart/products/bulk-grid' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const result = martService.bulkUpdateProducts(body?.updates || []);
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/import/preview' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = martService.previewFlyerImport(body?.raw_text || '');
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/import' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = martService.bulkImport(body?.mode || 'FLYER', body?.raw_text || '');
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/promotions' && method === 'POST') {
        const body = await parseJsonBody(req);
        const promotion = martService.createPromotion(body);
        return sendJson(res, 201, { success: true, promotion });
      }
      if (pathname === '/api/mart/promotions' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const promotion = martService.updatePromotion(body || {});
        return sendJson(res, 200, { success: true, promotion });
      }
      if (pathname === '/api/mart/promotions' && method === 'DELETE') {
        const body = await parseJsonBody(req);
        const result = martService.deletePromotion(body?.id);
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/promo-types' && method === 'GET') {
        return sendJson(res, 200, { success: true, promo_types: martService.getPromoTypes() });
      }
      if (pathname === '/api/mart/promo-types' && (method === 'POST' || method === 'PATCH')) {
        const body = await parseJsonBody(req);
        const result = martService.savePromoType(body || {});
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/promo-types' && method === 'DELETE') {
        const body = await parseJsonBody(req);
        const result = martService.deletePromoType(body?.code);
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/orders' && method === 'GET') {
        return sendJson(res, 200, { success: true, orders: martService.getOrders() });
      }
      if (pathname === '/api/mart/orders' && method === 'POST') {
        const body = await parseJsonBody(req);
        const order = martService.createOrder(body);
        return sendJson(res, 201, { success: true, order });
      }
      if (pathname === '/api/mart/orders/status' && method === 'POST') {
        const body = await parseJsonBody(req);
        const order = martService.updateOrderStatus(body?.order_id, body?.status);
        return sendJson(res, 200, { success: true, order });
      }
      if (pathname === '/api/mart/picking' && method === 'GET') {
        const deliveryDate = url.searchParams.get('delivery_date') || '';
        return sendJson(res, 200, { success: true, ...martService.getPickingSummary(deliveryDate) });
      }
      if (pathname === '/api/mart/orders/adjust' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = martService.adjustOrderItem(body || {});
        return sendJson(res, 200, { success: true, ...result });
      }
      if (pathname === '/api/mart/boxing' && method === 'GET') {
        const deliveryDate = url.searchParams.get('delivery_date') || '';
        return sendJson(res, 200, { success: true, ...martService.getBoxingManifest(deliveryDate) });
      }
      if (pathname === '/api/mart/settlements' && method === 'GET') {
        return sendJson(res, 200, { success: true, ...martService.getSettlementSummary() });
      }
      if (pathname === '/api/mart/pwa/config' && method === 'GET') {
        return sendJson(res, 200, { success: true, ...martService.getPwaConfig() });
      }
      if (pathname === '/api/mart/pwa/control' && method === 'PATCH') {
        const body = await parseJsonBody(req);
        const config = martService.updatePwaControl(body || {});
        return sendJson(res, 200, { success: true, config });
      }
      if (pathname === '/api/mart/marts' && method === 'GET') {
        return sendJson(res, 200, { success: true, marts: martService.getMarts() });
      }
      if (pathname === '/api/mart/group-buys' && method === 'GET') {
        return sendJson(res, 200, { success: true, group_buys: martService.getGroupBuys() });
      }
      if (pathname === '/api/mart/group-buys' && method === 'POST') {
        const body = await parseJsonBody(req);
        const campaign = martService.createGroupBuy(body || {});
        return sendJson(res, 201, { success: true, campaign });
      }
      if (pathname === '/api/mart/products/approve' && method === 'POST') {
        const body = await parseJsonBody(req);
        const item = martService.decideMartProductApproval(body || {});
        return sendJson(res, 200, { success: true, item });
      }
      if (pathname === '/api/admin/mart/group-buys/decide' && method === 'POST') {
        const body = await parseJsonBody(req);
        const campaign = martService.decideGroupBuy(body || {});
        return sendJson(res, 200, { success: true, campaign });
      }
      if (pathname === '/api/admin/mart/co-sell-products' && method === 'POST') {
        const body = await parseJsonBody(req);
        const item = martService.createCoSellProduct(body || {});
        return sendJson(res, 201, { success: true, item });
      }
      if (pathname === '/api/mart/group-buys/join' && method === 'POST') {
        const body = await parseJsonBody(req);
        const campaign = martService.joinGroupBuy(body || {});
        return sendJson(res, 200, { success: true, campaign });
      }
      if (pathname === '/api/mart/media/upload' && method === 'POST') {
        const body = await parseJsonBody(req);
        const media = martService.saveMediaWebp(body || {});
        return sendJson(res, 201, { success: true, ...media });
      }
      return sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 3-1. 고객 전용 모바일 PWA 정적 파일 서빙 (/food/pwa/*)
  if (pathname.startsWith('/food/pwa')) {
    let subpath = pathname.replace(/^\/food\/pwa\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'food-delivery', 'customer-pwa', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 3-0-1. 마트 상품 WebP 미디어 정적 서빙 (/mart/media/* -> R2 호환 로컬 버킷)
  if (pathname.startsWith('/mart/media/')) {
    const subpath = pathname.replace(/^\/mart\/media\/?/, '');
    const filePath = path.join(__dirname, 'packages', 'services', 'mart-logistics', 'backend', 'media', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 3-0. 마트 전용 소비자·기관 모바일 PWA 정적 파일 서빙 (/mart/pwa/*)
  if (pathname.startsWith('/mart/pwa')) {
    let subpath = pathname.replace(/^\/mart\/pwa\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'mart-logistics', 'mart-pwa', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 3. 마트 포털 정적 파일 서빙 (/mart/*)
  if (pathname.startsWith('/mart')) {
    let subpath = pathname.replace(/^\/mart\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'mart-logistics', 'mart-portal', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 4. 소상공인 요식업 포털 정적 파일 서빙 (/food/*)
  if (pathname.startsWith('/food')) {
    let subpath = pathname.replace(/^\/food\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'services', 'food-delivery', 'merchant-portal', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 5. 플랫폼 마스터 관리자 포털 정적 파일 서빙 (/admin/*)
  if (pathname.startsWith('/admin')) {
    let subpath = pathname.replace(/^\/admin\/?/, '');
    if (!subpath || subpath === '') subpath = 'index.html';
    const filePath = path.join(__dirname, 'packages', 'platform-admin', subpath);
    serveStatic(filePath, res);
    return;
  }

  // 기타 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

function serveStatic(filePath, res) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 File Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// DOC-17: RFC 6455 WebSocket / MQTT 브릿지 핸드셰이크 처리
server.on('upgrade', (req, socket, head) => {
  mqttBridge.handleUpgrade(req, socket, head);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AITIP Dev Server] Running at http://localhost:${PORT}`);
  console.log(`[AITIP Hub]        http://localhost:${PORT}/`);
  console.log(`[Mart Portal]      http://localhost:${PORT}/mart/`);
  console.log(`[Food Portal]      http://localhost:${PORT}/food/`);
});
