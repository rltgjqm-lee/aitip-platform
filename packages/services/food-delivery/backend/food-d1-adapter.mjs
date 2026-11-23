/**
 * AITIP Food Delivery - Cloudflare D1 Repository Adapter (ESM)
 * Modular Monolith: 단일 DB(env.DB) 또는 분리 시 전용 DB(env.FOOD_DB) 자동 바인딩
 */

export class FoodD1Adapter {
  constructor(dbOrEnv, storeId = 'STR-11-650-01-00001') {
    const db = (dbOrEnv && typeof dbOrEnv.prepare === 'function')
      ? dbOrEnv
      : (dbOrEnv?.FOOD_DB || dbOrEnv?.DB);
    if (!db || typeof db.prepare !== 'function') {
      throw new Error('유효한 Cloudflare D1 바인딩(env.FOOD_DB 또는 env.DB)이 필요합니다.');
    }
    this.db = db;
    this.storeId = storeId || dbOrEnv?.DEFAULT_STORE_ID || 'STR-11-650-01-00001';
  }

  async getStore() {
    return this.db.prepare('SELECT * FROM stores WHERE id = ?').bind(this.storeId).first();
  }

  async getProducts() {
    const res = await this.db.prepare(
      'SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC'
    ).bind(this.storeId).all();
    return res?.results || [];
  }

  async getOrders(limit = 200) {
    const res = await this.db.prepare(
      'SELECT * FROM orders WHERE store_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(this.storeId, limit).all();
    return res?.results || [];
  }
}
