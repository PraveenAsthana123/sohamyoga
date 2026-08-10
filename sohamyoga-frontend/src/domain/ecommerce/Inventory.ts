// Inventory — warehouse stock management with movements, reservations, batch/expiry tracking

export type MovementType =
  | "receipt"      // goods received from supplier
  | "sale"         // committed to a confirmed order
  | "reservation"  // held for pending checkout
  | "release"      // reservation released (cart abandoned / order cancelled)
  | "adjustment"   // manual stock correction
  | "transfer_out" // moved to another warehouse
  | "transfer_in"  // received from another warehouse
  | "return"       // customer return restored to stock
  | "expired"      // batch expiry write-off
  | "damaged";     // damaged goods write-off

export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock" | "discontinued";

export interface StockMovement {
  id: string;
  type: MovementType;
  quantity: number;        // positive = added, negative = removed
  referenceId?: string;    // orderId, PO number, warehouseId, etc.
  reason?: string;
  warehouseId: string;
  performedBy: string;
  performedAt: Date;
  batchNumber?: string;
  serialNumber?: string;
}

export interface InventoryProps {
  id: string;
  productId: string;
  variantId?: string;
  warehouseId: string;
  warehouseName: string;
  sku: string;

  quantity: number;          // total physical on-hand
  reservedQuantity: number;  // held for pending orders

  reorderPoint: number;      // trigger alert when availableQty <= reorderPoint
  reorderQuantity: number;   // suggested purchase order quantity

  batchNumber?: string;
  expiryDate?: Date;
  serialNumber?: string;
  location?: string;         // e.g. "A-12-3" (aisle-rack-bin)

  movements: StockMovement[];
  updatedAt: Date;
}

export class Inventory {
  constructor(private props: InventoryProps) {
    if (!props.sku.trim()) throw new Error("SKU required");
    if (!props.productId.trim()) throw new Error("Product ID required");
    if (!props.warehouseId.trim()) throw new Error("Warehouse ID required");
    if (props.quantity < 0) throw new Error("Quantity cannot be negative");
    if (props.reservedQuantity < 0) throw new Error("Reserved quantity cannot be negative");
    if (props.reservedQuantity > props.quantity) throw new Error("Reserved cannot exceed quantity");
    if (props.reorderPoint < 0) throw new Error("Reorder point cannot be negative");
    if (props.reorderQuantity < 1) throw new Error("Reorder quantity must be >= 1");
  }

  get id()                { return this.props.id; }
  get productId()         { return this.props.productId; }
  get variantId()         { return this.props.variantId; }
  get warehouseId()       { return this.props.warehouseId; }
  get warehouseName()     { return this.props.warehouseName; }
  get sku()               { return this.props.sku; }
  get quantity()          { return this.props.quantity; }
  get reservedQuantity()  { return this.props.reservedQuantity; }
  get reorderPoint()      { return this.props.reorderPoint; }
  get reorderQuantity()   { return this.props.reorderQuantity; }
  get batchNumber()       { return this.props.batchNumber; }
  get expiryDate()        { return this.props.expiryDate; }
  get location()          { return this.props.location; }
  get movements()         { return this.props.movements.map(m => ({ ...m })); }

  availableQty(): number {
    return this.props.quantity - this.props.reservedQuantity;
  }

  isLowStock(): boolean {
    return this.availableQty() <= this.props.reorderPoint && this.availableQty() > 0;
  }

  isOutOfStock(): boolean {
    return this.availableQty() <= 0;
  }

  isExpired(at = new Date()): boolean {
    if (!this.props.expiryDate) return false;
    return this.props.expiryDate < at;
  }

  status(): InventoryStatus {
    if (this.isOutOfStock()) return "out_of_stock";
    if (this.isLowStock()) return "low_stock";
    return "in_stock";
  }

  // ─── Movements ────────────────────────────────────────────────────────────

  private addMovement(movement: Omit<StockMovement, "performedAt"> & { performedAt?: Date }): StockMovement {
    return {
      ...movement,
      performedAt: movement.performedAt ?? new Date(),
    };
  }

  reserve(qty: number, referenceId: string, performedBy: string): Inventory {
    if (qty < 1) throw new Error("Reserve quantity must be >= 1");
    if (this.availableQty() < qty) throw new Error(`Insufficient stock: ${this.availableQty()} available, ${qty} requested`);
    const movement = this.addMovement({ id: `mov-${Date.now()}`, type: "reservation", quantity: qty, referenceId, warehouseId: this.props.warehouseId, performedBy });
    return new Inventory({
      ...this.props,
      reservedQuantity: this.props.reservedQuantity + qty,
      movements: [...this.props.movements, movement],
      updatedAt: new Date(),
    });
  }

  release(qty: number, referenceId: string, performedBy: string): Inventory {
    if (qty < 1) throw new Error("Release quantity must be >= 1");
    if (qty > this.props.reservedQuantity) throw new Error(`Cannot release ${qty}: only ${this.props.reservedQuantity} reserved`);
    const movement = this.addMovement({ id: `mov-${Date.now()}`, type: "release", quantity: qty, referenceId, warehouseId: this.props.warehouseId, performedBy });
    return new Inventory({
      ...this.props,
      reservedQuantity: this.props.reservedQuantity - qty,
      movements: [...this.props.movements, movement],
      updatedAt: new Date(),
    });
  }

  commit(qty: number, orderId: string, performedBy: string): Inventory {
    if (qty < 1) throw new Error("Commit quantity must be >= 1");
    if (qty > this.props.reservedQuantity) throw new Error(`Cannot commit ${qty}: only ${this.props.reservedQuantity} reserved`);
    if (qty > this.props.quantity) throw new Error(`Cannot commit ${qty}: only ${this.props.quantity} in stock`);
    const movement = this.addMovement({ id: `mov-${Date.now()}`, type: "sale", quantity: -qty, referenceId: orderId, warehouseId: this.props.warehouseId, performedBy });
    return new Inventory({
      ...this.props,
      quantity: this.props.quantity - qty,
      reservedQuantity: this.props.reservedQuantity - qty,
      movements: [...this.props.movements, movement],
      updatedAt: new Date(),
    });
  }

  receive(qty: number, performedBy: string, opts?: { referenceId?: string; batchNumber?: string; expiryDate?: Date }): Inventory {
    if (qty < 1) throw new Error("Receipt quantity must be >= 1");
    const movement = this.addMovement({ id: `mov-${Date.now()}`, type: "receipt", quantity: qty, referenceId: opts?.referenceId, warehouseId: this.props.warehouseId, performedBy, batchNumber: opts?.batchNumber });
    return new Inventory({
      ...this.props,
      quantity: this.props.quantity + qty,
      batchNumber: opts?.batchNumber ?? this.props.batchNumber,
      expiryDate: opts?.expiryDate ?? this.props.expiryDate,
      movements: [...this.props.movements, movement],
      updatedAt: new Date(),
    });
  }

  adjust(qty: number, reason: string, performedBy: string): Inventory {
    if (qty === 0) throw new Error("Adjustment quantity cannot be zero");
    if (!reason.trim()) throw new Error("Adjustment reason required");
    const newQty = this.props.quantity + qty;
    if (newQty < 0) throw new Error(`Adjustment would result in negative stock (${newQty})`);
    if (newQty < this.props.reservedQuantity) throw new Error("Adjusted stock cannot be less than reserved quantity");
    const movement = this.addMovement({ id: `mov-${Date.now()}`, type: "adjustment", quantity: qty, reason, warehouseId: this.props.warehouseId, performedBy });
    return new Inventory({
      ...this.props,
      quantity: newQty,
      movements: [...this.props.movements, movement],
      updatedAt: new Date(),
    });
  }

  markExpired(qty: number, performedBy: string, batchNumber?: string): Inventory {
    if (qty < 1) throw new Error("Expired quantity must be >= 1");
    if (qty > this.availableQty()) throw new Error("Cannot expire more than available stock");
    const movement = this.addMovement({ id: `mov-${Date.now()}`, type: "expired", quantity: -qty, reason: "Batch expired", warehouseId: this.props.warehouseId, performedBy, batchNumber });
    return new Inventory({
      ...this.props,
      quantity: this.props.quantity - qty,
      movements: [...this.props.movements, movement],
      updatedAt: new Date(),
    });
  }

  addReturn(qty: number, orderId: string, performedBy: string): Inventory {
    if (qty < 1) throw new Error("Return quantity must be >= 1");
    const movement = this.addMovement({ id: `mov-${Date.now()}`, type: "return", quantity: qty, referenceId: orderId, warehouseId: this.props.warehouseId, performedBy });
    return new Inventory({
      ...this.props,
      quantity: this.props.quantity + qty,
      movements: [...this.props.movements, movement],
      updatedAt: new Date(),
    });
  }

  toJSON(): InventoryProps {
    return { ...this.props, movements: this.props.movements.map(m => ({ ...m })) };
  }
}
