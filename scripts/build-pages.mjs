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

// 2. 각 포털 정적 에셋 복사
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

console.log('[Build] Copying mart portal to dist/mart...');
copyDirSync(
  path.join(ROOT_DIR, 'packages', 'services', 'mart-logistics', 'mart-portal'),
  path.join(DIST_DIR, 'mart')
);

// 3. 통합 테스트 런처 허브 index.html 생성
const hubHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AITIP 플랫폼 통합 테스트 허브</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --food: #f97316;
      --mart: #22c55e;
      --pwa: #06b6d4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Pretendard", sans-serif; }
    body {
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 36px;
      max-width: 680px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
      border: 1px solid rgba(56, 189, 248, 0.3);
      margin-bottom: 12px;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    p.desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 16px;
      width: 100%;
      max-width: 960px;
      margin-bottom: 36px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 22px;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
    }
    .card-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .card-icon {
      font-size: 24px;
      line-height: 1;
    }
    .card h2 {
      font-size: 17px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .card-badge {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      display: inline-block;
    }
    .badge-pwa { background: rgba(6, 182, 212, 0.18); color: var(--pwa); }
    .badge-food { background: rgba(249, 115, 22, 0.18); color: var(--food); }
    .badge-mart { background: rgba(34, 197, 94, 0.18); color: var(--mart); }
    .card-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 18px;
      flex: 1;
    }
    .card-link {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .footer {
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="badge">AITIP Live Platform Test Hub</div>
    <h1>AITIP 통합 플랫폼 테스트 런처</h1>
    <p class="desc">소비자 모바일 주문 PWA, 가맹점주 주방 KDS 및 매장 관리 포털을 실시간으로 테스트할 수 있습니다.</p>
  </div>

  <div class="grid">
    <a href="/food/pwa/" class="card" target="_blank" rel="noopener">
      <div>
        <div class="card-top">
          <span class="card-icon">&#128241;</span>
          <div>
            <h2>소비자 주문 모바일 PWA</h2>
            <span class="card-badge badge-pwa">스마트폰 / 모바일 웹</span>
          </div>
        </div>
        <p class="card-desc">배달/포장/홀 예약, 3단 차별화 메뉴판, 서브웨이식 옵션 선택, 다음/카카오 도로명 주소 검색, 0504 안심번호 연동</p>
      </div>
      <div class="card-link" style="color: var(--pwa);">모바일 PWA 열기 &rarr;</div>
    </a>

    <a href="/food/" class="card" target="_blank" rel="noopener">
      <div>
        <div class="card-top">
          <span class="card-icon">&#128421;</span>
          <div>
            <h2>가맹점주 통합 포털</h2>
            <span class="card-badge badge-food">태블릿 KDS / PC 관리자</span>
          </div>
        </div>
        <p class="card-desc">실시간 주방 KDS 주문 수락, 딩동 음성 알림, 조리 시간 선택, 영수증 인쇄, 메뉴 품절 및 영업 관리</p>
      </div>
      <div class="card-link" style="color: var(--food);">가맹점 포털 열기 &rarr;</div>
    </a>

    <a href="/mart/" class="card" target="_blank" rel="noopener">
      <div>
        <div class="card-top">
          <span class="card-icon">&#128722;</span>
          <div>
            <h2>하나로마트 물류 포털</h2>
            <span class="card-badge badge-mart">식자재 직송 물류</span>
          </div>
        </div>
        <p class="card-desc">농협 하나로마트 식자재 공급, 피킹/패킹 작업 지시 및 배송원 연계 물류 관리 시스템</p>
      </div>
      <div class="card-link" style="color: var(--mart);">물류 포털 열기 &rarr;</div>
    </a>
  </div>

  <div class="footer">
    AITIP Platform &middot; Cloudflare Edge Deployment &middot; All Services Ready
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), hubHtml, 'utf-8');

console.log('[Build] Successfully generated dist bundle at:', DIST_DIR);
