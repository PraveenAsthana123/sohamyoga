// Gift voucher — stored monetary value (liability on ERPNext books until redeemed)
// Supports partial redemption; maintains full transaction log for audit and refunds

export type VoucherStatus =
  | "issued"
  | "partially_redeemed"
  | "fully_redeemed"
  | "expired"
  | "cancelled";

export interface VoucherTransaction {
  id: string;
  amount: number;        // positive = redemption, negative = reversal
  type: "redemption" | "reversal";
  orderId?: string;
  occurredAt: Date;
  notes: string;
}

export interface GiftVoucherProps {
  id: string;
  voucherCode: string;     // normalized uppercase
  issuedTo?: string;       // customerId (undefined = unassigned / transferable)
  recipientEmail?: string;
  issuedBy: string;        // admin userId
  purchasedBy?: string;    // customerId who bought the voucher
  originalValue: number;
  currentBalance: number;
  currency: string;
  status: VoucherStatus;
  expiresAt: Date;
  issuedAt: Date;
  transactions: VoucherTransaction[];
  erpnextLiabilityId?: string;   // ERPNext journal entry for outstanding liability
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class GiftVoucher {
  constructor(private props: GiftVoucherProps) {
    if (!props.voucherCode.trim()) throw new Error("Voucher code required");
    if (props.originalValue <= 0) throw new Error("Original value must be positive");
    if (props.currentBalance < 0) throw new Error("Balance cannot be negative");
    if (props.currentBalance > props.originalValue) throw new Error("Balance cannot exceed original value");
    if (props.expiresAt <= props.issuedAt) throw new Error("Expiry must be after issue date");
  }

  get id()             { return this.props.id; }
  get voucherCode()    { return this.props.voucherCode; }
  get issuedTo()       { return this.props.issuedTo; }
  get originalValue()  { return this.props.originalValue; }
  get currentBalance() { return this.props.currentBalance; }
  get currency()       { return this.props.currency; }
  get status()         { return this.props.status; }
  get expiresAt()      { return this.props.expiresAt; }
  get issuedAt()       { return this.props.issuedAt; }
  get transactions()   { return this.props.transactions.map(t => ({ ...t })); }
  get erpnextLiabilityId() { return this.props.erpnextLiabilityId; }

  totalRedeemed(): number {
    return this.props.originalValue - this.props.currentBalance;
  }

  percentageUsed(): number {
    return Math.round((this.totalRedeemed() / this.props.originalValue) * 100);
  }

  isExpired(at = new Date()): boolean {
    return this.props.expiresAt < at;
  }

  isFullyRedeemed(): boolean { return this.props.currentBalance === 0; }

  canRedeem(amount: number, at = new Date()): boolean {
    if (amount <= 0) return false;
    if (this.isExpired(at)) return false;
    if (["fully_redeemed", "expired", "cancelled"].includes(this.props.status)) return false;
    return this.props.currentBalance >= amount;
  }

  redeem(amount: number, orderId: string, transactionId: string): GiftVoucher {
    if (amount <= 0) throw new Error("Redemption amount must be positive");
    if (!this.canRedeem(amount)) throw new Error("Voucher cannot be redeemed: expired, exhausted, or cancelled");
    const newBalance = this.props.currentBalance - amount;
    const newStatus: VoucherStatus = newBalance === 0 ? "fully_redeemed" : "partially_redeemed";
    const tx: VoucherTransaction = { id: transactionId, amount, type: "redemption", orderId, occurredAt: new Date(), notes: "" };
    return new GiftVoucher({ ...this.props, currentBalance: newBalance, status: newStatus, transactions: [...this.props.transactions, tx], updatedAt: new Date() });
  }

  reverse(transactionId: string, reversalId: string, reason: string): GiftVoucher {
    const tx = this.props.transactions.find(t => t.id === transactionId && t.type === "redemption");
    if (!tx) throw new Error("Redemption transaction not found");
    if (!reason.trim()) throw new Error("Reversal reason required");
    const restoredBalance = this.props.currentBalance + tx.amount;
    if (restoredBalance > this.props.originalValue) throw new Error("Reversal would exceed original value");
    const newStatus: VoucherStatus = restoredBalance === this.props.originalValue ? "issued" : "partially_redeemed";
    const reversalTx: VoucherTransaction = { id: reversalId, amount: -tx.amount, type: "reversal", orderId: tx.orderId, occurredAt: new Date(), notes: reason };
    return new GiftVoucher({ ...this.props, currentBalance: restoredBalance, status: newStatus, transactions: [...this.props.transactions, reversalTx], updatedAt: new Date() });
  }

  cancel(reason: string): GiftVoucher {
    if (!reason.trim()) throw new Error("Cancellation reason required");
    if (this.props.status === "cancelled") throw new Error("Already cancelled");
    if (this.props.status === "fully_redeemed") throw new Error("Cannot cancel a fully redeemed voucher");
    return new GiftVoucher({ ...this.props, status: "cancelled", updatedAt: new Date() });
  }

  assign(customerId: string, email: string): GiftVoucher {
    if (this.props.issuedTo) throw new Error("Voucher already assigned");
    return new GiftVoucher({ ...this.props, issuedTo: customerId, recipientEmail: email, updatedAt: new Date() });
  }

  toJSON(): GiftVoucherProps {
    return { ...this.props, transactions: this.props.transactions.map(t => ({ ...t })) };
  }
}
