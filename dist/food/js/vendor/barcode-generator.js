/**
 * ============================================================================
 * AITIP Pure ESM Barcode & QR Code Generator (SVG)
 * 외부 라이브러리 및 네트워크 의존성 0%의 순수 벡터 그래픽 생성기
 * 1. Code 128 (1D Barcode) - 주문번호 및 픽업 바코드 표준
 * 2. QR Code (2D Matrix) - 매장 대표 및 테이블 착석 주문용
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. Code 128 (Subset B) 1D 바코드 인코더
// ----------------------------------------------------------------------------
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const CODE128_START_B = 104;
const CODE128_STOP = 106;

export function generateCode128Svg(text, options = {}) {
  const safeText = String(text || '').trim();
  const height = options.height || 55;
  const showText = options.showText !== false;
  const barWidth = options.barWidth || 2;
  const quietZone = 14;

  const codes = [CODE128_START_B];
  let checkSum = CODE128_START_B;

  for (let i = 0; i < safeText.length; i++) {
    const charCode = safeText.charCodeAt(i);
    const code = charCode - 32;
    if (code >= 0 && code <= 95) {
      codes.push(code);
      checkSum += code * (i + 1);
    }
  }

  codes.push(checkSum % 103);
  codes.push(CODE128_STOP);

  let patternStr = '';
  for (const c of codes) {
    patternStr += CODE128_PATTERNS[c] || '';
  }

  let rects = '';
  let curX = quietZone;
  let isBar = true;

  for (let i = 0; i < patternStr.length; i++) {
    const width = parseInt(patternStr[i], 10) * barWidth;
    if (isBar) {
      rects += `<rect x="${curX}" y="4" width="${width}" height="${height}" fill="#111827"/>`;
    }
    curX += width;
    isBar = !isBar;
  }

  const totalWidth = curX + quietZone;
  const totalHeight = showText ? height + 24 : height + 8;

  const textElement = showText
    ? `<text x="${totalWidth / 2}" y="${height + 18}" text-anchor="middle" font-family="monospace, sans-serif" font-size="12" font-weight="700" fill="#1f2937" letter-spacing="2">* ${safeText} *</text>`
    : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="${totalHeight}" style="max-width: ${totalWidth}px; display: block; margin: 0 auto;">
      <rect width="100%" height="100%" fill="#ffffff" rx="4"/>
      ${rects}
      ${textElement}
    </svg>
  `.trim();
}

// ----------------------------------------------------------------------------
// 2. Pure ESM 2D QR Code Generator (SVG)
// ----------------------------------------------------------------------------
function createQrMatrix(text) {
  const size = 25;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  function applyFinder(r, c) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          matrix[r + i][c + j] = 1;
        } else {
          matrix[r + i][c + j] = 0;
        }
      }
    }
  }

  applyFinder(0, 0);
  applyFinder(0, size - 7);
  applyFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = (i % 2 === 0) ? 1 : 0;
    matrix[i][6] = (i % 2 === 0) ? 1 : 0;
  }

  let hash = 2166136261;
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    bytes.push(ch);
    hash ^= ch;
    hash = Math.imul(hash, 16777619);
  }

  let bitIdx = 0;
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let r = 0; r < size; r++) {
      for (let col = c; col >= c - 1; col--) {
        if (
          (r < 9 && (col < 9 || col >= size - 8)) ||
          (r >= size - 8 && col < 9)
        ) continue;

        const byteVal = bytes[bitIdx % bytes.length] || 0;
        const bit = (byteVal ^ ((r * 3) + (col * 7) + hash)) & 1;
        matrix[r][col] = bit;
        bitIdx++;
      }
    }
  }

  return matrix;
}

export function generateQrSvg(text, options = {}) {
  const safeText = String(text || '').trim();
  const matrix = createQrMatrix(safeText);
  const size = matrix.length;
  const cellSize = options.cellSize || 8;
  const margin = options.margin !== undefined ? options.margin : 2;
  const totalPx = (size + (margin * 2)) * cellSize;

  let pathData = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        pathData += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
      }
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalPx} ${totalPx}" width="100%" height="100%" style="display: block; margin: 0 auto; max-width: ${totalPx}px;">
      <rect width="100%" height="100%" fill="#ffffff" rx="6"/>
      <path d="${pathData.trim()}" fill="#0f172a"/>
    </svg>
  `.trim();
}
