import { CdbFindOperator, CdbFindValue } from '../types';

export const Not = <T>(value: CdbFindValue<T>): CdbFindOperator<T> => ({
  __op: 'Not',
  value,
});

export const LessThan = <T>(value: T): CdbFindOperator<T> => ({
  __op: 'LessThan',
  value,
});

export const MoreThan = <T>(value: T): CdbFindOperator<T> => ({
  __op: 'MoreThan',
  value,
});

export const LessThanOrEqual = <T>(value: T): CdbFindOperator<T> => ({
  __op: 'LessThanOrEqual',
  value,
});

export const MoreThanOrEqual = <T>(value: T): CdbFindOperator<T> => ({
  __op: 'MoreThanOrEqual',
  value,
});

export const And = <T>(
  ...values: Array<CdbFindValue<T> | CdbFindValue<T>[]>
): CdbFindOperator<T> => {
  const list: Array<CdbFindValue<T>> = [];
  for (const item of values) {
    if (Array.isArray(item)) {
      list.push(...item);
    } else {
      list.push(item);
    }
  }
  return { __op: 'And', values: list };
};

export const Or = <T>(
  ...values: Array<CdbFindValue<T> | CdbFindValue<T>[]>
): CdbFindOperator<T> => {
  const list: Array<CdbFindValue<T>> = [];
  for (const item of values) {
    if (Array.isArray(item)) {
      list.push(...item);
    } else {
      list.push(item);
    }
  }
  return { __op: 'Or', values: list };
};

export const HasBit = <T>(value: T): CdbFindOperator<T> => ({
  __op: 'HasBit',
  value,
});

export const HasAllBits = <T>(value: T): CdbFindOperator<T> => ({
  __op: 'HasAllBits',
  value,
});
