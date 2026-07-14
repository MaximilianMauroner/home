const formatStableDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default function RelativeDate({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{formatStableDate(date)}</time>;
}
