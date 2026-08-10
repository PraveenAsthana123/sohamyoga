// Bundle — class packs, hybrid bundles, corporate/family/gift bundles
// Each bundle has itemized credits tracked independently (e.g., 10 classes + 2 workshops)
// Transfer and gift ownership chains are recorded for audit

export type BundleType =
  | "class_pack"        // 10 or 20 class pack
  | "unlimited_monthly"
  | "unlimited_yearly"
  | "hybrid"            // classes + workshops mixed
  | "retreat"
  | "workshop"
  | "teacher_training"
  | "corporate"
  | "family"
  | "kids"
  | "senior"
  | "gift"
  | "custom";

export type BundleItemType = "class" | "workshop" | "retreat" | "product" | "consultation" | "content";
export type BundleStatus = "draft" | "active" | "suspended" | "archived";

export interface BundleItem {
  id: string;
  type: BundleItemType;
  name: string;
  quantity: number;     // total allotted
  usedCount: number;    // consumed so far
  productId?: string;
  classCategory?: string;
}

export interface BundleProps {
  id: string;
  name: string;
  slug: string;
  type: BundleType;
  description: string;
  status: BundleStatus;
  items: BundleItem[];

  basePrice: number;
  discountedPrice: number;   // selling price (may equal basePrice)
  currency: string;

  expiryDays: number;        // calendar days from activation
  activatedAt?: Date;
  expiresAt?: Date;

  isMixAndMatch: boolean;    // customer can swap item types at checkout
  isGiftable: boolean;
  isTransferable: boolean;

  // Ownership
  customerId?: string;
  giftedTo?: string;
  purchasedBy?: string;

  // Transfer chain
  transferredTo?: string;
  transferredAt?: Date;

  // Corporate / multi-seat
  corporateDepartment?: string;
  seatsTotal?: number;
  seatsUsed?: number;

  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Bundle {
  constructor(private props: BundleProps) {
    if (!props.name.trim()) throw new Error("Bundle name required");
    if (!props.slug.trim()) throw new Error("Slug required");
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error("Slug must be lowercase kebab-case");
    if (props.basePrice < 0) throw new Error("Base price cannot be negative");
    if (props.discountedPrice < 0) throw new Error("Discounted price cannot be negative");
    if (props.discountedPrice > props.basePrice) throw new Error("Discounted price cannot exceed base price");
    if (props.expiryDays < 1) throw new Error("Expiry must be at least 1 day");
    if (props.items.some(i => i.quantity < 1)) throw new Error("Item quantity must be >= 1");
    if (props.items.some(i => i.usedCount < 0)) throw new Error("Used count cannot be negative");
    if (props.items.some(i => i.usedCount > i.quantity)) throw new Error("Used count cannot exceed quantity");
  }

  get id()             { return this.props.id; }
  get name()           { return this.props.name; }
  get slug()           { return this.props.slug; }
  get type()           { return this.props.type; }
  get status()         { return this.props.status; }
  get items()          { return this.props.items.map(i => ({ ...i })); }
  get basePrice()      { return this.props.basePrice; }
  get discountedPrice() { return this.props.discountedPrice; }
  get currency()       { return this.props.currency; }
  get expiryDays()     { return this.props.expiryDays; }
  get activatedAt()    { return this.props.activatedAt; }
  get expiresAt()      { return this.props.expiresAt; }
  get isMixAndMatch()  { return this.props.isMixAndMatch; }
  get isGiftable()     { return this.props.isGiftable; }
  get isTransferable() { return this.props.isTransferable; }
  get customerId()     { return this.props.customerId; }
  get giftedTo()       { return this.props.giftedTo; }
  get transferredTo()  { return this.props.transferredTo; }
  get transferredAt()  { return this.props.transferredAt; }
  get seatsTotal()     { return this.props.seatsTotal; }
  get seatsUsed()      { return this.props.seatsUsed; }

  totalItems(): number {
    return this.props.items.reduce((s, i) => s + i.quantity, 0);
  }

  totalUsed(): number {
    return this.props.items.reduce((s, i) => s + i.usedCount, 0);
  }

  totalRemaining(): number {
    return this.totalItems() - this.totalUsed();
  }

  remainingCredits(type: BundleItemType): number {
    return this.props.items
      .filter(i => i.type === type)
      .reduce((s, i) => s + (i.quantity - i.usedCount), 0);
  }

  discountPercent(): number {
    if (this.props.basePrice === 0) return 0;
    return Math.round(((this.props.basePrice - this.props.discountedPrice) / this.props.basePrice) * 100);
  }

  isActivated(): boolean { return this.props.activatedAt !== undefined; }

  isExpired(at = new Date()): boolean {
    if (!this.props.expiresAt) return false;
    return this.props.expiresAt < at;
  }

  // --- Activation ---
  activate(customerId: string, at = new Date()): Bundle {
    if (!customerId.trim()) throw new Error("Customer ID required to activate");
    if (this.isActivated()) throw new Error("Bundle already activated");
    const expiresAt = new Date(at.getTime() + this.props.expiryDays * 86400000);
    return new Bundle({ ...this.props, status: "active", customerId, activatedAt: at, expiresAt, updatedAt: new Date() });
  }

  // --- Item usage ---
  useItem(itemId: string, count: number = 1): Bundle {
    if (count < 1) throw new Error("Count must be >= 1");
    const item = this.props.items.find(i => i.id === itemId);
    if (!item) throw new Error(`Item ${itemId} not found`);
    if (item.usedCount + count > item.quantity) throw new Error(`Insufficient ${item.type} credits: ${item.quantity - item.usedCount} remaining`);
    const updatedItems = this.props.items.map(i =>
      i.id === itemId ? { ...i, usedCount: i.usedCount + count } : i
    );
    return new Bundle({ ...this.props, items: updatedItems, updatedAt: new Date() });
  }

  // --- Gift ---
  gift(recipientId: string, purchasedById: string): Bundle {
    if (!this.props.isGiftable) throw new Error("This bundle is not giftable");
    if (!recipientId.trim()) throw new Error("Recipient ID required");
    if (this.props.giftedTo) throw new Error("Bundle already gifted");
    return new Bundle({ ...this.props, giftedTo: recipientId, purchasedBy: purchasedById, updatedAt: new Date() });
  }

  // --- Transfer ---
  transfer(targetCustomerId: string): Bundle {
    if (!this.props.isTransferable) throw new Error("This bundle is not transferable");
    if (!targetCustomerId.trim()) throw new Error("Target customer ID required");
    if (this.props.transferredTo) throw new Error("Bundle already transferred");
    return new Bundle({ ...this.props, transferredTo: targetCustomerId, transferredAt: new Date(), customerId: targetCustomerId, updatedAt: new Date() });
  }

  // --- State machine ---
  suspend(reason: string): Bundle {
    if (!reason.trim()) throw new Error("Suspension reason required");
    if (this.props.status !== "active") throw new Error("Can only suspend an active bundle");
    return new Bundle({ ...this.props, status: "suspended", updatedAt: new Date() });
  }

  reinstate(): Bundle {
    if (this.props.status !== "suspended") throw new Error("Can only reinstate a suspended bundle");
    return new Bundle({ ...this.props, status: "active", updatedAt: new Date() });
  }

  archive(): Bundle {
    if (this.props.status === "archived") throw new Error("Already archived");
    return new Bundle({ ...this.props, status: "archived", updatedAt: new Date() });
  }

  toJSON(): BundleProps {
    return { ...this.props, items: this.props.items.map(i => ({ ...i })) };
  }
}
