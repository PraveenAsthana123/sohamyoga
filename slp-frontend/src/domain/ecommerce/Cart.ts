// Cart — shopping cart with layered discount stack: rules → coupon → gift card → wallet → reward points
// Guest carts use sessionId; member carts use customerId

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productType: string;
  variantId?: string;
  variantName?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  compareAtPrice?: number;
  isDigital: boolean;
  requiresShipping: boolean;
}

export interface CartProps {
  id: string;
  customerId?: string;
  sessionId?: string;     // guest cart token
  currency: string;
  items: CartItem[];

  couponCode?: string;
  couponDiscount: number;

  giftCardCode?: string;
  giftCardAmount: number;

  walletAmount: number;

  rewardPointsUsed: number;
  rewardPointsValuePerPoint: number; // e.g., 0.05 = CAD 0.05 per point

  shippingCost: number;
  taxRate: number;        // 0–1, e.g., 0.13 for 13% HST

  notes?: string;
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export class Cart {
  constructor(private props: CartProps) {
    if (!props.id.trim()) throw new Error("Cart ID required");
    if (!props.currency.trim()) throw new Error("Currency required");
    if (props.couponDiscount < 0) throw new Error("Coupon discount cannot be negative");
    if (props.giftCardAmount < 0) throw new Error("Gift card amount cannot be negative");
    if (props.walletAmount < 0) throw new Error("Wallet amount cannot be negative");
    if (props.rewardPointsUsed < 0) throw new Error("Reward points used cannot be negative");
    if (props.rewardPointsValuePerPoint < 0) throw new Error("Points value per point cannot be negative");
    if (props.shippingCost < 0) throw new Error("Shipping cost cannot be negative");
    if (props.taxRate < 0 || props.taxRate > 1) throw new Error("Tax rate must be 0–1");
    if (props.items.some(i => i.quantity < 1)) throw new Error("Item quantity must be >= 1");
    if (props.items.some(i => i.unitPrice < 0)) throw new Error("Unit price cannot be negative");
  }

  get id()                      { return this.props.id; }
  get customerId()               { return this.props.customerId; }
  get sessionId()                { return this.props.sessionId; }
  get currency()                 { return this.props.currency; }
  get items()                    { return this.props.items.map(i => ({ ...i })); }
  get couponCode()               { return this.props.couponCode; }
  get couponDiscount()           { return this.props.couponDiscount; }
  get giftCardCode()             { return this.props.giftCardCode; }
  get giftCardAmount()           { return this.props.giftCardAmount; }
  get walletAmount()             { return this.props.walletAmount; }
  get rewardPointsUsed()         { return this.props.rewardPointsUsed; }
  get rewardPointsValuePerPoint() { return this.props.rewardPointsValuePerPoint; }
  get shippingCost()             { return this.props.shippingCost; }
  get taxRate()                  { return this.props.taxRate; }
  get expiresAt()                { return this.props.expiresAt; }

  // ─── Computed ─────────────────────────────────────────────────────────────

  subtotal(): number {
    return Math.round(this.props.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100;
  }

  rewardPointsValue(): number {
    return Math.round(this.props.rewardPointsUsed * this.props.rewardPointsValuePerPoint * 100) / 100;
  }

  totalDiscount(): number {
    return Math.round((
      this.props.couponDiscount +
      this.props.giftCardAmount +
      this.props.walletAmount +
      this.rewardPointsValue()
    ) * 100) / 100;
  }

  taxableAmount(): number {
    return Math.max(0, this.subtotal() - this.props.couponDiscount);
  }

  tax(): number {
    return Math.round(this.taxableAmount() * this.props.taxRate * 100) / 100;
  }

  total(): number {
    const raw = this.subtotal() + this.props.shippingCost + this.tax() - this.totalDiscount();
    return Math.max(0, Math.round(raw * 100) / 100);
  }

  isEmpty(): boolean { return this.props.items.length === 0; }

  itemCount(): number {
    return this.props.items.reduce((s, i) => s + i.quantity, 0);
  }

  hasDigitalItems(): boolean { return this.props.items.some(i => i.isDigital); }
  hasPhysicalItems(): boolean { return this.props.items.some(i => !i.isDigital && i.requiresShipping); }

  isExpired(at = new Date()): boolean {
    if (!this.props.expiresAt) return false;
    return this.props.expiresAt < at;
  }

  isGuest(): boolean { return !this.props.customerId; }

  // ─── Item management ──────────────────────────────────────────────────────

  addItem(item: CartItem): Cart {
    if (item.quantity < 1) throw new Error("Item quantity must be >= 1");
    if (item.unitPrice < 0) throw new Error("Unit price cannot be negative");
    const existing = this.props.items.find(i =>
      i.productId === item.productId && i.variantId === item.variantId
    );
    if (existing) {
      const updated = this.props.items.map(i =>
        i.productId === item.productId && i.variantId === item.variantId
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
      );
      return new Cart({ ...this.props, items: updated, updatedAt: new Date() });
    }
    return new Cart({ ...this.props, items: [...this.props.items, item], updatedAt: new Date() });
  }

  removeItem(productId: string, variantId?: string): Cart {
    const items = this.props.items.filter(i =>
      !(i.productId === productId && i.variantId === variantId)
    );
    return new Cart({ ...this.props, items, updatedAt: new Date() });
  }

  updateQuantity(productId: string, quantity: number, variantId?: string): Cart {
    if (quantity < 1) throw new Error("Quantity must be >= 1; use removeItem to remove");
    const found = this.props.items.find(i => i.productId === productId && i.variantId === variantId);
    if (!found) throw new Error(`Item ${productId} not in cart`);
    const items = this.props.items.map(i =>
      i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i
    );
    return new Cart({ ...this.props, items, updatedAt: new Date() });
  }

  // ─── Discount layers ──────────────────────────────────────────────────────

  applyCoupon(code: string, discount: number): Cart {
    if (!code.trim()) throw new Error("Coupon code required");
    if (discount < 0) throw new Error("Coupon discount cannot be negative");
    if (discount > this.subtotal()) throw new Error("Coupon discount exceeds subtotal");
    return new Cart({ ...this.props, couponCode: code, couponDiscount: discount, updatedAt: new Date() });
  }

  removeCoupon(): Cart {
    return new Cart({ ...this.props, couponCode: undefined, couponDiscount: 0, updatedAt: new Date() });
  }

  applyGiftCard(code: string, amount: number): Cart {
    if (!code.trim()) throw new Error("Gift card code required");
    if (amount <= 0) throw new Error("Gift card amount must be > 0");
    return new Cart({ ...this.props, giftCardCode: code, giftCardAmount: amount, updatedAt: new Date() });
  }

  applyWallet(amount: number): Cart {
    if (amount <= 0) throw new Error("Wallet amount must be > 0");
    return new Cart({ ...this.props, walletAmount: amount, updatedAt: new Date() });
  }

  applyRewardPoints(points: number, valuePerPoint: number): Cart {
    if (points < 1) throw new Error("Must redeem at least 1 point");
    if (valuePerPoint <= 0) throw new Error("Value per point must be > 0");
    return new Cart({ ...this.props, rewardPointsUsed: points, rewardPointsValuePerPoint: valuePerPoint, updatedAt: new Date() });
  }

  clearDiscounts(): Cart {
    return new Cart({
      ...this.props,
      couponCode: undefined, couponDiscount: 0,
      giftCardCode: undefined, giftCardAmount: 0,
      walletAmount: 0,
      rewardPointsUsed: 0,
      updatedAt: new Date(),
    });
  }

  toJSON(): CartProps {
    return { ...this.props, items: this.props.items.map(i => ({ ...i })) };
  }
}
