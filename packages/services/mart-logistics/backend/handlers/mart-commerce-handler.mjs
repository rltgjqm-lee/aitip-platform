/**
 * AITIP Mart API - Commerce, Pricing, Promo, Orders & Fulfillment Handler (ESM)
 */

import { nextMonotonicId, applyDailyPriceBatchToData } from '../mart-price-batch.mjs';
import { buildPickingSummary, buildBoxingManifest, buildSettlementSummary } from '../mart-fulfillment-calc.mjs';
import { parseMartFlyerText, parseMartPosCsv, parseMartPrepSheet } from '../../../../core/merchant-meta/mart-catalog-parser.mjs';
import { buildPrivateEvidenceKey } from '../../../../core/shared/r2-key-builder.js';

export async function handleMartCommerceRoutes({
  request,
  env,
  method,
  subPath,
  body,
  d1,
  martData,
  tenantMartId,
  jsonRes
}) {
  if (subPath === 'profile') {
    if (method === 'GET') {
      if (d1) {
        const cat = await d1.getCatalog();
        return jsonRes({ success: true, mart: { ...martData.mart, ...cat.mart } });
      }
      return jsonRes({ success: true, mart: martData.mart });
    }
    if (method === 'PATCH') return jsonRes({ success: true, mart: { ...martData.mart, ...body } });
  }

  if (subPath === 'staff') {
    if (method === 'GET') return jsonRes({ success: true, staff: martData.staff || [] });
    return jsonRes({ success: true, staff: body });
  }

  if (subPath === 'catalog') {
    if (d1) {
      const cat = await d1.getCatalog();
      return jsonRes({
        success: true,
        mart: { ...martData.mart, ...cat.mart },
        products: cat.products.length ? cat.products.map(p => ({ ...p, barcode: p.barcode_sku || p.barcode })) : (martData.products || []),
        promotions: cat.promotions.length ? cat.promotions : (martData.promotions || []),
        promo_types: cat.promo_types.length ? cat.promo_types : (martData.promo_types || [])
      });
    }
    return jsonRes({
      success: true,
      mart: martData.mart,
      products: martData.products || [],
      promotions: martData.promotions || [],
      promo_types: martData.promo_types || []
    });
  }

  if (subPath === 'products' || subPath === 'products/approve') {
    const item = { ...body, id: body?.id || (body?.name ? nextMonotonicId('mrt_sku') : undefined) };
    if (d1 && item.id) {
      await d1.upsertProduct(item);
    }
    return jsonRes({ success: true, item }, method === 'POST' ? 201 : 200);
  }

  if (subPath === 'products/bulk-grid') {
    const updates = Array.isArray(body?.updates) ? body.updates : [];
    let updatedCount = 0;
    if (d1) {
      for (const u of updates) {
        if (!u || !u.id) continue;
        await d1.upsertProduct(u);
        updatedCount += 1;
      }
    } else {
      updatedCount = updates.length;
    }
    return jsonRes({ success: true, updated_count: updatedCount });
  }

  if (subPath === 'import/preview' || subPath === 'import') {
    const mode = String(body?.mode || 'FLYER').toUpperCase();
    const rawText = String(body?.raw_text || '');
    const parsed = mode === 'POS_CSV'
      ? parseMartPosCsv(rawText)
      : mode === 'PREP_SHEET'
        ? parseMartPrepSheet(rawText)
        : parseMartFlyerText(rawText);
    const cat = d1 ? await d1.getCatalog() : { products: martData.products || [] };
    const existingList = (cat.products || []).map(p => ({ ...p, barcode: p.barcode || p.barcode_sku || '' }));
    const norm = (s = '') => String(s || '').replace(/\s+/g, '').toLowerCase();
    const findMatch = (p) => existingList.find(x =>
      (p.barcode && x.barcode && x.barcode === p.barcode)
      || (p.name && norm(x.name) === norm(p.name))
    );

    if (subPath === 'import/preview') {
      const previewItems = (parsed.items || []).map(p => {
        const hit = findMatch(p);
        return {
          ...p,
          match_status: hit ? 'MATCHED_EXISTING' : 'NEW_PRODUCT',
          matched_product_id: hit ? hit.id : '',
          matched_product_name: hit ? hit.name : ''
        };
      });
      return jsonRes({
        success: true,
        promo_start: parsed.promo_start,
        promo_end: parsed.promo_end,
        items: previewItems,
        promotions: parsed.promotions || []
      });
    }

    const addedProducts = [];
    for (const p of (parsed.items || [])) {
      const hit = findMatch(p);
      const record = hit
        ? { ...hit, ...p, id: hit.id, status: 'ACTIVE' }
        : { ...p, id: p.id || nextMonotonicId('mrt_sku'), status: 'ACTIVE' };
      if (d1) await d1.upsertProduct(record);
      addedProducts.push(record);
    }
    const addedPromos = [];
    for (const pr of (parsed.promotions || [])) {
      const promoRec = { ...pr, id: pr.id || nextMonotonicId('mpr') };
      if (d1) await d1.createPromotion(promoRec);
      addedPromos.push(promoRec);
    }
    return jsonRes({
      success: true,
      mode,
      imported_products: addedProducts.length,
      imported_promotions: addedPromos.length,
      products: addedProducts,
      promotions: addedPromos
    }, 201);
  }

  if (subPath === 'promotions') {
    if (d1) {
      if (method === 'POST') {
        const pr = { id: body.id || nextMonotonicId('mpr'), ...body };
        await d1.createPromotion(pr);
        return jsonRes({ success: true, promotion: pr }, 201);
      }
      if (method === 'PATCH') {
        await d1.updatePromotion(body);
        return jsonRes({ success: true, promotion: body });
      }
      if (method === 'DELETE') {
        await d1.deletePromotion(body.id);
        return jsonRes({ success: true, deleted_id: body.id });
      }
    }
    return jsonRes({ success: true, promotion: { id: body.id || nextMonotonicId('mpr'), ...body } }, method === 'POST' ? 201 : 200);
  }

  if (subPath === 'promo-types') {
    if (d1 && method === 'POST') await d1.savePromoType(body);
    return jsonRes({ success: true, promo_types: martData.promo_types || [] });
  }

  if (subPath === 'orders') {
    if (method === 'GET') {
      if (d1) {
        const rows = await d1.getOrders();
        return jsonRes({ success: true, orders: rows.length ? rows.map(r => ({ ...r, order_id: r.id, status: r.order_status })) : (martData.orders || []) });
      }
      return jsonRes({ success: true, orders: martData.orders || [] });
    }
    if (d1) {
      const created = await d1.createOrder(body);
      return jsonRes({ success: true, order: created }, 201);
    }
    const d = String(body.delivery_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(2, 8);
    return jsonRes({ success: true, order: { order_id: `ORD-11-650-01-47121-0001-${d}-${String(Date.now()).slice(-4)}`, ...body, status: 'REQUESTED' } }, 201);
  }

  if (subPath === 'orders/status') {
    if (d1 && body?.order_id && body?.status) await d1.updateOrderStatus(body.order_id, body.status);
    return jsonRes({ success: true, ...body });
  }

  if (subPath === 'orders/adjust') {
    if (d1) {
      const result = await d1.adjustOrderItem(body || {});
      return jsonRes({ success: true, ...result });
    }
    return jsonRes({ success: true, ...body });
  }

  if (subPath === 'picking' || subPath === 'boxing' || subPath === 'settlements') {
    const url = new URL(request.url);
    const reqDate = url.searchParams.get('delivery_date') || url.searchParams.get('date') || '';
    const d1Orders = d1 ? await d1.getOrders() : [];
    const allOrders = d1Orders.length ? d1Orders : (martData.orders || []);
    const cat = d1 ? await d1.getCatalog() : { products: martData.products || [], mart: martData.mart || {} };
    const products = cat.products?.length ? cat.products : (martData.products || []);
    if (subPath === 'picking') return jsonRes({ success: true, ...buildPickingSummary(allOrders, products, reqDate) });
    if (subPath === 'boxing') return jsonRes({ success: true, ...buildBoxingManifest(allOrders, products, reqDate) });
    const martInfo = { ...(martData.mart || {}), ...(cat.mart || {}) };
    return jsonRes({ success: true, ...buildSettlementSummary(allOrders, products, martInfo) });
  }

  if (subPath === 'pwa/config') {
    if (d1) {
      const cfg = await d1.getPwaConfig();
      if (cfg) return jsonRes({ success: true, mart: martData.mart, config: cfg });
    }
    return jsonRes({ success: true, mart: martData.mart, config: martData.pwa_config || {} });
  }

  if (subPath === 'pwa/control') {
    if (d1) await d1.updatePwaControl(body);
    return jsonRes({ success: true, config: { ...(martData.pwa_config || {}), ...body } });
  }

  if (subPath === 'marts') {
    return jsonRes({ success: true, marts: martData.marts || [] });
  }

  if (subPath === 'group-buys') {
    if (method === 'GET') return jsonRes({ success: true, group_buys: martData.group_buys || [] });
    return jsonRes({ success: true, campaign: { campaign_id: nextMonotonicId('mgb'), ...body, approval_status: 'PENDING_ADMIN' } }, 201);
  }

  if (subPath === 'group-buys/join') {
    return jsonRes({ success: true, campaign_id: body.campaign_id });
  }

  if (subPath === 'facilities') {
    return jsonRes({ success: true, facilities: martData.facilities || [] });
  }

  if (subPath === 'facilities/register') {
    const name = String(body.facility_name || '').trim();
    const phone = String(body.phone || '').trim();
    const address = String(body.address || '').trim();
    if (!name || !phone || !address) {
      return jsonRes({ success: false, error: '기관명, 연락처, 배송 주소를 모두 입력해 주세요.' }, 400);
    }
    return jsonRes({
      success: true,
      facility: {
        request_id: nextMonotonicId('fapp'),
        facility_id: '',
        facility_name: name,
        facility_type: body.facility_type || 'SENIOR_CENTER',
        phone,
        address,
        status: 'PENDING_APPROVAL'
      }
    }, 201);
  }

  if (subPath === 'facilities/decide') {
    return jsonRes({ success: true, facility: { ...body } });
  }

  if (subPath === 'b2b/login') {
    const list = Array.isArray(martData.facilities) ? martData.facilities : [];
    const fid = String(body.facility_id || '').trim().toUpperCase();
    const normPhone = String(body.phone || '').replace(/[^0-9]/g, '');
    const found = list.find(f =>
      (fid && String(f.facility_id || '').toUpperCase() === fid)
      || (normPhone && String(f.phone || '').replace(/[^0-9]/g, '') === normPhone)
    );
    if (!found) return jsonRes({ success: false, error: '등록된 기관 정보를 찾을 수 없습니다.' }, 400);
    if (found.status === 'PENDING_APPROVAL') return jsonRes({ success: false, error: '마트 관리자 승인 대기 중인 기관입니다.' }, 400);
    if (found.status === 'REJECTED') return jsonRes({ success: false, error: '가입이 반려된 기관입니다.' }, 400);
    return jsonRes({ success: true, facility: found });
  }

  if (subPath === 'prices/batch') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const cat = d1 ? await d1.getCatalog() : { products: martData.products || [] };
    const workData = {
      products: (cat.products || []).map(p => ({ ...p, barcode: p.barcode || p.barcode_sku || '' })),
      upload_history: []
    };
    let batchOut;
    try {
      batchOut = applyDailyPriceBatchToData(workData, {
        rows,
        mode: body.mode || 'PARTIAL',
        source_name: body.source_name || 'daily_price.csv'
      });
    } catch (err) {
      return jsonRes({ success: false, error: err?.message || '시세 일괄 처리 오류' }, 400);
    }
    const { shouldSave, result } = batchOut;
    const snapRecord = workData.upload_history[0];
    const snapshotItems = snapRecord?.snapshot_products || [];
    if (d1 && shouldSave) {
      const prevMap = new Map(snapshotItems.map(s => [s.id, s]));
      for (const p of workData.products) {
        const prev = prevMap.get(p.id);
        if (!prev) continue;
        if (prev.cost_price !== p.cost_price || prev.regular_price !== p.regular_price
          || prev.sale_price !== p.sale_price || prev.stock_qty !== p.stock_qty
          || prev.online_publish_status !== p.online_publish_status) {
          await d1.upsertProduct(p);
        }
      }
    }
    let snapshotKey = null;
    if (shouldSave && env?.MEDIA_PRIVATE) {
      snapshotKey = buildPrivateEvidenceKey({
        domain: 'MART',
        tenantUid: tenantMartId,
        evidenceType: 'snapshots',
        mediaId: result.batch_id,
        ext: 'json'
      });
      await env.MEDIA_PRIVATE.put(snapshotKey, JSON.stringify(snapshotItems), {
        httpMetadata: { contentType: 'application/json' }
      });
    }
    if (d1 && shouldSave) {
      await d1.recordPriceUploadBatch({
        batch_id: result.batch_id,
        mode: body.mode || 'PARTIAL',
        total_rows: rows.length,
        updated_count: result.success_count,
        error_count: result.error_count,
        sold_out_count: result.synced_suspended_count,
        snapshot_r2_key: snapshotKey,
        snapshot: snapshotKey ? undefined : snapshotItems
      });
    }
    return jsonRes({ success: true, snapshot_r2_key: snapshotKey, ...result });
  }

  if (subPath === 'prices/history') {
    if (d1) {
      const history = await d1.getPriceUploadBatches(20);
      return jsonRes({ success: true, history });
    }
    return jsonRes({ success: true, history: martData.upload_history || [] });
  }

  if (subPath === 'prices/rollback') {
    const batchId = String(body?.batch_id || '').trim();
    if (!batchId) return jsonRes({ success: false, error: 'batch_id가 필요합니다.' }, 400);
    let restoredCount = 0;
    if (d1) {
      const batch = await d1.getPriceUploadBatchById(batchId);
      if (!batch) return jsonRes({ success: false, error: '롤백할 업로드 이력을 찾을 수 없습니다.' }, 404);
      let snap = [];
      if (batch.snapshot_r2_key && env?.MEDIA_PRIVATE) {
        const obj = await env.MEDIA_PRIVATE.get(batch.snapshot_r2_key);
        if (obj) snap = JSON.parse(await obj.text() || '[]');
      } else if (batch.snapshot_json) {
        snap = JSON.parse(batch.snapshot_json || '[]');
      }
      for (const item of (Array.isArray(snap) ? snap : [])) {
        if (!item?.id) continue;
        await d1.upsertProduct(item);
        restoredCount += 1;
      }
      await d1.markPriceUploadBatchRolledBack(batchId);
    }
    return jsonRes({ success: true, batch_id: batchId, restored_count: restoredCount, rolled_back_at: new Date().toISOString() });
  }

  return null;
}
