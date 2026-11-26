/**
 * 엑셀 호환(UTF-8 BOM) CSV 서식 다운로드 및 파일 파싱 유틸리티 (ESM)
 */

export function downloadExcelCsv(filename, headers, rows = []) {
  const escCell = (v) => {
    const s = String(v ?? '');
    if (/^\d{11,}$/.test(s)) return `"=""${s}"""`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(escCell).join(','),
    ...rows.map(r => r.map(escCell).join(','))
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readCsvOrTextFile(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('euc-kr').decode(buf);
  } catch {
    return utf8;
  }
}

export function parseDelimitedRows(rawText = '') {
  return String(rawText)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => line.split(/\t|,/).map(c => {
      let v = c.trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"');
      if (v.startsWith('="') && v.endsWith('"')) v = v.slice(2, -1);
      return v.trim();
    }));
}
