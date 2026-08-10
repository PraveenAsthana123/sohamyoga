import { describe, it, expect } from '@jest/globals';
import { ChatBot } from '../../../domain/chat/ChatBot';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function makeBot(overrides: Partial<ConstructorParameters<typeof ChatBot>[0]> = {}): ChatBot {
  return new ChatBot({
    id: 'bot-1',
    name: 'SohamYoga Assistant',
    botType: 'llm',
    status: 'inactive',
    model: 'llama3',
    systemPrompt: 'You are a helpful yoga assistant.',
    handoffTriggers: [],
    maxTurns: 20,
    temperature: 0.7,
    responseTimeoutMs: 5000,
    confidenceThreshold: 0.6,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('ChatBot — construction', () => {
  it('creates a valid bot', () => {
    const b = makeBot();
    expect(b.id).toBe('bot-1');
    expect(b.botType).toBe('llm');
    expect(b.temperature).toBe(0.7);
    expect(b.isActive()).toBe(false);
  });

  it('throws when id is missing', () => {
    expect(() => makeBot({ id: '' })).toThrow('id is required');
  });

  it('throws when name is missing', () => {
    expect(() => makeBot({ name: '' })).toThrow('name is required');
  });

  it('throws when systemPrompt is missing', () => {
    expect(() => makeBot({ systemPrompt: '' })).toThrow('systemPrompt is required');
  });

  it('throws when maxTurns < 1', () => {
    expect(() => makeBot({ maxTurns: 0 })).toThrow('at least 1');
  });

  it('throws when temperature out of range', () => {
    expect(() => makeBot({ temperature: 1.1 })).toThrow('temperature must be 0-1');
    expect(() => makeBot({ temperature: -0.1 })).toThrow('temperature must be 0-1');
  });

  it('accepts temperature at boundary values', () => {
    expect(() => makeBot({ temperature: 0 })).not.toThrow();
    expect(() => makeBot({ temperature: 1 })).not.toThrow();
  });

  it('throws when confidenceThreshold out of range', () => {
    expect(() => makeBot({ confidenceThreshold: -0.1 })).toThrow('confidenceThreshold must be 0-1');
    expect(() => makeBot({ confidenceThreshold: 1.1 })).toThrow('confidenceThreshold must be 0-1');
  });

  it('throws when responseTimeoutMs < 100', () => {
    expect(() => makeBot({ responseTimeoutMs: 99 })).toThrow('at least 100');
  });
});

// ── shouldHandoff() ───────────────────────────────────────────────────────────

describe('shouldHandoff()', () => {
  it('returns true when confidence is below threshold', () => {
    expect(makeBot({ confidenceThreshold: 0.6 }).shouldHandoff(0.5)).toBe(true);
  });

  it('returns false when confidence meets threshold', () => {
    expect(makeBot({ confidenceThreshold: 0.6 }).shouldHandoff(0.6)).toBe(false);
  });

  it('returns false when confidence exceeds threshold', () => {
    expect(makeBot({ confidenceThreshold: 0.6 }).shouldHandoff(0.9)).toBe(false);
  });
});

// ── activate() / deactivate() ─────────────────────────────────────────────────

describe('activate()', () => {
  it('sets status to active from inactive', () => {
    expect(makeBot({ status: 'inactive' }).activate(LATER).status).toBe('active');
  });

  it('throws when already active', () => {
    expect(() => makeBot({ status: 'active' }).activate(LATER)).toThrow('already active');
  });

  it('throws when training', () => {
    expect(() => makeBot({ status: 'training' }).activate(LATER)).toThrow('cannot activate a bot that is training');
  });

  it('does not mutate original', () => {
    const b = makeBot();
    b.activate(LATER);
    expect(b.isActive()).toBe(false);
  });
});

describe('deactivate()', () => {
  it('sets status to inactive from active', () => {
    expect(makeBot({ status: 'active' }).deactivate(LATER).status).toBe('inactive');
  });

  it('sets status to inactive from training', () => {
    expect(makeBot({ status: 'training' }).deactivate(LATER).status).toBe('inactive');
  });

  it('throws when already inactive', () => {
    expect(() => makeBot({ status: 'inactive' }).deactivate(LATER)).toThrow('already inactive');
  });
});

describe('startTraining()', () => {
  it('sets status to training', () => {
    expect(makeBot({ status: 'inactive' }).startTraining(LATER).status).toBe('training');
    expect(makeBot({ status: 'active'   }).startTraining(LATER).status).toBe('training');
  });

  it('throws when already training', () => {
    expect(() => makeBot({ status: 'training' }).startTraining(LATER)).toThrow('already training');
  });
});

// ── updatePrompt() ────────────────────────────────────────────────────────────

describe('updatePrompt()', () => {
  it('updates the system prompt', () => {
    const b = makeBot().updatePrompt('New prompt for yoga.', LATER);
    expect(b.systemPrompt).toBe('New prompt for yoga.');
  });

  it('throws when prompt is empty', () => {
    expect(() => makeBot().updatePrompt('   ', LATER)).toThrow('cannot be empty');
  });

  it('does not mutate original', () => {
    const b = makeBot();
    b.updatePrompt('new', LATER);
    expect(b.systemPrompt).toBe('You are a helpful yoga assistant.');
  });
});

// ── setModel() ────────────────────────────────────────────────────────────────

describe('setModel()', () => {
  it('sets the model', () => {
    expect(makeBot().setModel('mistral', LATER).model).toBe('mistral');
  });

  it('throws when model is empty', () => {
    expect(() => makeBot().setModel('   ', LATER)).toThrow('cannot be empty');
  });
});

// ── setTemperature() ──────────────────────────────────────────────────────────

describe('setTemperature()', () => {
  it('updates temperature', () => {
    expect(makeBot().setTemperature(0.3, LATER).temperature).toBe(0.3);
  });

  it('accepts boundary values', () => {
    expect(makeBot().setTemperature(0, LATER).temperature).toBe(0);
    expect(makeBot().setTemperature(1, LATER).temperature).toBe(1);
  });

  it('throws out of range', () => {
    expect(() => makeBot().setTemperature(1.5, LATER)).toThrow('temperature must be 0-1');
  });
});

// ── setConfidenceThreshold() ──────────────────────────────────────────────────

describe('setConfidenceThreshold()', () => {
  it('updates threshold', () => {
    expect(makeBot().setConfidenceThreshold(0.8, LATER).confidenceThreshold).toBe(0.8);
  });

  it('throws out of range', () => {
    expect(() => makeBot().setConfidenceThreshold(1.1, LATER)).toThrow('confidenceThreshold must be 0-1');
  });
});

// ── handoffTriggers ───────────────────────────────────────────────────────────

describe('addHandoffTrigger() / removeHandoffTrigger()', () => {
  it('adds a trigger', () => {
    const b = makeBot().addHandoffTrigger('speak to human', LATER);
    expect(b.handoffTriggers).toContain('speak to human');
  });

  it('throws on empty trigger', () => {
    expect(() => makeBot().addHandoffTrigger('   ', LATER)).toThrow('cannot be empty');
  });

  it('throws on duplicate trigger', () => {
    const b = makeBot({ handoffTriggers: ['cancel'] });
    expect(() => b.addHandoffTrigger('cancel', LATER)).toThrow('already exists');
  });

  it('removes a trigger', () => {
    const b = makeBot({ handoffTriggers: ['cancel', 'speak to human'] }).removeHandoffTrigger('cancel', LATER);
    expect(b.handoffTriggers).not.toContain('cancel');
    expect(b.handoffTriggers).toContain('speak to human');
  });

  it('throws when trigger not found', () => {
    expect(() => makeBot().removeHandoffTrigger('ghost', LATER)).toThrow('not found');
  });

  it('handoffTriggers is defensive copy', () => {
    const b = makeBot({ handoffTriggers: ['cancel'] });
    b.handoffTriggers.push('spy');
    expect(b.handoffTriggers).toEqual(['cancel']);
  });
});

// ── BotType variety ───────────────────────────────────────────────────────────

describe('BotType', () => {
  const types = ['rule_based', 'llm', 'rag', 'hybrid'] as const;
  it.each(types)('accepts botType %s', type => {
    expect(() => makeBot({ botType: type })).not.toThrow();
    expect(makeBot({ botType: type }).botType).toBe(type);
  });
});
