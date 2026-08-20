import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  Car,
  ShieldCheck,
  Leaf,
  Users,
  ArrowRight,
  TrendingDown,
  Building2,
  Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    if (session.user.role === "admin") {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top Corporate Header */}
      <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 px-6 md:px-12 bg-white">
        <div className="flex items-center gap-2.5">
          <img
            src="/images/commutex-logo.png"
            alt="CommuteX"
            className="h-9 w-auto object-contain rounded-md"
          />
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-slate-900 leading-tight flex items-center">
              COMMUTE<span className="text-emerald-600">X</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Corporate Commute
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="font-medium text-slate-700">
              Employee Login
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              Register Account
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden bg-slate-900 py-20 px-6 text-white md:py-28 md:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-6">
              <Building2 className="h-3.5 w-3.5" /> Corporate Campus Mobility Platform
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl max-w-3xl mx-auto leading-tight">
              Smart Carpooling for the Modern{" "}
              <span className="text-emerald-400">Corporate Campus</span>
            </h1>

            <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed">
              Connect with colleagues commuting along your route. Share empty vehicle seats,
              cut daily commute expenses, and contribute to measurable carbon reduction.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-8">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:text-white"
                >
                  Sign In with Work Email
                </Button>
              </Link>
            </div>

            {/* Impact Highlights */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-800 pt-10 text-left">
              <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="text-emerald-400 mb-2">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div className="text-xl font-bold text-white">40%+</div>
                <div className="text-xs text-slate-400 mt-0.5">Commute Cost Savings</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="text-emerald-400 mb-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="text-xl font-bold text-white">100%</div>
                <div className="text-xs text-slate-400 mt-0.5">Verified Employees</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="text-emerald-400 mb-2">
                  <Leaf className="h-5 w-5" />
                </div>
                <div className="text-xl font-bold text-white">Measurable</div>
                <div className="text-xs text-slate-400 mt-0.5">CO₂ & Fuel Savings</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="text-emerald-400 mb-2">
                  <Route className="h-5 w-5" />
                </div>
                <div className="text-xl font-bold text-white">Optimized</div>
                <div className="text-xs text-slate-400 mt-0.5">Live Route Matching</div>
              </div>
            </div>
          </div>
        </section>

        {/* Corporate Pillars */}
        <section className="py-16 px-6 md:px-12 bg-slate-50">
          <div className="mx-auto max-w-5xl">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Designed Around the Corporate Campus Commute
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                A closed-loop platform bringing employees, drivers, and daily commute routes into one seamless system.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 mb-4">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Verified Employee Identity</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Only employees registered with corporate emails and valid employee IDs can offer and request rides, ensuring complete trust and safety.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mb-4">
                  <Car className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Driver & Passenger Modes</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Register your vehicle to offer empty seats or search for available colleagues travelling from your neighborhood to campus.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 mb-4">
                  <Leaf className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Eco-Friendly Commutes</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Every shared ride directly cuts down single-occupancy vehicles, reducing morning traffic congestion and corporate carbon emissions.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500 bg-white">
        <p>© 2026 CommuteX — Corporate Ride Sharing & Mobility System. All rights reserved.</p>
      </footer>
    </div>
  );
}
