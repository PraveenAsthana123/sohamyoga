// Wave 19: Yoga Library — ClassSequence entity (teacher sequence builder)
// Table-driven: goal/style codes → ref_sequence_goal, ref_yoga_style

export type SequenceGoal   = 'stress_relief' | 'flexibility' | 'strength' | 'balance'
  | 'energy' | 'sleep' | 'injury_recovery' | 'mindfulness';
export type SequenceStatus = 'draft' | 'published' | 'archived';
export type YogaStyle      = 'hatha' | 'vinyasa' | 'ashtanga' | 'iyengar' | 'kundalini'
  | 'yin' | 'restorative' | 'bikram' | 'power' | 'aerial' | 'prenatal' | 'kids';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

export interface SequenceItem {
  order:           number;     // 1-based, unique within sequence
  asanaId:         string;
  durationSeconds: number;     // >= 10
  cues?:           string;
  side?:           'left' | 'right' | 'both';
  transitionNote?: string;
}

export interface ClassSequenceProps {
  id:              string;
  tenantId:        string;
  teacherId:       string;
  title:           string;
  style:           YogaStyle;
  difficultyLevel: DifficultyLevel;
  goals:           SequenceGoal[];
  items:           SequenceItem[];
  isTemplate:      boolean;
  status:          SequenceStatus;
  createdAt:       Date;
  updatedAt:       Date;
}

function validateItem(item: SequenceItem): void {
  if (!item.asanaId?.trim())      throw new Error('asanaId is required');
  if (item.durationSeconds < 10)  throw new Error('durationSeconds must be at least 10');
  if (!Number.isInteger(item.order) || item.order < 1)
    throw new Error('order must be a positive integer');
}

function validateItems(items: SequenceItem[]): void {
  items.forEach(validateItem);
  const orders = items.map(i => i.order);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length)
    throw new Error('sequence items must have unique order values');
}

export class ClassSequence {
  private readonly props: Readonly<ClassSequenceProps>;

  constructor(props: ClassSequenceProps) {
    if (!props.id?.trim())        throw new Error('id is required');
    if (!props.tenantId?.trim())  throw new Error('tenantId is required');
    if (!props.teacherId?.trim()) throw new Error('teacherId is required');
    if (!props.title?.trim())     throw new Error('title is required');
    validateItems(props.items);

    this.props = {
      ...props,
      goals: [...props.goals],
      items: props.items.map(i => ({ ...i })),
    };
  }

  get id()              { return this.props.id; }
  get tenantId()        { return this.props.tenantId; }
  get teacherId()       { return this.props.teacherId; }
  get title()           { return this.props.title; }
  get style()           { return this.props.style; }
  get difficultyLevel() { return this.props.difficultyLevel; }
  get goals()           { return [...this.props.goals]; }
  get items()           { return this.props.items.map(i => ({ ...i })); }
  get isTemplate()      { return this.props.isTemplate; }
  get status()          { return this.props.status; }
  get createdAt()       { return this.props.createdAt; }
  get updatedAt()       { return this.props.updatedAt; }

  isDraft()     { return this.props.status === 'draft'; }
  isPublished() { return this.props.status === 'published'; }
  isArchived()  { return this.props.status === 'archived'; }

  // ── Items ──────────────────────────────────────────────────────────────────

  addItem(item: SequenceItem, now: Date): ClassSequence {
    validateItem(item);
    if (this.props.items.some(i => i.order === item.order))
      throw new Error(`item with order ${item.order} already exists`);
    return this.clone({ items: [...this.props.items, { ...item }], updatedAt: now });
  }

  removeItem(order: number, now: Date): ClassSequence {
    if (!this.props.items.some(i => i.order === order))
      throw new Error(`item with order ${order} not found`);
    return this.clone({ items: this.props.items.filter(i => i.order !== order), updatedAt: now });
  }

  reorderItems(fromOrder: number, toOrder: number, now: Date): ClassSequence {
    const fromExists = this.props.items.some(i => i.order === fromOrder);
    const toExists   = this.props.items.some(i => i.order === toOrder);
    if (!fromExists) throw new Error(`item with order ${fromOrder} not found`);
    if (!toExists)   throw new Error(`item with order ${toOrder} not found`);
    if (fromOrder === toOrder) return this.clone({ updatedAt: now });
    const newItems = this.props.items.map(i => {
      if (i.order === fromOrder) return { ...i, order: toOrder };
      if (i.order === toOrder)   return { ...i, order: fromOrder };
      return { ...i };
    });
    return this.clone({ items: newItems, updatedAt: now });
  }

  moveItemUp(order: number, now: Date): ClassSequence {
    const sorted = this.props.items.map(i => i.order).sort((a, b) => a - b);
    const idx = sorted.indexOf(order);
    if (idx === -1)  throw new Error(`item with order ${order} not found`);
    if (idx === 0)   throw new Error('item is already first');
    return this.reorderItems(order, sorted[idx - 1], now);
  }

  moveItemDown(order: number, now: Date): ClassSequence {
    const sorted = this.props.items.map(i => i.order).sort((a, b) => a - b);
    const idx = sorted.indexOf(order);
    if (idx === -1)                   throw new Error(`item with order ${order} not found`);
    if (idx === sorted.length - 1)    throw new Error('item is already last');
    return this.reorderItems(order, sorted[idx + 1], now);
  }

  // ── Goals ──────────────────────────────────────────────────────────────────

  addGoal(goal: SequenceGoal, now: Date): ClassSequence {
    if (this.props.goals.includes(goal))
      throw new Error(`goal "${goal}" already added`);
    return this.clone({ goals: [...this.props.goals, goal], updatedAt: now });
  }

  removeGoal(goal: SequenceGoal, now: Date): ClassSequence {
    if (!this.props.goals.includes(goal))
      throw new Error(`goal "${goal}" not found`);
    return this.clone({ goals: this.props.goals.filter(g => g !== goal), updatedAt: now });
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  totalDurationSeconds(): number {
    return this.props.items.reduce((sum, i) => sum + i.durationSeconds, 0);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  publish(now: Date): ClassSequence {
    if (this.props.status !== 'draft')
      throw new Error('can only publish a draft sequence');
    return this.clone({ status: 'published', updatedAt: now });
  }

  archive(now: Date): ClassSequence {
    if (this.props.status !== 'published')
      throw new Error('can only archive a published sequence');
    return this.clone({ status: 'archived', updatedAt: now });
  }

  makeTemplate(now: Date): ClassSequence {
    if (this.props.status !== 'published')
      throw new Error('can only make a published sequence a template');
    return this.clone({ isTemplate: true, updatedAt: now });
  }

  clone(newId: string, newTeacherId: string, now: Date): ClassSequence;
  clone(patch: Partial<ClassSequenceProps>): ClassSequence;
  clone(first: string | Partial<ClassSequenceProps>, newTeacherId?: string, now?: Date): ClassSequence {
    if (typeof first === 'string') {
      if (!first.trim())          throw new Error('newId is required');
      if (!newTeacherId?.trim())  throw new Error('newTeacherId is required');
      return new ClassSequence({
        ...this.props,
        id:         first,
        teacherId:  newTeacherId,
        status:     'draft',
        isTemplate: false,
        createdAt:  now!,
        updatedAt:  now!,
      });
    }
    return new ClassSequence({ ...this.props, ...first });
  }
}
