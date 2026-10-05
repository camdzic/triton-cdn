import { type AnyColumn, sql } from 'drizzle-orm';

export function total(column: AnyColumn) {
  return sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);
}

export function aggregateRow<T>(row: T | undefined) {
  if (row === undefined) {
    throw new Error('Aggregate query returned no row');
  }

  return row;
}
