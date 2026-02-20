import { OcgcoreCommonConstants } from 'ygopro-msg-encode';
import {
  CdbFindFilter,
  CdbFindOperator,
  CdbFindVirtualFields,
  CdbSqljsRow,
  CdbSqljsRowData,
  CdbSqljsRowText,
} from '../types';

const DATA_FIELDS: (keyof CdbSqljsRowData)[] = [
  'id',
  'ot',
  'alias',
  'setcode',
  'type',
  'atk',
  'def',
  'level',
  'race',
  'attribute',
  'category',
];

const TEXT_FIELDS: (keyof CdbSqljsRowText)[] = [
  'name',
  'desc',
  'str1',
  'str2',
  'str3',
  'str4',
  'str5',
  'str6',
  'str7',
  'str8',
  'str9',
  'str10',
  'str11',
  'str12',
  'str13',
  'str14',
  'str15',
  'str16',
];

type PredicateBuildContext = {
  params: Record<string, any>;
  nextParamId: number;
};

type BuildCdbFilterOptions = {
  noTexts?: boolean;
};

const isFindOperator = (value: unknown): value is CdbFindOperator => {
  return (
    !!value &&
    typeof value === 'object' &&
    '__op' in (value as Record<string, unknown>)
  );
};

const isPlainValue = (value: unknown) =>
  value === null || value === undefined || !isFindOperator(value);

const areAllPlainValues = (values: unknown[]) =>
  values.every((value) => isPlainValue(value));

const allPlainValuesEqual = (values: unknown[]) => {
  if (values.length <= 1) return true;
  const first = values[0];
  return values.every((value) => value === first);
};

const isTextKey = (key: keyof CdbSqljsRow) =>
  TEXT_FIELDS.includes(key as keyof CdbSqljsRowText);

const TYPE_LINK = OcgcoreCommonConstants.TYPE_LINK >>> 0;

const getColumnExpr = (
  key: keyof (CdbSqljsRow & CdbFindVirtualFields),
  options?: BuildCdbFilterOptions,
): string => {
  switch (key) {
    case 'code':
      return 'datas.id';
    case 'level':
      return '(datas.level & 255)';
    case 'rawLevel':
      return 'datas.level';
    case 'lscale':
      return '((datas.level >> 24) & 255)';
    case 'rscale':
      return '((datas.level >> 16) & 255)';
    case 'linkMarker':
      return `CASE WHEN (datas.type & ${TYPE_LINK}) != 0 THEN datas.def ELSE NULL END`;
    case 'rawDefense':
      return 'datas.def';
    case 'defense':
      return `CASE WHEN (datas.type & ${TYPE_LINK}) != 0 THEN NULL ELSE datas.def END`;
    default:
      if (options?.noTexts && isTextKey(key as keyof CdbSqljsRow)) {
        throw new Error(
          `Text field "${String(key)}" is not available in noTexts mode`,
        );
      }
      return isTextKey(key as keyof CdbSqljsRow)
        ? `texts.${String(key)}`
        : `datas.${String(key)}`;
  }
};

const addParam = (ctx: PredicateBuildContext, value: any) => {
  const key = `p${ctx.nextParamId++}`;
  ctx.params[key] = value;
  return `:${key}`;
};

const buildPredicate = (
  column: string,
  value: unknown,
  ctx: PredicateBuildContext,
): string => {
  if (isFindOperator(value)) {
    const op = value.__op;
    switch (op) {
      case 'Not': {
        if (value.value === undefined) return '1=1';
        if (value.value === null) {
          return `${column} IS NOT NULL`;
        }
        if (isFindOperator(value.value)) {
          switch (value.value.__op) {
            case 'Not':
              return buildPredicate(column, value.value.value, ctx);
            /* 
            // it's not same in SQL so we don't do this optimization
            case 'LessThan':
              return buildPredicate(
                column,
                {
                  __op: 'MoreThanOrEqual',
                  value: value.value.value,
                },
                ctx,
              );
            case 'MoreThan':
              return buildPredicate(
                column,
                {
                  __op: 'LessThanOrEqual',
                  value: value.value.value,
                },
                ctx,
              );
            case 'LessThanOrEqual':
              return buildPredicate(
                column,
                {
                  __op: 'MoreThan',
                  value: value.value.value,
                },
                ctx,
              );
            case 'MoreThanOrEqual':
              return buildPredicate(
                column,
                {
                  __op: 'LessThan',
                  value: value.value.value,
                },
                ctx,
              );*/
            default:
              break;
          }
        }
        if (isPlainValue(value.value)) {
          const param = addParam(ctx, value.value);
          return `${column} != ${param}`;
        }
        const inner = buildPredicate(column, value.value, ctx);
        return `NOT (${inner})`;
      }
      case 'LessThan': {
        const param = addParam(ctx, value.value);
        return `${column} < ${param}`;
      }
      case 'MoreThan': {
        const param = addParam(ctx, value.value);
        return `${column} > ${param}`;
      }
      case 'LessThanOrEqual': {
        const param = addParam(ctx, value.value);
        return `${column} <= ${param}`;
      }
      case 'MoreThanOrEqual': {
        const param = addParam(ctx, value.value);
        return `${column} >= ${param}`;
      }
      case 'HasBit': {
        const param = addParam(ctx, value.value);
        return `${column} & ${param} != 0`;
      }
      case 'HasAllBits': {
        const param = addParam(ctx, value.value);
        return `${column} & ${param} = ${param}`;
      }
      case 'And': {
        const values = value.values ?? [];
        if (values.length === 0) return '1=1';
        if (areAllPlainValues(values)) {
          if (!allPlainValuesEqual(values)) {
            return '1=0';
          }
          return buildPredicate(column, values[0], ctx);
        }
        return values
          .map((item) => `(${buildPredicate(column, item, ctx)})`)
          .join(' AND ');
      }
      case 'Or': {
        const values = value.values ?? [];
        if (values.length === 0) return '1=0';
        if (areAllPlainValues(values)) {
          if (values.length === 1) {
            return buildPredicate(column, values[0], ctx);
          }
          const params = values.map((item) => addParam(ctx, item));
          return `${column} IN (${params.join(', ')})`;
        }
        return values
          .map((item) => `(${buildPredicate(column, item, ctx)})`)
          .join(' OR ');
      }
      default:
        return '1=1';
    }
  }

  if (value === null) {
    return `${column} IS NULL`;
  }
  const param = addParam(ctx, value);
  return `${column} = ${param}`;
};

export function buildCdbFilterStmt(
  filter: CdbFindFilter,
  options?: BuildCdbFilterOptions,
) {
  const clauses: string[] = [];
  const ctx: PredicateBuildContext = {
    params: {},
    nextParamId: 0,
  };
  for (const [rawKey, value] of Object.entries(filter)) {
    if (value === undefined) continue;
    const key = rawKey as keyof (CdbSqljsRow & CdbFindVirtualFields);
    const column = getColumnExpr(key, options);
    clauses.push(buildPredicate(column, value, ctx));
  }
  return { stmt: clauses.join(' AND '), params: ctx.params };
}

export function normalizeCdbParams(params: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const normalizedKey =
      key.startsWith(':') || key.startsWith('$') || key.startsWith('@')
        ? key
        : `:${key}`;
    if (typeof value === 'bigint') {
      if (value <= BigInt(Number.MAX_SAFE_INTEGER)) {
        result[normalizedKey] = Number(value);
      } else {
        result[normalizedKey] = value.toString();
      }
    } else {
      result[normalizedKey] = value;
    }
  }
  return result;
}
