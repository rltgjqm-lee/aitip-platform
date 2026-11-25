/**
 * AITIP Mart Logistics - 피킹 · 박싱 · 과면세 정산 순수 계산 모듈 (ESM)
 * 로컬(mart-service.mjs)과 Cloudflare Pages Functions(functions/api/mart/[[path]].js)가
 * 동일한 집계·정산 로직을 공유하기 위한 단일 책임(SRP) 도메인 모듈.
 */

export function buildPickingSummary(orders = [], dateFilter = '') {
  const targetOrders = dateFilter
    ? (orders || []).filter(o => String(o.delivery_date || '') === dateFilter)
    : (orders || []);
  const itemMap = new Map();
  for (const ord of targetOrders) {
    for (const it of (ord.items || [])) {
      const key = it.product_id || it.name;
      const prev = itemMap.get(key) || {
        product_id: it.product_id,
        name: it.name,
        uom: it.uom || '개',
        total_qty: 0,
        order_count: 0,
        storage_temp: it.storage_temp || 'AMBIENT'
      };
      prev.total_qty += Number(it.actual_qty !== undefined ? it.actual_qty : (it.qty || 0));
      prev.order_count += 1;
      itemMap.set(key, prev);
    }
  }
  return {
    orders: targetOrders,
    items: Array.from(itemMap.values()),
    adjustments: []
  };
}

export function buildBoxingManifest(orders = [], dateFilter = '') {
  const targetOrders = dateFilter
    ? (orders || []).filter(o => String(o.delivery_date || '') === dateFilter)
    : (orders || []);
  const manifest = targetOrders.map(ord => {
    const buckets = { AMBIENT: [], REFRIGERATED: [], FROZEN: [] };
    for (const it of (ord.items || [])) {
      const t = buckets[it.storage_temp] ? it.storage_temp : 'AMBIENT';
      buckets[t].push(it);
    }
    return {
      order_id: ord.order_id || ord.id,
      buyer_name: ord.buyer_name,
      delivery_date: ord.delivery_date,
      status: ord.status || ord.order_status,
      buckets
    };
  });
  return { manifest, orders: targetOrders };
}

export function buildSettlementSummary(orders = [], products = [], mart = {}, policy = {}) {
  const prodMap = new Map((products || []).map(p => [p.id, p]));
  const pgFeePct = Number(policy.mart_pg_fee_pct ?? 2.0);
  const saasFeePct = Number(policy.mart_saas_fee_pct ?? 3.0);

  let grossSales = 0;
  let exemptSales = 0;
  let taxableSales = 0;
  let pgFeeTotal = 0;
  let saasFeeTotal = 0;
  let martSettlementTotal = 0;

  const rows = (orders || []).map(ord => {
    let ordExempt = 0;
    let ordTaxable = 0;
    for (const it of (ord.items || [])) {
      const prod = prodMap.get(it.product_id) || {};
      const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
      const amt = q * Number(it.unit_price || 0);
      if (prod.tax_type === 'TAXABLE') ordTaxable += amt;
      else ordExempt += amt;
    }
    const ordGross = ordExempt + ordTaxable;
    const payMethod = ord.payment_method || 'FACILITY_POSTPAY';
    const isPg = payMethod === 'CARD' || payMethod === 'MUNICIPAL_VOUCHER';
    const pgFee = isPg ? Math.round(ordGross * (pgFeePct / 100)) : 0;
    const saasFee = Math.round(ordGross * (saasFeePct / 100));
    const rowDeduction = pgFee + saasFee;
    const martNet = isPg ? (ordGross - rowDeduction) : ordGross;

    grossSales += ordGross;
    exemptSales += ordExempt;
    taxableSales += ordTaxable;
    pgFeeTotal += pgFee;
    saasFeeTotal += saasFee;
    martSettlementTotal += martNet;

    return {
      ledger_id: `mstl_${ord.order_id || ord.id}`,
      order_id: ord.order_id || ord.id,
      facility_id: ord.facility_id || null,
      buyer_name: ord.buyer_name,
      customer_type: ord.customer_type || (ord.facility_id ? 'SENIOR_CENTER' : 'INDIVIDUAL'),
      payment_method: payMethod,
      settlement_route: isPg ? 'PG' : 'DIRECT',
      delivery_date: ord.delivery_date,
      status: ord.status || ord.order_status,
      gross_amount: ordGross,
      exempt_amount: ordExempt,
      taxable_amount: ordTaxable,
      pg_fee: pgFee,
      saas_fee: saasFee,
      total_fee: rowDeduction,
      mart_settlement: martNet
    };
  });

  return {
    mart,
    totals: {
      gross_sales: grossSales,
      exempt_sales: exemptSales,
      taxable_sales: taxableSales,
      pg_fee_total: pgFeeTotal,
      saas_fee_total: saasFeeTotal,
      total_deduction: pgFeeTotal + saasFeeTotal,
      mart_settlement_total: martSettlementTotal,
      adjustment_count: 0
    },
    rows
  };
}
