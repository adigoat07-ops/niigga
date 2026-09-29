"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface UserSession {
  userId: string;
  email: string;
  name?: string | null;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white font-bold text-lg shadow-sm transition group-hover:bg-cyan-500">
            LS
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-slate-900 text-lg">LAB SAATHI</span>
            <span className="ml-1.5 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 uppercase tracking-wider">
              Health AI
            </span>
          </div>
        </Link>

        {!isAuthPage && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/" ? "bg-slate-100 text-cyan-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Upload & Analyze
              </Link>
              <Link
                href="/history"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/history" ? "bg-slate-100 text-cyan-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                My Reports
              </Link>
            </div>

            {user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">
                    {user.name || user.email.split("@")[0]}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-rose-600 transition disabled:opacity-50"
                >
                  {isLoggingOut ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-500 transition"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
