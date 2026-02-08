import { SqlJsStatic } from "sql.js";

export function isSqlJsStatic(value: unknown): value is SqlJsStatic {
  return !!value && typeof (value as SqlJsStatic).Database === 'function';
}
