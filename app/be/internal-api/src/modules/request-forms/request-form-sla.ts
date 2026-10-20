const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const WORK_START_MINUTE = 8 * 60;
const WORK_END_MINUTE = 17 * 60;

function jakartaDate(value: Date) {
  return new Date(value.getTime() + JAKARTA_OFFSET_MS);
}

function isWorkday(local: Date, holidays: ReadonlySet<string>) {
  const weekday = local.getUTCDay();
  return weekday !== 0 && weekday !== 6 && !holidays.has(local.toISOString().slice(0, 10));
}

function atLocalWorkStart(local: Date) {
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 8) - JAKARTA_OFFSET_MS);
}

/** Adds work time within Mon-Fri 08:00-17:00 Asia/Jakarta, excluding national holidays. */
export function addRequestFormBusinessHours(start: Date, businessHours: number, holidays: ReadonlySet<string>) {
  let cursor = new Date(start);
  let remainingMs = businessHours * 60 * 60 * 1000;
  while (remainingMs > 0) {
    const local = jakartaDate(cursor);
    const minute = local.getUTCHours() * 60 + local.getUTCMinutes() + local.getUTCSeconds() / 60;
    if (!isWorkday(local, holidays) || minute >= WORK_END_MINUTE) {
      local.setUTCDate(local.getUTCDate() + 1);
      cursor = atLocalWorkStart(local);
      continue;
    }
    if (minute < WORK_START_MINUTE) {
      cursor = atLocalWorkStart(local);
      continue;
    }
    const availableMs = (WORK_END_MINUTE - minute) * 60 * 1000;
    const consumedMs = Math.min(remainingMs, availableMs);
    cursor = new Date(cursor.getTime() + consumedMs);
    remainingMs -= consumedMs;
    if (remainingMs > 0) {
      const nextLocal = jakartaDate(cursor);
      nextLocal.setUTCDate(nextLocal.getUTCDate() + 1);
      cursor = atLocalWorkStart(nextLocal);
    }
  }
  return cursor;
}
