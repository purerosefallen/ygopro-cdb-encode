const SETCODE_BITS = 64;
const SETCODE_CHUNKS = SETCODE_BITS / 16;
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function normalizeSetcodeValue(value: number | bigint | string): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'string') {
    return BigInt(value);
  }
  if (!Number.isFinite(value)) {
    return 0n;
  }
  return BigInt(Math.trunc(value));
}

export function toNumberArrayFromSetcode(
  value: number | bigint | string,
): number[] {
  let raw = BigInt.asUintN(SETCODE_BITS, normalizeSetcodeValue(value));

  const list: number[] = [];
  while (raw !== 0n && list.length < SETCODE_CHUNKS) {
    const chunk = raw & 0xffffn;
    if (chunk !== 0n) {
      list.push(Number(chunk));
    }
    raw >>= 16n;
  }
  return list;
}

export function toSetcodeFromNumberArray(list: number[]): bigint {
  let raw = 0n;
  const length = Math.min(list.length, SETCODE_CHUNKS);
  for (let i = 0; i < length; i++) {
    const chunk = BigInt(list[i] ?? 0) & 0xffffn;
    raw |= chunk << BigInt(16 * i);
  }
  return BigInt.asUintN(SETCODE_BITS, raw);
}

export function toSqliteIntegerFromSetcode(
  value: number | bigint | string,
): number | string {
  const raw = BigInt.asUintN(SETCODE_BITS, normalizeSetcodeValue(value));
  const signed = BigInt.asIntN(SETCODE_BITS, raw);
  if (MIN_SAFE_BIGINT <= signed && signed <= MAX_SAFE_BIGINT) {
    return Number(signed);
  }
  return signed.toString();
}
