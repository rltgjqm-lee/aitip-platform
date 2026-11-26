/**
 * AITIP Platform - Automated Regression & Quality Gate Suite (ESM)
 * 외부 의존성 0개 (Node.js 내장 node:test + node:assert/strict)
 * 실행: node scripts/run-regression-tests.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  DEFAULT_SESSION_TTL_SECONDS,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  parseCookies,
  buildSessionCookieHeader,
  nextAuthUid
} from '../packages/core/shared/auth-crypto.mjs';

import {
  SESSION_TTL_SECONDS,
  resolveTenantMartId,
  checkMartApiAccess,
  canModifyMediaObject
} from '../packages/services/mart-logistics/backend/mart-auth-guard.mjs';

import { reserveInventoryForOrder } from '../packages/services/mart-logistics/backend/mart-inventory-tx.mjs';
import { parseMartPosCsv } from '../packages/core/merchant-meta/mart-catalog-parser.mjs';
import { applyDailyPriceBatchToData } from '../packages/services/mart-logistics/backend/mart-price-batch.mjs';
import { parseDelimitedRows } from '../packages/services/mart-logistics/mart-portal/js/utils/excel-csv.js';

function collectJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor' || entry.name === 'node_modules') continue;
      collectJsFiles(full, out);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
}

test('1. 전사 핵심 ESM/JS 파일 구문 검사 (node --check)', () => {
  const roots = [
    'functions/api',
    'packages/core/shared',
    'packages/core/merchant-meta',
    'packages/services/mart-logistics/backend',
    'packages/services/mart-logistics/mart-portal/js',
    'packages/platform-admin/js',
    'packages/services/food-delivery/merchant-portal/js'
  ];
  const files = roots.flatMap(r => collectJsFiles(path.resolve(r)));
  assert.ok(files.length >= 25, `검사 대상 파일 수가 예상보다 적습니다: ${files.length}`);
  for (const f of files) {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  }
});

test('2. 인증 암호화(PBKDF2-SHA256) · 1시간 세션 · 쿠키 · 단조 UID 검증', async () => {
  assert.equal(DEFAULT_SESSION_TTL_SECONDS, 3600);
  assert.equal(SESSION_TTL_SECONDS, 3600);

  const hash = await hashPassword('SecurePass#2026');
  assert.ok(hash.startsWith('pbkdf2_sha256$100000$'));
  assert.equal(await verifyPassword('SecurePass#2026', hash), true);
  assert.equal(await verifyPassword('WrongPass#2026', hash), false);

  const token = generateSessionToken();
  assert.ok(token.length >= 40);
  const digest = await hashSessionToken(token);
  assert.equal(digest.length, 64);

  const header = buildSessionCookieHeader(token);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Max-Age=3600/);
  const parsed = parseCookies(header.split(';')[0]);
  assert.equal(parsed.aitip_sid, token);

  const uids = new Set(Array.from({ length: 20 }, () => nextAuthUid('usr')));
  assert.equal(uids.size, 20);
});

test('3. RBAC 권한 매트릭스 · 멀티마트 테넌트 격리 · R2 공용 풀 보호 검증', () => {
  const spoofReq = {
    url: 'https://aitip-platform.pages.dev/api/mart/products?mart_id=MRT-OTHER',
    headers: new Map([['X-Mart-Id', 'MRT-OTHER']])
  };
  const martCtx = { role: 'MART_ADMIN', user: { id: 'usr_1', mart_id: 'MRT-11-650-01-47121-0001' } };
  const superCtx = { role: 'SUPER_ADMIN', user: { id: 'usr_0', mart_id: null } };
  const pickerCtx = { role: 'MART_PICKER', user: { id: 'usr_2', mart_id: 'MRT-11-650-01-47121-0001' } };

  assert.equal(resolveTenantMartId(martCtx, spoofReq), 'MRT-11-650-01-47121-0001');
  assert.equal(resolveTenantMartId(superCtx, spoofReq), 'MRT-OTHER');

  assert.equal(checkMartApiAccess('GET', 'catalog', null).allowed, true);
  assert.equal(checkMartApiAccess('GET', 'marts', null).allowed, true);
  assert.equal(checkMartApiAccess('POST', 'b2b/login', null).allowed, true);
  assert.equal(checkMartApiAccess('POST', 'products', null).status, 401);
  assert.equal(checkMartApiAccess('POST', 'prices/batch', pickerCtx).status, 403);
  assert.equal(checkMartApiAccess('GET', 'picking', pickerCtx).allowed, true);
  assert.equal(checkMartApiAccess('POST', 'marts', martCtx).status, 403);
  assert.equal(checkMartApiAccess('POST', 'marts', superCtx).allowed, true);

  assert.equal(
    canModifyMediaObject(martCtx, { domain: 'SHARED', tenant_id: 'MRT-11-650-01-47121-0001' }, { isDelete: true }),
    false
  );
  assert.equal(
    canModifyMediaObject(superCtx, { domain: 'SHARED', tenant_id: 'MRT-11-650-01-47121-0001' }, { isDelete: true }),
    true
  );
});

test('4. 원자적 재고·행사 한정수량 차감 및 초과 판매 시 자동 보상 롤백 검증', async () => {
  const prods = new Map([
    ['p1', { id: 'p1', name: '사과', stock_qty: 5, applied_promo_id: 'pr1' }],
    ['p2', { id: 'p2', name: '배', stock_qty: 1, applied_promo_id: null }]
  ]);
  const promos = new Map([
    ['pr1', { id: 'pr1', name: '특가', total_limit_qty: 3, used_qty: 0, status: 'ACTIVE' }]
  ]);

  const mockDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM products')) return prods.get(args[0]) || null;
              if (sql.includes('FROM store_promotions')) return promos.get(args[0]) || null;
              return null;
            },
            async run() {
              if (sql.includes('stock_qty = stock_qty - ?')) {
                const p = prods.get(args[2]);
                if (p && p.stock_qty >= args[0]) { p.stock_qty -= args[0]; return { meta: { changes: 1 } }; }
                return { meta: { changes: 0 } };
              }
              if (sql.includes('stock_qty = stock_qty + ?')) {
                const p = prods.get(args[2]);
                if (p) { p.stock_qty += args[0]; return { meta: { changes: 1 } }; }
                return { meta: { changes: 0 } };
              }
              if (sql.includes('used_qty = used_qty + ?')) {
                const pr = promos.get(args[2]);
                if (pr && pr.status === 'ACTIVE' && pr.used_qty + args[4] <= pr.total_limit_qty) {
                  pr.used_qty += args[0];
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (sql.includes('MAX(0, used_qty - ?)')) {
                const pr = promos.get(args[2]);
                if (pr) { pr.used_qty = Math.max(0, pr.used_qty - args[0]); return { meta: { changes: 1 } }; }
                return { meta: { changes: 0 } };
              }
              return { meta: { changes: 0 } };
            }
          };
        }
      };
    }
  };

  await reserveInventoryForOrder(mockDb, 'M1', [{ product_id: 'p1', qty: 2 }]);
  assert.equal(prods.get('p1').stock_qty, 3);
  assert.equal(promos.get('pr1').used_qty, 2);

  await assert.rejects(
    () => reserveInventoryForOrder(mockDb, 'M1', [{ product_id: 'p1', qty: 1 }, { product_id: 'p2', qty: 2 }]),
    (err) => err.status === 409
  );
  // 보상 롤백으로 p1 재고와 행사 사용량이 정확히 원복되어야 함
  assert.equal(prods.get('p1').stock_qty, 3);
  assert.equal(promos.get('pr1').used_qty, 2);
});

test('5. POS 파서 단조 UID · 한셀 바코드 CSV 언랩 · 당일 시세 일괄 적용 검증', () => {
  const pos = parseMartPosCsv(
    '8801012345678,테스트두부,300g,모,면세,1000,2000,1800,2026-11-01,2026-11-30,식품\n' +
    '8801012345679,테스트콩나물,300g,봉,면세,800,1500,1200,2026-11-01,2026-11-30,농산'
  );
  assert.equal(pos.items.length, 2);
  assert.notEqual(pos.items[0].id, pos.items[1].id);
  assert.match(pos.items[0].id, /^mrt_pos_\d+_\d{4}$/);

  const parsedCsv = parseDelimitedRows('바코드,상품명\n"=""8801043015653""",신라면');
  assert.equal(parsedCsv[1][0], '8801043015653');

  const work = {
    products: [{ id: 'p1', barcode: '8801043015653', name: '신라면', cost_price: 900, regular_price: 1200, sale_price: 1100, stock_qty: 20 }],
    upload_history: []
  };
  const out = applyDailyPriceBatchToData(work, {
    rows: [{ barcode: '8801043015653', name: '신라면', sale_price: 990, stock_qty: 30 }],
    mode: 'PARTIAL'
  });
  assert.equal(out.shouldSave, true);
  assert.equal(out.result.success_count, 1);
  assert.equal(work.products[0].sale_price, 990);
  assert.equal(work.upload_history.length, 1);
});

test('6. Pages 빌드 산출물(dist) 핵심 파일 존재 검증', () => {
  const required = [
    'dist/index.html',
    'dist/core/shared/portal-auth-gate.js',
    'dist/mart/js/modules/auth-gate.js',
    'dist/admin/js/admin-app.js',
    'dist/food/js/app.js'
  ];
  for (const rel of required) {
    assert.ok(fs.existsSync(path.resolve(rel)), `필수 빌드 파일 누락: ${rel}`);
  }
});
