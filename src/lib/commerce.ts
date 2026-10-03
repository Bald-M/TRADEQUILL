import { invoke } from "@tauri-apps/api/core";

export interface Parameter {
  name: string;
  value: string;
}
export interface ProductFields {
  code: string;
  name: string;
  parameters: Parameter[];
  unit: string;
  moq: string | null;
  leadDaysMin: number | null;
  leadDaysMax: number | null;
  notes: string;
  archived: boolean;
}
export interface Product extends ProductFields {
  id: number;
}
export interface SupplierFields {
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  archived: boolean;
}
export interface Supplier extends SupplierFields {
  id: number;
}
export interface OfferFields {
  productId: number;
  supplierId: number;
  supplierCode: string;
  price: string | null;
  currency: string;
  quotedOn: string | null;
  moq: string | null;
  leadDaysMin: number | null;
  leadDaysMax: number | null;
  notes: string;
  active: boolean;
}
export interface Offer extends OfferFields {
  id: number;
}
export interface QuoteLine {
  productId: number;
  product: ProductFields;
  quantity: string;
  unitPrice: string;
}
export interface QuoteFields {
  customerId: number;
  inquiryId: number | null;
  quotedOn: string;
  validUntil: string;
  seller: string;
  terms: string;
  currency: string;
  discount: string;
  tax: string;
  freight: string;
  lines: QuoteLine[];
}
export interface StructuredQuoteInput extends QuoteFields {
  requestKey: string;
  previousQuoteId: number | null;
}
export interface QuoteDocument extends QuoteFields {
  quoteId: number;
  seriesId: number;
  revision: number;
  number: string;
  previousQuoteId: number | null;
  customer: {
    name: string;
    company: string;
    email: string;
    phone: string;
    country: string;
  };
  lineAmounts: string[];
  belowMoq: number[];
  subtotal: string;
  total: string;
}
export interface CostEntry {
  category: "purchase" | "freight" | "tax" | "other";
  amount: string;
  currency: string;
  occurredOn: string;
  notes: string;
  supplierId: number | null;
  supplierName: string;
  productId: number | null;
  offerId: number | null;
  rate: string | null;
  rateOn: string | null;
  confirmed: boolean;
}
export interface Profit {
  missingRates: number;
  complete: boolean;
  purchase: string | null;
  freight: string | null;
  tax: string | null;
  other: string | null;
  totalCost: string | null;
  profit: string | null;
  margin: string | null;
}
export interface Order {
  id: number;
  number: string;
  sourceQuoteId: number;
  quote: QuoteDocument;
  orderedOn: string;
  deliveryOn: string | null;
  status: "draft" | "confirmed" | "cancelled";
  notes: string;
  version: number;
  costs: CostEntry[];
  costsComplete: boolean;
  completenessNote: string;
  profit: Profit;
}
export interface OrderUpdate {
  id: number;
  expectedVersion: number;
  orderedOn: string;
  deliveryOn: string | null;
  notes: string;
  sourceQuoteId: number;
  reason: string;
}
export interface OrderTransition {
  id: number;
  expectedVersion: number;
  status: "confirmed" | "cancelled";
  reason: string;
}
export interface CostsInput {
  orderId: number;
  expectedVersion: number;
  entries: CostEntry[];
  complete: boolean;
  completenessNote: string;
  reason: string;
}
export interface OrderEvent {
  id: number;
  occurredAt: string;
  action: string;
  snapshot: Omit<Order, "id">;
}
export interface CommerceSnapshot {
  products: Product[];
  suppliers: Supplier[];
  offers: Offer[];
  quotes: QuoteDocument[];
  orders: Order[];
  seller: string;
}
export interface ReportFilter {
  from: string;
  through: string;
  customerId: number | null;
}
export interface ReportTotals {
  orderIds: number[];
  revenue: string;
  purchase: string;
  freight: string;
  tax: string;
  other: string;
  totalCost: string;
  profit: string;
  margin: string | null;
}
export interface CurrencyReport {
  currency: string;
  orderIds: number[];
  revenue: string;
  incompleteCount: number;
  missingRateCount: number;
  uncomputedCount: number;
  confirmed: ReportTotals;
  estimated: ReportTotals;
}
export interface OrderReport {
  from: string;
  through: string;
  includedCount: number;
  incompleteCount: number;
  missingRateCount: number;
  currencies: CurrencyReport[];
  orders: Order[];
}
export type CommerceRoute = {
  kind: "products" | "suppliers" | "quotes" | "orders" | "reports";
  id?: number;
  customerId?: number;
  newQuote?: boolean;
  legacyId?: number;
};
export const costCategories = {
  purchase: "商品采购",
  freight: "运费",
  tax: "税费",
  other: "其他费用",
} as const;
export const orderStatuses = {
  draft: "草稿",
  confirmed: "已确认",
  cancelled: "已取消",
} as const;
export const getCommerceSnapshot = () =>
  invoke<CommerceSnapshot>("commerce_snapshot");
export const saveProduct = (input: ProductFields & { id: number | null }) =>
  invoke<number>("save_product", { input });
export const saveSupplier = (input: SupplierFields & { id: number | null }) =>
  invoke<number>("save_supplier", { input });
export const saveOffer = (input: OfferFields & { id: number | null }) =>
  invoke<number>("save_offer", { input });
export const saveSeller = (seller: string) =>
  invoke<void>("save_seller", { seller });
export const saveStructuredQuote = (input: StructuredQuoteInput) =>
  invoke<number>("save_structured_quote", { input });
export const getQuoteDocument = (quoteId: number) =>
  invoke<QuoteDocument>("get_quote_document", { quoteId });
export const createOrder = (quoteId: number, orderedOn: string) =>
  invoke<number>("create_order", { quoteId, orderedOn });
export const updateOrder = (input: OrderUpdate) =>
  invoke<void>("update_order", { input });
export const transitionOrder = (input: OrderTransition) =>
  invoke<void>("transition_order", { input });
export const saveOrderCosts = (input: CostsInput) =>
  invoke<void>("save_order_costs", { input });
export const getOrderHistory = (orderId: number) =>
  invoke<OrderEvent[]>("order_history", { orderId });
export const draftCostFromOffer = (
  orderId: number,
  lineIndex: number,
  offerId: number,
  occurredOn: string,
) =>
  invoke<CostEntry>("draft_cost_from_offer", {
    orderId,
    lineIndex,
    offerId,
    occurredOn,
  });
export const getOrderReport = (filter: ReportFilter) =>
  invoke<OrderReport>("order_report", { filter });

export function productText(product: ProductFields): string {
  return [
    `${product.code} · ${product.name}`,
    ...product.parameters.map((item) => `${item.name}：${item.value}`),
    `单位：${product.unit}`,
    `MOQ：${product.moq === null ? "未知" : `${product.moq} ${product.unit}`}`,
    `交期：${leadTime(product)}`,
  ].join("\n");
}
export function leadTime(
  product: Pick<ProductFields, "leadDaysMin" | "leadDaysMax">,
): string {
  return product.leadDaysMin === null
    ? "未知"
    : `确认订单后 ${product.leadDaysMin}–${product.leadDaysMax} 天`;
}

export const exportQuotePdf = (quoteId: number) =>
  invoke<string | null>("export_quote_pdf", { quoteId });
