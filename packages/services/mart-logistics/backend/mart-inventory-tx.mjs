/**
 * AITIP Mart Logistics - Atomic Inventory & Promo Limit Transaction Module (ESM)
 * - D1(SQLite) 조건부 원자적 UPDATE로 동시 주문 초과 판매(Overselling) 및 한정수량 초과 차단
 * - 실패 시 앞선 차감분 즉시 보상 복원(Compensation Rollback)
 * - 주문 취소(CANCELLED) / 결품 정정(adjustOrderItem) 시 재고 및 행사 사용량 자동 복원
 */

function createConflictError(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

export async function compensateReservations(db, martId, reservations = []) {
  const now = Date.now();
  for (let i = reservations.length - 1; i >= 0; i--) {
    const r = reservations[i];
    if (r.type === 'STOCK') {
      await db.prepare(
        'UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? AND mart_id = ?'
      ).bind(r.qty, now, r.productId, martId).run().catch(() => {});
    } else if (r.type === 'PROMO') {
      await db.prepare(
        'UPDATE store_promotions SET used_qty = MAX(0, used_qty - ?), updated_at = ? WHERE id = ? AND mart_id = ?'
      ).bind(r.qty, now, r.promoId, martId).run().catch(() => {});
    }
  }
}

export async function reserveInventoryForOrder(db, martId, items = []) {
  const reservations = [];
  const now = Date.now();

  // 동일 상품이 여러 행으로 들어온 경우 합산
  const qtyByProduct = new Map();
  for (const it of (Array.isArray(items) ? items : [])) {
    const pid = String(it?.product_id || it?.id || '').trim();
    const qty = Math.max(0, Math.floor(Number(it?.qty || 0)));
    if (!pid || qty <= 0) continue;
    qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + qty);
  }

  try {
    for (const [productId, qty] of qtyByProduct.entries()) {
      const prod = await db.prepare(
        'SELECT id, name, stock_qty, applied_promo_id FROM products WHERE id = ? AND mart_id = ? LIMIT 1'
      ).bind(productId, martId).first();
      if (!prod) continue; // 비정형 수기 품목은 재고 차감 대상 제외

      const stockRes = await db.prepare(
        'UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ? AND mart_id = ? AND stock_qty >= ?'
      ).bind(qty, now, productId, martId, qty).run();

      if (!stockRes?.meta?.changes) {
        throw createConflictError(`재고가 부족합니다: ${prod.name || productId} (현재 재고 ${Number(prod.stock_qty || 0)}개, 요청 ${qty}개)`);
      }
      reservations.push({ type: 'STOCK', productId, qty });

      if (prod.applied_promo_id) {
        const promo = await db.prepare(
          'SELECT id, name, total_limit_qty, used_qty, status FROM store_promotions WHERE id = ? AND mart_id = ? LIMIT 1'
        ).bind(prod.applied_promo_id, martId).first();

        if (promo && Number(promo.total_limit_qty || 0) > 0) {
          const promoRes = await db.prepare(`
            UPDATE store_promotions
            SET used_qty = used_qty + ?, updated_at = ?
            WHERE id = ? AND mart_id = ? AND status = 'ACTIVE' AND (used_qty + ? <= total_limit_qty)
          `).bind(qty, now, promo.id, martId, qty).run();

          if (!promoRes?.meta?.changes) {
            throw createConflictError(`행사 한정수량이 소진되었습니다: ${promo.name || promo.id}`);
          }
          reservations.push({ type: 'PROMO', promoId: promo.id, qty });
        }
      }
    }
    return reservations;
  } catch (err) {
    await compensateReservations(db, martId, reservations);
    throw err;
  }
}

export async function adjustInventoryForDelta(db, martId, productId, deltaQty) {
  const pid = String(productId || '').trim();
  const delta = Math.trunc(Number(deltaQty || 0));
  if (!pid || delta === 0) return false;

  const prod = await db.prepare(
    'SELECT id, name, stock_qty, applied_promo_id FROM products WHERE id = ? AND mart_id = ? LIMIT 1'
  ).bind(pid, martId).first();
  if (!prod) return false;

  const now = Date.now();
  if (delta > 0) {
    // 수량 증액 -> 추가 차감 검증
    const res = await db.prepare(
      'UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ? AND mart_id = ? AND stock_qty >= ?'
    ).bind(delta, now, pid, martId, delta).run();
    if (!res?.meta?.changes) {
      throw createConflictError(`추가 정정 재고가 부족합니다: ${prod.name || pid}`);
    }
    if (prod.applied_promo_id) {
      await db.prepare(
        'UPDATE store_promotions SET used_qty = used_qty + ?, updated_at = ? WHERE id = ? AND mart_id = ? AND total_limit_qty > 0'
      ).bind(delta, now, prod.applied_promo_id, martId).run().catch(() => {});
    }
  } else {
    // 수량 감액(결품 등) -> 재고 복원
    const restoreQty = Math.abs(delta);
    await db.prepare(
      'UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? AND mart_id = ?'
    ).bind(restoreQty, now, pid, martId).run();
    if (prod.applied_promo_id) {
      await db.prepare(
        'UPDATE store_promotions SET used_qty = MAX(0, used_qty - ?), updated_at = ? WHERE id = ? AND mart_id = ? AND total_limit_qty > 0'
      ).bind(restoreQty, now, prod.applied_promo_id, martId).run().catch(() => {});
    }
  }
  return true;
}

export async function restoreInventoryForCancelledOrder(db, martId, orderId) {
  const itemsRes = await db.prepare(
    'SELECT product_id, qty FROM order_items WHERE order_id = ?'
  ).bind(orderId).all();
  const rows = itemsRes?.results || [];
  for (const row of rows) {
    const qty = Math.max(0, Math.floor(Number(row.qty || 0)));
    if (qty > 0 && row.product_id) {
      await adjustInventoryForDelta(db, martId, row.product_id, -qty);
    }
  }
  return rows.length;
}
