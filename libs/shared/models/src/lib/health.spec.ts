import { HealthResponseSchema } from './health';

describe('HealthResponseSchema', () => {
  const valid = {
    status: 'ok',
    db: 'up',
    uptimeSeconds: 12.5,
    timestamp: new Date().toISOString(),
    version: '0.0.0',
  };

  it('accepts a valid health payload', () => {
    expect(HealthResponseSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an unknown db status', () => {
    const result = HealthResponseSchema.safeParse({ ...valid, db: 'maybe' });
    expect(result.success).toBe(false);
  });
});
