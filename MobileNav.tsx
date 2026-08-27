"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/prospects", label: "Prospects" },
  { href: "/prospects/import", label: "Import" },
  { href: "/approvals", label: "Approvals" },
  { href: "/send", label: "Send Queue" },
  { href: "/pipeline", label: "Pipeline" },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <div className="md:hidden sticky top-0 z-20 bg-[#001630] text-white">
      <div className="px-4 py-3 text-[#c9a95a] font-semibold">Bosch Baking</div>
      <nav className="flex overflow-x-auto scrollbar-thin border-t border-white/10">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2.5 text-sm whitespace-nowrap ${
                active
                  ? "text-[#c9a95a] border-b-2 border-[#c9a95a] font-medium"
                  : "text-white/70"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
