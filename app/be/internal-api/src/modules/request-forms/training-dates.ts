const jakartaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
});

export function trainingDates(values: Array<Date | string>): string {
  const dates = values.map((value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = jakartaDate.formatToParts(date);
    const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }).filter((date): date is string => date !== null);
  return [...new Set(dates)].sort().join(",");
}
