/**
 * AITIP Mart Consignment Operations Service (ESM + JSON Persistence)
 * 단위농협 하나로마트 온라인 몰 위탁(대행) 운영 백엔드
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMartFlyerText, parseMartPosCsv, parseMartPrepSheet } from '../../../core/merchant-meta/mart-catalog-parser.mjs';
import {
  createDefaultPwaConfig,
  createDefaultMarts,
  createDefaultGroupBuys,
  createDefaultPromoTypes,
  createDefaultData
} from './mart-seed.mjs';
import {
  nextMonotonicId,
  applyDailyPriceBatchToData,
  getUploadHistoryFromData,
  rollbackUploadBatchInData
} from './mart-price-batch.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'mart_data.json');
const MEDIA_DIR = path.join(__dirname, 'media');
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

function generateMediaTypeId() {
  const ts = Date.now().toString(32).toLowerCase().padStart(10, '0').slice(-10);
  let tail = '';
  for (let i = 0; i < 15; i++) tail += CROCKFORD[Math.floor(Math.random() * 32)];
  return `med_0${ts}${tail}`.slice(0, 30);
}

class MartService {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (_) {}
    const initial = createDefaultData();
    this.saveData(initial);
    return initial;
  }

  saveData(target = this.data) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(target, null, 2), 'utf8');
  }

  _ensurePromoTypes() {
    if (!Array.isArray(this.data.promo_types) || this.data.promo_types.length === 0) {
      this.data.promo_types = createDefaultPromoTypes();
      this.saveData();
    }
    return this.data.promo_types;
  }

  getPromoTypes() {
    return this._ensurePromoTypes();
  }

  savePromoType(payload = {}) {
    const VALID_CALC = new Set(['UNIT_DISCOUNT', 'BOGO_BUNDLE', 'MIX_MATCH', 'THRESHOLD']);
    const list = this._ensurePromoTypes();
    const label = String(payload.label || '').trim();
    if (!label) throw new Error('행사 유형 이름을 입력하세요.');
    const calcMode = VALID_CALC.has(payload.calc_mode) ? payload.calc_mode : 'UNIT_DISCOUNT';
    const rawCode = String(payload.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const code = rawCode || `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
    const idx = list.findIndex(t => t.code === code);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        label,
        calc_mode: calcMode,
        is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : list[idx].is_active
      };
    } else {
      list.push({ code, label, calc_mode: calcMode, is_active: true, is_system: false });
    }
    this.saveData();
    return { promo_types: list };
  }

  deletePromoType(code = '') {
    const targetCode = String(code || '').trim();
    if (!targetCode) throw new Error('삭제할 행사 유형 코드가 필요합니다.');
    const list = this._ensurePromoTypes();
    const idx = list.findIndex(t => t.code === targetCode);
    if (idx < 0) throw new Error('해당 행사 유형을 찾을 수 없습니다.');
    const inUse = (this.data.promotions || []).some(pr => pr.promo_type === targetCode)
      || (this.data.products || []).some(p => p.applied_promo_type === targetCode);
    if (inUse) {
      list[idx].is_active = false;
      this.saveData();
      return { action: 'DEACTIVATED', promo_types: list };
    }
    list.splice(idx, 1);
    this.saveData();
    return { action: 'DELETED', promo_types: list };
  }

  getCatalog() {
    const products = (this.data.products || []).map(p => {
      const src = p.fulfillment_source || (p.category_type === 'PREP_PROCESSED' ? 'PREP_CENTER' : 'MART_FLOOR');
      const reg = Number(p.regular_price || 0);
      const sale = Number(p.sale_price ?? reg);
      const discountPct = p.discount_pct !== undefined
        ? Number(p.discount_pct)
        : (reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0);
      return {
        ...p,
        discount_pct: discountPct,
        payment_scope: p.payment_scope || 'ONLINE_APPLICABLE',
        fulfillment_source: src,
        shared_catalog_scope: p.shared_catalog_scope || 'LOCAL_ONLY',
        online_publish_status: p.online_publish_status || 'PUBLISHED_FEED',
        stock_qty: p.stock_qty !== undefined ? Number(p.stock_qty) : 50,
        safety_stock: p.safety_stock !== undefined ? Number(p.safety_stock) : 5
      };
    });
    return {
      mart: this.data.mart,
      products,
      promotions: this.data.promotions || [],
      promo_types: this._ensurePromoTypes()
    };
  }

  bulkUpdateProducts(updates = []) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('수정할 상품 목록이 비어 있습니다.');
    }
    const VALID_SOURCES = new Set(['MART_FLOOR', 'PREP_CENTER', 'DIRECT_SUPPLIER']);
    let updatedCount = 0;
    for (const u of updates) {
      if (!u || !u.id) continue;
      const idx = this.data.products.findIndex(p => p.id === u.id);
      if (idx < 0) continue;
      const cur = this.data.products[idx];
      const nextSrc = VALID_SOURCES.has(u.fulfillment_source)
        ? u.fulfillment_source
        : (cur.fulfillment_source || (cur.category_type === 'PREP_PROCESSED' ? 'PREP_CENTER' : 'MART_FLOOR'));
      const nextReg = u.regular_price !== undefined ? Math.max(0, Number(u.regular_price)) : Number(cur.regular_price || 0);
      let nextSale = u.sale_price !== undefined ? Math.max(0, Number(u.sale_price)) : Number(cur.sale_price ?? nextReg);
      let nextDisc = u.discount_pct !== undefined ? Math.max(0, Math.min(99, Number(u.discount_pct))) : undefined;
      if (nextDisc !== undefined && u.sale_price === undefined && nextReg > 0) {
        nextSale = Math.round(nextReg * (1 - nextDisc / 100));
      } else if (nextDisc === undefined) {
        nextDisc = nextReg > 0 && nextSale < nextReg ? Math.round((1 - nextSale / nextReg) * 100) : 0;
      }
      this.data.products[idx] = {
        ...cur,
        cost_price: u.cost_price !== undefined ? Math.max(0, Number(u.cost_price)) : cur.cost_price,
        regular_price: nextReg,
        sale_price: nextSale,
        discount_pct: nextDisc,
        promo_start: u.promo_start !== undefined ? String(u.promo_start) : (cur.promo_start || ''),
        promo_end: u.promo_end !== undefined ? String(u.promo_end) : (cur.promo_end || ''),
        stock_qty: u.stock_qty !== undefined ? Math.max(0, Number(u.stock_qty)) : (cur.stock_qty ?? 50),
        safety_stock: u.safety_stock !== undefined ? Math.max(0, Number(u.safety_stock)) : (cur.safety_stock ?? 5),
        payment_scope: u.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : (u.payment_scope === 'ONLINE_APPLICABLE' ? 'ONLINE_APPLICABLE' : (cur.payment_scope || 'ONLINE_APPLICABLE')),
        channel_scope: ['ALL_CHANNELS', 'ONLINE_ONLY', 'POS_ONLY'].includes(u.channel_scope) ? u.channel_scope : (cur.channel_scope || (u.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ALL_CHANNELS')),
        applied_promo_id: u.applied_promo_id !== undefined ? String(u.applied_promo_id) : (cur.applied_promo_id || ''),
        applied_promo_name: u.applied_promo_name !== undefined ? String(u.applied_promo_name) : (cur.applied_promo_name || ''),
        applied_promo_type: u.applied_promo_type !== undefined ? String(u.applied_promo_type) : (cur.applied_promo_type || ''),
        promo_calc_mode: u.promo_calc_mode !== undefined ? String(u.promo_calc_mode) : (cur.promo_calc_mode || ''),
        promo_required_qty: u.promo_required_qty !== undefined ? Number(u.promo_required_qty) : (cur.promo_required_qty || 1),
        promo_bundle_price: u.promo_bundle_price !== undefined ? Number(u.promo_bundle_price) : (cur.promo_bundle_price || 0),
        promo_days_of_week: Array.isArray(u.promo_days_of_week) ? u.promo_days_of_week : (cur.promo_days_of_week || []),
        promo_max_discount_amount: u.promo_max_discount_amount !== undefined ? Number(u.promo_max_discount_amount) : (cur.promo_max_discount_amount || 0),
        promo_limit_per_person: u.promo_limit_per_person !== undefined ? Number(u.promo_limit_per_person) : (cur.promo_limit_per_person || 0),
        promo_card_targets: Array.isArray(u.promo_card_targets) ? u.promo_card_targets : (cur.promo_card_targets || []),
        online_publish_status: ['PUBLISHED_FEED', 'SEARCH_ONLY', 'SUSPENDED'].includes(u.online_publish_status) ? u.online_publish_status : (cur.online_publish_status || 'PUBLISHED_FEED'),
        sales_target: ['BOTH', 'B2C_ONLY', 'B2B_ONLY'].includes(u.sales_target) ? u.sales_target : (cur.sales_target || 'BOTH'),
        b2b_price: u.b2b_price !== undefined ? Math.max(0, Number(u.b2b_price)) : Number(cur.b2b_price ?? 0),
        b2b_min_qty: u.b2b_min_qty !== undefined ? Math.max(1, Number(u.b2b_min_qty)) : Number(cur.b2b_min_qty ?? 1),
        fulfillment_source: nextSrc
      };
      updatedCount += 1;
    }
    if (updatedCount > 0) this.saveData();
    return { updated_count: updatedCount };
  }

  updateProduct(payload = {}) {
    if (!payload.id) throw new Error('수정할 상품 ID가 필요합니다.');
    const idx = this.data.products.findIndex(p => p.id === payload.id);
    if (idx < 0) throw new Error('상품을 찾을 수 없습니다.');
    const cur = this.data.products[idx];
    const reg = payload.regular_price !== undefined ? Math.max(0, Number(payload.regular_price)) : Number(cur.regular_price || 0);
    let sale = payload.sale_price !== undefined
      ? Math.max(0, Number(payload.sale_price))
      : (!cur.applied_promo_id && payload.regular_price !== undefined ? reg : Number(cur.sale_price ?? reg));
    if (reg > 0 && sale > reg) sale = reg;
    this.data.products[idx] = {
      ...cur,
      ...payload,
      sales_target: ['BOTH', 'B2C_ONLY', 'B2B_ONLY'].includes(payload.sales_target) ? payload.sales_target : (cur.sales_target || 'BOTH'),
      b2b_price: payload.b2b_price !== undefined ? Math.max(0, Number(payload.b2b_price)) : Number(cur.b2b_price ?? 0),
      b2b_min_qty: payload.b2b_min_qty !== undefined ? Math.max(1, Number(payload.b2b_min_qty)) : Number(cur.b2b_min_qty ?? 1),
      cost_price: payload.cost_price !== undefined ? Math.max(0, Number(payload.cost_price)) : Number(cur.cost_price || 0),
      regular_price: reg,
      sale_price: sale,
      stock_qty: payload.stock_qty !== undefined ? Math.max(0, Number(payload.stock_qty)) : Number(cur.stock_qty ?? 50),
      safety_stock: payload.safety_stock !== undefined ? Math.max(0, Number(payload.safety_stock)) : Number(cur.safety_stock ?? 5),
      discount_pct: reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0
    };
    this.saveData();
    return this.data.products[idx];
  }

  addProduct(payload) {
    const item = {
      id: nextMonotonicId('mrt_sku'),
      barcode: payload.barcode || `200${String(Date.now()).slice(-10)}`,
      name: payload.name || '신규 상품',
      category_type: payload.category_type || 'B2B_INDUSTRIAL',
      category_l1: payload.category_l1 || '',
      category_l2: payload.category_l2 || '',
      category_l3: payload.category_l3 || '',
      category_path: payload.category_path || '-',
      tax_type: payload.tax_type || (payload.category_type === 'B2B_INDUSTRIAL' ? 'TAXABLE' : 'EXEMPT'),
      spec: payload.spec || '-',
      uom: payload.uom || '개',
      weight_grams: Number(payload.weight_grams || 0),
      pack_qty: Number(payload.pack_qty || 1),
      size_grade: payload.size_grade || '',
      prep_method: payload.prep_method || '',
      inspection_note: payload.inspection_note || '',
      cost_price: Math.max(0, Number(payload.cost_price ?? 0)),
      regular_price: Math.max(0, Number(payload.regular_price ?? 0)),
      sale_price: payload.sale_price !== undefined ? Math.max(0, Number(payload.sale_price)) : Math.max(0, Number(payload.regular_price ?? 0)),
      promo_start: payload.promo_start || '',
      promo_end: payload.promo_end || '',
      pos_price: payload.pos_price !== undefined ? Math.max(0, Number(payload.pos_price)) : 0,
      pos_agency_tagged: Boolean(payload.pos_agency_tagged),
      reservation_price_policy: payload.reservation_price_policy === 'MARKET_AT_DELIVERY' ? 'MARKET_AT_DELIVERY' : 'FIXED_AT_ORDER',
      upload_batch_type: payload.upload_batch_type || 'BASE_PRODUCT',
      payment_scope: payload.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
      channel_scope: ['ALL_CHANNELS', 'ONLINE_ONLY', 'POS_ONLY'].includes(payload.channel_scope) ? payload.channel_scope : (payload.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ALL_CHANNELS'),
      sales_target: ['BOTH', 'B2C_ONLY', 'B2B_ONLY'].includes(payload.sales_target) ? payload.sales_target : (payload.category_type === 'PREP_PROCESSED' ? 'B2B_ONLY' : 'BOTH'),
      b2b_price: payload.b2b_price !== undefined ? Math.max(0, Number(payload.b2b_price)) : 0,
      b2b_min_qty: Math.max(1, Number(payload.b2b_min_qty ?? 1)),
      applied_promo_id: payload.applied_promo_id || '',
      applied_promo_name: payload.applied_promo_name || '',
      applied_promo_type: payload.applied_promo_type || '',
      promo_required_qty: Math.max(1, Number(payload.promo_required_qty ?? 1)),
      promo_bundle_price: Math.max(0, Number(payload.promo_bundle_price ?? 0)),
      promo_days_of_week: Array.isArray(payload.promo_days_of_week) ? payload.promo_days_of_week : [],
      promo_max_discount_amount: Math.max(0, Number(payload.promo_max_discount_amount ?? 0)),
      promo_limit_per_person: Math.max(0, Number(payload.promo_limit_per_person ?? 0)),
      promo_card_targets: Array.isArray(payload.promo_card_targets) ? payload.promo_card_targets : [],
      fulfillment_source: payload.fulfillment_source || (payload.category_type === 'PREP_PROCESSED' ? 'PREP_CENTER' : 'MART_FLOOR'),
      stock_qty: payload.stock_qty !== undefined ? Math.max(0, Number(payload.stock_qty)) : 50,
      safety_stock: payload.safety_stock !== undefined ? Math.max(0, Number(payload.safety_stock)) : 5,
      storage_temp: payload.storage_temp || 'AMBIENT',
      media_id: payload.media_id || '',
      image_url: payload.image_url || '',
      status: 'ACTIVE'
    };
    this.data.products.unshift(item);
    this.saveData();
    return item;
  }

  _findExistingProductMatch(item) {
    const norm = (s = '') => String(s || '').replace(/\s+/g, '').toLowerCase();
    const targetName = norm(item?.name);
    return (this.data.products || []).find(x =>
      (item?.barcode && !String(item.barcode).startsWith('2001000000') && x.barcode === item.barcode)
      || (targetName && norm(x.name) === targetName)
    );
  }

  previewFlyerImport(rawText = '') {
    const parsed = parseMartFlyerText(rawText);
    const previewItems = (parsed.items || []).map(p => {
      const existing = this._findExistingProductMatch(p);
      return {
        ...p,
        match_status: existing ? 'MATCHED_EXISTING' : 'NEW_PRODUCT',
        matched_product_id: existing ? existing.id : '',
        matched_barcode: existing ? existing.barcode : ''
      };
    });
    return {
      promo_start: parsed.promo_start,
      promo_end: parsed.promo_end,
      items: previewItems,
      promotions: parsed.promotions || []
    };
  }

  bulkImport(mode, rawText) {
    let parsed;
    if (mode === 'POS_CSV') parsed = parseMartPosCsv(rawText);
    else if (mode === 'PREP_SHEET') parsed = parseMartPrepSheet(rawText);
    else parsed = parseMartFlyerText(rawText);

    const addedProducts = [];
    for (const p of parsed.items || []) {
      const existing = mode === 'FLYER'
        ? this._findExistingProductMatch(p)
        : (this.data.products || []).find(x => x.barcode === p.barcode && p.barcode);
      if (existing) {
        const idx = this.data.products.findIndex(x => x.id === existing.id);
        this.data.products[idx] = {
          ...existing,
          sale_price: p.sale_price ?? existing.sale_price,
          promo_start: p.promo_start || existing.promo_start,
          promo_end: p.promo_end || existing.promo_end,
          payment_scope: p.payment_scope || existing.payment_scope,
          channel_scope: p.channel_scope || existing.channel_scope,
          applied_promo_id: p.applied_promo_id || existing.applied_promo_id,
          applied_promo_name: p.applied_promo_name || existing.applied_promo_name,
          applied_promo_type: p.applied_promo_type || existing.applied_promo_type,
          promo_calc_mode: p.promo_calc_mode || existing.promo_calc_mode,
          promo_required_qty: p.promo_required_qty || existing.promo_required_qty,
          promo_bundle_price: p.promo_bundle_price ?? existing.promo_bundle_price,
          promo_days_of_week: p.promo_days_of_week || existing.promo_days_of_week,
          promo_max_discount_amount: p.promo_max_discount_amount ?? existing.promo_max_discount_amount,
          promo_limit_per_person: p.promo_limit_per_person ?? existing.promo_limit_per_person,
          promo_card_targets: p.promo_card_targets || existing.promo_card_targets,
          status: 'ACTIVE'
        };
        addedProducts.push(this.data.products[idx]);
      } else {
        const record = { ...p, status: 'ACTIVE' };
        this.data.products.unshift(record);
        addedProducts.push(record);
      }
    }

    const addedPromos = [];
    for (const pr of parsed.promotions || []) {
      this.data.promotions.unshift(pr);
      addedPromos.push(pr);
    }

    this.saveData();
    return {
      mode,
      imported_products: addedProducts.length,
      imported_promotions: addedPromos.length,
      products: addedProducts,
      promotions: addedPromos
    };
  }

  createPromotion(payload) {
    const pTypes = this._ensurePromoTypes();
    const matchedType = pTypes.find(t => t.code === payload.promo_type);
    const pr = {
      id: nextMonotonicId('mpr'),
      name: payload.name || '신규 마트 행사',
      promo_type: payload.promo_type || 'BOGO_1_PLUS_1',
      calc_mode: payload.calc_mode || matchedType?.calc_mode || 'UNIT_DISCOUNT',
      payment_scope: payload.channel_scope === 'POS_ONLY' || payload.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
      channel_scope: ['ALL_CHANNELS', 'ONLINE_ONLY', 'POS_ONLY'].includes(payload.channel_scope) ? payload.channel_scope : (payload.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ALL_CHANNELS'),
      required_qty: Math.max(1, Number(payload.required_qty ?? 2)),
      min_purchase_amount: Math.max(0, Number(payload.min_purchase_amount ?? 0)),
      bundle_price: Math.max(0, Number(payload.bundle_price ?? 0)),
      discount_type: payload.discount_type === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENT',
      discount_pct: Math.max(0, Math.min(99, Number(payload.discount_pct ?? payload.discount_rate ?? 0))),
      discount_amount: Math.max(0, Number(payload.discount_amount ?? 0)),
      max_discount_amount: Math.max(0, Number(payload.max_discount_amount ?? 0)),
      days_of_week: Array.isArray(payload.days_of_week) ? payload.days_of_week : [],
      card_targets: Array.isArray(payload.card_targets) ? payload.card_targets : [],
      limit_per_person: Math.max(0, Number(payload.limit_per_person ?? 0)),
      total_limit_qty: Math.max(0, Number(payload.total_limit_qty ?? 0)),
      used_qty: 0,
      max_receipt_sections: Math.max(0, Number(payload.max_receipt_sections ?? 0)),
      start_date: payload.start_date || '2026-11-17',
      end_date: payload.end_date || '2026-11-30',
      status: 'ACTIVE'
    };
    this.data.promotions.unshift(pr);
    this.saveData();
    return pr;
  }

  updatePromotion(payload = {}) {
    if (!payload.id) throw new Error('수정할 행사 ID가 필요합니다.');
    const idx = (this.data.promotions || []).findIndex(p => p.id === payload.id);
    if (idx < 0) throw new Error('행사 룰을 찾을 수 없습니다.');
    const cur = this.data.promotions[idx];
    const pTypes = this._ensurePromoTypes();
    const nextType = payload.promo_type || cur.promo_type;
    const matchedType = pTypes.find(t => t.code === nextType);
    const chScope = ['ALL_CHANNELS', 'ONLINE_ONLY', 'POS_ONLY'].includes(payload.channel_scope)
      ? payload.channel_scope
      : (cur.channel_scope || 'ALL_CHANNELS');
    const updated = {
      ...cur,
      name: payload.name !== undefined ? String(payload.name).trim() || cur.name : cur.name,
      promo_type: nextType,
      calc_mode: payload.calc_mode || matchedType?.calc_mode || cur.calc_mode || 'UNIT_DISCOUNT',
      channel_scope: chScope,
      payment_scope: chScope === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
      required_qty: payload.required_qty !== undefined ? Math.max(1, Number(payload.required_qty)) : cur.required_qty,
      min_purchase_amount: payload.min_purchase_amount !== undefined ? Math.max(0, Number(payload.min_purchase_amount)) : (cur.min_purchase_amount || 0),
      bundle_price: payload.bundle_price !== undefined ? Math.max(0, Number(payload.bundle_price)) : (cur.bundle_price || 0),
      discount_type: payload.discount_type || cur.discount_type || 'PERCENT',
      discount_pct: payload.discount_pct !== undefined ? Math.max(0, Math.min(99, Number(payload.discount_pct))) : (cur.discount_pct || 0),
      discount_amount: payload.discount_amount !== undefined ? Math.max(0, Number(payload.discount_amount)) : (cur.discount_amount || 0),
      max_discount_amount: payload.max_discount_amount !== undefined ? Math.max(0, Number(payload.max_discount_amount)) : (cur.max_discount_amount || 0),
      days_of_week: Array.isArray(payload.days_of_week) ? payload.days_of_week : (cur.days_of_week || []),
      card_targets: Array.isArray(payload.card_targets) ? payload.card_targets : (cur.card_targets || []),
      limit_per_person: payload.limit_per_person !== undefined ? Math.max(0, Number(payload.limit_per_person)) : (cur.limit_per_person || 0),
      total_limit_qty: payload.total_limit_qty !== undefined ? Math.max(0, Number(payload.total_limit_qty)) : (cur.total_limit_qty || 0),
      used_qty: Number(cur.used_qty || 0),
      max_receipt_sections: payload.max_receipt_sections !== undefined ? Math.max(0, Number(payload.max_receipt_sections)) : (cur.max_receipt_sections || 0),
      start_date: payload.start_date || cur.start_date,
      end_date: payload.end_date || cur.end_date,
      status: ['ACTIVE', 'ENDED', 'PAUSED'].includes(payload.status) ? payload.status : (cur.status || 'ACTIVE')
    };
    this.data.promotions[idx] = updated;
    // 연결된 상품의 행사 메타도 함께 동기화
    this.data.products = (this.data.products || []).map(p => {
      if (p.applied_promo_id !== updated.id) return p;
      return {
        ...p,
        applied_promo_name: updated.name,
        applied_promo_type: updated.promo_type,
        promo_calc_mode: updated.calc_mode,
        promo_required_qty: updated.required_qty,
        promo_bundle_price: updated.bundle_price,
        promo_days_of_week: updated.days_of_week,
        promo_max_discount_amount: updated.max_discount_amount,
        promo_limit_per_person: updated.limit_per_person,
        promo_card_targets: updated.card_targets,
        promo_start: updated.start_date,
        promo_end: updated.end_date,
        channel_scope: updated.channel_scope,
        payment_scope: updated.payment_scope
      };
    });
    this.saveData();
    return updated;
  }

  deletePromotion(id) {
    if (!id) throw new Error('삭제할 행사 ID가 필요합니다.');
    const idx = (this.data.promotions || []).findIndex(p => p.id === id);
    if (idx < 0) throw new Error('행사 룰을 찾을 수 없습니다.');
    const [removed] = this.data.promotions.splice(idx, 1);
    let unlinkedCount = 0;
    this.data.products = (this.data.products || []).map(p => {
      if (p.applied_promo_id !== id) return p;
      unlinkedCount += 1;
      const reg = Number(p.regular_price || 0);
      return {
        ...p,
        sale_price: reg,
        discount_pct: 0,
        promo_start: '',
        promo_end: '',
        applied_promo_id: '',
        applied_promo_name: '',
        applied_promo_type: '',
        promo_calc_mode: '',
        promo_required_qty: 1,
        promo_bundle_price: 0,
        promo_days_of_week: [],
        promo_max_discount_amount: 0,
        promo_limit_per_person: 0,
        promo_card_targets: []
      };
    });
    this.saveData();
    return { deleted_id: removed.id, unlinked_products: unlinkedCount };
  }

  getOrders() {
    return (this.data.orders || []).map(o => ({
      ...o,
      order_channel: o.order_channel || (String(o.facility_id || '').includes('PWA') ? 'ONLINE' : 'OFFLINE'),
      offline_source: o.offline_source || 'FACILITY_REGULAR',
      payment_method: o.payment_method || 'FACILITY_POSTPAY'
    }));
  }

  _nextOrderUid(deliveryDate = '') {
    const martId = String(this.data.mart?.mart_id || 'MRT-11-650-01-47121-0001').replace(/^MRT-/, '');
    const d = (deliveryDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(2, 8);
    const prefix = `ORD-${martId}-${d}-`;
    let maxSeq = 0;
    for (const o of this.data.orders || []) {
      if (String(o.order_id || '').startsWith(prefix)) {
        const n = Number(String(o.order_id).slice(prefix.length));
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  createOrder(payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const totalAmount = items.reduce((s, it) => s + Number(it.unit_price || 0) * Number(it.qty || 1), 0);
    const deliveryDate = payload.delivery_date || new Date().toISOString().slice(0, 10);
    const order = {
      order_id: this._nextOrderUid(deliveryDate),
      order_channel: payload.order_channel === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
      offline_source: payload.offline_source || (payload.order_channel === 'ONLINE' ? 'PWA' : 'PHONE'),
      payment_method: payload.payment_method || 'FACILITY_POSTPAY',
      memo: payload.memo || '',
      customer_type: payload.customer_type || 'SENIOR_CENTER',
      facility_id: payload.facility_id || 'FAC-11-650-01-87391-0001',
      buyer_name: payload.buyer_name || '기관 발주',
      schedule_type: payload.schedule_type || 'ONETIME',
      delivery_date: deliveryDate,
      items,
      total_amount: totalAmount,
      status: 'REQUESTED',
      created_at: new Date().toISOString()
    };
    this.data.orders.unshift(order);

    // 선착순 전체 한정 수량(total_limit_qty) 차감 및 소진 시 자동 종료
    const prodMap = new Map((this.data.products || []).map(p => [p.id, p]));
    const endedPromoIds = new Set();
    for (const it of items) {
      const prod = prodMap.get(it.product_id);
      const promoId = prod?.applied_promo_id;
      if (!promoId) continue;
      const promo = (this.data.promotions || []).find(pr => pr.id === promoId);
      if (!promo || Number(promo.total_limit_qty || 0) <= 0) continue;
      promo.used_qty = Number(promo.used_qty || 0) + Number(it.qty || 1);
      if (promo.used_qty >= Number(promo.total_limit_qty)) {
        promo.status = 'ENDED';
        endedPromoIds.add(promo.id);
      }
    }
    if (endedPromoIds.size > 0) {
      this.data.products = (this.data.products || []).map(p => (
        endedPromoIds.has(p.applied_promo_id)
          ? { ...p, applied_promo_id: '', applied_promo_name: '', applied_promo_type: '', sale_price: p.regular_price, discount_pct: 0 }
          : p
      ));
    }

    this.saveData();
    return order;
  }

  updateOrderStatus(orderId, status) {
    const target = (this.data.orders || []).find(o => o.order_id === orderId);
    if (!target) throw new Error('마트 주문을 찾을 수 없습니다.');
    target.status = status || 'PICKING';
    this.saveData();
    return target;
  }

  // Phase 2: 출고거점별 품목 총량 피킹 집계
  getPickingSummary(deliveryDate = '') {
    const prodMap = new Map((this.data.products || []).map(p => [p.id, p]));
    const activeOrders = (this.data.orders || []).filter(o =>
      (!deliveryDate || o.delivery_date === deliveryDate) &&
      ['REQUESTED', 'PICKING'].includes(o.status)
    );
    const agg = new Map();
    for (const ord of activeOrders) {
      for (const it of ord.items || []) {
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
          order_id: ord.order_id,
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
      adjustments: this.data.adjustments || []
    };
  }

  // Phase 2: DOC-11 결품/실중량 부분정정 (원주문 UID 불변 + 정정 원장 adj_* 생성)
  adjustOrderItem({ order_id, product_id, actual_qty, reason = '결품·수량 정정' }) {
    const ord = (this.data.orders || []).find(o => o.order_id === order_id);
    if (!ord) throw new Error('정정할 주문을 찾을 수 없습니다.');
    const item = (ord.items || []).find(it => (it.product_id || it.id || it.name) === product_id);
    if (!item) throw new Error('주문 내 해당 품목을 찾을 수 없습니다.');

    const prevQty = item.actual_qty !== undefined ? Number(item.actual_qty) : Number(item.qty || 0);
    const nextQty = Math.max(0, Number(actual_qty));
    const unitPrice = Number(item.unit_price || 0);
    const diffAmount = Math.round((nextQty - prevQty) * unitPrice);

    item.actual_qty = nextQty;
    item.adjust_reason = reason;

    const newTotal = (ord.items || []).reduce((s, it) => {
      const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
      return s + q * Number(it.unit_price || 0);
    }, 0);
    if (ord.original_total_amount === undefined) ord.original_total_amount = ord.total_amount;
    ord.total_amount = newTotal;

    if (!Array.isArray(this.data.adjustments)) this.data.adjustments = [];
    const adj = {
      adj_id: nextMonotonicId('adj'),
      order_id: ord.order_id,
      buyer_name: ord.buyer_name,
      product_id,
      product_name: item.name || item.sku_name,
      prev_qty: prevQty,
      actual_qty: nextQty,
      diff_amount: diffAmount,
      reason,
      created_at: new Date().toISOString()
    };
    this.data.adjustments.unshift(adj);
    this.saveData();
    return { order: ord, adjustment: adj };
  }

  // Phase 2: 온도대별 분배 박싱 매니페스트 (상온/냉장/냉동 합포장 방지)
  getBoxingManifest(deliveryDate = '') {
    const prodMap = new Map((this.data.products || []).map(p => [p.id, p]));
    const orders = (this.data.orders || []).filter(o =>
      (!deliveryDate || o.delivery_date === deliveryDate) &&
      ['REQUESTED', 'PICKING', 'PACKED', 'DISPATCHED'].includes(o.status)
    );
    const TEMP_LABEL = { AMBIENT: '상온 박스', REFRIGERATED: '냉장 박스', FROZEN: '냉동 박스' };
    const manifest = orders.map(ord => {
      const boxes = {};
      for (const it of ord.items || []) {
        const prod = prodMap.get(it.product_id) || {};
        const temp = it.storage_temp || prod.storage_temp || 'AMBIENT';
        const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
        if (q <= 0) continue;
        if (!boxes[temp]) {
          boxes[temp] = {
            box_id: `${ord.order_id}-${temp}`,
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
        order_id: ord.order_id,
        facility_id: ord.facility_id,
        buyer_name: ord.buyer_name,
        customer_type: ord.customer_type,
        delivery_date: ord.delivery_date,
        status: ord.status,
        total_amount: ord.total_amount,
        box_count: boxList.length,
        boxes: boxList
      };
    });
    return { delivery_date: deliveryDate || 'ALL', manifest };
  }

  // Phase 2: 3자 정산 & 과면세·보조금 대사 집계
  getSettlementSummary(policy = {}) {
    const prodMap = new Map((this.data.products || []).map(p => [p.id, p]));
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

    const rows = (this.data.orders || []).map(ord => {
      let ordExempt = 0;
      let ordTaxable = 0;
      let ordCost = 0;
      for (const it of ord.items || []) {
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
        ledger_id: `mstl_${ord.order_id}`,
        order_id: ord.order_id,
        facility_id: ord.facility_id,
        buyer_name: ord.buyer_name,
        customer_type: ord.customer_type,
        payment_method: payMethod,
        settlement_route: isPg ? 'PG' : 'DIRECT',
        delivery_date: ord.delivery_date,
        status: ord.status,
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

    const smsCount = (this.data.orders || []).length * 2;
    const smsFeeTotal = smsCount * alimtalkUnitFee;
    const totalDeduction = pgFeeTotal + saasFeeTotal;
    const taxInvoiceSupply = pgFeeTotal + saasFeeTotal + smsFeeTotal;
    const taxInvoiceVat = Math.round(taxInvoiceSupply * 0.1);
    return {
      mart: this.data.mart,
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
        adjustment_count: (this.data.adjustments || []).length,
        alimtalk_sms_count: smsCount,
        alimtalk_sms_fee: smsFeeTotal,
        tax_invoice_supply: taxInvoiceSupply,
        tax_invoice_vat: taxInvoiceVat,
        tax_invoice_total: taxInvoiceSupply + taxInvoiceVat
      },
      rows,
      adjustments: this.data.adjustments || []
    };
  }

  getMartProfile() {
    return {
      ...createDefaultData().mart,
      ...(this.data.mart || {})
    };
  }

  updateMartProfile(payload = {}) {
    const cur = this.getMartProfile();
    this.data.mart = {
      ...cur,
      mart_name: payload.mart_name !== undefined ? String(payload.mart_name).trim() : cur.mart_name,
      mart_type: payload.mart_type || cur.mart_type,
      operator_name: payload.operator_name !== undefined ? String(payload.operator_name).trim() : cur.operator_name,
      agency_fee_pct: payload.agency_fee_pct !== undefined ? Number(payload.agency_fee_pct) : cur.agency_fee_pct,
      biz_number: payload.biz_number !== undefined ? String(payload.biz_number).trim() : cur.biz_number,
      phone: payload.phone !== undefined ? String(payload.phone).trim() : cur.phone,
      address: payload.address !== undefined ? String(payload.address).trim() : cur.address,
      open_hours: payload.open_hours !== undefined ? String(payload.open_hours).trim() : cur.open_hours,
      delivery_fee: payload.delivery_fee !== undefined ? Number(payload.delivery_fee) : cur.delivery_fee,
      free_delivery_threshold: payload.free_delivery_threshold !== undefined ? Number(payload.free_delivery_threshold) : cur.free_delivery_threshold,
      min_order_amount: payload.min_order_amount !== undefined ? Number(payload.min_order_amount) : cur.min_order_amount,
      pickup_enabled: payload.pickup_enabled !== undefined ? Boolean(payload.pickup_enabled) : cur.pickup_enabled,
      settlement_bank: payload.settlement_bank !== undefined ? String(payload.settlement_bank).trim() : cur.settlement_bank,
      settlement_account: payload.settlement_account !== undefined ? String(payload.settlement_account).trim() : cur.settlement_account,
      manager: payload.manager ? { ...(cur.manager || {}), ...payload.manager } : cur.manager
    };
    this.saveData();
    return this.data.mart;
  }

  getStaff() {
    if (!Array.isArray(this.data.staff)) {
      this.data.staff = createDefaultData().staff;
    }
    return this.data.staff;
  }

  _nextStaffUid() {
    const martId = this.data.mart?.mart_id || 'MRT-11-650-01-47121-0001';
    const prefix = `${martId}-U`;
    let maxSeq = 0;
    for (const s of this.getStaff()) {
      if (String(s.staff_id || '').startsWith(prefix)) {
        const n = Number(String(s.staff_id).slice(prefix.length));
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }

  saveStaff(payload = {}) {
    const list = this.getStaff();
    const ROLE_LABEL = {
      PICKER: '매장 피킹 · 박싱',
      PREP_WORKER: '전처리 작업자',
      DRIVER: '순회 배송 기사',
      CS_ADMIN: '발주 · CS 담당'
    };
    const role = payload.role || 'PICKER';
    if (payload.staff_id) {
      const idx = list.findIndex(s => s.staff_id === payload.staff_id);
      if (idx < 0) throw new Error('사원을 찾을 수 없습니다.');
      list[idx] = {
        ...list[idx],
        name: payload.name !== undefined ? String(payload.name).trim() : list[idx].name,
        role,
        role_label: ROLE_LABEL[role] || role,
        phone: payload.phone !== undefined ? String(payload.phone).trim() : list[idx].phone,
        work_shift: payload.work_shift !== undefined ? String(payload.work_shift).trim() : list[idx].work_shift,
        status: payload.status || list[idx].status
      };
      this.saveData();
      return list[idx];
    }
    const created = {
      staff_id: this._nextStaffUid(),
      name: String(payload.name || '').trim() || '신규 사원',
      role,
      role_label: ROLE_LABEL[role] || role,
      phone: String(payload.phone || '').trim(),
      work_shift: String(payload.work_shift || '09:00 ~ 18:00').trim(),
      status: payload.status || 'ACTIVE'
    };
    list.unshift(created);
    this.saveData();
    return created;
  }

  deleteStaff(staffId) {
    const list = this.getStaff();
    const idx = list.findIndex(s => s.staff_id === staffId);
    if (idx < 0) throw new Error('사원을 찾을 수 없습니다.');
    const [removed] = list.splice(idx, 1);
    this.saveData();
    return removed;
  }

  // Phase 3: PWA 6대 블록 디스플레이 제어 & 마트 연합·공동구매
  getPwaConfig() {
    if (!this.data.pwa_config) {
      this.data.pwa_config = createDefaultPwaConfig();
    }
    return {
      mart: this.data.mart,
      config: this.data.pwa_config
    };
  }

  updatePwaControl(payload = {}) {
    const cur = this.getPwaConfig().config;
    if (payload.store_status) cur.store_status = payload.store_status;
    if (payload.cutoff_time) cur.cutoff_time = payload.cutoff_time;
    if (payload.pos_only_policy) cur.pos_only_policy = payload.pos_only_policy;
    if (payload.notice_text !== undefined) cur.notice_text = String(payload.notice_text);
    if (Array.isArray(payload.blocks)) {
      cur.blocks = payload.blocks;
    }
    if (Array.isArray(payload.flyer_banners)) {
      cur.flyer_banners = payload.flyer_banners;
    }
    this.data.pwa_config = cur;
    this.saveData();
    return cur;
  }

  getMarts() {
    if (!Array.isArray(this.data.marts)) {
      this.data.marts = createDefaultMarts();
    }
    return this.data.marts;
  }

  getGroupBuys() {
    if (!Array.isArray(this.data.group_buys)) {
      this.data.group_buys = createDefaultGroupBuys();
    }
    return this.data.group_buys.map(g => ({
      ...g,
      approval_status: g.approval_status || 'APPROVED'
    }));
  }

  createGroupBuy(payload = {}) {
    const title = String(payload.title || '').trim();
    if (!title) throw new Error('공동구매 캠페인명을 입력하세요.');
    if (!Array.isArray(this.data.group_buys)) this.data.group_buys = createDefaultGroupBuys();
    const gb = {
      campaign_id: nextMonotonicId('mgb'),
      campaign_type: payload.campaign_type === 'B2B_INSTITUTIONAL' ? 'B2B_INSTITUTIONAL' : 'B2C_RESIDENT',
      title,
      mart_id: payload.mart_id || this.data.mart?.mart_id || 'MRT-11-650-01-47121-0001',
      unit_price: Math.max(0, Number(payload.unit_price || 0)),
      regular_price: Math.max(0, Number(payload.regular_price || payload.unit_price || 0)),
      target_qty: Math.max(1, Number(payload.target_qty || 50)),
      current_qty: 0,
      deadline_at: payload.deadline_at || '2026-11-30',
      distribution_mode: payload.distribution_mode || 'HUB_PICKUP',
      approval_status: 'PENDING_ADMIN',
      status: 'PENDING_ADMIN',
      created_at: new Date().toISOString()
    };
    this.data.group_buys.unshift(gb);
    this.saveData();
    return gb;
  }

  decideGroupBuy({ campaign_id, decision } = {}) {
    if (!Array.isArray(this.data.group_buys)) this.data.group_buys = createDefaultGroupBuys();
    const target = this.data.group_buys.find(g => g.campaign_id === campaign_id);
    if (!target) throw new Error('공동구매 캠페인을 찾을 수 없습니다.');
    if (decision === 'APPROVED') {
      target.approval_status = 'APPROVED';
      target.status = target.current_qty >= target.target_qty ? 'GOAL_REACHED' : 'OPEN';
    } else {
      target.approval_status = 'REJECTED';
      target.status = 'REJECTED';
    }
    this.saveData();
    return target;
  }

  createCoSellProduct(payload = {}) {
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('공동판매 상품명을 입력하세요.');
    const reg = Math.max(0, Number(payload.regular_price || 0));
    const sale = Math.max(0, Number(payload.sale_price ?? reg));
    const item = {
      id: nextMonotonicId('mrt_cosell'),
      barcode: String(payload.barcode || `8809${String(Date.now()).slice(-9)}`),
      name,
      category_type: payload.category_type || 'FRESH',
      category_path: payload.category_path || '농산>산지직송',
      tax_type: payload.tax_type || 'EXEMPT',
      spec: String(payload.spec || '1박스'),
      uom: String(payload.uom || '박스'),
      cost_price: Math.max(0, Number(payload.cost_price || 0)),
      regular_price: reg,
      sale_price: sale,
      discount_pct: reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0,
      storage_temp: payload.storage_temp || 'AMBIENT',
      fulfillment_source: 'DIRECT_SUPPLIER',
      shared_catalog_scope: 'NATIONWIDE_CO_SELL',
      mart_approval_status: 'PENDING_MART',
      online_publish_status: 'SUSPENDED',
      payment_scope: 'ONLINE_APPLICABLE',
      channel_scope: 'ONLINE_ONLY',
      status: 'ACTIVE'
    };
    this.data.products.unshift(item);
    this.saveData();
    return item;
  }

  decideMartProductApproval({ product_id, decision } = {}) {
    const idx = (this.data.products || []).findIndex(p => p.id === product_id);
    if (idx < 0) throw new Error('상품을 찾을 수 없습니다.');
    const cur = this.data.products[idx];
    if (decision === 'APPROVED') {
      this.data.products[idx] = {
        ...cur,
        mart_approval_status: 'APPROVED',
        online_publish_status: 'PUBLISHED_FEED'
      };
    } else {
      this.data.products[idx] = {
        ...cur,
        mart_approval_status: 'REJECTED',
        online_publish_status: 'SUSPENDED'
      };
    }
    this.saveData();
    return this.data.products[idx];
  }

  joinGroupBuy({ campaign_id, qty = 1 }) {
    const list = this.getGroupBuys();
    const target = list.find(g => g.campaign_id === campaign_id);
    if (!target) throw new Error('공동구매 캠페인을 찾을 수 없습니다.');
    const addQty = Math.max(1, Number(qty));
    target.current_qty += addQty;
    if (target.current_qty >= target.target_qty) {
      target.status = 'GOAL_REACHED';
    }
    this.saveData();
    return target;
  }

  saveMediaWebp({ data_url = '', original_name = 'product.webp' } = {}) {
    const m = String(data_url || '').match(/^data:image\/webp;base64,(.+)$/i);
    if (!m) {
      throw new Error('유효한 WebP 이미지 데이터가 아닙니다.');
    }
    const buf = Buffer.from(m[1], 'base64');
    const medId = generateMediaTypeId();
    const martId = this.data.mart?.mart_id || 'MRT-11-650-01-47121-0001';
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, `${medId}.webp`), buf);

    const record = {
      id: medId,
      owner_type: 'MART_PRODUCT',
      owner_id: martId,
      r2_object_key: `mart/${martId}/${medId}.webp`,
      original_file_name: String(original_name || 'product.webp'),
      content_type: 'image/webp',
      file_size_bytes: buf.length,
      cdn_url: `/mart/media/${medId}.webp`,
      created_at: new Date().toISOString()
    };
    if (!Array.isArray(this.data.media_objects)) this.data.media_objects = [];
    this.data.media_objects.unshift(record);
    this.saveData();
    return { media_id: medId, image_url: record.cdn_url, r2_object_key: record.r2_object_key, file_size_bytes: buf.length };
  }

  async searchHaccpProducts({ q = '', barcode = '' } = {}) {
    const apiKey = process.env.HACCP_API_KEY || '';
    if (!apiKey) throw new Error('.env에 HACCP_API_KEY가 설정되어 있지 않습니다.');
    const params = [`serviceKey=${apiKey}`, 'returnType=json', 'pageNo=1', 'numOfRows=10'];
    if (barcode && String(barcode).trim()) params.push(`barcode=${encodeURIComponent(String(barcode).trim())}`);
    else if (q && String(q).trim()) params.push(`prdlstNm=${encodeURIComponent(String(q).trim())}`);
    else return [];

    const url = `https://apis.data.go.kr/B553748/CertImgListServiceV3/getCertImgListServiceV3?${params.join('&')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HACCP API 오류 (${res.status})`);
    const json = await res.json();
    const rawItems = json?.body?.items || [];
    return rawItems.map(entry => {
      const it = entry?.item || entry || {};
      const rawBarcode = String(it.barcode || '').trim();
      return {
        prdlstReportNo: it.prdlstReportNo || '',
        name: it.prdlstNm || '',
        spec: it.capacity || '-',
        manufacture: it.manufacture || '',
        prdkind: it.prdkind || '',
        barcode: rawBarcode && rawBarcode !== '알수없음' ? rawBarcode : '',
        image_url: it.imgurl1 || it.imgurl2 || '',
        allergy: it.allergy && it.allergy !== '알수없음' ? it.allergy : ''
      };
    }).filter(x => x.name);
  }

  async importExternalImageToMedia({ image_url = '', original_name = 'haccp.jpg' } = {}) {
    const src = String(image_url || '').trim();
    if (!src || !/^https?:\/\//i.test(src)) throw new Error('유효한 외부 이미지 URL이 아닙니다.');
    const res = await fetch(src);
    if (!res.ok) throw new Error(`외부 이미지 다운로드 실패 (${res.status})`);
    const ctype = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ctype.startsWith('image/')) {
      throw new Error("이미지 파일 주소가 아닙니다. '링크 주소 복사'가 아니라 사진 위 우클릭 -> '이미지 주소 복사'를 사용하거나 '이미지 복사' 후 Ctrl+V를 눌러 주세요.");
    }
    const ext = ctype.includes('png') ? 'png' : ctype.includes('webp') ? 'webp' : 'jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    const medId = generateMediaTypeId();
    const martId = this.data.mart?.mart_id || 'MRT-11-650-01-47121-0001';
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, `${medId}.${ext}`), buf);

    const record = {
      id: medId,
      owner_type: 'MART_PRODUCT',
      owner_id: martId,
      r2_object_key: `mart/${martId}/${medId}.${ext}`,
      original_file_name: String(original_name || `haccp.${ext}`),
      content_type: ctype,
      file_size_bytes: buf.length,
      cdn_url: `/mart/media/${medId}.${ext}`,
      created_at: new Date().toISOString()
    };
    if (!Array.isArray(this.data.media_objects)) this.data.media_objects = [];
    this.data.media_objects.unshift(record);
    this.saveData();
    return { media_id: medId, image_url: record.cdn_url, r2_object_key: record.r2_object_key, file_size_bytes: buf.length };
  }

  _ensureFacilities() {
    if (!Array.isArray(this.data.facilities) || this.data.facilities.length === 0) {
      this.data.facilities = [
        {
          request_id: 'fapp_seed_0001',
          facility_id: 'FAC-11-650-01-87391-0001',
          facility_name: '서초 양재1동 경로당',
          facility_type: 'SENIOR_CENTER',
          biz_reg_no: '214-80-11901',
          contact_name: '박영순 회장',
          phone: '02-571-8801',
          address: '서울특별시 서초구 양재1동 바우뫼로 45',
          credit_limit: 500000,
          credit_balance: 450000,
          status: 'APPROVED',
          created_at: '2026-11-10T09:00:00.000Z'
        }
      ];
      this.saveData();
    }
    return this.data.facilities;
  }

  getFacilities() {
    return this._ensureFacilities();
  }

  registerFacility(payload = {}) {
    const list = this._ensureFacilities();
    const name = String(payload.facility_name || '').trim();
    const phone = String(payload.phone || '').trim();
    const address = String(payload.address || '').trim();
    if (!name || !phone || !address) {
      throw new Error('기관명, 연락처, 배송 주소를 모두 입력해 주세요.');
    }
    const item = {
      request_id: nextMonotonicId('fapp'),
      facility_id: '',
      facility_name: name,
      facility_type: ['SENIOR_CENTER', 'NURSING_HOME', 'WELFARE_CENTER', 'CHILD_CARE', 'INSTITUTION_B2B'].includes(payload.facility_type) ? payload.facility_type : 'SENIOR_CENTER',
      biz_reg_no: String(payload.biz_reg_no || '').trim(),
      contact_name: String(payload.contact_name || '').trim() || '담당자',
      phone,
      address,
      credit_limit: 0,
      credit_balance: 0,
      status: 'PENDING_APPROVAL',
      created_at: new Date().toISOString()
    };
    list.unshift(item);
    this.saveData();
    return item;
  }

  decideFacility({ request_id = '', decision = 'APPROVED', credit_limit = 500000 } = {}) {
    const list = this._ensureFacilities();
    const idx = list.findIndex(f => f.request_id === request_id || (f.facility_id && f.facility_id === request_id));
    if (idx < 0) throw new Error('대상 기관 신청 정보를 찾을 수 없습니다.');
    const cur = list[idx];
    if (decision === 'REJECTED') {
      list[idx] = { ...cur, status: 'REJECTED', decided_at: new Date().toISOString() };
      this.saveData();
      return list[idx];
    }
    const ksic = cur.facility_type === 'CHILD_CARE' ? '87210' : '87391';
    const seq = String(list.filter(f => f.facility_id).length + 1).padStart(4, '0');
    const facId = cur.facility_id || `FAC-11-650-01-${ksic}-${seq}`;
    const limit = Math.max(0, Number(credit_limit ?? 500000));
    list[idx] = {
      ...cur,
      facility_id: facId,
      credit_limit: limit,
      credit_balance: cur.status === 'APPROVED' ? Number(cur.credit_balance ?? limit) : limit,
      status: 'APPROVED',
      decided_at: new Date().toISOString()
    };
    this.saveData();
    return list[idx];
  }

  loginFacility({ facility_id = '', phone = '' } = {}) {
    const list = this._ensureFacilities();
    const fid = String(facility_id || '').trim().toUpperCase();
    const normPhone = String(phone || '').replace(/[^0-9]/g, '');
    const found = list.find(f =>
      (fid && String(f.facility_id || '').toUpperCase() === fid)
      || (normPhone && String(f.phone || '').replace(/[^0-9]/g, '') === normPhone)
    );
    if (!found) throw new Error('등록된 기관 정보를 찾을 수 없습니다.');
    if (found.status === 'PENDING_APPROVAL') throw new Error('마트 관리자 승인 대기 중인 기관입니다.');
    if (found.status === 'REJECTED') throw new Error('가입이 반려된 기관입니다. 마트에 문의해 주세요.');
    return found;
  }

  applyDailyPriceBatch(payload = {}) {
    const { shouldSave, result } = applyDailyPriceBatchToData(this.data, payload);
    if (shouldSave) this.saveData();
    return result;
  }

  getUploadHistory() {
    return getUploadHistoryFromData(this.data);
  }

  rollbackUploadBatch(batchId = '') {
    const result = rollbackUploadBatchInData(this.data, batchId);
    this.saveData();
    return result;
  }

  _loadSharedBarcodePool() {
    if (this._sharedBarcodePool) return this._sharedBarcodePool;
    const previewPath = path.resolve(__dirname, '../../../../scratch/haccp_preload_preview.json');
    try {
      if (fs.existsSync(previewPath)) {
        const parsed = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
        this._sharedBarcodePool = Array.isArray(parsed.valid) ? parsed.valid : [];
        return this._sharedBarcodePool;
      }
    } catch (_) {}
    this._sharedBarcodePool = [];
    return this._sharedBarcodePool;
  }

  _formatSharedCatalogRow(r) {
    const cleanText = (v = '') => {
      const s = String(v || '').trim();
      return (!s || s === '알수없음' || s === 'null' || s === 'undefined') ? '' : s;
    };
    const cleanMaker = (v = '') => {
      const s = cleanText(v);
      return s ? s.split(/[_\n]/)[0].split('/')[0].trim() : '';
    };
    const r2Key = `shared/barcode/${r.barcode}.webp`;
    const localWebp = path.resolve(__dirname, '../../../../scratch/haccp_webp', `${r.barcode}.webp`);
    const hasLocalWebp = fs.existsSync(localWebp);
    const spec = cleanText(r.standard_spec) || '-';
    const maker = cleanMaker(r.manufacturer);
    return {
      barcode: r.barcode,
      product_name: r.product_name,
      name: r.product_name,
      manufacturer: maker,
      manufacture: maker,
      standard_spec: spec,
      spec,
      category_name: cleanText(r.category_name),
      prdkind: cleanText(r.category_name),
      allergens_text: cleanText(r.allergens_text),
      allergy: cleanText(r.allergens_text),
      image_r2_key: r2Key,
      image_url: hasLocalWebp ? `/api/mart/media/public/${r2Key}` : (r.source_image_url || ''),
      source_type: 'HACCP'
    };
  }

  lookupSharedBarcode({ barcode = '', q = '', limit = 50, categoryHint = '' } = {}) {
    const pool = this._loadSharedBarcodePool();
    const cleanBc = String(barcode || '').replace(/[^0-9]/g, '');
    const cleanQ = String(q || '').trim().toLowerCase();
    const hint = String(categoryHint || '').trim();
    const safeLimit = Math.min(Math.max(1, Number(limit || 50)), 100);
    if (cleanBc) {
      const hit = pool.find(r => r.barcode === cleanBc);
      return hit ? [this._formatSharedCatalogRow(hit)] : [];
    }
    if (cleanQ) {
      const hintTokens = hint.split(/[\s·,/()]+/).map(t => t.trim()).filter(t => t.length >= 2);
      if (hint.includes('라면')) hintTokens.push('유탕면', '국수', '면류');
      const matches = pool
        .filter(r => String(r.product_name || '').toLowerCase().includes(cleanQ))
        .map(r => this._formatSharedCatalogRow(r))
        .map(item => {
          const catText = `${item.category_name || ''} ${item.product_name || ''}`;
          const catMatch = hintTokens.some(t => catText.includes(t)) ? 1 : 0;
          const prefixMatch = String(item.product_name || '').toLowerCase().startsWith(cleanQ) ? 1 : 0;
          const score = (item.image_url ? 100 : 0) + (catMatch * 20) + (prefixMatch * 10);
          return { ...item, _score: score };
        });
      matches.sort((a, b) => b._score - a._score);
      const deduped = [];
      const seen = new Set();
      for (const item of matches) {
        const key = `${String(item.product_name || '').replace(/\s+/g, '').toLowerCase()}|${String(item.manufacturer || '').replace(/\s+/g, '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { _score, ...cleanItem } = item;
        deduped.push(cleanItem);
        if (deduped.length >= safeLimit) break;
      }
      return deduped;
    }
    return [];
  }

  lookupSharedBarcodesBatch(barcodes = []) {
    const pool = this._loadSharedBarcodePool();
    const byBc = new Map(pool.map(r => [r.barcode, r]));
    const map = {};
    for (const raw of (Array.isArray(barcodes) ? barcodes : [])) {
      const bc = String(raw || '').replace(/[^0-9]/g, '');
      if (bc && byBc.has(bc) && !map[bc]) {
        map[bc] = this._formatSharedCatalogRow(byBc.get(bc));
      }
    }
    return map;
  }
}

export const martService = new MartService();
