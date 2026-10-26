// Accept ISO calendar dates or timestamps, never locale-dependent date text.
export function normalizeCalendarDates(values: readonly unknown[]): string[] {
  const dates = values.flatMap((value) => {
    if (typeof value !== "string") return [];
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/.exec(value.trim());
    if (!match) return [];
    const [, year, month, day] = match;
    const iso = `${year}-${month}-${day}`;
    const parsed = new Date(`${iso}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return [];
    return [iso];
  });
  return [...new Set(dates)].sort();
}
