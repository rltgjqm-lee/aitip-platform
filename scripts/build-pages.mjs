import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('[Build] Starting AITIP static bundle build...');

// Helper: 폴더 재귀 복사
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[Build] Warning: Source path does not exist: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. 기존 dist 폴더 초기화
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. 요식업 정적 에셋 복사 (소비자 주문 PWA 및 가맹점 관리 포털만 포함)
console.log('[Build] Copying customer PWA to dist/food/pwa...');
copyDirSync(
  path.join(ROOT_DIR, 'packages', 'services', 'food-delivery', 'customer-pwa'),
  path.join(DIST_DIR, 'food', 'pwa')
);

console.log('[Build] Copying merchant portal to dist/food...');
copyDirSync(
  path.join(ROOT_DIR, 'packages', 'services', 'food-delivery', 'merchant-portal'),
  path.join(DIST_DIR, 'food')
);

console.log('[Build] Copying platform admin to dist/admin...');
copyDirSync(
  path.join(ROOT_DIR, 'packages', 'platform-admin'),
  path.join(DIST_DIR, 'admin')
);

console.log('[Build] Copying mart portal to dist/mart...');
copyDirSync(
  path.join(ROOT_DIR, 'packages', 'services', 'mart-logistics', 'mart-portal'),
  path.join(DIST_DIR, 'mart')
);

console.log('[Build] Copying mart PWA to dist/mart/pwa...');
copyDirSync(
  path.join(ROOT_DIR, 'packages', 'services', 'mart-logistics', 'mart-pwa'),
  path.join(DIST_DIR, 'mart', 'pwa')
);

console.log('[Build] Copying mart B2B portal to dist/mart/b2b...');
copyDirSync(
  path.join(ROOT_DIR, 'packages', 'services', 'mart-logistics', 'mart-b2b'),
  path.join(DIST_DIR, 'mart', 'b2b')
);

console.log('[Build] Copying mart media assets to dist/mart/media...');
copyDirSync(
  path.join(ROOT_DIR, 'packages', 'services', 'mart-logistics', 'backend', 'media'),
  path.join(DIST_DIR, 'mart', 'media')
);

// 3. Functions 데이터 동기화
console.log('[Build] Synchronizing store_data.json & mart_data.json to functions/api...');
const functionsApiFoodDir = path.join(ROOT_DIR, 'functions', 'api', 'food');
fs.mkdirSync(functionsApiFoodDir, { recursive: true });
fs.copyFileSync(
  path.join(ROOT_DIR, 'packages', 'services', 'food-delivery', 'backend', 'data', 'store_data.json'),
  path.join(functionsApiFoodDir, 'store_data.json')
);
const functionsApiMartDir = path.join(ROOT_DIR, 'functions', 'api', 'mart');
fs.mkdirSync(functionsApiMartDir, { recursive: true });
fs.copyFileSync(
  path.join(ROOT_DIR, 'packages', 'services', 'mart-logistics', 'backend', 'data', 'mart_data.json'),
  path.join(functionsApiMartDir, 'mart_data.json')
);

// 4. 공통 관제 허브 HTML 복사 (dev-server.mjs와 100% 동일 SSOT)
console.log('[Build] Copying unified hub index.html to dist/index.html...');
fs.copyFileSync(
  path.join(ROOT_DIR, 'packages', 'hub', 'index.html'),
  path.join(DIST_DIR, 'index.html')
);

console.log('[Build] Successfully generated clean dist bundle at:', DIST_DIR);
