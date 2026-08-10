// Coupon redemption — reservation → commit pattern (concurrency-safe via Redis TTL)
// A reservation holds the slot during checkout; commit finalizes after payment succeeds.
// If payment fails or times out, the reservation expires and the slot is freed.

export type RedemptionStatus = "reserved" | "committed" | "cancelled" | "reversed";
export type RedemptionChannel = "web" | "app" | "in_person" | "phone";

export interface CouponRedemptionProps {
  id: string;
  couponId: string;
  couponCode: string;
  customerId: string;
  customerEmail: string;

  status: RedemptionStatus;

  orderAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;

  orderId?: string;

  // Reservation TTL — prevents double-redemption during concurrent checkouts
  reservedAt: Date;
  reservationExpiresAt: Date;  // typically reservedAt + 15 minutes
  committedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  reversedAt?: Date;
  reverseReason?: string;

  // Fraud/audit context
  ipAddress?: string;
  deviceType?: string;
  channel: RedemptionChannel;
  failureReason?: string;

  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const RESERVATION_TTL_MINUTES = 15;

export class CouponRedemption {
  constructor(private props: CouponRedemptionProps) {
    if (!props.couponId.trim()) throw new Error("Coupon ID required");
    if (!props.customerId.trim()) throw new Error("Customer ID required");
    if (props.orderAmount < 0) throw new Error("Order amount cannot be negative");
    if (props.discountAmount < 0) throw new Error("Discount amount cannot be negative");
    if (props.discountAmount > props.orderAmount) throw new Error("Discount cannot exceed order amount");
    if (Math.round(props.finalAmount * 100) !== Math.round((props.orderAmount - props.discountAmount) * 100))
      throw new Error("Final amount must equal order amount minus discount");
    if (props.reservationExpiresAt <= props.reservedAt) throw new Error("Reservation expiry must be after reserved-at");
  }

  get id()                    { return this.props.id; }
  get couponId()               { return this.props.couponId; }
  get couponCode()             { return this.props.couponCode; }
  get customerId()             { return this.props.customerId; }
  get status()                 { return this.props.status; }
  get orderAmount()            { return this.props.orderAmount; }
  get discountAmount()         { return this.props.discountAmount; }
  get finalAmount()            { return this.props.finalAmount; }
  get currency()               { return this.props.currency; }
  get orderId()                { return this.props.orderId; }
  get reservedAt()             { return this.props.reservedAt; }
  get reservationExpiresAt()   { return this.props.reservationExpiresAt; }
  get committedAt()            { return this.props.committedAt; }
  get cancelReason()           { return this.props.cancelReason; }
  get reverseReason()          { return this.props.reverseReason; }
  get channel()                { return this.props.channel; }

  savingsAmount(): number { return this.props.discountAmount; }

  savingsPercent(): number {
    if (this.props.orderAmount === 0) return 0;
    return Math.round((this.props.discountAmount / this.props.orderAmount) * 100);
  }

  isReservationExpired(at = new Date()): boolean {
    return this.props.status === "reserved" && this.props.reservationExpiresAt < at;
  }

  isSettled(): boolean {
    return this.props.status === "committed" || this.props.status === "cancelled" || this.props.status === "reversed";
  }

  // Complete after successful payment
  commit(orderId: string): CouponRedemption {
    if (!orderId.trim()) throw new Error("Order ID required to commit redemption");
    if (this.props.status !== "reserved") throw new Error("Can only commit a reserved redemption");
    if (this.isReservationExpired()) throw new Error("Reservation has expired — cannot commit");
    return new CouponRedemption({ ...this.props, status: "committed", orderId, committedAt: new Date(), updatedAt: new Date() });
  }

  // Cancel before payment (user aborts or payment fails)
  cancel(reason: string): CouponRedemption {
    if (!reason.trim()) throw new Error("Cancellation reason required");
    if (this.props.status !== "reserved") throw new Error("Can only cancel a reserved redemption");
    return new CouponRedemption({ ...this.props, status: "cancelled", cancelReason: reason, cancelledAt: new Date(), updatedAt: new Date() });
  }

  // Reverse a committed redemption (refund scenario — restores coupon slot)
  reverse(reason: string): CouponRedemption {
    if (!reason.trim()) throw new Error("Reversal reason required");
    if (this.props.status !== "committed") throw new Error("Can only reverse a committed redemption");
    return new CouponRedemption({ ...this.props, status: "reversed", reverseReason: reason, reversedAt: new Date(), updatedAt: new Date() });
  }

  static createReservation(props: Omit<CouponRedemptionProps, "status" | "reservedAt" | "reservationExpiresAt" | "createdAt" | "updatedAt">): CouponRedemption {
    const reservedAt = new Date();
    const reservationExpiresAt = new Date(reservedAt.getTime() + RESERVATION_TTL_MINUTES * 60000);
    return new CouponRedemption({ ...props, status: "reserved", reservedAt, reservationExpiresAt, createdAt: reservedAt, updatedAt: reservedAt });
  }

  toJSON(): CouponRedemptionProps { return { ...this.props }; }
}
