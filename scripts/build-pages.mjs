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

// 3. Functions 데이터 동기화
console.log('[Build] Synchronizing store_data.json to functions/api/food...');
const functionsApiFoodDir = path.join(ROOT_DIR, 'functions', 'api', 'food');
fs.mkdirSync(functionsApiFoodDir, { recursive: true });
fs.copyFileSync(
  path.join(ROOT_DIR, 'packages', 'services', 'food-delivery', 'backend', 'data', 'store_data.json'),
  path.join(functionsApiFoodDir, 'store_data.json')
);

// 4. 미니멀 대문 index.html 생성 (사족 없이 2개 버튼만 정갈하게 배치)
const hubHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AITIP 플랫폼</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif; }
    body {
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .box {
      width: 100%;
      max-width: 400px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 32px 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
      margin-bottom: 24px;
      text-align: center;
    }
    .menu-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      text-decoration: none;
      color: #0f172a;
      font-size: 15px;
      font-weight: 700;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    .btn span.arrow {
      color: #94a3b8;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="box">
    <h1>AITIP 플랫폼</h1>
    <div class="menu-list">
      <a href="/food/pwa/" class="btn" target="_blank" rel="noopener">
        <span>소비자 주문</span>
        <span class="arrow">&rarr;</span>
      </a>
      <a href="/food/" class="btn" target="_blank" rel="noopener">
        <span>가맹점 관리</span>
        <span class="arrow">&rarr;</span>
      </a>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), hubHtml, 'utf-8');

console.log('[Build] Successfully generated clean dist bundle at:', DIST_DIR);
