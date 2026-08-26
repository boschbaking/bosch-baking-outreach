"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001630] px-4">
      <div className="w-full max-w-sm bg-white rounded-md shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="text-[#001630] font-semibold text-2xl tracking-wide">
            Bosch Baking
          </div>
          <div className="text-[#c9a95a] text-sm mt-1 font-medium">Outreach</div>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-sm text-neutral-700">
              Check <span className="font-medium">{email}</span> for a sign-in link.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-[#001630] underline underline-offset-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Work email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="brandon@boschbaking.com"
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a95a]"
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#001630] text-white rounded py-2 text-sm font-medium hover:bg-[#0a2e57] transition-colors disabled:opacity-60"
            >
              {loading ? "Sending link..." : "Send sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
