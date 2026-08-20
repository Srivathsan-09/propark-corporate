"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Lock, Mail, Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CarLoader } from "@/components/common/CarLoader";
import { loginSchema } from "@/validations/auth.schema";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registeredMsg = searchParams.get("registered");
  const authError = searchParams.get("error");
  const prefillEmail = searchParams.get("email") || "";

  const [formData, setFormData] = useState({
    email: prefillEmail,
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const getErrorMessageForAuth = (error: string | null) => {
    if (!error) return null;
    if (error === "OAuthSignin" || error === "OAuthCallback" || error === "redirect_uri_mismatch") {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://commutex-corporate.vercel.app";
      return `Google OAuth connection error. Please ensure your Google Cloud authorized redirect URI is set to: ${origin}/api/auth/callback/google`;
    }
    if (error === "Callback" || error === "OAuthCreateAccount") {
      return "Database error during sign-in. Please ensure MONGODB_URI is set in Vercel and MongoDB Atlas IP is 0.0.0.0/0.";
    }
    if (error === "Configuration") {
      return "Server configuration error. Please ensure NEXTAUTH_SECRET and Google credentials are saved in Vercel.";
    }
    return "Authentication failed. Please verify your corporate credentials or try signing in with Google.";
  };

  const [errorMessage, setErrorMessage] = useState<string | null>(getErrorMessageForAuth(authError));
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
    if (errorMessage) setErrorMessage(null);
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      await signIn("google", { callbackUrl });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setIsGoogleLoading(false);
      setErrorMessage("Could not initiate Google sign in. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    // Validate with Zod
    const validation = loginSchema.safeParse(formData);
    if (!validation.success) {
      const formattedErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          formattedErrors[err.path[0].toString()] = err.message;
        }
      });
      setFieldErrors(formattedErrors);
      return;
    }

    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      if (!res || res.error) {
        setErrorMessage(res?.error || "Invalid email or password. Please verify your credentials.");
        setIsLoading(false);
        return;
      }

      // Success -> navigate to target or dashboard
      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      console.error("Sign in error:", err);
      setErrorMessage("An unexpected network error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-none border-0 bg-white rounded-none overflow-hidden">
      {/* Top Tab Switcher */}
      <div className="flex border-b border-slate-100 bg-slate-50 text-xs font-semibold">
        <div className="flex-1 py-3.5 text-center border-b-2 border-emerald-600 text-emerald-700 bg-white font-bold">
          Sign In
        </div>
        <Link
          href="/register"
          className="flex-1 py-3.5 text-center text-slate-500 hover:text-emerald-700 transition-colors"
        >
          Sign Up
        </Link>
      </div>

      <CardHeader className="space-y-1 text-center pt-6 pb-4">
        <CardTitle className="text-2xl font-extrabold tracking-tight text-slate-900">
          Welcome to Commute<span className="text-emerald-600">X</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-slate-500">
          Sign in to your corporate carpooling & commute portal
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-6">
        {registeredMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3.5 text-xs sm:text-sm text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Registration submitted! Please sign in with your corporate credentials.</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-xs sm:text-sm text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
          className="w-full h-11 border-slate-200 bg-white hover:bg-emerald-50/50 hover:border-emerald-300 font-medium text-slate-700 flex items-center justify-center gap-3 transition-colors shadow-xs rounded-xl"
        >
          {isGoogleLoading ? (
            <CarLoader size="inline" showRoad={false} className="w-8 h-4 scale-75" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span className="font-semibold text-slate-800 text-sm">Continue with Google</span>
        </Button>

        {/* Separator */}
        <div className="relative flex items-center justify-center my-2">
          <div className="w-full border-t border-slate-100" />
          <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            or sign in with email
          </span>
          <div className="w-full border-t border-slate-100" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Email field */}
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
              Corporate Work Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="alex.smith@company.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading || isGoogleLoading}
                className={`pl-9 rounded-xl ${fieldErrors.email ? "border-rose-500 focus-visible:ring-rose-500" : "border-slate-200"}`}
                autoComplete="email"
                required
              />
            </div>
            {fieldErrors.email && (
              <p className="text-xs text-rose-600">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Password
              </Label>
              <span className="text-[11px] text-slate-400 cursor-not-allowed">
                Forgot password?
              </span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading || isGoogleLoading}
                className={`pl-9 pr-10 rounded-xl ${fieldErrors.password ? "border-rose-500 focus-visible:ring-rose-500" : "border-slate-200"}`}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-rose-600">{fieldErrors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors mt-2"
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-1.5">
                <CarLoader size="inline" showRoad={false} carColor="#ffffff" className="w-8 h-4 scale-75 inline-flex" />
                <span>Signing in...</span>
              </span>
            ) : (
              "Sign In to CommuteX"
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col items-center justify-center border-t border-slate-100 py-4 bg-slate-50/50">
        <p className="text-xs text-slate-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Register Now
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-96 flex flex-col items-center justify-center">
          <CarLoader size="lg" message="Getting things ready..." />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
