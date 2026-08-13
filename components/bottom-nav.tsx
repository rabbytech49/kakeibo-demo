"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "入力",
    match: ["/"],
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l12.682-12.68z"
      />
    ),
  },
  {
    href: "/list",
    label: "一覧",
    match: ["/list", "/items"],
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    ),
  },
  {
    href: "/more",
    label: "その他",
    match: ["/more", "/stats", "/credit", "/balance"],
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm6 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm6 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-white/5 bg-surface/75 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2">
        {TABS.map((tab) => {
          const active = tab.match.some((m) =>
            m === "/" ? pathname === "/" : pathname.startsWith(m)
          );
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="active-scale flex flex-col items-center justify-center gap-1"
            >
              <span
                className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-200 ${
                  active
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.6 : 2.2}
                  className="h-6 w-6"
                  aria-hidden
                >
                  {tab.icon}
                </svg>
              </span>
              <span
                className={`font-label text-[11px] tracking-wide ${
                  active ? "font-bold text-on-surface" : "text-on-surface-variant"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
