/**
 * 브라우저 JPG/PNG -> WebP 자동 리사이즈·변환 유틸 (ESM)
 */

export async function fileToWebpDataUrl(file, maxSize = 800, quality = 0.82) {
  if (!file) throw new Error('이미지 파일이 없습니다.');
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지 로드 실패'));
      el.src = bitmapUrl;
    });
    const ratio = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round((img.width || 1) * ratio));
    const h = Math.max(1, Math.round((img.height || 1) * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/webp', quality);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
