export function toNumberArrayFromSetcode(
  value: number | bigint | string,
): number[] {
  let raw: bigint;

  if (typeof value === 'bigint') {
    raw = value;
  } else if (typeof value === 'string') {
    // sqlite / sql.js may return big integers as strings when bound that way
    raw = BigInt(value);
  } else {
    // sql.js returns JS number for INTEGER columns. For large 64-bit values
    // this may exceed Number.MAX_SAFE_INTEGER, but we still prefer to treat
    // it as a 64-bit unsigned integer instead of truncating to 32 bits.
    if (!Number.isFinite(value)) {
      return [];
    }
    // Negative values are not expected for setcode, but in case they appear,
    // normalise them to unsigned 32-bit before widening to bigint.
    if (value < 0) {
      raw = BigInt((value >>> 0) >>> 0);
    } else {
      raw = BigInt(value);
    }
  }

  const list: number[] = [];
  while (raw !== 0n && list.length < 16) {
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
  const length = Math.min(list.length, 16);
  for (let i = 0; i < length; i++) {
    const chunk = BigInt(list[i] ?? 0) & 0xffffn;
    raw |= chunk << BigInt(16 * i);
  }
  return raw;
}
