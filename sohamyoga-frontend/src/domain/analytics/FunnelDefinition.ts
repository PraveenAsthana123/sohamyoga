import type { EventType } from "./TrackingEvent";

export type FunnelStatus = "draft" | "active" | "paused" | "archived";

export interface FunnelStep {
  id: string;
  order: number;
  name: string;
  eventType: EventType;
  urlPattern?: string;
  properties?: Record<string, unknown>;
}

export interface FunnelStepResult {
  stepName: string;
  count: number;
  /** Conversion from the immediately preceding step (100% for first step) */
  conversionRate: number;
  /** 100 - conversionRate */
  dropOffRate: number;
}

export interface FunnelDefinitionProps {
  id: string;
  name: string;
  description?: string;
  steps: FunnelStep[];
  status: FunnelStatus;
  /** Max hours for a session to complete the full funnel. Default 24. */
  windowHours: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class FunnelDefinition {
  constructor(private readonly props: FunnelDefinitionProps) {
    if (!props.id)        throw new Error("id is required");
    if (!props.name)      throw new Error("name is required");
    if (!props.createdBy) throw new Error("createdBy is required");
    if (props.steps.length < 2)
      throw new Error("funnel requires at least 2 steps");
    if (props.windowHours < 1)
      throw new Error("windowHours must be >= 1");
    const orders = props.steps.map(s => s.order);
    if (new Set(orders).size !== orders.length)
      throw new Error("step orders must be unique");
    const ids = props.steps.map(s => s.id);
    if (new Set(ids).size !== ids.length)
      throw new Error("step ids must be unique");
  }

  get id()          { return this.props.id; }
  get name()        { return this.props.name; }
  get description() { return this.props.description; }
  get status()      { return this.props.status; }
  get windowHours() { return this.props.windowHours; }
  get createdBy()   { return this.props.createdBy; }
  get createdAt()   { return this.props.createdAt; }
  get updatedAt()   { return this.props.updatedAt; }
  get steps()       { return this.sortedSteps(); }

  stepCount(): number { return this.props.steps.length; }
  isActive():  boolean { return this.props.status === "active"; }

  sortedSteps(): FunnelStep[] {
    return [...this.props.steps].sort((a, b) => a.order - b.order);
  }

  hasStep(stepId: string): boolean {
    return this.props.steps.some(s => s.id === stepId);
  }

  addStep(step: FunnelStep): FunnelDefinition {
    const orders = this.props.steps.map(s => s.order);
    const ids    = this.props.steps.map(s => s.id);
    if (orders.includes(step.order)) throw new Error("step order already exists");
    if (ids.includes(step.id))       throw new Error("step id already exists");
    return new FunnelDefinition({ ...this.props, steps: [...this.props.steps, step] });
  }

  removeStep(stepId: string): FunnelDefinition {
    const remaining = this.props.steps.filter(s => s.id !== stepId);
    if (remaining.length < 2)
      throw new Error("funnel must retain at least 2 steps");
    return new FunnelDefinition({ ...this.props, steps: remaining });
  }

  /**
   * Given raw step counts (in sorted step order), compute per-step results.
   * stepCounts[i] = number of sessions that reached step i.
   */
  calculateResults(stepCounts: number[]): FunnelStepResult[] {
    if (stepCounts.length !== this.props.steps.length)
      throw new Error("stepCounts length must match the number of funnel steps");
    if (stepCounts.some(c => c < 0))
      throw new Error("stepCounts values must be >= 0");

    const sorted = this.sortedSteps();
    return sorted.map((step, i) => {
      const count = stepCounts[i];
      const prev  = i === 0 ? stepCounts[0] : stepCounts[i - 1];
      const conv  = (i === 0 || prev === 0) ? 100 : Math.round((count / prev) * 1000) / 10;
      return {
        stepName: step.name,
        count,
        conversionRate: conv,
        dropOffRate: Math.round((100 - conv) * 10) / 10,
      };
    });
  }

  overallConversionRate(stepCounts: number[]): number {
    if (stepCounts.length === 0) return 0;
    const first = stepCounts[0];
    const last  = stepCounts[stepCounts.length - 1];
    return first > 0 ? Math.round((last / first) * 1000) / 10 : 0;
  }

  publish(at: Date): FunnelDefinition {
    return new FunnelDefinition({ ...this.props, status: "active", updatedAt: at });
  }

  pause(at: Date): FunnelDefinition {
    if (this.props.status !== "active") throw new Error("only active funnels can be paused");
    return new FunnelDefinition({ ...this.props, status: "paused", updatedAt: at });
  }

  resume(at: Date): FunnelDefinition {
    if (this.props.status !== "paused") throw new Error("only paused funnels can be resumed");
    return new FunnelDefinition({ ...this.props, status: "active", updatedAt: at });
  }

  archive(at: Date): FunnelDefinition {
    if (this.props.status === "archived") throw new Error("already archived");
    return new FunnelDefinition({ ...this.props, status: "archived", updatedAt: at });
  }

  updateWindow(hours: number, at: Date): FunnelDefinition {
    if (hours < 1) throw new Error("windowHours must be >= 1");
    return new FunnelDefinition({ ...this.props, windowHours: hours, updatedAt: at });
  }
}
