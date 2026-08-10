// Product — physical, digital, service, subscription, workshop, retreat, course,
// gift card, ayurvedic, book, bundle, membership product catalog

export type ProductType =
  | "physical"      // yoga mat, blocks, clothing, ayurvedic
  | "digital"       // downloadable PDF, MP3, video file
  | "service"       // private class, consultation
  | "subscription"  // recurring membership product
  | "bundle"        // gift pack / combo
  | "workshop"      // one-time in-person or virtual event
  | "retreat"       // multi-day program
  | "course"        // structured multi-lesson program
  | "gift_card"     // stored-value card
  | "ayurvedic"     // herbal / wellness products
  | "book"          // physical or digital book
  | "membership";   // yoga membership pass

export type ProductStatus = "draft" | "active" | "archived" | "out_of_stock";
export type TaxClass = "standard" | "reduced" | "zero" | "exempt";
export type WeightUnit = "kg" | "g" | "lb";

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>; // { size: "S", color: "Blue" }
  price: number;
  compareAtPrice?: number;
  stock: number;
  lowStockThreshold: number;
  weight?: number;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductProps {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  status: ProductStatus;
  description: string;
  shortDescription: string;

  basePrice: number;
  compareAtPrice?: number;
  currency: string;

  sku: string;
  trackInventory: boolean;
  stock: number;
  lowStockThreshold: number;

  requiresShipping: boolean;
  weight?: number;
  weightUnit?: WeightUnit;

  digitalUrl?: string;
  downloadLimit?: number;
  downloadExpiryDays?: number;

  taxable: boolean;
  taxClass: TaxClass;
  hsnCode?: string;

  categories: string[];
  tags: string[];
  brand?: string;

  variants: ProductVariant[];
  images: ProductImage[];

  vendorId?: string;
  teacherId?: string;
  duration?: number;
  maxParticipants?: number;

  isGiftable: boolean;
  isSubscriptionProduct: boolean;

  metaTitle?: string;
  metaDescription?: string;

  averageRating: number;
  reviewCount: number;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  constructor(private props: ProductProps) {
    if (!props.name.trim()) throw new Error("Product name required");
    if (!props.slug.trim()) throw new Error("Slug required");
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error("Slug must be lowercase kebab-case");
    if (!props.sku.trim()) throw new Error("SKU required");
    if (props.basePrice < 0) throw new Error("Base price cannot be negative");
    if (props.compareAtPrice !== undefined && props.compareAtPrice < props.basePrice) throw new Error("Compare-at price must be >= base price");
    if (props.stock < 0) throw new Error("Stock cannot be negative");
    if (props.lowStockThreshold < 0) throw new Error("Low stock threshold cannot be negative");
    if (props.averageRating < 0 || props.averageRating > 5) throw new Error("Rating must be 0–5");
    if (props.reviewCount < 0) throw new Error("Review count cannot be negative");
    if (props.variants.some(v => v.price < 0)) throw new Error("Variant price cannot be negative");
    if (props.variants.some(v => v.stock < 0)) throw new Error("Variant stock cannot be negative");
    if (props.downloadLimit !== undefined && props.downloadLimit < 1) throw new Error("Download limit must be >= 1");
    if (props.maxParticipants !== undefined && props.maxParticipants < 1) throw new Error("Max participants must be >= 1");
  }

  get id()                  { return this.props.id; }
  get name()                { return this.props.name; }
  get slug()                { return this.props.slug; }
  get type()                { return this.props.type; }
  get status()              { return this.props.status; }
  get basePrice()           { return this.props.basePrice; }
  get compareAtPrice()      { return this.props.compareAtPrice; }
  get currency()            { return this.props.currency; }
  get sku()                 { return this.props.sku; }
  get stock()               { return this.props.stock; }
  get lowStockThreshold()   { return this.props.lowStockThreshold; }
  get requiresShipping()    { return this.props.requiresShipping; }
  get trackInventory()      { return this.props.trackInventory; }
  get taxable()             { return this.props.taxable; }
  get taxClass()            { return this.props.taxClass; }
  get categories()          { return [...this.props.categories]; }
  get tags()                { return [...this.props.tags]; }
  get brand()               { return this.props.brand; }
  get variants()            { return this.props.variants.map(v => ({ ...v })); }
  get images()              { return this.props.images.map(i => ({ ...i })); }
  get vendorId()            { return this.props.vendorId; }
  get teacherId()           { return this.props.teacherId; }
  get duration()            { return this.props.duration; }
  get maxParticipants()     { return this.props.maxParticipants; }
  get isGiftable()          { return this.props.isGiftable; }
  get isSubscriptionProduct() { return this.props.isSubscriptionProduct; }
  get averageRating()       { return this.props.averageRating; }
  get reviewCount()         { return this.props.reviewCount; }
  get digitalUrl()          { return this.props.digitalUrl; }
  get downloadLimit()       { return this.props.downloadLimit; }

  discountPercent(): number {
    if (!this.props.compareAtPrice || this.props.compareAtPrice === 0) return 0;
    return Math.round(((this.props.compareAtPrice - this.props.basePrice) / this.props.compareAtPrice) * 100);
  }

  isInStock(variantId?: string): boolean {
    if (variantId) {
      const v = this.props.variants.find(v => v.id === variantId);
      return v ? v.stock > 0 && v.isActive : false;
    }
    if (this.props.trackInventory) return this.props.stock > 0;
    return this.props.status === "active";
  }

  isLowStock(variantId?: string): boolean {
    if (variantId) {
      const v = this.props.variants.find(v => v.id === variantId);
      return v ? v.stock <= v.lowStockThreshold && v.stock > 0 : false;
    }
    return this.props.stock <= this.props.lowStockThreshold && this.props.stock > 0;
  }

  getVariant(variantId: string): ProductVariant | undefined {
    const v = this.props.variants.find(v => v.id === variantId);
    return v ? { ...v } : undefined;
  }

  addVariant(variant: ProductVariant): Product {
    if (this.props.variants.some(v => v.id === variant.id)) throw new Error(`Variant ${variant.id} already exists`);
    if (this.props.variants.some(v => v.sku === variant.sku)) throw new Error(`SKU ${variant.sku} already in use`);
    if (variant.price < 0) throw new Error("Variant price cannot be negative");
    return new Product({ ...this.props, variants: [...this.props.variants, variant], updatedAt: new Date() });
  }

  removeVariant(variantId: string): Product {
    if (!this.props.variants.find(v => v.id === variantId)) throw new Error(`Variant ${variantId} not found`);
    return new Product({ ...this.props, variants: this.props.variants.filter(v => v.id !== variantId), updatedAt: new Date() });
  }

  updateStock(qty: number): Product {
    if (qty < 0) throw new Error("Stock cannot be negative");
    const status = qty === 0 ? "out_of_stock" : this.props.status === "out_of_stock" ? "active" : this.props.status;
    return new Product({ ...this.props, stock: qty, status, updatedAt: new Date() });
  }

  addCategory(category: string): Product {
    if (this.props.categories.includes(category)) return this;
    return new Product({ ...this.props, categories: [...this.props.categories, category], updatedAt: new Date() });
  }

  removeCategory(category: string): Product {
    return new Product({ ...this.props, categories: this.props.categories.filter(c => c !== category), updatedAt: new Date() });
  }

  addTag(tag: string): Product {
    if (this.props.tags.includes(tag)) return this;
    return new Product({ ...this.props, tags: [...this.props.tags, tag], updatedAt: new Date() });
  }

  // State machine
  activate(): Product {
    if (this.props.status === "archived") throw new Error("Cannot activate archived product");
    return new Product({ ...this.props, status: "active", updatedAt: new Date() });
  }

  archive(): Product {
    if (this.props.status === "archived") throw new Error("Already archived");
    return new Product({ ...this.props, status: "archived", updatedAt: new Date() });
  }

  markOutOfStock(): Product {
    if (this.props.status === "archived") throw new Error("Archived products cannot be marked out of stock");
    return new Product({ ...this.props, status: "out_of_stock", stock: 0, updatedAt: new Date() });
  }

  addReview(rating: number): Product {
    if (rating < 1 || rating > 5) throw new Error("Rating must be 1–5");
    const newCount = this.props.reviewCount + 1;
    const newAvg = Math.round(((this.props.averageRating * this.props.reviewCount + rating) / newCount) * 10) / 10;
    return new Product({ ...this.props, averageRating: newAvg, reviewCount: newCount, updatedAt: new Date() });
  }

  toJSON(): ProductProps {
    return {
      ...this.props,
      categories: [...this.props.categories],
      tags: [...this.props.tags],
      variants: this.props.variants.map(v => ({ ...v })),
      images: this.props.images.map(i => ({ ...i })),
    };
  }
}
