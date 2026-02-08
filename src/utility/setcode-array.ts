export function toNumberArrayFromSetcode(value: number | bigint): number[] {
  let raw = typeof value === 'bigint' ? value : BigInt(value >>> 0);
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
