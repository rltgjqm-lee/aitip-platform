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
        sold_out_count, snapshot_json, rolled_back, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      batch.batch_id, this.martId, batch.mode || 'PARTIAL',
      Number(batch.total_rows || 0), Number(batch.updated_count || 0),
      Number(batch.error_count || 0), Number(batch.sold_out_count || 0),
      JSON.stringify(batch.snapshot || []), batch.rolled_back ? 1 : 0, now
    ).run();
    return batch;
  }

  async getPriceUploadBatches(limit = 20) {
    const res = await this.db.prepare(
      'SELECT batch_id, mode, total_rows, updated_count, error_count, sold_out_count, rolled_back, created_at FROM mart_price_upload_batches WHERE mart_id = ? ORDER BY created_at DESC LIMIT ?'
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
}
