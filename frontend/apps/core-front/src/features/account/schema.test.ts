import { describe, expect, it } from 'vitest';

import { leaveFormSchema } from './schema';

describe('leave form schema', () => {
  it('allows no withdrawal reason and rejects unknown reasons', () => {
    expect(leaveFormSchema.safeParse({ reason: '' }).success).toBe(true);
    expect(leaveFormSchema.safeParse({ reason: 'OTHER' }).success).toBe(true);
    expect(leaveFormSchema.safeParse({ reason: 'unknown' }).success).toBe(false);
  });
});
