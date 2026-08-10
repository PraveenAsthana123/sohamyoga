// Order — full eCommerce order lifecycle with payment, fulfillment, returns, refunds
import type { ProductType } from "./Product";

export type OrderStatus =
  | "draft" | "pending" | "confirmed" | "processing"
  | "partially_shipped" | "shipped" | "delivered"
  | "cancelled" | "refunded" | "returned";

export type PaymentStatus = "pending" | "paid" | "partially_paid" | "failed" | "refunded";
export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled" | "returned";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productType: ProductType;
  variantId?: string;
  variantName?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;  // (unitPrice * qty) - discountAmount + taxAmount
  isDigital: boolean;
  downloadUrl?: string;
  teacherId?: string;
  vendorId?: string;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  phone?: string;
}

export interface OrderProps {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerEmail: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;

  items: OrderItem[];

  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  couponDiscount: number;
  giftCardCode?: string;
  giftCardAmount: number;
  walletAmount: number;
  rewardPointsUsed: number;
  rewardPointsValue: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
  currency: string;

  shippingAddress?: ShippingAddress;
  billingAddress?: ShippingAddress;

  trackingNumber?: string;
  trackingUrl?: string;

  notes?: string;
  internalNotes?: string;
  cancelReason?: string;
  refundAmount: number;
  refundReason?: string;

  invoiceNumber?: string;

  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Order {
  constructor(private props: OrderProps) {
    if (!props.orderNumber.trim()) throw new Error("Order number required");
    if (!props.customerEmail.trim()) throw new Error("Customer email required");
    if (props.items.length === 0) throw new Error("Order must have at least one item");
    if (props.subtotal < 0) throw new Error("Subtotal cannot be negative");
    if (props.total < 0) throw new Error("Total cannot be negative");
    if (props.taxAmount < 0) throw new Error("Tax amount cannot be negative");
    if (props.shippingAmount < 0) throw new Error("Shipping amount cannot be negative");
    if (props.refundAmount < 0) throw new Error("Refund amount cannot be negative");
    if (props.refundAmount > props.total) throw new Error("Refund cannot exceed order total");
    if (props.items.some(i => i.quantity < 1)) throw new Error("Item quantity must be >= 1");
    if (props.items.some(i => i.unitPrice < 0)) throw new Error("Item price cannot be negative");
  }

  get id()                 { return this.props.id; }
  get orderNumber()        { return this.props.orderNumber; }
  get customerId()         { return this.props.customerId; }
  get customerEmail()      { return this.props.customerEmail; }
  get status()             { return this.props.status; }
  get paymentStatus()      { return this.props.paymentStatus; }
  get fulfillmentStatus()  { return this.props.fulfillmentStatus; }
  get items()              { return this.props.items.map(i => ({ ...i })); }
  get subtotal()           { return this.props.subtotal; }
  get discountAmount()     { return this.props.discountAmount; }
  get couponCode()         { return this.props.couponCode; }
  get couponDiscount()     { return this.props.couponDiscount; }
  get giftCardAmount()     { return this.props.giftCardAmount; }
  get walletAmount()       { return this.props.walletAmount; }
  get rewardPointsUsed()   { return this.props.rewardPointsUsed; }
  get rewardPointsValue()  { return this.props.rewardPointsValue; }
  get taxAmount()          { return this.props.taxAmount; }
  get shippingAmount()     { return this.props.shippingAmount; }
  get total()              { return this.props.total; }
  get currency()           { return this.props.currency; }
  get trackingNumber()     { return this.props.trackingNumber; }
  get refundAmount()       { return this.props.refundAmount; }
  get invoiceNumber()      { return this.props.invoiceNumber; }
  get cancelReason()       { return this.props.cancelReason; }
  get refundReason()       { return this.props.refundReason; }

  itemCount(): number {
    return this.props.items.reduce((s, i) => s + i.quantity, 0);
  }

  hasDigitalItems(): boolean {
    return this.props.items.some(i => i.isDigital);
  }

  hasPhysicalItems(): boolean {
    return this.props.items.some(i => !i.isDigital);
  }

  getItem(itemId: string): OrderItem | undefined {
    const item = this.props.items.find(i => i.id === itemId);
    return item ? { ...item } : undefined;
  }

  // ─── Status machine ───────────────────────────────────────────────────────

  confirm(): Order {
    if (this.props.status !== "pending") throw new Error(`Cannot confirm from ${this.props.status}`);
    return new Order({ ...this.props, status: "confirmed", updatedAt: new Date() });
  }

  startProcessing(): Order {
    if (this.props.status !== "confirmed") throw new Error(`Cannot process from ${this.props.status}`);
    return new Order({ ...this.props, status: "processing", updatedAt: new Date() });
  }

  ship(trackingNumber: string, trackingUrl?: string): Order {
    if (!["processing", "confirmed"].includes(this.props.status)) throw new Error(`Cannot ship from ${this.props.status}`);
    if (!trackingNumber.trim()) throw new Error("Tracking number required");
    return new Order({
      ...this.props,
      status: "shipped",
      fulfillmentStatus: "fulfilled",
      trackingNumber,
      trackingUrl,
      updatedAt: new Date(),
    });
  }

  deliver(): Order {
    if (this.props.status !== "shipped") throw new Error(`Cannot deliver from ${this.props.status}`);
    return new Order({ ...this.props, status: "delivered", updatedAt: new Date() });
  }

  cancel(reason: string): Order {
    if (!reason.trim()) throw new Error("Cancellation reason required");
    if (["delivered", "refunded", "returned"].includes(this.props.status)) {
      throw new Error(`Cannot cancel a ${this.props.status} order`);
    }
    return new Order({
      ...this.props,
      status: "cancelled",
      cancelReason: reason,
      updatedAt: new Date(),
    });
  }

  refund(amount: number, reason: string): Order {
    if (amount <= 0) throw new Error("Refund amount must be > 0");
    if (amount > this.props.total) throw new Error("Refund cannot exceed order total");
    if (!reason.trim()) throw new Error("Refund reason required");
    if (!["delivered", "cancelled", "returned"].includes(this.props.status)) {
      throw new Error(`Cannot refund from ${this.props.status}`);
    }
    const isFullRefund = Math.abs(amount - this.props.total) < 0.01;
    return new Order({
      ...this.props,
      status: isFullRefund ? "refunded" : this.props.status,
      paymentStatus: isFullRefund ? "refunded" : "partially_paid",
      refundAmount: amount,
      refundReason: reason,
      updatedAt: new Date(),
    });
  }

  requestReturn(reason: string): Order {
    if (this.props.status !== "delivered") throw new Error("Can only return delivered orders");
    if (!reason.trim()) throw new Error("Return reason required");
    return new Order({
      ...this.props,
      status: "returned",
      fulfillmentStatus: "returned",
      updatedAt: new Date(),
    });
  }

  // ─── Payment ──────────────────────────────────────────────────────────────

  markPaid(): Order {
    if (this.props.paymentStatus === "paid") throw new Error("Already paid");
    return new Order({ ...this.props, paymentStatus: "paid", updatedAt: new Date() });
  }

  markPaymentFailed(): Order {
    return new Order({ ...this.props, paymentStatus: "failed", updatedAt: new Date() });
  }

  setInvoiceNumber(invoiceNumber: string): Order {
    if (!invoiceNumber.trim()) throw new Error("Invoice number required");
    return new Order({ ...this.props, invoiceNumber, updatedAt: new Date() });
  }

  toJSON(): OrderProps {
    return { ...this.props, items: this.props.items.map(i => ({ ...i })) };
  }
}
