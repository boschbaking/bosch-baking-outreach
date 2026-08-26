"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Upload,
  CheckSquare,
  Kanban,
  Send,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospects", label: "Prospects", icon: Users },
  { href: "/prospects/import", label: "Import CSV", icon: Upload },
  { href: "/approvals", label: "Approval Queue", icon: CheckSquare },
  { href: "/send", label: "Send Queue", icon: Send },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col bg-[#001630] text-white shrink-0">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="text-[#c9a95a] font-semibold tracking-wide text-lg leading-tight">
          Bosch Baking
        </div>
        <div className="text-white/50 text-xs mt-0.5">Outreach</div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[#c9a95a] text-[#001630] font-medium"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
