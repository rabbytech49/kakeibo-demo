import Link from "next/link";
import { addMonths, formatMonth } from "@/lib/date";

export default function MonthSwitcher({
  month,
  basePath,
}: {
  month: string;
  basePath: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <Link
        href={`${basePath}?month=${addMonths(month, -1)}`}
        className="active-scale rounded-full bg-surface-container px-4 py-1.5 text-sm text-on-surface-variant"
        aria-label="前の月"
      >
        ← 前月
      </Link>
      <span className="font-display text-lg font-bold">{formatMonth(month)}</span>
      <Link
        href={`${basePath}?month=${addMonths(month, 1)}`}
        className="active-scale rounded-full bg-surface-container px-4 py-1.5 text-sm text-on-surface-variant"
        aria-label="次の月"
      >
        翌月 →
      </Link>
    </div>
  );
}
