/**
 * AITIP Mart Logistics - 피킹 · 박싱 · 과면세 정산 순수 계산 모듈 (ESM)
 * 로컬(mart-service.mjs)과 Cloudflare Pages Functions(functions/api/mart/[[path]].js)가
 * 100% 동일한 스키마와 집계 로직을 공유하기 위한 단일 책임(SRP) 도메인 모듈.
 */

export function buildPickingSummary(orders = [], products = [], deliveryDate = '', adjustments = []) {
  const prodMap = new Map((products || []).map(p => [p.id, p]));
  const activeOrders = (orders || []).filter(o => {
    const status = o.status || o.order_status;
    return (!deliveryDate || o.delivery_date === deliveryDate) && ['REQUESTED', 'PICKING'].includes(status);
  });
  const agg = new Map();
  for (const ord of activeOrders) {
    const ordId = ord.order_id || ord.id;
    for (const it of (ord.items || [])) {
      const pid = it.product_id || it.name;
      const prod = prodMap.get(it.product_id) || {};
      const src = prod.fulfillment_source || (prod.category_type === 'PREP_PROCESSED' ? 'PREP_CENTER' : 'MART_FLOOR');
      const temp = it.storage_temp || prod.storage_temp || 'AMBIENT';
      const key = `${src}::${pid}`;
      if (!agg.has(key)) {
        agg.set(key, {
          product_id: pid,
          name: it.name || it.sku_name || prod.name || '상품',
          fulfillment_source: src,
          storage_temp: temp,
          uom: it.uom || it.unit || prod.uom || '개',
          prep_method: prod.prep_method || '',
          inspection_note: prod.inspection_note || '',
          total_ordered_qty: 0,
          total_actual_qty: 0,
          order_refs: []
        });
      }
      const entry = agg.get(key);
      const ordered = Number(it.qty || 0);
      const actual = it.actual_qty !== undefined ? Number(it.actual_qty) : ordered;
      entry.total_ordered_qty += ordered;
      entry.total_actual_qty += actual;
      entry.order_refs.push({
        order_id: ordId,
        buyer_name: ord.buyer_name,
        ordered_qty: ordered,
        actual_qty: actual,
        unit_price: Number(it.unit_price || 0)
      });
    }
  }
  return {
    delivery_date: deliveryDate || 'ALL',
    order_count: activeOrders.length,
    orders: activeOrders,
    items: Array.from(agg.values()),
    adjustments: adjustments || []
  };
}

export function buildBoxingManifest(orders = [], products = [], deliveryDate = '') {
  const prodMap = new Map((products || []).map(p => [p.id, p]));
  const activeOrders = (orders || []).filter(o => {
    const status = o.status || o.order_status;
    return (!deliveryDate || o.delivery_date === deliveryDate) && ['REQUESTED', 'PICKING', 'PACKED', 'DISPATCHED'].includes(status);
  });
  const TEMP_LABEL = { AMBIENT: '상온 박스', REFRIGERATED: '냉장 박스', FROZEN: '냉동 박스' };
  const manifest = activeOrders.map(ord => {
    const ordId = ord.order_id || ord.id;
    const boxes = {};
    for (const it of (ord.items || [])) {
      const prod = prodMap.get(it.product_id) || {};
      const temp = it.storage_temp || prod.storage_temp || 'AMBIENT';
      const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
      if (q <= 0) continue;
      if (!boxes[temp]) {
        boxes[temp] = {
          box_id: `${ordId}-${temp}`,
          storage_temp: temp,
          box_label: TEMP_LABEL[temp] || '상온 박스',
          items: []
        };
      }
      boxes[temp].items.push({
        product_id: it.product_id,
        name: it.name || it.sku_name,
        qty: q,
        uom: it.uom || it.unit || prod.uom || '개'
      });
    }
    const boxList = Object.values(boxes);
    return {
      order_id: ordId,
      facility_id: ord.facility_id || null,
      buyer_name: ord.buyer_name,
      customer_type: ord.customer_type || (ord.facility_id ? 'SENIOR_CENTER' : 'INDIVIDUAL'),
      delivery_date: ord.delivery_date,
      status: ord.status || ord.order_status,
      total_amount: ord.total_amount,
      box_count: boxList.length,
      boxes: boxList
    };
  });
  return { delivery_date: deliveryDate || 'ALL', manifest };
}

export function buildSettlementSummary(orders = [], products = [], mart = {}, policy = {}, adjustments = []) {
  const prodMap = new Map((products || []).map(p => [p.id, p]));
  const pgFeePct = Number(policy.mart_pg_fee_pct ?? 2.0);
  const saasFeePct = Number(policy.mart_saas_fee_pct ?? 3.0);
  const alimtalkUnitFee = Number(policy.alimtalk_base_cost ?? 13) + Number(policy.alimtalk_platform_fee ?? 2);

  let grossSales = 0;
  let exemptSales = 0;
  let taxableSales = 0;
  let martCostTotal = 0;
  let pgSalesTotal = 0;
  let directSalesTotal = 0;
  let pgFeeTotal = 0;
  let saasFeeTotal = 0;
  let pgDeductionTotal = 0;
  let directBillingTotal = 0;

  const rows = (orders || []).map(ord => {
    const ordId = ord.order_id || ord.id;
    let ordExempt = 0;
    let ordTaxable = 0;
    let ordCost = 0;
    for (const it of (ord.items || [])) {
      const prod = prodMap.get(it.product_id) || {};
      const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
      const amt = q * Number(it.unit_price || 0);
      const unitCost = Number(prod.cost_price || Math.round((it.unit_price || 0) * 0.72));
      ordCost += q * unitCost;
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
    martCostTotal += ordCost;
    pgFeeTotal += pgFee;
    saasFeeTotal += saasFee;
    if (isPg) {
      pgSalesTotal += ordGross;
      pgDeductionTotal += rowDeduction;
    } else {
      directSalesTotal += ordGross;
      directBillingTotal += saasFee;
    }

    return {
      ledger_id: `mstl_${ordId}`,
      order_id: ordId,
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
      agency_fee: 0,
      pg_fee: pgFee,
      saas_fee: saasFee,
      total_fee: rowDeduction,
      mart_settlement: martNet
    };
  });

  const smsCount = (orders || []).length * 2;
  const smsFeeTotal = smsCount * alimtalkUnitFee;
  const totalDeduction = pgFeeTotal + saasFeeTotal;
  const taxInvoiceSupply = pgFeeTotal + saasFeeTotal + smsFeeTotal;
  const taxInvoiceVat = Math.round(taxInvoiceSupply * 0.1);

  return {
    mart,
    rates: {
      agency_fee_pct: 0,
      pg_fee_pct: pgFeePct,
      saas_fee_pct: saasFeePct,
      alimtalk_unit_fee: alimtalkUnitFee,
      saas_monthly_fee: 0
    },
    totals: {
      gross_sales: grossSales,
      exempt_sales: exemptSales,
      taxable_sales: taxableSales,
      mart_cost_total: martCostTotal,
      pg_sales_total: pgSalesTotal,
      direct_sales_total: directSalesTotal,
      agency_fee_total: 0,
      pg_fee_total: pgFeeTotal,
      saas_fee_total: saasFeeTotal,
      total_deduction: totalDeduction,
      pg_deduction_total: pgDeductionTotal,
      direct_billing_total: directBillingTotal,
      mart_pg_payout_total: pgSalesTotal - pgDeductionTotal,
      mart_settlement_total: grossSales - totalDeduction,
      adjustment_count: (adjustments || []).length,
      alimtalk_sms_count: smsCount,
      alimtalk_sms_fee: smsFeeTotal,
      tax_invoice_supply: taxInvoiceSupply,
      tax_invoice_vat: taxInvoiceVat,
      tax_invoice_total: taxInvoiceSupply + taxInvoiceVat
    },
    rows,
    adjustments: adjustments || []
  };
}
