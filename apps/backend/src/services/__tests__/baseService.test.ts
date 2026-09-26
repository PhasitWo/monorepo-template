import { BaseService } from '../baseService';

class Probe extends BaseService {
  where(filters: Parameters<BaseService['transformToWhereClause']>[0]) {
    return this.transformToWhereClause<{ n: number; s: string; d: Date; b: boolean }>(filters, {
      n: this.transformToNumberWhereClause,
      s: this.transformToStringWhereClause,
      d: this.transformToDateWhereClause,
      b: this.transformToDropdownWhereClause,
    });
  }
  page(params: Parameters<BaseService['pageArgs']>[0]) {
    return this.pageArgs(params);
  }
}

describe('BaseService', () => {
  const probe = new Probe();
  const one = (f: string, o: string, v1: unknown, v2: unknown = null) =>
    (probe.where([{ f, o, v1, v2 } as never]) as { AND: object[] }).AND[0];

  describe('pageArgs', () => {
    it('turns page and pageSize into skip/take', () => {
      expect(probe.page({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
    });

    it('defaults to the first page of the default size', () => {
      expect(probe.page({})).toEqual({ skip: 0, take: 20 });
    });

    it('returns no paging when all=true', () => {
      expect(probe.page({ page: 3, pageSize: 10, all: true })).toEqual({});
    });
  });

  describe('filter transforms', () => {
    it.each([
      ['n', 'eq', 1, { n: 1 }],
      ['n', 'neq', 1, { n: { not: 1 } }],
      ['n', 'gt', 1, { n: { gt: 1 } }],
      ['n', 'gte', 1, { n: { gte: 1 } }],
      ['n', 'lt', 1, { n: { lt: 1 } }],
      ['n', 'lte', 1, { n: { lte: 1 } }],
      ['s', 'eq', 'a', { s: 'a' }],
      ['s', 'neq', 'a', { s: { not: 'a' } }],
      ['s', 'ct', 'a', { s: { contains: 'a', mode: 'insensitive' } }],
      ['s', 'nct', 'a', { s: { not: { contains: 'a', mode: 'insensitive' } } }],
      ['s', 'sw', 'a', { s: { startsWith: 'a', mode: 'insensitive' } }],
      ['s', 'nsw', 'a', { s: { not: { startsWith: 'a', mode: 'insensitive' } } }],
      ['s', 'ew', 'a', { s: { endsWith: 'a', mode: 'insensitive' } }],
      ['s', 'new', 'a', { s: { not: { endsWith: 'a', mode: 'insensitive' } } }],
      ['b', 'eq', true, { b: true }],
      ['b', 'neq', true, { b: { not: true } }],
    ])('%s %s %p', (f, o, v1, expected) => {
      expect(one(f, o, v1)).toEqual(expected);
    });

    it('date operators cover whole days', () => {
      const day = '2026-01-15T10:00:00.000Z';
      const eq = one('d', 'eq', day) as { d: { gte: Date; lte: Date } };

      expect(eq.d.gte.getHours()).toBe(0);
      expect(eq.d.lte.getHours()).toBe(23);
      expect(Object.keys(one('d', 'neq', day))).toEqual(['d']);
      expect(one('d', 'bf', day)).toEqual({ d: { lt: expect.any(Date) } });
      expect(one('d', 'af', day)).toEqual({ d: { gte: expect.any(Date) } });
      expect(one('d', 'btw', day, '2026-01-20T00:00:00.000Z')).toEqual({
        d: { gte: expect.any(Date), lte: expect.any(Date) },
      });
      expect(one('d', 'nbtw', day, '2026-01-20T00:00:00.000Z')).toEqual({ d: { not: expect.any(Object) } });
    });

    it('returns an empty clause without filters and rejects bad fields, operators or values', () => {
      expect(probe.where(undefined)).toEqual({});
      expect(() => one('x', 'eq', 1)).toThrow('Unsupported filter field: x');
      expect(() => one('n', 'ct', 1)).toThrow('Unsupported operator');
      expect(() => one('s', 'gt', 'a')).toThrow('Unsupported operator');
      expect(() => one('b', 'gt', true)).toThrow('Unsupported operator');
      expect(() => one('d', 'gt', '2026-01-01')).toThrow('Unsupported operator');
      expect(() => one('d', 'eq', 5)).toThrow('Invalid value type');
      expect(() => one('d', 'btw', '2026-01-01', null)).toThrow('Invalid value type');
    });
  });
});
