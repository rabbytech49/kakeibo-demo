import Link from "next/link";

const MENU = [
  {
    href: "/stats",
    title: "統計",
    description: "月次の収支とカテゴリ別グラフ",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.5V21h4.5v-7.5H3zm6.75-6V21h4.5V7.5h-4.5zM16.5 3v18H21V3h-4.5z"
      />
    ),
  },
  {
    href: "/credit",
    title: "クレジット管理",
    description: "引落年月別の支払額と処理ステータス",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
      />
    ),
  },
  {
    href: "/balance",
    title: "残高",
    description: "現金・IKOCCAの現在残高",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l9 4.5H3L12 3zm-7.5 4.5V18m5-10.5V18m5-10.5V18m5-10.5V18M3 21h18M3 18h18"
      />
    ),
  },
];

export default function MorePage() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-2xl font-semibold">その他</h2>
      <ul className="flex flex-col gap-3">
        {MENU.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="active-scale flex items-center gap-4 rounded-2xl bg-surface-container-low p-5"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-6 w-6 shrink-0 text-primary"
                aria-hidden
              >
                {item.icon}
              </svg>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.title}</span>
                <span className="block truncate text-xs text-on-surface-variant">
                  {item.description}
                </span>
              </span>
              <span aria-hidden className="text-outline">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
