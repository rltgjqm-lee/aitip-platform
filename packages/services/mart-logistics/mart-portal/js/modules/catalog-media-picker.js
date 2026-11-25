/**
 * AITIP Mart Portal - 상품 등록/수정 모달 전용 이미지 업로드 · 외부 URL WebP 변환 · 공용 이미지 풀 검색 모듈 (ESM)
 */

import { escapeHtml } from '../utils/html.js';

export function bindCatalogMediaPicker({ container, martApi, fileToWebpDataUrl, onMediaSelected }) {
  const setImgStatus = (msg, isError = false) => {
    const st = container.querySelector('#mp-img-status');
    if (st) {
      st.style.color = isError ? '#b91c1c' : '#64748b';
      st.textContent = msg;
    }
  };

  const setImgPreview = (url) => {
    const box = container.querySelector('#mp-img-preview-box');
    if (box) box.innerHTML = `<img src="${escapeHtml(url)}" alt="상품 이미지" style="width: 100%; height: 100%; object-fit: cover;" />`;
  };

  const buildSharedImgName = (fallback = 'product') => {
    const nm = container.querySelector('#mp-name')?.value?.trim() || '';
    const sp = container.querySelector('#mp-spec')?.value?.trim() || '';
    const base = [nm, sp && sp !== '-' ? sp : ''].filter(Boolean).join(' ').trim() || String(fallback || 'product').replace(/\.[^.]+$/, '');
    return `${base}.webp`;
  };

  const uploadWebpBlobToShared = async (blobOrFile, originalName, barcode = '') => {
    const webpDataUrl = await fileToWebpDataUrl(blobOrFile);
    const bc = barcode || container.querySelector('#mp-barcode')?.value?.trim() || '';
    return martApi.uploadMedia({
      data_url: webpDataUrl,
      original_name: originalName || buildSharedImgName(blobOrFile?.name),
      scope: 'SHARED',
      barcode: bc
    });
  };

  const importExternalUrlAsWebp = async (url, fallbackName = 'product', barcode = '') => {
    const blob = await martApi.fetchExternalImageBlob(url);
    return uploadWebpBlobToShared(blob, buildSharedImgName(fallbackName), barcode);
  };

  const uploadProductImageFile = async (file) => {
    if (!file) return;
    setImgStatus('WebP 변환 및 공용 저장소 업로드 중...');
    const uploaded = await uploadWebpBlobToShared(file, buildSharedImgName(file.name));
    onMediaSelected({ media_id: uploaded.media_id, image_url: uploaded.image_url });
    setImgPreview(uploaded.image_url);
    setImgStatus('WebP 변환 및 공용 이미지 저장 완료');
  };

  container.querySelector('#mp-img-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await uploadProductImageFile(file);
  });

  const buildWebSearchQuery = () => {
    const nm = container.querySelector('#mp-name')?.value?.trim() || '';
    const bc = container.querySelector('#mp-barcode')?.value?.trim() || '';
    return [nm, bc].filter(Boolean).join(' ').trim();
  };

  container.querySelector('#btn-shared-img-search')?.addEventListener('click', async () => {
    const kw = container.querySelector('#mp-name')?.value?.trim() || '';
    const box = container.querySelector('#shared-img-box');
    if (!kw) { setImgStatus('상품명(예: 대파)을 먼저 입력해 주세요.', true); return; }
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<div style="font-size: 11.5px; color: #475569;">공용 이미지 풀 검색 중...</div>';
    try {
      const res = await martApi.searchSharedMedia(kw, 40);
      const list = res.items || [];
      if (list.length === 0) {
        box.innerHTML = `<div style="font-size: 11.5px; color: #64748b;">'${escapeHtml(kw)}' 관련 공용 이미지가 아직 없습니다. 아래 URL 가져오기 또는 파일 업로드로 등록하면 이후 공용으로 재사용됩니다.</div>`;
        return;
      }
      box.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 700; color: #007749;">공용 이미지 ${list.length}건 (클릭 시 재업로드 없이 연결)</span>
          <button type="button" id="btn-close-shared-img" style="border: 0; background: none; font-size: 12px; cursor: pointer; color: #64748b;">닫기</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px;">
          ${list.map((it, idx) => `
            <button type="button" class="shared-img-pick" data-idx="${idx}" style="border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; padding: 4px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 4px;">
              <img src="${escapeHtml(it.image_url)}" alt="${escapeHtml(it.label)}" style="width: 100%; height: 64px; object-fit: cover; border-radius: 4px; background: #f1f5f9;" />
              <span style="font-size: 10.5px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}</span>
            </button>
          `).join('')}
        </div>
      `;
      box.querySelector('#btn-close-shared-img')?.addEventListener('click', () => { box.style.display = 'none'; });
      box.querySelectorAll('.shared-img-pick').forEach(btn => {
        btn.addEventListener('click', () => {
          const picked = list[Number(btn.dataset.idx)];
          if (!picked) return;
          onMediaSelected({ media_id: picked.media_id || null, image_url: picked.image_url });
          setImgPreview(picked.image_url);
          setImgStatus(`공용 이미지 연결 완료 (${picked.label})`);
          box.style.display = 'none';
        });
      });
    } catch (err) {
      box.innerHTML = `<div style="font-size: 11.5px; color: #b91c1c;">공용 이미지 조회 실패: ${escapeHtml(err.message)}</div>`;
    }
  });

  container.querySelector('#btn-web-img-google')?.addEventListener('click', () => {
    const kw = buildWebSearchQuery();
    if (!kw) { setImgStatus('상품명 또는 바코드를 먼저 입력해 주세요.', true); return; }
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(kw)}`, '_blank', 'noopener,noreferrer');
  });

  container.querySelector('#btn-web-img-naver')?.addEventListener('click', () => {
    const kw = buildWebSearchQuery();
    if (!kw) { setImgStatus('상품명 또는 바코드를 먼저 입력해 주세요.', true); return; }
    window.open(`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(kw)}`, '_blank', 'noopener,noreferrer');
  });

  const runImportFromUrl = async (rawUrl = '') => {
    const url = String(rawUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      setImgStatus('http:// 또는 https://로 시작하는 이미지 주소를 붙여넣어 주세요.', true);
      return;
    }
    try {
      setImgStatus('외부 이미지 다운로드 후 WebP 변환 중...');
      const nm = container.querySelector('#mp-name')?.value?.trim() || 'product';
      const up = await importExternalUrlAsWebp(url, nm);
      onMediaSelected({ media_id: up.media_id, image_url: up.image_url });
      setImgPreview(up.image_url);
      setImgStatus('WebP 변환 및 공용 이미지 저장 완료');
    } catch (err) {
      setImgStatus(`가져오기 실패: ${err.message}`, true);
    }
  };

  container.querySelector('#btn-mp-img-url')?.addEventListener('click', async () => {
    const urlInput = container.querySelector('#mp-img-url');
    let url = urlInput?.value?.trim() || '';
    if (!url && navigator.clipboard?.readText) {
      try {
        const clip = (await navigator.clipboard.readText()).trim();
        if (clip) {
          url = clip;
          if (urlInput) urlInput.value = clip;
        }
      } catch {
        // 클립보드 권한 거부 시 안내 메시지 표시
      }
    }
    await runImportFromUrl(url);
  });

  container.querySelector('#mp-img-url')?.addEventListener('paste', (e) => {
    const pasted = (e.clipboardData?.getData('text') || '').trim();
    if (/^https?:\/\//i.test(pasted)) {
      setTimeout(() => runImportFromUrl(pasted), 0);
    }
  });

  container.querySelector('#form-mart-add')?.addEventListener('paste', async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find(it => it.type && it.type.startsWith('image/'));
    if (!imgItem) return;
    e.preventDefault();
    const file = imgItem.getAsFile();
    if (file) await uploadProductImageFile(file);
  });

  return { importExternalUrlAsWebp, setImgPreview };
}
