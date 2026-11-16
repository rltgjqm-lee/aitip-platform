/**
 * ============================================================================
 * [AITIP Core] 공용 스마트 카탈로그/할인전단 일괄 파서 (Pure ESM)
 * 용도:
 *   1. 요식업 가맹점 포털: 메뉴판 텍스트/CSV 붙여넣기 일괄 등록
 *   2. 하나로마트 포털: 할인전단(정상가 -> 할인가) 품목 일괄 등록
 * ============================================================================
 */

export function parsePriceNumber(raw) {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[,원\s]/g, '').trim();
  if (!cleaned || !/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

function splitCsvLine(line, delimiter) {
  if (delimiter !== ',') {
    return line.split(delimiter).map(s => s.trim());
  }
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

function isHeaderRow(cols) {
  const joined = cols.join(' ').toLowerCase();
  return (joined.includes('메뉴') || joined.includes('품목') || joined.includes('상품') || joined.includes('name'))
    && (joined.includes('가격') || joined.includes('정상가') || joined.includes('price'));
}

function parseFreeformLine(line, defaultCategoryName) {
  let text = line.trim();
  let categoryName = defaultCategoryName;

  const catBracket = text.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (catBracket) {
    categoryName = catBracket[1].trim() || defaultCategoryName;
    text = catBracket[2].trim();
  }

  // 마트 할인전단/할인가 표기 지원: "삼겹살 600g 24,000원 -> 18,900원"
  const arrowMatch = text.match(/^(.+?)\s+([\d,]+)\s*원?\s*(?:->|→)\s*([\d,]+)\s*원?(?:\s+(.+))?$/);
  if (arrowMatch) {
    const name = arrowMatch[1].replace(/[-/:]+$/, '').trim();
    const price = parsePriceNumber(arrowMatch[2]);
    const discountedPrice = parsePriceNumber(arrowMatch[3]);
    const description = (arrowMatch[4] || '').trim();
    return { category_name: categoryName, name, price, discounted_price: discountedPrice, description };
  }

  // 일반 자유 텍스트: "후라이드치킨 18,900원 바삭한 기본 치킨" or "치즈볼 - 5,000원"
  const priceMatch = text.match(/^(.+?)\s*(?:-|\/|:)?\s*([\d,]{3,})\s*원?(?:\s+(.+))?$/);
  if (priceMatch) {
    const name = priceMatch[1].replace(/[-/:]+$/, '').trim();
    const price = parsePriceNumber(priceMatch[2]);
    const description = (priceMatch[3] || '').trim();
    return { category_name: categoryName, name, price, discounted_price: null, description };
  }

  return { category_name: categoryName, name: text, price: null, discounted_price: null, description: '' };
}

/**
 * 텍스트 또는 CSV/TSV 원문을 구조화된 상품 목록으로 파싱합니다.
 * @param {string} rawText
 * @param {string} defaultCategoryName
 */
export function parseBulkCatalogInput(rawText, defaultCategoryName = '대표메뉴') {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let parsed;

    const delimiter = line.includes('\t') ? '\t' : (line.includes('|') ? '|' : (line.includes(',') && !/\d,\d{3}/.test(line.replace(/"[^"]*"/g, '')) ? ',' : null));

    if (delimiter) {
      const cols = splitCsvLine(line, delimiter);
      if (i === 0 && isHeaderRow(cols)) continue;

      if (cols.length === 2) {
        parsed = {
          category_name: defaultCategoryName,
          name: cols[0],
          price: parsePriceNumber(cols[1]),
          discounted_price: null,
          description: ''
        };
      } else if (cols.length >= 3) {
        const col1IsPrice = parsePriceNumber(cols[1]) !== null;
        if (col1IsPrice) {
          // 메뉴명 | 가격 | (할인가 또는 설명) | 설명
          const maybeDiscount = parsePriceNumber(cols[2]);
          parsed = {
            category_name: defaultCategoryName,
            name: cols[0],
            price: parsePriceNumber(cols[1]),
            discounted_price: maybeDiscount,
            description: maybeDiscount !== null ? (cols[3] || '') : (cols[2] || '')
          };
        } else {
          // 대분류 | 메뉴명 | 정상가 | [할인가] | [설명]
          const maybeDiscount = cols[3] !== undefined ? parsePriceNumber(cols[3]) : null;
          const desc = maybeDiscount !== null ? (cols[4] || '') : (cols[3] || cols[4] || '');
          parsed = {
            category_name: cols[0] || defaultCategoryName,
            name: cols[1] || '',
            price: parsePriceNumber(cols[2]),
            discounted_price: maybeDiscount,
            description: desc
          };
        }
      } else {
        parsed = parseFreeformLine(line, defaultCategoryName);
      }
    } else {
      parsed = parseFreeformLine(line, defaultCategoryName);
    }

    const nameOk = Boolean(parsed.name && parsed.name.trim().length > 0);
    const priceOk = parsed.price !== null && parsed.price >= 0;
    const discountOk = parsed.discounted_price === null || (parsed.discounted_price >= 0 && parsed.discounted_price <= parsed.price);

    let error = null;
    if (!nameOk) error = '메뉴/품목명 누락';
    else if (!priceOk) error = '유효한 가격 누락';
    else if (!discountOk) error = '할인가가 정상가보다 큼';

    items.push({
      category_name: (parsed.category_name || defaultCategoryName).trim(),
      name: (parsed.name || '').trim(),
      price: parsed.price ?? 0,
      discounted_price: parsed.discounted_price,
      description: (parsed.description || '').trim(),
      valid: !error,
      error
    });
  }

  const validCount = items.filter(it => it.valid).length;
  return {
    items,
    summary: {
      total: items.length,
      validCount,
      invalidCount: items.length - validCount
    }
  };
}
