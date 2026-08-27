import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

// No global Proxy/Middleware in this app (see proxy.ts removal) — every
// authenticated route lives under this one shared layout, so gating access
// here covers all of them just as well, without Netlify's Edge Function
// bundling step (which has an unresolved Windows path bug as of this
// writing) ever coming into play.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
