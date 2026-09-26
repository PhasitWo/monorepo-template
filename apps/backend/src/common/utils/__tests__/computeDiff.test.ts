import { computeDiff, REDACTED } from '../computeDiff';

describe('computeDiff', () => {
  it('returns only changed fields as [old, new]', () => {
    expect(computeDiff({ name: 'a', isActive: true }, { name: 'b', isActive: true })).toEqual({ name: ['a', 'b'] });
  });

  it('returns an empty object when nothing changed', () => {
    expect(computeDiff({ name: 'a' }, { name: 'a' })).toEqual({});
  });

  it('always excludes system-managed fields', () => {
    const before = { createdAt: new Date(1), updatedAt: new Date(1), deletedAt: null, runningId: 1, runningCode: 'A' };
    const after = {
      createdAt: new Date(2),
      updatedAt: new Date(2),
      deletedAt: new Date(2),
      runningId: 2,
      runningCode: 'B',
    };
    expect(computeDiff(before, after)).toEqual({});
  });

  it('excludes extra fields passed in options', () => {
    expect(
      computeDiff({ tagName: 'a', isPaid: false }, { tagName: 'b', isPaid: true }, { exclude: ['tagName'] }),
    ).toEqual({
      isPaid: [false, true],
    });
  });

  it('compares Dates by value and serializes them as ISO strings', () => {
    const d = '2026-01-01T00:00:00.000Z';
    expect(computeDiff({ voidedAt: new Date(d) }, { voidedAt: new Date(d) })).toEqual({});
    expect(computeDiff({ voidedAt: null }, { voidedAt: new Date(d) })).toEqual({ voidedAt: [null, d] });
  });

  it('treats undefined and null as equal', () => {
    expect(computeDiff({ address: undefined }, { address: null })).toEqual({});
  });

  it('reports fields present on only one side', () => {
    expect(computeDiff({}, { name: 'x' })).toEqual({ name: [null, 'x'] });
  });

  it('redacts password always and extra redact fields', () => {
    expect(computeDiff({ password: 'old', secret: 1 }, { password: 'new', secret: 2 }, { redact: ['secret'] })).toEqual(
      {
        password: [REDACTED, REDACTED],
        secret: [REDACTED, REDACTED],
      },
    );
  });

  it('records a changed nested array as [oldItems, newItems]', () => {
    const oldItems = [{ name: 'a', quantity: 1 }];
    const newItems = [{ name: 'a', quantity: 2 }];
    expect(computeDiff({ items: oldItems }, { items: newItems })).toEqual({ items: [oldItems, newItems] });
    expect(computeDiff({ items: oldItems }, { items: [{ name: 'a', quantity: 1 }] })).toEqual({});
  });
});
