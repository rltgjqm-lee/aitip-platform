/**
 * AITIP Platform - 공공데이터포털 HACCP 가공식품 바코드 · 이미지 일괄 사전 적재 스크립트 (ESM)
 * 사용법:
 *   1) 드라이런 검수: node scripts/preload-haccp-barcodes.mjs --dry-run
 *   2) R2+D1 실반영: node scripts/preload-haccp-barcodes.mjs --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildSharedMediaKey } from '../packages/core/shared/r2-key-builder.js';

const execFileAsync = promisify(execFile);
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

async function putObjectToR2S3({ endpoint, accessKeyId, secretAccessKey, bucket, key, body, contentType = 'image/webp' }) {
  const url = new URL(`${endpoint.replace(/\/+$/, '')}/${bucket}/${key}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const host = url.host;

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, 'auto');
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization
    },
    body
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`R2 S3 PUT ${res.status}: ${errText.slice(0, 200)}`);
  }
}

export function generateBarcodeCatalogId() {
  const ts = Date.now().toString(32).toLowerCase().padStart(10, '0').slice(-10);
  let tail = '';
  for (let i = 0; i < 15; i++) tail += CROCKFORD[Math.floor(Math.random() * 32)];
  return `bar_0${ts}${tail}`.slice(0, 30);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// .env 로드
const ENV_PATH = path.join(ROOT_DIR, '.env');
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIdx = trimmed.indexOf('=');
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

const DEFAULT_KEYWORDS = [
  '신라면', '진라면', '짜파게티', '서울우유', '매일우유',
  '새우깡', '양파링', '코카콜라', '삼다수', '참치',
  '고추장', '된장', '간장', '식용유', '즉석밥'
];

export function isValidEan13(code = '') {
  const s = String(code || '').trim();
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(s[12]);
}

async function fetchHaccpByKeyword(apiKey, keyword, numOfRows = 10) {
  const qs = `serviceKey=${apiKey}&prdlstNm=${encodeURIComponent(keyword)}&returnType=json&pageNo=1&numOfRows=${numOfRows}`;
  const url = `https://apis.data.go.kr/B553748/CertImgListServiceV3/getCertImgListServiceV3?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HACCP API HTTP ${res.status} for "${keyword}"`);
  const json = await res.json();
  const items = json?.body?.items || [];
  return (Array.isArray(items) ? items : [items]).map(w => w?.item || w).filter(Boolean);
}

async function fetchHaccpPage(apiKey, pageNo = 1, numOfRows = 100, retries = 3) {
  const qs = `serviceKey=${apiKey}&returnType=json&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  const url = `https://apis.data.go.kr/B553748/CertImgListServiceV3/getCertImgListServiceV3?${qs}`;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HACCP API HTTP ${res.status} (page ${pageNo})`);
      const json = await res.json();
      const rawItems = json?.body?.items || [];
      const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).map(w => w?.item || w).filter(Boolean);
      const totalCount = Number(json?.body?.totalCount || 0);
      return { items, totalCount };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800 * attempt));
    }
  }
  throw lastErr;
}

function getArgValue(args, prefix, fallback) {
  const found = args.find(a => a.startsWith(prefix));
  if (!found) return fallback;
  const val = Number(found.slice(prefix.length));
  return Number.isFinite(val) && val > 0 ? val : fallback;
}

function collectHaccpItems(items, tag, byBarcode, rejected, reasonCounts) {
  for (const it of items) {
    const bc = String(it.barcode || '').replace(/[^0-9]/g, '');
    const img = String(it.imgurl1 || it.imgurl2 || '').trim();
    const name = String(it.prdlstNm || '').trim();
    const reject = reason => {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      rejected.push({ tag, name, barcode: bc, reason });
    };
    if (!bc || bc.length < 8 || bc.length > 14) {
      reject('바코드 누락/자릿수 오류');
      continue;
    }
    if (bc.length === 13 && !isValidEan13(bc)) {
      reject('EAN-13 체크디지트 불일치');
      continue;
    }
    if (!/^https?:\/\//i.test(img)) {
      reject('이미지 URL 없음');
      continue;
    }
    if (!byBarcode.has(bc)) {
      byBarcode.set(bc, {
        barcode: bc,
        product_name: name,
        manufacturer: String(it.manufacture || '').trim(),
        standard_spec: String(it.capacity || '').trim(),
        category_name: String(it.prdkind || '').trim(),
        allergens_text: String(it.allergy || '').trim(),
        source_image_url: img,
        r2_object_key: buildSharedMediaKey({ kind: 'barcode', key: bc, ext: 'webp' })
      });
    }
  }
}

async function runPool(items, concurrency, fn) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => worker()));
}

function convertBatchToWebp(rawDir, webpDir, barcodes) {
  const manifestPath = path.join(ROOT_DIR, 'scratch', 'haccp_webp_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ rawDir, webpDir, barcodes }), 'utf8');
  const pyCode = [
    'import json, os, sys',
    'from PIL import Image, ImageOps',
    `m = json.load(open(r'${manifestPath.replace(/\\/g, '\\\\')}', encoding='utf-8'))`,
    'os.makedirs(m["webpDir"], exist_ok=True)',
    'ok, fail = [], []',
    'for bc in m["barcodes"]:',
    '    src = os.path.join(m["rawDir"], f"{bc}.bin")',
    '    dst = os.path.join(m["webpDir"], f"{bc}.webp")',
    '    try:',
    '        with Image.open(src) as im:',
    '            im = ImageOps.exif_transpose(im)',
    '            if im.mode not in ("RGB", "RGBA"): im = im.convert("RGBA" if "A" in im.getbands() else "RGB")',
    '            im.thumbnail((800, 800))',
    '            im.save(dst, "WEBP", quality=82, method=4)',
    '        ok.append(bc)',
    '    except Exception as e:',
    '        fail.append({"barcode": bc, "error": str(e)})',
    'print(json.dumps({"ok": ok, "fail": fail}, ensure_ascii=False))'
  ].join('\n');
  const out = execFileSync('python', ['-c', pyCode], { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(out.trim());
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isScanAll = args.includes('--scan-all');
  const isRescan = args.includes('--rescan');
  const startPage = getArgValue(args, '--start-page=', 1);
  const maxPagesArg = getArgValue(args, '--max-pages=', 0);
  const concurrency = Math.min(getArgValue(args, '--concurrency=', 3), 6);
  const offset = Math.max(0, getArgValue(args, '--offset=', 0));
  const limit = Math.max(0, getArgValue(args, '--limit=', 0));
  const r2Concurrency = Math.min(getArgValue(args, '--r2-concurrency=', 10), 25);
  const previewPath = path.join(ROOT_DIR, 'scratch', 'haccp_preload_preview.json');

  let validList = [];
  if (isApply && !isScanAll && !isRescan && fs.existsSync(previewPath)) {
    const cached = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
    validList = (cached.valid || []).map(v => ({
      ...v,
      r2_object_key: buildSharedMediaKey({ kind: 'barcode', key: v.barcode, ext: 'webp' })
    }));
    console.log(`[HACCP Preload] 모드: APPLY (기존 검수 파일 ${validList.length}건 재사용)`);
  } else {
    const apiKey = process.env.HACCP_API_KEY || '';
    if (!apiKey) {
      console.error('[Error] .env에 HACCP_API_KEY가 설정되어 있지 않습니다.');
      process.exit(1);
    }

    console.log(`[HACCP Preload] 모드: ${isApply ? 'APPLY (R2+D1 실반영)' : 'DRY-RUN (검수 미리보기)'}${isScanAll ? ' [전체 페이지 스캔]' : ''}`);
    const byBarcode = new Map();
    const rejected = [];
    const reasonCounts = {};
    const failedPages = [];
    let totalScanned = 0;

    if (isScanAll || maxPagesArg > 0) {
      const numOfRows = 100;
      const first = await fetchHaccpPage(apiKey, startPage, numOfRows);
      totalScanned += first.items.length;
      collectHaccpItems(first.items, `page:${startPage}`, byBarcode, rejected, reasonCounts);

      const totalPagesAll = Math.max(1, Math.ceil(first.totalCount / numOfRows));
      const endPage = maxPagesArg > 0 ? Math.min(totalPagesAll, startPage + maxPagesArg - 1) : totalPagesAll;
      const pages = [];
      for (let p = startPage + 1; p <= endPage; p++) pages.push(p);

      console.log(`[HACCP Preload] 전체 ${first.totalCount}건 (총 ${totalPagesAll}페이지 중 ${startPage}~${endPage}페이지 스캔, 동시성=${concurrency})`);

      await runPool(pages, concurrency, async p => {
        try {
          const res = await fetchHaccpPage(apiKey, p, numOfRows);
          totalScanned += res.items.length;
          collectHaccpItems(res.items, `page:${p}`, byBarcode, rejected, reasonCounts);
        } catch (err) {
          failedPages.push({ page: p, error: err.message });
          console.warn(`[Warn] page ${p} 조회 실패:`, err.message);
        }
      });
    } else {
      for (const kw of DEFAULT_KEYWORDS) {
        try {
          const items = await fetchHaccpByKeyword(apiKey, kw, 8);
          totalScanned += items.length;
          collectHaccpItems(items, kw, byBarcode, rejected, reasonCounts);
        } catch (err) {
          console.warn(`[Warn] 키워드 "${kw}" 조회 실패:`, err.message);
        }
      }
    }

    validList = Array.from(byBarcode.values());
    fs.mkdirSync(path.dirname(previewPath), { recursive: true });
    fs.writeFileSync(previewPath, JSON.stringify({
      generated_at: new Date().toISOString(),
      scanned_count: totalScanned,
      valid_count: validList.length,
      rejected_count: rejected.length,
      reason_counts: reasonCounts,
      failed_pages: failedPages,
      valid: validList,
      rejected: rejected.slice(0, 200)
    }, null, 2), 'utf8');

    console.log(`[HACCP Preload] 스캔: ${totalScanned}건 | 유효 바코드(중복제거): ${validList.length}건 | 제외: ${rejected.length}건 | 실패 페이지: ${failedPages.length}건`);
    console.log('[HACCP Preload] 제외 사유별 집계:', reasonCounts);
    console.log(`[HACCP Preload] 검수 파일 저장: ${previewPath}`);
    console.log('--- 상위 5건 미리보기 ---');
    validList.slice(0, 5).forEach((v, i) => {
      console.log(`${i + 1}. [${v.barcode}] ${v.product_name} (${v.manufacturer || '-'}) -> ${v.r2_object_key}`);
    });
  }

  if (!isApply) return;

  const targetSlice = limit > 0 ? validList.slice(offset, offset + limit) : validList.slice(offset);
  console.log(`[HACCP Apply] 대상: offset=${offset}, count=${targetSlice.length} (전체 ${validList.length}건 중)`);

  const rawDir = path.join(ROOT_DIR, 'scratch', 'haccp_raw');
  const webpDir = path.join(ROOT_DIR, 'scratch', 'haccp_webp');
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(webpDir, { recursive: true });

  const downloaded = [];
  let downloadFail = 0;
  await runPool(targetSlice, 8, async item => {
    const rawFile = path.join(rawDir, `${item.barcode}.bin`);
    try {
      if (!fs.existsSync(rawFile) || fs.statSync(rawFile).size === 0) {
        const imgRes = await fetch(item.source_image_url);
        if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(rawFile, buf);
      }
      downloaded.push(item);
    } catch (err) {
      downloadFail += 1;
      console.warn(`[Warn] ${item.barcode} 다운로드 스킵:`, err.message);
    }
  });

  const webpRes = convertBatchToWebp(rawDir, webpDir, downloaded.map(d => d.barcode));
  const okSet = new Set(webpRes.ok || []);
  console.log(`[HACCP Apply] 다운로드: ${downloaded.length}건 (실패 ${downloadFail}건) | WebP 변환 성공: ${okSet.size}건 (실패 ${(webpRes.fail || []).length}건)`);

  const readyItems = downloaded.filter(d => okSet.has(d.barcode));
  const sqlLines = [];
  const now = Date.now();
  let uploadedCount = 0;
  let r2FailCount = 0;
  const escSql = (s = '') => `'${String(s).replace(/'/g, "''")}'`;

  const s3Endpoint = process.env.R2_S3_ENDPOINT || '';
  const s3AccessKey = process.env.R2_ACCESS_KEY_ID || '';
  const s3SecretKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const useS3Direct = Boolean(s3Endpoint && s3AccessKey && s3SecretKey);
  const effectiveConcurrency = useS3Direct ? Math.min(getArgValue(args, '--r2-concurrency=', 24), 40) : r2Concurrency;
  console.log(`[HACCP Apply] R2 업로드 모드: ${useS3Direct ? `S3 API 직결 (동시성=${effectiveConcurrency})` : `Wrangler CLI (동시성=${effectiveConcurrency})`}`);

  await runPool(readyItems, effectiveConcurrency, async item => {
    const webpFile = path.join(webpDir, `${item.barcode}.webp`);
    try {
      if (useS3Direct) {
        const webpBuf = fs.readFileSync(webpFile);
        await putObjectToR2S3({
          endpoint: s3Endpoint,
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
          bucket: 'aitip-media-public',
          key: item.r2_object_key,
          body: webpBuf,
          contentType: 'image/webp'
        });
      } else {
        await execFileAsync('cmd', ['/c', 'npx', 'wrangler', 'r2', 'object', 'put', `aitip-media-public/${item.r2_object_key}`, '--file', webpFile, '--content-type=image/webp', '--remote'], {
          cwd: ROOT_DIR
        });
      }
      const id = generateBarcodeCatalogId();
      sqlLines.push(
        `INSERT INTO shared_barcode_catalog (id, barcode, product_name, manufacturer, standard_spec, category_name, allergens_text, image_r2_key, image_url, source_type, created_at, updated_at) VALUES (${escSql(id)}, ${escSql(item.barcode)}, ${escSql(item.product_name)}, ${escSql(item.manufacturer)}, ${escSql(item.standard_spec)}, ${escSql(item.category_name)}, ${escSql(item.allergens_text)}, ${escSql(item.r2_object_key)}, ${escSql(item.source_image_url)}, 'HACCP', ${now}, ${now}) ON CONFLICT(barcode) DO UPDATE SET product_name=excluded.product_name, manufacturer=excluded.manufacturer, standard_spec=excluded.standard_spec, category_name=excluded.category_name, allergens_text=excluded.allergens_text, image_r2_key=excluded.image_r2_key, image_url=excluded.image_url, source_type=excluded.source_type, updated_at=excluded.updated_at;`
      );
      uploadedCount += 1;
      if (uploadedCount % 200 === 0 || uploadedCount === readyItems.length) {
        console.log(`[HACCP Apply] R2 업로드 진행: ${uploadedCount}/${readyItems.length}`);
      }
    } catch (err) {
      r2FailCount += 1;
      console.warn(`[Warn] ${item.barcode} R2 업로드 스킵:`, err.message);
    }
  });

  const CHUNK_SIZE = 200;
  let d1ChunkCount = 0;
  for (let i = 0; i < sqlLines.length; i += CHUNK_SIZE) {
    const chunk = sqlLines.slice(i, i + CHUNK_SIZE);
    const sqlPath = path.join(ROOT_DIR, 'scratch', `haccp_preload_chunk_${d1ChunkCount}.sql`);
    fs.writeFileSync(sqlPath, chunk.join('\n'), 'utf8');
    execFileSync('cmd', ['/c', 'npx', 'wrangler', 'd1', 'execute', 'aitip-core-db', '--remote', '--yes', '--file', sqlPath], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    d1ChunkCount += 1;
  }
  console.log(`[HACCP Preload] 완료: R2 적재 ${uploadedCount}건 (실패 ${r2FailCount}건), D1 적재 ${sqlLines.length}건 (${d1ChunkCount}청크)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
