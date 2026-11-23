/**
 * AITIP Platform Admin - Cloudflare D1 Repository Adapter (ESM)
 * Modular Monolith: 단일 DB(env.DB) 또는 분리 시 전용 DB(env.ADMIN_DB) 자동 바인딩
 */

export class AdminD1Adapter {
  constructor(dbOrEnv) {
    const db = (dbOrEnv && typeof dbOrEnv.prepare === 'function')
      ? dbOrEnv
      : (dbOrEnv?.ADMIN_DB || dbOrEnv?.DB);
    if (!db || typeof db.prepare !== 'function') {
      throw new Error('유효한 Cloudflare D1 바인딩(env.ADMIN_DB 또는 env.DB)이 필요합니다.');
    }
    this.db = db;
  }

  async getDashboardCounts() {
    const [stores, marts, orders] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) AS cnt FROM stores').first(),
      this.db.prepare('SELECT COUNT(*) AS cnt FROM mart_suppliers').first(),
      this.db.prepare('SELECT COUNT(*) AS cnt FROM orders').first()
    ]);
    return {
      store_count: Number(stores?.cnt || 0),
      mart_count: Number(marts?.cnt || 0),
      order_count: Number(orders?.cnt || 0)
    };
  }

  async listMarts() {
    const res = await this.db.prepare('SELECT * FROM mart_suppliers ORDER BY created_at DESC').all();
    return res?.results || [];
  }

  async listStores() {
    const res = await this.db.prepare('SELECT * FROM stores ORDER BY created_at DESC').all();
    return res?.results || [];
  }

  async listAuditLogs(limit = 100) {
    const res = await this.db.prepare(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();
    return res?.results || [];
  }
}
