/**
 * AITIP Mart Logistics - Cloudflare D1 Repository Adapter (ESM)
 * env.DB (D1Database) 바인딩을 사용하는 Workers 환경용 비동기 데이터 어댑터
 */

import { nextMonotonicId } from './mart-price-batch.mjs';

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

function cleanCatalogText(val = '') {
  const s = String(val || '').trim();
  return (!s || s === '알수없음' || s === 'null' || s === 'undefined') ? '' : s;
}

function cleanManufacturerText(val = '') {
  const s = cleanCatalogText(val);
  if (!s) return '';
  return s.split(/[_\n]/)[0].split('/')[0].trim();
}

function generateBarcodeCatalogId() {
  const ts = Date.now().toString(32).toLowerCase().padStart(10, '0').slice(-10);
  let tail = '';
  for (let i = 0; i < 15; i++) tail += CROCKFORD[Math.floor(Math.random() * 32)];
  return `bar_0${ts}${tail}`.slice(0, 30);
}

export class MartD1Adapter {
  constructor(dbOrEnv, martId = 'MRT-11-650-01-47121-0001') {
    const db = (dbOrEnv && typeof dbOrEnv.prepare === 'function')
      ? dbOrEnv
      : (dbOrEnv?.MART_DB || dbOrEnv?.DB);
    if (!db || typeof db.prepare !== 'function') {
      throw new Error('유효한 Cloudflare D1 바인딩(env.MART_DB 또는 env.DB)이 필요합니다.');
    }
    this.db = db;
    this.martId = martId || dbOrEnv?.DEFAULT_MART_ID || 'MRT-11-650-01-47121-0001';
  }

  async getCatalog() {
    const [martRes, prodRes, promoRes, typeRes] = await Promise.all([
      this.db.prepare('SELECT * FROM mart_suppliers WHERE id = ?').bind(this.martId).first(),
      this.db.prepare('SELECT * FROM products WHERE mart_id = ? ORDER BY created_at DESC').bind(this.martId).all(),
      this.db.prepare('SELECT * FROM store_promotions WHERE mart_id = ? AND is_active = 1 ORDER BY created_at DESC').bind(this.martId).all(),
      this.db.prepare('SELECT * FROM mart_promo_types WHERE mart_id = ? OR mart_id IS NULL ORDER BY is_system DESC, created_at ASC').bind(this.martId).all()
    ]);
    return {
      mart: martRes || { mart_id: this.martId },
      products: prodRes?.results || [],
      promotions: promoRes?.results || [],
      promo_types: typeRes?.results || []
    };
  }

  async upsertProduct(p) {
    const now = Date.now();
    const existing = p?.id
      ? await this.db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').bind(p.id).first().catch(() => null)
      : null;
    if (existing && existing.mart_id && existing.mart_id !== this.martId) {
      const err = new Error('다른 마트 소유의 상품은 수정할 수 없습니다.');
      err.status = 403;
      throw err;
    }
    const merged = { ...(existing || {}) };
    for (const [k, v] of Object.entries(p || {})) {
      if (v !== undefined) merged[k] = v;
    }
    const catType = merged.category_type || 'B2B_INDUSTRIAL';
    await this.db.prepare(`
      INSERT INTO products (
        id, mart_id, barcode_sku, name, category_type, category_path, spec, uom, tax_type,
        cost_price, regular_price, sale_price, discount_pct, applied_promo_id,
        channel_scope, online_publish_status, shared_catalog_scope, mart_approval_status,
        is_prep, storage_temp, stock_qty, safety_stock, image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        barcode_sku = excluded.barcode_sku,
        name = excluded.name,
        category_type = excluded.category_type,
        category_path = excluded.category_path,
        spec = excluded.spec,
        uom = excluded.uom,
        tax_type = excluded.tax_type,
        cost_price = excluded.cost_price,
        regular_price = excluded.regular_price,
        sale_price = excluded.sale_price,
        discount_pct = excluded.discount_pct,
        applied_promo_id = excluded.applied_promo_id,
        channel_scope = excluded.channel_scope,
        online_publish_status = excluded.online_publish_status,
        mart_approval_status = excluded.mart_approval_status,
        is_prep = excluded.is_prep,
        storage_temp = excluded.storage_temp,
        stock_qty = excluded.stock_qty,
        safety_stock = excluded.safety_stock,
        image_url = excluded.image_url,
        updated_at = excluded.updated_at
    `).bind(
      merged.id, this.martId, (p?.barcode !== undefined ? (p.barcode || null) : (merged.barcode_sku ?? merged.barcode ?? null)),
      merged.name, catType,
      merged.category_path || '-', merged.spec || '-', merged.uom || '개', merged.tax_type || 'TAXABLE',
      Number(merged.cost_price ?? 0), Number(merged.regular_price ?? 0), Number(merged.sale_price ?? 0),
      Number(merged.discount_pct ?? 0), merged.applied_promo_id || null,
      merged.channel_scope || 'ALL_CHANNELS', merged.online_publish_status || 'PUBLISHED_FEED',
      merged.shared_catalog_scope || 'LOCAL_ONLY', merged.mart_approval_status || null,
      catType === 'PREP_PROCESSED' ? 1 : Number(merged.is_prep ?? 0), merged.storage_temp || 'AMBIENT',
      Number(merged.stock_qty ?? 50), Number(merged.safety_stock ?? 5), merged.image_url || null,
      Number(existing?.created_at || now), now
    ).run();
    await this.contributeSharedBarcode(merged).catch(() => {});
    return merged;
  }

  async contributeSharedBarcode(p) {
    const cleanBc = String(p?.barcode || p?.barcode_sku || '').replace(/[^0-9]/g, '');
    const name = String(p?.name || p?.product_name || '').trim();
    if (!/^\d{8,14}$/.test(cleanBc) || /^2\d{12}$/.test(cleanBc)) return false;
    if (!name || name === '-') return false;

    const rawImg = String(p?.image_url || '').trim();
    const isSharedImg = rawImg.startsWith('/api/mart/media/public/shared/');
    const r2Key = isSharedImg ? rawImg.slice('/api/mart/media/public/'.length) : null;
    const sharedImgUrl = isSharedImg ? rawImg : null;
    const now = Date.now();
    const id = generateBarcodeCatalogId();

    await this.db.prepare(`
      INSERT INTO shared_barcode_catalog (
        id, barcode, product_name, manufacturer, standard_spec, category_name,
        allergens_text, image_r2_key, image_url, source_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MERCHANT_INPUT', ?, ?)
      ON CONFLICT(barcode) DO NOTHING
    `).bind(
      id, cleanBc, name,
      String(p?.manufacturer || p?.manufacture || '').trim() || null,
      String(p?.spec || p?.standard_spec || '').trim() || null,
      String(p?.category_path || p?.category_name || '').trim() || null,
      String(p?.allergy || p?.allergens_text || '').trim() || null,
      r2Key, sharedImgUrl, now, now
    ).run();
    return true;
  }

  async createPromotion(pr) {
    const now = Date.now();
    await this.db.prepare(`
      INSERT INTO store_promotions (
        id, mart_id, name, promo_type, calc_mode, discount_type, discount_value,
        min_order_amount, bundle_qty, bundle_price, applicable_days_json,
        channel_scope, card_targets_json, limit_per_person, total_limit_qty, used_qty, status,
        max_discount_amount, max_receipt_sections, start_at, end_at, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(
      pr.id, this.martId, pr.name, pr.promo_type, pr.calc_mode || 'UNIT_DISCOUNT',
      pr.discount_type || 'PERCENT', Number(pr.discount_pct || pr.discount_amount || 0),
      Number(pr.min_purchase_amount || 0), Number(pr.required_qty || 1), Number(pr.bundle_price || 0),
      JSON.stringify(pr.days_of_week || []), pr.channel_scope || 'ALL_CHANNELS',
      JSON.stringify(pr.card_targets || []), Number(pr.limit_per_person || 0),
      Number(pr.total_limit_qty || 0), Number(pr.used_qty || 0), pr.status || 'ACTIVE',
      Number(pr.max_discount_amount || 0), Number(pr.max_receipt_sections || 0),
      pr.start_date, pr.end_date, now, now
    ).run();
    return pr;
  }

  async recordPriceUploadBatch(batch) {
    const now = Date.now();
    await this.db.prepare(`
      INSERT INTO mart_price_upload_batches (
        batch_id, mart_id, mode, total_rows, updated_count, error_count,
        sold_out_count, snapshot_r2_key, snapshot_json, rolled_back, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      batch.batch_id, this.martId, batch.mode || 'PARTIAL',
      Number(batch.total_rows || 0), Number(batch.updated_count || 0),
      Number(batch.error_count || 0), Number(batch.sold_out_count || 0),
      batch.snapshot_r2_key || null,
      batch.snapshot_r2_key ? null : JSON.stringify(batch.snapshot || []),
      batch.rolled_back ? 1 : 0, now
    ).run();
    return batch;
  }

  async getPriceUploadBatches(limit = 20) {
    const res = await this.db.prepare(
      'SELECT batch_id, mode, total_rows, updated_count, error_count, sold_out_count, snapshot_r2_key, rolled_back, created_at FROM mart_price_upload_batches WHERE mart_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(this.martId, limit).all();
    return res?.results || [];
  }

  async getPriceUploadBatchById(batchId) {
    return this.db.prepare(
      'SELECT * FROM mart_price_upload_batches WHERE mart_id = ? AND batch_id = ? LIMIT 1'
    ).bind(this.martId, batchId).first();
  }

  async markPriceUploadBatchRolledBack(batchId) {
    await this.db.prepare(
      'UPDATE mart_price_upload_batches SET rolled_back = 1 WHERE mart_id = ? AND batch_id = ?'
    ).bind(this.martId, batchId).run();
    return true;
  }

  async savePromoType(t) {
    const now = Date.now();
    const typeId = t.id || (t.is_system ? `prt_${t.code}` : `prt_${this.martId}_${t.code}`);
    await this.db.prepare(`
      INSERT INTO mart_promo_types (id, mart_id, code, label, calc_mode, is_active, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mart_id, code) DO UPDATE SET
        label = excluded.label,
        calc_mode = excluded.calc_mode,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).bind(
      typeId, this.martId, t.code, t.label, t.calc_mode || 'UNIT_DISCOUNT',
      t.is_active !== false ? 1 : 0, t.is_system ? 1 : 0, now, now
    ).run();
    return { ...t, id: typeId };
  }

  async getOrders() {
    const [ordRes, itemRes] = await this.db.batch([
      this.db.prepare('SELECT * FROM orders WHERE mart_id = ? ORDER BY created_at DESC LIMIT 200').bind(this.martId),
      this.db.prepare('SELECT oi.* FROM order_items oi INNER JOIN orders o ON oi.order_id = o.id WHERE o.mart_id = ?').bind(this.martId)
    ]);
    const itemsByOrder = new Map();
    for (const it of (itemRes?.results || [])) {
      const list = itemsByOrder.get(it.order_id) || [];
      list.push({
        id: it.id,
        product_id: it.product_id,
        name: it.product_name,
        qty: Number(it.qty || 0),
        uom: it.uom || '개',
        unit_price: Number(it.unit_price || 0),
        storage_temp: it.storage_temp || 'AMBIENT'
      });
      itemsByOrder.set(it.order_id, list);
    }
    return (ordRes?.results || []).map(r => ({
      ...r,
      order_id: r.id,
      status: r.order_status,
      items: itemsByOrder.get(r.id) || []
    }));
  }

  async adjustOrderItem({ order_id, product_id, actual_qty, reason = '결품·수량 정정' } = {}) {
    if (!order_id || !product_id) throw new Error('order_id와 product_id가 필요합니다.');
    const ownedOrder = await this.db.prepare(
      'SELECT id FROM orders WHERE id = ? AND mart_id = ? LIMIT 1'
    ).bind(order_id, this.martId).first();
    if (!ownedOrder) {
      const err = new Error('해당 마트 소유의 주문을 찾을 수 없습니다.');
      err.status = 403;
      throw err;
    }
    const nextQty = Math.max(0, Number(actual_qty ?? 0));
    const item = await this.db.prepare(
      'SELECT * FROM order_items WHERE order_id = ? AND (product_id = ? OR id = ? OR product_name = ?) LIMIT 1'
    ).bind(order_id, product_id, product_id, product_id).first();
    if (!item) throw new Error('주문 내 해당 품목을 찾을 수 없습니다.');
    const prevQty = Number(item.qty || 0);
    const diffAmount = Math.round((nextQty - prevQty) * Number(item.unit_price || 0));
    const now = Date.now();
    await this.db.prepare('UPDATE order_items SET qty = ? WHERE id = ?').bind(nextQty, item.id).run();
    const sumRow = await this.db.prepare(
      'SELECT COALESCE(SUM(qty * unit_price), 0) AS total FROM order_items WHERE order_id = ?'
    ).bind(order_id).first();
    const newTotal = Number(sumRow?.total || 0);
    await this.db.prepare('UPDATE orders SET total_amount = ?, updated_at = ? WHERE id = ? AND mart_id = ?')
      .bind(newTotal, now, order_id, this.martId).run();
    await this.db.prepare(`
      INSERT INTO mart_adjustments (id, mart_id, order_id, product_id, prev_qty, next_qty, diff_amount, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(nextMonotonicId('adj'), this.martId, order_id, item.product_id, prevQty, nextQty, diffAmount, String(reason || '결품·수량 정정'), now).run().catch(() => {});
    return { order_id, product_id: item.product_id, prev_qty: prevQty, actual_qty: nextQty, diff_amount: diffAmount, total_amount: newTotal };
  }

  async getPwaConfig() {
    const row = await this.db.prepare('SELECT * FROM pwa_configs WHERE mart_id = ?').bind(this.martId).first();
    if (!row) return null;
    return {
      store_status: row.store_status,
      cutoff_time: row.cutoff_time,
      pos_only_policy: row.pos_only_policy,
      notice_text: row.notice_text,
      blocks: JSON.parse(row.blocks_json || '[]')
    };
  }

  async updatePwaControl(cfg) {
    const now = Date.now();
    await this.db.prepare(`
      INSERT INTO pwa_configs (mart_id, store_status, cutoff_time, pos_only_policy, notice_text, blocks_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mart_id) DO UPDATE SET
        store_status = excluded.store_status,
        cutoff_time = excluded.cutoff_time,
        pos_only_policy = excluded.pos_only_policy,
        notice_text = excluded.notice_text,
        blocks_json = excluded.blocks_json,
        updated_at = excluded.updated_at
    `).bind(
      this.martId, cfg.store_status || 'OPEN', cfg.cutoff_time || '14:00',
      cfg.pos_only_policy || 'BADGE_ONLY', cfg.notice_text || '',
      JSON.stringify(cfg.blocks || []), now
    ).run();
    return cfg;
  }

  async seedIfEmpty(martData = {}) {
    const existing = await this.db.prepare('SELECT id FROM mart_suppliers WHERE id = ? LIMIT 1').bind(this.martId).first();
    if (existing) return false;
    const now = Date.now();
    const m = martData.mart || {};
    const stmts = [
      this.db.prepare(`
        INSERT OR IGNORE INTO mart_suppliers (
          id, mart_name, mart_type, operator_name, agency_fee_pct, biz_number, phone,
          address, open_hours, delivery_fee, free_delivery_threshold, min_order_amount,
          pickup_enabled, receipt_top_notice, receipt_sub_notice, receipt_bottom_notice,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).bind(
        this.martId, m.mart_name || '서초농협 하나로마트 양재점', m.mart_type || 'NH_HANARO',
        m.operator_name || '서초구 시니어클럽 위탁운영팀', Number(m.agency_fee_pct ?? 5),
        m.biz_number || '214-82-04712', m.phone || '02-578-9000',
        m.address || '서울특별시 서초구 양재대로 123', m.open_hours || '09:00 ~ 22:00',
        Number(m.delivery_fee ?? 3000), Number(m.free_delivery_threshold ?? 40000),
        Number(m.min_order_amount ?? 15000), m.pickup_enabled !== false ? 1 : 0,
        m.receipt_top_notice || '', m.receipt_sub_notice || '', m.receipt_bottom_notice || '',
        now, now
      )
    ];

    for (const pr of martData.promotions || []) {
      stmts.push(this.db.prepare(`
        INSERT OR IGNORE INTO store_promotions (
          id, mart_id, name, promo_type, calc_mode, discount_type, discount_value,
          min_order_amount, bundle_qty, bundle_price, applicable_days_json,
          channel_scope, card_targets_json, limit_per_person, total_limit_qty, used_qty, status,
          max_discount_amount, max_receipt_sections, start_at, end_at, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).bind(
        pr.id, this.martId, pr.name, pr.promo_type || 'PRICE_DISCOUNT', pr.calc_mode || 'UNIT_DISCOUNT',
        pr.discount_type || 'PERCENT', Number(pr.discount_pct || pr.discount_amount || 0),
        Number(pr.min_purchase_amount || 0), Number(pr.required_qty || 1), Number(pr.bundle_price || 0),
        JSON.stringify(pr.days_of_week || []), pr.channel_scope || 'ALL_CHANNELS',
        JSON.stringify(pr.card_targets || []), Number(pr.limit_per_person || 0),
        Number(pr.total_limit_qty || 0), Number(pr.used_qty || 0), pr.status || 'ACTIVE',
        Number(pr.max_discount_amount || 0), Number(pr.max_receipt_sections || 0),
        pr.start_date || '2026-11-01', pr.end_date || '2026-12-31', now, now
      ));
    }

    for (const p of martData.products || []) {
      stmts.push(this.db.prepare(`
        INSERT OR IGNORE INTO products (
          id, mart_id, barcode_sku, name, category_type, category_l1, category_l2, category_l3,
          category_path, spec, uom, tax_type, cost_price, regular_price, sale_price,
          b2b_price, b2b_min_qty, discount_pct, applied_promo_id, sales_target,
          channel_scope, online_publish_status, shared_catalog_scope, mart_approval_status,
          is_prep, storage_temp, stock_qty, safety_stock, media_id, image_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        p.id, this.martId, p.barcode || null, p.name, p.category_type || 'B2B_INDUSTRIAL',
        p.category_l1 || null, p.category_l2 || null, p.category_l3 || null,
        p.category_path || '-', p.spec || '-', p.uom || '개', p.tax_type || 'TAXABLE',
        Number(p.cost_price || 0), Number(p.regular_price || 0), Number(p.sale_price ?? p.regular_price ?? 0),
        Number(p.b2b_price ?? 0), Number(p.b2b_min_qty ?? 1), Number(p.discount_pct || 0),
        p.applied_promo_id || null, p.sales_target || 'BOTH', p.channel_scope || 'ALL_CHANNELS',
        p.online_publish_status || 'PUBLISHED_FEED', p.shared_catalog_scope || 'LOCAL_ONLY',
        p.mart_approval_status || null, p.category_type === 'PREP_PROCESSED' ? 1 : 0,
        p.storage_temp || 'AMBIENT', Number(p.stock_qty ?? 50), Number(p.safety_stock ?? 5),
        p.media_id || null, p.image_url || null, now, now
      ));
    }

    if (martData.pwa_config) {
      const cfg = martData.pwa_config;
      stmts.push(this.db.prepare(`
        INSERT OR IGNORE INTO pwa_configs (mart_id, store_status, cutoff_time, pos_only_policy, notice_text, blocks_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        this.martId, cfg.store_status || 'OPEN', cfg.cutoff_time || '14:00',
        cfg.pos_only_policy || 'BADGE_ONLY', cfg.notice_text || '',
        JSON.stringify(cfg.blocks || []), now
      ));
    }

    await this.db.batch(stmts);
    return true;
  }

  async updatePromotion(pr) {
    const now = Date.now();
    await this.db.prepare(`
      UPDATE store_promotions SET
        name = COALESCE(?, name),
        discount_value = COALESCE(?, discount_value),
        bundle_price = COALESCE(?, bundle_price),
        total_limit_qty = COALESCE(?, total_limit_qty),
        used_qty = COALESCE(?, used_qty),
        status = COALESCE(?, status),
        start_at = COALESCE(?, start_at),
        end_at = COALESCE(?, end_at),
        updated_at = ?
      WHERE id = ? AND mart_id = ?
    `).bind(
      pr.name ?? null,
      pr.discount_pct !== undefined ? Number(pr.discount_pct) : null,
      pr.bundle_price !== undefined ? Number(pr.bundle_price) : null,
      pr.total_limit_qty !== undefined ? Number(pr.total_limit_qty) : null,
      pr.used_qty !== undefined ? Number(pr.used_qty) : null,
      pr.status ?? null,
      pr.start_date ?? null,
      pr.end_date ?? null,
      now, pr.id, this.martId
    ).run();
    return pr;
  }

  async deletePromotion(id) {
    await this.db.prepare('UPDATE products SET applied_promo_id = NULL, discount_pct = 0, sale_price = regular_price WHERE mart_id = ? AND applied_promo_id = ?')
      .bind(this.martId, id).run();
    await this.db.prepare('DELETE FROM store_promotions WHERE id = ? AND mart_id = ?')
      .bind(id, this.martId).run();
    return { deleted_id: id };
  }

  async createOrder(order) {
    const now = Date.now();
    const d = String(order.delivery_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(2, 8);
    const martSuffix = String(this.martId || 'MRT-11-650-01-47121-0001').replace(/^MRT-/, '');
    const orderId = order.order_id || `ORD-${martSuffix}-${d}-${String(now).slice(-4)}`;
    const totalAmount = (order.items || []).reduce((s, it) => s + Number(it.unit_price || 0) * Number(it.qty || 1), 0);
    const stmts = [
      this.db.prepare(`
        INSERT INTO orders (
          id, mart_id, order_channel, customer_type, facility_id, buyer_name,
          delivery_date, delivery_mode, payment_method, card_brand,
          promo_discount_total, total_amount, order_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId, this.martId, order.order_channel || 'ONLINE', order.customer_type || 'INDIVIDUAL',
        order.facility_id || null, order.buyer_name || '일반 고객',
        order.delivery_date || new Date().toISOString().slice(0, 10),
        order.delivery_mode || 'LOCAL_DELIVERY', order.payment_method || 'CARD',
        order.card_brand || null, Number(order.promo_discount_total || 0),
        totalAmount, 'REQUESTED', now, now
      )
    ];
    (order.items || []).forEach((it, idx) => {
      stmts.push(this.db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, qty, uom, unit_price, storage_temp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `${orderId}_it_${idx + 1}`, orderId, it.product_id || it.id || `item_${idx + 1}`,
        it.name || '상품', Number(it.qty || 1), it.uom || '개',
        Number(it.unit_price || 0), it.storage_temp || 'AMBIENT'
      ));
    });
    await this.db.batch(stmts);
    return { order_id: orderId, ...order, total_amount: totalAmount, status: 'REQUESTED' };
  }

  async updateOrderStatus(orderId, status) {
    await this.db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE id = ? AND mart_id = ?')
      .bind(status, Date.now(), orderId, this.martId).run();
    return { order_id: orderId, status };
  }

  async recordMediaObject(meta) {
    await this.db.prepare(`
      INSERT INTO media_objects (
        id, domain, region_code, tenant_id, owner_type, owner_id,
        r2_bucket_name, r2_object_key, original_file_name, content_type,
        file_size_bytes, sha256_hash, cdn_url, access_scope, upload_status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
    `).bind(
      meta.id, meta.domain || 'MART', meta.region_code || '11-650', meta.tenant_id || this.martId,
      meta.owner_type || 'PRODUCT', meta.owner_id || this.martId,
      meta.r2_bucket_name || 'aitip-media-public', meta.r2_object_key,
      meta.original_file_name || 'upload.webp', meta.content_type || 'image/webp',
      Number(meta.file_size_bytes || 1), meta.sha256_hash || null,
      meta.cdn_url || '', meta.access_scope || 'PUBLIC', meta.expires_at || null
    ).run();
    return meta;
  }

  async lookupSharedBarcode({ barcode = '', q = '', limit = 50, categoryHint = '' } = {}) {
    const cleanBc = String(barcode || '').replace(/[^0-9]/g, '');
    const cleanQ = String(q || '').trim();
    const hint = String(categoryHint || '').trim();
    const safeLimit = Math.min(Math.max(1, Number(limit || 50)), 100);
    let res;
    if (cleanBc) {
      res = await this.db.prepare(
        'SELECT id, barcode, product_name, manufacturer, standard_spec, category_name, allergens_text, image_r2_key, image_url, source_type FROM shared_barcode_catalog WHERE barcode = ? LIMIT 1'
      ).bind(cleanBc).all();
    } else if (cleanQ) {
      const fetchLimit = Math.min(safeLimit * 3, 180);
      res = await this.db.prepare(
        'SELECT id, barcode, product_name, manufacturer, standard_spec, category_name, allergens_text, image_r2_key, image_url, source_type FROM shared_barcode_catalog WHERE product_name LIKE ? ORDER BY (image_r2_key IS NOT NULL) DESC, CASE WHEN product_name LIKE ? THEN 0 ELSE 1 END ASC, updated_at DESC LIMIT ?'
      ).bind(`%${cleanQ}%`, `${cleanQ}%`, fetchLimit).all();
    } else {
      return [];
    }
    const hintTokens = hint.split(/[\s·,/()]+/).map(t => t.trim()).filter(t => t.length >= 2);
    if (hint.includes('라면')) hintTokens.push('유탕면', '국수', '면류');
    const qLower = cleanQ.toLowerCase();
    const mapped = (res?.results || []).map(r => {
      const hasImg = Boolean(r.image_r2_key || r.image_url);
      const nameLower = String(r.product_name || '').toLowerCase();
      const catText = `${r.category_name || ''} ${r.product_name || ''}`;
      const catMatch = hintTokens.some(t => catText.includes(t)) ? 1 : 0;
      const prefixMatch = qLower && nameLower.startsWith(qLower) ? 1 : 0;
      const score = (hasImg ? 100 : 0) + (catMatch * 20) + (prefixMatch * 10);
      const specClean = cleanCatalogText(r.standard_spec);
      const makerClean = cleanManufacturerText(r.manufacturer);
      const allergyClean = cleanCatalogText(r.allergens_text);
      return {
        ...r,
        _score: score,
        name: r.product_name,
        spec: specClean || '-',
        manufacture: makerClean,
        prdkind: cleanCatalogText(r.category_name),
        allergy: allergyClean,
        image_url: r.image_r2_key ? `/api/mart/media/public/${r.image_r2_key}` : (r.image_url || '')
      };
    });
    mapped.sort((a, b) => b._score - a._score);
    const deduped = [];
    const seen = new Set();
    for (const item of mapped) {
      const key = `${String(item.product_name || '').replace(/\s+/g, '').toLowerCase()}|${String(item.manufacturer || '').replace(/\s+/g, '').toLowerCase()}`;
      if (!cleanBc && seen.has(key)) continue;
      seen.add(key);
      const { _score, ...cleanItem } = item;
      deduped.push(cleanItem);
      if (deduped.length >= safeLimit) break;
    }
    return deduped;
  }

  async lookupSharedBarcodesBatch(barcodes = []) {
    const cleanList = Array.from(new Set(
      (Array.isArray(barcodes) ? barcodes : [])
        .map(b => String(b || '').replace(/[^0-9]/g, ''))
        .filter(b => b.length >= 8 && b.length <= 14)
    ));
    if (cleanList.length === 0) return {};
    const map = {};
    for (let i = 0; i < cleanList.length; i += 50) {
      const chunk = cleanList.slice(i, i + 50);
      const placeholders = chunk.map(() => '?').join(', ');
      const res = await this.db.prepare(
        `SELECT id, barcode, product_name, manufacturer, standard_spec, category_name, allergens_text, image_r2_key, image_url, source_type FROM shared_barcode_catalog WHERE barcode IN (${placeholders})`
      ).bind(...chunk).all();
      for (const r of (res?.results || [])) {
        map[r.barcode] = {
          ...r,
          name: r.product_name,
          spec: r.standard_spec || '-',
          manufacture: r.manufacturer || '',
          prdkind: r.category_name || '',
          allergy: r.allergens_text || '',
          image_url: r.image_r2_key ? `/api/mart/media/public/${r.image_r2_key}` : (r.image_url || '')
        };
      }
    }
    return map;
  }

  async searchSharedMedia({ q = '', limit = 40 } = {}) {
    const cleanQ = String(q || '').trim();
    const safeLimit = Math.min(Math.max(1, Number(limit || 40)), 100);
    const items = [];
    const seen = new Set();
    const pushItem = (it) => {
      if (!it.image_url || seen.has(it.image_url)) return;
      seen.add(it.image_url);
      items.push(it);
    };

    if (cleanQ) {
      const mediaRes = await this.db.prepare(`
        SELECT id, original_file_name, cdn_url, r2_object_key, created_at
        FROM media_objects
        WHERE domain = 'SHARED' AND deleted_at IS NULL AND upload_status = 'COMPLETED'
          AND original_file_name LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(`%${cleanQ}%`, safeLimit).all();
      for (const m of (mediaRes?.results || [])) {
        const url = m.r2_object_key ? `/api/mart/media/public/${m.r2_object_key}` : (m.cdn_url || '');
        const label = String(m.original_file_name || '').replace(/\.[^.]+$/, '') || '공용 이미지';
        pushItem({ media_id: m.id, image_url: url, label, source: 'SHARED_POOL' });
      }

      const bcRes = await this.db.prepare(`
        SELECT id, barcode, product_name, standard_spec, image_r2_key, image_url
        FROM shared_barcode_catalog
        WHERE product_name LIKE ? AND (image_r2_key IS NOT NULL OR image_url IS NOT NULL)
        ORDER BY (image_r2_key IS NOT NULL) DESC, updated_at DESC
        LIMIT ?
      `).bind(`%${cleanQ}%`, safeLimit).all();
      for (const b of (bcRes?.results || [])) {
        const url = b.image_r2_key ? `/api/mart/media/public/${b.image_r2_key}` : (b.image_url || '');
        const spec = b.standard_spec && b.standard_spec !== '-' ? ` (${b.standard_spec})` : '';
        pushItem({ media_id: b.id, image_url: url, label: `${b.product_name}${spec}`, barcode: b.barcode, source: 'SHARED_BARCODE' });
      }
    } else {
      const mediaRes = await this.db.prepare(`
        SELECT id, original_file_name, cdn_url, r2_object_key, created_at
        FROM media_objects
        WHERE domain = 'SHARED' AND deleted_at IS NULL AND upload_status = 'COMPLETED'
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(safeLimit).all();
      for (const m of (mediaRes?.results || [])) {
        const url = m.r2_object_key ? `/api/mart/media/public/${m.r2_object_key}` : (m.cdn_url || '');
        const label = String(m.original_file_name || '').replace(/\.[^.]+$/, '') || '공용 이미지';
        pushItem({ media_id: m.id, image_url: url, label, source: 'SHARED_POOL' });
      }
    }
    return items.slice(0, safeLimit);
  }
}
