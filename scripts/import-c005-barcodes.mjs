/**
 * AITIP Platform - 식품안전나라 C005(바코드연계제품정보) 현행 생산분 D1 분할 적재 스크립트 (ESM)
 * 사용법:
 *   1) 드라이런 검수: node scripts/import-c005-barcodes.mjs --dry-run
 *   2) 분할 실반영:   node scripts/import-c005-barcodes.mjs --apply --offset=0 --limit=1000
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_GZ_PATH = 'C:\\Users\\user\\Downloads\\C005.csv.gz';
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

export function generateBarcodeCatalogId() {
  const ts = Date.now().toString(32).toLowerCase().padStart(10, '0').slice(-10);
  let tail = '';
  for (let i = 0; i < 15; i++) tail += CROCKFORD[Math.floor(Math.random() * 32)];
  return `bar_0${ts}${tail}`.slice(0, 30);
}

function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

function getArgValue(args, prefix, fallback) {
  const found = args.find(a => a.startsWith(prefix));
  if (!found) return fallback;
  const val = Number(found.slice(prefix.length));
  return Number.isFinite(val) && val >= 0 ? val : fallback;
}

function getArgStr(args, prefix, fallback) {
  const found = args.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const offset = getArgValue(args, '--offset=', 0);
  const limit = getArgValue(args, '--limit=', 1000);
  const inputPath = getArgStr(args, '--file=', DEFAULT_GZ_PATH);

  if (!fs.existsSync(inputPath)) {
    console.error(`[Error] 입력 파일을 찾을 수 없습니다: ${inputPath}`);
    process.exit(1);
  }

  console.log(`[C005 Import] 모드: ${isApply ? 'APPLY (D1 분할 적재)' : 'DRY-RUN (현행 생산분 검수)'}`);
  const rawBuf = fs.readFileSync(inputPath);
  const csvText = (inputPath.endsWith('.gz') ? zlib.gunzipSync(rawBuf) : rawBuf).toString('utf8').replace(/^\uFEFF/, '');
  const lines = csvText.split(/\r?\n/);
  const header = parseCsvLine(lines[0] || '');
  const idxEnd = header.indexOf('END_DT');
  const idxName = header.indexOf('PRDLST_NM');
  const idxCat = header.indexOf('PRDLST_DCNM');
  const idxMaker = header.indexOf('BSSH_NM');
  const idxBar = header.indexOf('BAR_CD');

  if (idxName < 0 || idxBar < 0 || idxEnd < 0) {
    throw new Error(`필수 컬럼 누락: ${header.join(', ')}`);
  }

  const byBarcode = new Map();
  let totalRows = 0;
  let endedSkipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    totalRows += 1;
    const cols = parseCsvLine(line);
    if ((cols[idxEnd] || '').trim() !== '') {
      endedSkipped += 1;
      continue;
    }
    const bc = String(cols[idxBar] || '').replace(/[^0-9]/g, '');
    const name = String(cols[idxName] || '').trim();
    if (!/^\d{8,14}$/.test(bc) || /^2\d{12}$/.test(bc) || !name) continue;
    if (!byBarcode.has(bc)) {
      byBarcode.set(bc, {
        barcode: bc,
        product_name: name,
        manufacturer: String(cols[idxMaker] || '').trim(),
        category_name: String(cols[idxCat] || '').trim()
      });
    }
  }

  const activeList = Array.from(byBarcode.values());
  const previewPath = path.join(ROOT_DIR, 'scratch', 'c005_active_preview.json');
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.writeFileSync(previewPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_csv_rows: totalRows,
    ended_skipped: endedSkipped,
    active_unique_barcodes: activeList.length,
    sample: activeList.slice(0, 10)
  }, null, 2), 'utf8');

  console.log(`[C005 Import] 전체 행: ${totalRows} | 생산종료 제외: ${endedSkipped} | 현행 유효 바코드(중복제거): ${activeList.length}`);
  console.log(`[C005 Import] 미리보기 저장: ${previewPath}`);

  if (!isApply) return;

  const slice = limit > 0 ? activeList.slice(offset, offset + limit) : activeList.slice(offset);
  console.log(`[C005 Apply] 이번 배치: offset=${offset}, count=${slice.length} (전체 ${activeList.length}건 중)`);

  const escSql = (s = '') => `'${String(s).replace(/'/g, "''")}'`;
  const now = Date.now();
  const sqlLines = slice.map(item => {
    const id = generateBarcodeCatalogId();
    return `INSERT INTO shared_barcode_catalog (id, barcode, product_name, manufacturer, standard_spec, category_name, allergens_text, image_r2_key, image_url, source_type, created_at, updated_at) VALUES (${escSql(id)}, ${escSql(item.barcode)}, ${escSql(item.product_name)}, ${escSql(item.manufacturer)}, NULL, ${escSql(item.category_name)}, NULL, NULL, NULL, 'MFDS', ${now}, ${now}) ON CONFLICT(barcode) DO NOTHING;`;
  });

  const CHUNK_SIZE = 1000;
  let chunkNo = 0;
  for (let i = 0; i < sqlLines.length; i += CHUNK_SIZE) {
    const chunk = sqlLines.slice(i, i + CHUNK_SIZE);
    const sqlPath = path.join(ROOT_DIR, 'scratch', `c005_chunk_${offset}_${chunkNo}.sql`);
    fs.writeFileSync(sqlPath, chunk.join('\n'), 'utf8');
    execFileSync('cmd', ['/c', 'npx', 'wrangler', 'd1', 'execute', 'aitip-core-db', '--remote', '--yes', '--file', sqlPath], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    chunkNo += 1;
  }

  const nextOffset = offset + slice.length;
  console.log(`[C005 Apply] 완료: ${slice.length}건 처리 (${chunkNo}청크). 다음 배치 시작 오프셋: ${nextOffset} / ${activeList.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
