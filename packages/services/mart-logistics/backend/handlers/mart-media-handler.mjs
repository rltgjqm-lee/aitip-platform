/**
 * AITIP Mart API - R2 Media, Shared Barcode & HACCP Handler (ESM)
 * 담당 엔드포인트: /media/upload, /media/shared, /media/public/*, /catalog/barcode*, /haccp/*, /catalog/barcodes/lookup
 */

import {
  buildPublicMediaKey,
  buildSharedMediaKey,
  buildPrivateEvidenceKey,
  extractRegionCodeFromUid
} from '../../../../core/shared/r2-key-builder.js';

export async function handleMartMediaRoutes({
  request,
  env,
  method,
  subPath,
  body,
  d1,
  tenantMartId,
  jsonRes
}) {
  if (subPath === 'media/upload') {
    const dataUrl = String(body.data_url || '');
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return jsonRes({ success: false, error: '유효한 이미지 Data URL이 필요합니다.' }, 400);
    const contentType = m[1];
    const binStr = atob(m[2]);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    const mediaId = `med_0${Date.now().toString(32).padStart(10, '0')}`.padEnd(30, '0').slice(0, 30);
    const martId = tenantMartId;
    const isPrivate = ['DELIVERY', 'CLAIM', 'RETURN'].includes(String(body.owner_type || '').toUpperCase());
    const isShared = !isPrivate && String(body.scope || body.domain || '').toUpperCase() === 'SHARED';
    const cleanBc = String(body.barcode || '').replace(/[^0-9]/g, '');
    const isStdBarcode = /^\d{8,14}$/.test(cleanBc) && !/^2\d{12}$/.test(cleanBc);
    const r2Key = isPrivate
      ? buildPrivateEvidenceKey({ domain: 'MART', tenantUid: martId, evidenceType: String(body.owner_type).toLowerCase(), mediaId })
      : isShared
        ? buildSharedMediaKey({ kind: isStdBarcode ? 'barcode' : 'common-pool', key: isStdBarcode ? cleanBc : mediaId })
        : buildPublicMediaKey({ domain: 'MART', tenantUid: martId, itemType: body.item_type || 'products', mediaId, variant: 'orig' });
    const bucket = isPrivate ? env?.MEDIA_PRIVATE : env?.MEDIA_PUBLIC;
    const bucketName = isPrivate ? 'aitip-media-private' : 'aitip-media-public';
    if (bucket) {
      await bucket.put(r2Key, bytes, { httpMetadata: { contentType } });
    }
    const publicUrl = isPrivate ? `/mart/media/${r2Key}` : `/api/mart/media/public/${r2Key}`;
    if (d1) {
      await d1.recordMediaObject({
        id: mediaId,
        domain: isShared ? 'SHARED' : 'MART',
        region_code: isShared ? '00-000' : extractRegionCodeFromUid(martId),
        tenant_id: isShared ? 'SHARED' : martId,
        owner_type: body.owner_type || 'PRODUCT',
        owner_id: body.owner_id || (isShared && isStdBarcode ? cleanBc : martId),
        r2_bucket_name: bucketName,
        r2_object_key: r2Key,
        original_file_name: body.original_name || 'upload.webp',
        content_type: contentType,
        file_size_bytes: bytes.byteLength,
        cdn_url: publicUrl,
        access_scope: isPrivate ? 'PRIVATE_SIGNED' : 'PUBLIC'
      });
    }
    return jsonRes({ success: true, media_id: mediaId, r2_object_key: r2Key, image_url: publicUrl });
  }

  if (method === 'GET' && subPath === 'media/shared') {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const limit = Number(url.searchParams.get('limit') || 40);
    const items = d1 ? await d1.searchSharedMedia({ q, limit }) : [];
    return jsonRes({ success: true, items });
  }

  if (method === 'GET' && subPath.startsWith('media/public/')) {
    const r2Key = subPath.slice('media/public/'.length);
    if (!r2Key || r2Key.includes('..')) return jsonRes({ success: false, error: 'Invalid media key' }, 400);
    if (!env?.MEDIA_PUBLIC) return jsonRes({ success: false, error: 'MEDIA_PUBLIC binding unavailable' }, 503);
    const obj = await env.MEDIA_PUBLIC.get(r2Key);
    if (!obj) return jsonRes({ success: false, error: 'Media not found' }, 404);
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', r2Key.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(obj.body, { status: 200, headers });
  }

  if (method === 'GET' && (subPath === 'catalog/barcode' || subPath.startsWith('catalog/barcode/') || subPath === 'haccp/search')) {
    const urlObj = new URL(request.url);
    const pathBc = subPath.startsWith('catalog/barcode/') ? subPath.slice('catalog/barcode/'.length) : '';
    const barcode = pathBc || urlObj.searchParams.get('barcode') || '';
    const q = urlObj.searchParams.get('q') || '';
    const limit = Number(urlObj.searchParams.get('limit') || 50);
    const categoryHint = urlObj.searchParams.get('category_hint') || '';
    const d1Items = d1 ? await d1.lookupSharedBarcode({ barcode, q, limit, categoryHint }) : [];
    let items = [...d1Items];

    if (subPath === 'haccp/search' && env?.HACCP_API_KEY && ((q.trim() && d1Items.length < 15) || (barcode.trim() && d1Items.length === 0))) {
      try {
        const qs = [`serviceKey=${env.HACCP_API_KEY}`, 'returnType=json', 'pageNo=1', 'numOfRows=15'];
        if (barcode.trim()) qs.push(`barcode=${encodeURIComponent(barcode.trim())}`);
        else if (q.trim()) qs.push(`prdlstNm=${encodeURIComponent(q.trim())}`);
        const hRes = await fetch(`https://apis.data.go.kr/B553748/CertImgListServiceV3/getCertImgListServiceV3?${qs.join('&')}`, {
          signal: AbortSignal.timeout(3500)
        });
        if (hRes.ok) {
          const hJson = await hRes.json();
          const raw = hJson?.body?.items || [];
          const arr = (Array.isArray(raw) ? raw : [raw]).map(w => w?.item || w).filter(Boolean);
          const seenBc = new Set(d1Items.map(i => i.barcode).filter(Boolean));
          const seenKey = new Set(d1Items.map(i => `${i.name}|${i.barcode || ''}`));
          for (const it of arr) {
            const name = String(it.prdlstNm || '').trim();
            if (!name) continue;
            const rawBc = String(it.barcode || '').replace(/[^0-9]/g, '');
            if (rawBc && seenBc.has(rawBc)) continue;
            const key = `${name}|${rawBc}`;
            if (seenKey.has(key)) continue;
            seenKey.add(key);
            if (rawBc) seenBc.add(rawBc);
            items.push({
              prdlstReportNo: it.prdlstReportNo || '',
              name,
              spec: it.capacity && it.capacity !== '알수없음' ? it.capacity : '-',
              manufacture: it.manufacture && it.manufacture !== '알수없음' ? it.manufacture : '',
              prdkind: it.prdkind || '',
              barcode: rawBc,
              image_url: it.imgurl1 || it.imgurl2 || '',
              allergy: it.allergy && it.allergy !== '알수없음' ? it.allergy : '',
              source_type: 'HACCP_LIVE'
            });
          }
        }
      } catch (_) {}
    }
    return jsonRes({ success: true, source: d1Items.length ? 'shared_barcode_catalog' : 'haccp_live', items, item: items[0] || null });
  }

  if (method === 'GET' && subPath === 'haccp/proxy-image') {
    const reqUrl = new URL(request.url);
    const src = String(reqUrl.searchParams.get('url') || '').trim();
    if (!/^https?:\/\//i.test(src)) return jsonRes({ success: false, error: '유효한 외부 이미지 URL이 필요합니다.' }, 400);
    let imgRes;
    try {
      imgRes = await fetch(src, { signal: AbortSignal.timeout(8000) });
    } catch (err) {
      return jsonRes({ success: false, error: `외부 이미지 서버 연결 실패: ${err?.message || 'timeout'}` }, 502);
    }
    if (!imgRes.ok) return jsonRes({ success: false, error: `외부 이미지 다운로드 실패 (${imgRes.status})` }, 502);
    const contentType = String(imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      return jsonRes({ success: false, error: "이미지 파일 주소가 아닙니다. '링크 주소 복사'가 아니라 사진 위 우클릭 -> '이미지 주소 복사'를 사용하거나 '이미지 복사' 후 Ctrl+V를 눌러 주세요." }, 400);
    }
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'no-store');
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(imgRes.body, { status: 200, headers });
  }

  if (method === 'POST' && subPath === 'haccp/import-image') {
    const src = String(body?.image_url || '').trim();
    if (!/^https?:\/\//i.test(src)) return jsonRes({ success: false, error: '유효한 외부 이미지 URL이 필요합니다.' }, 400);
    let imgRes;
    try {
      imgRes = await fetch(src, { signal: AbortSignal.timeout(8000) });
    } catch (err) {
      return jsonRes({ success: false, error: `외부 이미지 서버 연결 실패: ${err?.message || 'timeout'}` }, 502);
    }
    if (!imgRes.ok) return jsonRes({ success: false, error: `외부 이미지 다운로드 실패 (${imgRes.status})` }, 502);
    const contentType = String(imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      return jsonRes({ success: false, error: "이미지 파일 주소가 아닙니다. '링크 주소 복사'가 아니라 사진 위 우클릭 -> '이미지 주소 복사'를 사용하거나 '이미지 복사' 후 Ctrl+V를 눌러 주세요." }, 400);
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const mediaId = `med_0${Date.now().toString(32).padStart(10, '0')}`.padEnd(30, '0').slice(0, 30);
    const martId = tenantMartId;
    const r2Key = buildPublicMediaKey({ domain: 'MART', tenantUid: martId, itemType: 'products', mediaId, variant: 'orig' });
    if (env?.MEDIA_PUBLIC) {
      await env.MEDIA_PUBLIC.put(r2Key, bytes, { httpMetadata: { contentType } });
    }
    if (d1) {
      await d1.recordMediaObject({
        id: mediaId,
        domain: 'MART',
        region_code: extractRegionCodeFromUid(martId),
        tenant_id: martId,
        owner_type: 'PRODUCT',
        owner_id: martId,
        r2_bucket_name: 'aitip-media-public',
        r2_object_key: r2Key,
        original_file_name: String(body?.original_name || 'haccp.jpg'),
        content_type: contentType,
        file_size_bytes: bytes.byteLength,
        cdn_url: `/api/mart/media/public/${r2Key}`,
        access_scope: 'PUBLIC'
      });
    }
    return jsonRes({ success: true, media_id: mediaId, r2_object_key: r2Key, image_url: `/api/mart/media/public/${r2Key}` }, 201);
  }

  if (method === 'POST' && subPath === 'catalog/barcodes/lookup') {
    const barcodes = Array.isArray(body?.barcodes) ? body.barcodes : [];
    const map = d1 ? await d1.lookupSharedBarcodesBatch(barcodes) : {};
    return jsonRes({ success: true, source: 'shared_barcode_catalog', count: Object.keys(map).length, items_by_barcode: map });
  }

  return null;
}
