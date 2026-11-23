/**
 * AITIP Mart Logistics - Cloudflare D1 Repository Adapter (ESM)
 * env.DB (D1Database) 바인딩을 사용하는 Workers 환경용 비동기 데이터 어댑터
 */

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
    await this.db.prepare(`
      INSERT INTO products (
        id, mart_id, barcode_sku, name, category_type, category_path, spec, uom, tax_type,
        cost_price, regular_price, sale_price, discount_pct, applied_promo_id,
        channel_scope, online_publish_status, shared_catalog_scope, mart_approval_status,
        is_prep, storage_temp, stock_qty, safety_stock, image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        regular_price = excluded.regular_price,
        sale_price = excluded.sale_price,
        discount_pct = excluded.discount_pct,
        applied_promo_id = excluded.applied_promo_id,
        channel_scope = excluded.channel_scope,
        online_publish_status = excluded.online_publish_status,
        mart_approval_status = excluded.mart_approval_status,
        stock_qty = excluded.stock_qty,
        image_url = excluded.image_url,
        updated_at = excluded.updated_at
    `).bind(
      p.id, this.martId, p.barcode || null, p.name, p.category_type || 'B2B_INDUSTRIAL',
      p.category_path || '-', p.spec || '-', p.uom || '개', p.tax_type || 'TAXABLE',
      Number(p.cost_price || 0), Number(p.regular_price || 0), Number(p.sale_price || 0),
      Number(p.discount_pct || 0), p.applied_promo_id || null,
      p.channel_scope || 'ALL_CHANNELS', p.online_publish_status || 'PUBLISHED_FEED',
      p.shared_catalog_scope || 'LOCAL_ONLY', p.mart_approval_status || null,
      p.category_type === 'PREP_PROCESSED' ? 1 : 0, p.storage_temp || 'AMBIENT',
      Number(p.stock_qty ?? 50), Number(p.safety_stock ?? 5), p.image_url || null,
      now, now
    ).run();
    return p;
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

  async savePromoType(t) {
    const now = Date.now();
    await this.db.prepare(`
      INSERT INTO mart_promo_types (id, mart_id, code, label, calc_mode, is_active, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mart_id, code) DO UPDATE SET
        label = excluded.label,
        calc_mode = excluded.calc_mode,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).bind(
      `prt_${t.code}`, this.martId, t.code, t.label, t.calc_mode || 'UNIT_DISCOUNT',
      t.is_active !== false ? 1 : 0, t.is_system ? 1 : 0, now, now
    ).run();
    return t;
  }

  async getOrders() {
    const res = await this.db.prepare(
      'SELECT * FROM orders WHERE mart_id = ? ORDER BY created_at DESC LIMIT 200'
    ).bind(this.martId).all();
    return res?.results || [];
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
    const orderId = order.order_id || `ORD-11-650-01-47121-0001-${d}-${String(now).slice(-4)}`;
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

  async lookupSharedBarcode({ barcode = '', q = '', limit = 20 } = {}) {
    const cleanBc = String(barcode || '').replace(/[^0-9]/g, '');
    const cleanQ = String(q || '').trim();
    const safeLimit = Math.min(Math.max(1, Number(limit || 20)), 50);
    let res;
    if (cleanBc) {
      res = await this.db.prepare(
        'SELECT id, barcode, product_name, manufacturer, standard_spec, category_name, allergens_text, image_r2_key, image_url, source_type FROM shared_barcode_catalog WHERE barcode = ? LIMIT 1'
      ).bind(cleanBc).all();
    } else if (cleanQ) {
      res = await this.db.prepare(
        'SELECT id, barcode, product_name, manufacturer, standard_spec, category_name, allergens_text, image_r2_key, image_url, source_type FROM shared_barcode_catalog WHERE product_name LIKE ? ORDER BY updated_at DESC LIMIT ?'
      ).bind(`%${cleanQ}%`, safeLimit).all();
    } else {
      return [];
    }
    return (res?.results || []).map(r => ({
      ...r,
      name: r.product_name,
      spec: r.standard_spec || '-',
      manufacture: r.manufacturer || '',
      prdkind: r.category_name || '',
      allergy: r.allergens_text || '',
      image_url: r.image_r2_key ? `/api/mart/media/public/${r.image_r2_key}` : (r.image_url || '')
    }));
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
}
