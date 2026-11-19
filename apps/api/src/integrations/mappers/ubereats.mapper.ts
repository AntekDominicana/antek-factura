import {
  DeliveryMapperOptions,
  ItbisRate,
  PublicInvoiceCreateInput,
  PublicInvoiceItemInput,
  PublicPaymentMethod,
} from '../integrations.types';

function parseUberMoneyAmount(raw: any): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (typeof raw === 'object') {
    if (typeof raw.amount_e5 === 'number') {
      return Math.round((raw.amount_e5 / 100000) * 100) / 100;
    }
    if (typeof raw.amount === 'number') {
      // Uber Orders API devuelve enteros en centavos cuando viene acompañado de formatted_amount o currency_code
      if (Number.isInteger(raw.amount) && (raw.formatted_amount || raw.currency_code)) {
        return Math.round((raw.amount / 100) * 100) / 100;
      }
      return raw.amount;
    }
    if (typeof raw.value === 'number') {
      return raw.value;
    }
  }
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function normalizeItbisRate(rate: any): ItbisRate {
  const num = Number(rate);
  if (num === 0) return 0;
  if (num === 16) return 16;
  return 18;
}

function resolveUberPaymentMethod(payload: any): PublicPaymentMethod {
  const rawMethod = String(
    payload?.payment?.method ||
      payload?.payment_method ||
      payload?.payment?.type ||
      payload?.forma_pago ||
      'tarjeta'
  ).toLowerCase();

  if (rawMethod.includes('cash') || rawMethod.includes('efectivo')) return 'efectivo';
  if (rawMethod.includes('transfer')) return 'transferencia';
  if (rawMethod.includes('mix')) return 'mixto';
  return 'tarjeta';
}

/**
 * Convierte un pedido de Uber Eats al formato interno de facturación de ANTEK Factura.
 * Reglas fiscales:
 * - Solo factura el monto pagado por el cliente final.
 * - Envío y propina se agregan como líneas separadas configurables.
 * - Nunca factura las comisiones de Uber Eats (son gastos del restaurante).
 */
export function mapUberEatsOrderToInvoiceInput(
  payload: any,
  options: DeliveryMapperOptions = {}
): PublicInvoiceCreateInput {
  const order = payload?.order || payload;
  const externalId = String(
    order?.id ||
      order?.order_id ||
      payload?.meta?.resource_id ||
      payload?.resource_id ||
      payload?.external_id ||
      ''
  ).trim();

  const rawItems: any[] = Array.isArray(order?.cart?.items)
    ? order.cart.items
    : Array.isArray(order?.items)
    ? order.items
    : [];

  const items: PublicInvoiceItemInput[] = rawItems
    .map((item) => {
      const cantidad = Math.max(1, Number(item?.quantity ?? item?.cantidad ?? 1) || 1);
      const basePrice = parseUberMoneyAmount(
        item?.price?.unit_price ??
          item?.unit_price ??
          item?.price?.base_price ??
          item?.precio_unitario ??
          item?.price
      );

      // Sumar modificadores si existen
      const modifiers: any[] = Array.isArray(item?.selected_modifier_groups)
        ? item.selected_modifier_groups.flatMap((g: any) =>
            Array.isArray(g?.selected_items) ? g.selected_items : []
          )
        : [];
      const modifiersPerUnit = modifiers.reduce((acc, mod) => {
        const modQty = Math.max(1, Number(mod?.quantity || 1));
        const modPrice = parseUberMoneyAmount(
          mod?.price?.unit_price ?? mod?.unit_price ?? mod?.price
        );
        return acc + modPrice * modQty;
      }, 0);

      const precioUnitario = Math.round((basePrice + modifiersPerUnit) * 100) / 100;
      const descuento = parseUberMoneyAmount(item?.discount ?? item?.descuento ?? 0);
      const descripcion = String(
        item?.title || item?.name || item?.descripcion || 'Producto Uber Eats'
      )
        .trim()
        .slice(0, 180);

      return {
        descripcion,
        cantidad,
        precio_unitario: Math.max(0, precioUnitario),
        itbis_tasa: normalizeItbisRate(item?.itbis_tasa ?? item?.tax_rate ?? 18),
        descuento: descuento > 0 ? descuento : undefined,
      };
    })
    .filter((i) => i.precio_unitario > 0 || i.cantidad > 0);

  // Envío como línea separada configurable (NO incluir comisiones de Uber al comercio)
  const deliveryFee = parseUberMoneyAmount(
    order?.payment?.charges?.delivery_fee ??
      order?.charges?.delivery_fee ??
      order?.delivery_fee ??
      0
  );
  if (options.incluirEnvio !== false && deliveryFee > 0) {
    items.push({
      descripcion: 'Servicio de Envío (Uber Eats)',
      cantidad: 1,
      precio_unitario: deliveryFee,
      itbis_tasa: 18,
    });
  }

  // Propina como línea separada exenta configurable
  const tipAmount = parseUberMoneyAmount(
    order?.payment?.charges?.tip ?? order?.charges?.tip ?? order?.tip ?? 0
  );
  if (options.incluirPropina !== false && tipAmount > 0) {
    items.push({
      descripcion: 'Propina Voluntaria (Uber Eats)',
      cantidad: 1,
      precio_unitario: tipAmount,
      itbis_tasa: 0,
    });
  }

  const buyerRncRaw = String(
    order?.eater?.tax_id || order?.buyer?.rnc || order?.comprador?.rnc || ''
  )
    .replace(/\D/g, '')
    .trim();
  const hasValidRnc = buyerRncRaw.length === 9 || buyerRncRaw.length === 11;
  const buyerName = String(
    order?.eater?.first_name
      ? `${order.eater.first_name} ${order.eater.last_name || ''}`.trim()
      : order?.buyer?.name || order?.comprador?.nombre || 'Consumidor Final'
  ).trim();

  const displayId = order?.display_id ? ` #${order.display_id}` : '';

  return {
    external_id: externalId,
    tipo_ecf: hasValidRnc ? 31 : 32,
    comprador: hasValidRnc
      ? { rnc: buyerRncRaw, nombre: buyerName || 'Cliente Uber Eats' }
      : { nombre: buyerName || 'Consumidor Final' },
    items,
    forma_pago: resolveUberPaymentMethod(order),
    canal: 'para_llevar',
    notas: `Pedido Uber Eats${displayId} (${externalId})`.trim(),
  };
}
