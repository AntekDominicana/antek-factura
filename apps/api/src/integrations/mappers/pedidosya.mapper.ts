import {
  DeliveryMapperOptions,
  ItbisRate,
  PublicInvoiceCreateInput,
  PublicInvoiceItemInput,
  PublicPaymentMethod,
} from '../integrations.types';

function toMoney(val: any): number {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function normalizeItbisRate(rate: any): ItbisRate {
  const num = Number(rate);
  if (num === 0) return 0;
  if (num === 16) return 16;
  return 18;
}

function resolvePedidosYaPaymentMethod(payload: any): PublicPaymentMethod {
  const raw = String(
    payload?.payment?.type ||
      payload?.paymentMethod ||
      payload?.payment_method ||
      payload?.forma_pago ||
      'tarjeta'
  ).toLowerCase();

  if (raw.includes('cash') || raw.includes('efectivo')) return 'efectivo';
  if (raw.includes('transfer')) return 'transferencia';
  if (raw.includes('mix')) return 'mixto';
  return 'tarjeta';
}

/**
 * Convierte un pedido de PedidosYa al formato interno de facturación de ANTEK Factura.
 * Reglas fiscales:
 * - Solo factura el total de venta pagado por el cliente.
 * - Envío y propina se agregan como líneas separadas configurables.
 * - Las comisiones de PedidosYa al comercio nunca se incluyen en la factura al cliente.
 */
export function mapPedidosYaOrderToInvoiceInput(
  payload: any,
  options: DeliveryMapperOptions = {}
): PublicInvoiceCreateInput {
  const order = payload?.order || payload?.data || payload;
  const externalId = String(
    order?.id || order?.orderId || order?.code || order?.external_id || ''
  ).trim();

  const rawItems: any[] = Array.isArray(order?.products)
    ? order.products
    : Array.isArray(order?.details)
    ? order.details
    : Array.isArray(order?.items)
    ? order.items
    : [];

  const items: PublicInvoiceItemInput[] = rawItems
    .map((item) => {
      const cantidad = Math.max(
        1,
        Number(item?.quantity ?? item?.cantidad ?? item?.qty ?? 1) || 1
      );
      const precioUnitario = toMoney(
        item?.unitPrice ??
          item?.unit_price ??
          item?.price ??
          item?.precio_unitario ??
          (item?.total ? Number(item.total) / cantidad : 0)
      );
      const descuento = toMoney(item?.discount ?? item?.descuento ?? 0);
      const descripcion = String(
        item?.name || item?.title || item?.description || item?.descripcion || 'Producto PedidosYa'
      )
        .trim()
        .slice(0, 180);

      return {
        descripcion,
        cantidad,
        precio_unitario: Math.max(0, precioUnitario),
        itbis_tasa: normalizeItbisRate(item?.itbis_tasa ?? item?.taxRate ?? item?.tax_rate ?? 18),
        descuento: descuento > 0 ? descuento : undefined,
      };
    })
    .filter((i) => i.precio_unitario > 0 || i.cantidad > 0);

  // Envío como línea separada configurable
  const deliveryFee = toMoney(
    order?.payment?.deliveryFee ??
      order?.deliveryFee ??
      order?.delivery_fee ??
      order?.shippingAmount ??
      0
  );
  if (options.incluirEnvio !== false && deliveryFee > 0) {
    items.push({
      descripcion: 'Servicio de Envío (PedidosYa)',
      cantidad: 1,
      precio_unitario: deliveryFee,
      itbis_tasa: 18,
    });
  }

  // Propina como línea separada exenta configurable
  const tipAmount = toMoney(
    order?.payment?.tip ?? order?.tip ?? order?.tipAmount ?? order?.propina ?? 0
  );
  if (options.incluirPropina !== false && tipAmount > 0) {
    items.push({
      descripcion: 'Propina Voluntaria (PedidosYa)',
      cantidad: 1,
      precio_unitario: tipAmount,
      itbis_tasa: 0,
    });
  }

  const buyerRncRaw = String(
    order?.customer?.documentNumber ||
      order?.customer?.rnc ||
      order?.comprador?.rnc ||
      ''
  )
    .replace(/\D/g, '')
    .trim();
  const hasValidRnc = buyerRncRaw.length === 9 || buyerRncRaw.length === 11;
  const buyerName = String(
    order?.customer?.name ||
      order?.customer?.fullName ||
      order?.comprador?.nombre ||
      'Consumidor Final'
  ).trim();

  const orderCode = order?.code ? ` #${order.code}` : '';

  return {
    external_id: externalId,
    tipo_ecf: hasValidRnc ? 31 : 32,
    comprador: hasValidRnc
      ? { rnc: buyerRncRaw, nombre: buyerName || 'Cliente PedidosYa' }
      : { nombre: buyerName || 'Consumidor Final' },
    items,
    forma_pago: resolvePedidosYaPaymentMethod(order),
    canal: 'para_llevar',
    notas: `Pedido PedidosYa${orderCode} (${externalId})`.trim(),
  };
}
