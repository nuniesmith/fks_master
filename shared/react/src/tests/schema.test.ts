import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../../shared_schema/trade_signal.schema.json';
import { TradeSignal } from '../types/trading';

// Minimal runtime validation to ensure interface remains aligned with schema for key fields.

describe('trade_signal.schema.json', () => {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema as any);

  it('accepts a valid TradeSignal sample', () => {
    const sample: TradeSignal = {
      symbol: 'BTC-USD',
      side: 'LONG',
      strength: 0.9,
      timestamp: new Date().toISOString(),
      strategy: 'momentum',
      meta: { note: 'unit-test' }
    };
    const ok = validate(sample);
    if (!ok) {
      console.error(validate.errors);
    }
    expect(ok).toBe(true);
  });

  it('rejects invalid strength', () => {
    const bad: any = {
      symbol: 'BTC-USD',
      side: 'SHORT',
      strength: 2,
      timestamp: new Date().toISOString(),
      strategy: 'x',
    };
    const ok = validate(bad);
    expect(ok).toBe(false);
  });
});
