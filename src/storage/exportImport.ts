import type { LogicalDay, SaveFile } from '../domain/types';
import { MigrationError, migrate } from './migrate';

export function exportFileName(today: LogicalDay): string {
  return `workout-buddy-${today}.json`;
}

export function serialize(save: SaveFile): string {
  return JSON.stringify(save, null, 2);
}

/** Parses an export file. Throws MigrationError with a user-facing message. */
export function parseImport(text: string): SaveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MigrationError('That file is not valid JSON.');
  }
  return migrate(raw);
}
