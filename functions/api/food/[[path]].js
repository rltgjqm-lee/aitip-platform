// Cloudflare Pages Serverless Function for /api/food/*
import storeData from './store_data.json';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

export async function onRequest(context) {
  const { request, params } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const pathSegments = params.path || [];
  const subPath = pathSegments.join('/');

  if (subPath === 'store' || subPath === 'store/') {
    if (method === 'GET') {
      return new Response(JSON.stringify(storeData.store), { headers: corsHeaders });
    }
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: true, store: { ...storeData.store, ...body } }), { headers: corsHeaders });
    }
  }

  if (subPath === 'store/hours') {
    return new Response(JSON.stringify(storeData.store_hours), { headers: corsHeaders });
  }

  if (subPath === 'store/delivery-rules') {
    return new Response(JSON.stringify(storeData.store.delivery_tip_rules || []), { headers: corsHeaders });
  }

  if (subPath === 'menu') {
    return new Response(JSON.stringify({
      categories: storeData.categories,
      products: storeData.products,
      option_groups: storeData.option_groups
    }), { headers: corsHeaders });
  }

  if (subPath === 'reviews') {
    return new Response(JSON.stringify(storeData.reviews || []), { headers: corsHeaders });
  }

  if (subPath === 'orders') {
    if (method === 'GET') {
      return new Response(JSON.stringify(storeData.live_orders || []), { headers: corsHeaders });
    }
    if (method === 'POST') {
      const orderPayload = await request.json().catch(() => ({}));
      const orderId = 'ord_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      const shortId = 'A-' + (Math.floor(Math.random() * 50) + 10);
      const virtualPhone = orderPayload.virtual_phone || (orderPayload.use_virtual_phone ? `0504-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}` : (orderPayload.customer_phone || '010-0000-0000'));
      
      const items = Array.isArray(orderPayload.items) ? orderPayload.items : [];
      const calcItemsTotal = Number(orderPayload.items_total) > 0
        ? Number(orderPayload.items_total)
        : items.reduce((s, it) => s + (Number(it.total_price) || (Number(it.base_price || it.price || 0) * (Number(it.quantity) || 1))), 0);
      const calcTip = (orderPayload.fulfillment_type === 'DELIVERY')
        ? (Number(orderPayload.delivery_tip) || 3000)
        : 0;
      const calcFinal = (Number(orderPayload.final_payment_amount) > 0)
        ? Number(orderPayload.final_payment_amount)
        : (calcItemsTotal + calcTip);

      const createdOrder = {
        order_id: orderId,
        short_display_id: shortId,
        status: 'PENDING',
        order_channel: orderPayload.order_channel || 'PWA',
        fulfillment_type: orderPayload.fulfillment_type || 'DELIVERY',
        customer_name: orderPayload.customer_name || '고객',
        customer_phone: orderPayload.customer_phone || '',
        virtual_phone: virtualPhone,
        road_address: orderPayload.road_address || '',
        detail_address: orderPayload.detail_address || '',
        postal_code: orderPayload.postal_code || '',
        delivery_address: orderPayload.delivery_address || '서울특별시 서초구 서초대로 42길 11, 302호',
        customer_memo: orderPayload.customer_memo || '',
        payment_method: orderPayload.payment_method || 'AITIP_ZERO_PAY',
        items: items,
        items_total: calcItemsTotal,
        delivery_tip: calcTip,
        final_payment_amount: calcFinal,
        prep_time_minutes: 25,
        created_at: new Date().toISOString()
      };
      return new Response(JSON.stringify({ success: true, order: createdOrder }), { status: 201, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    service: 'AITIP Food Delivery Edge API',
    endpoints: ['/store', '/menu', '/reviews', '/orders']
  }), { headers: corsHeaders });
}
