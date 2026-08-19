"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  User,
  BadgeCheck,
  Mail,
  Phone,
  Building,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CarLoader } from "@/components/common/CarLoader";
import { registerSchema } from "@/validations/auth.schema";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    employeeId: "",
    email: "",
    phone: "",
    companyName: "",
    department: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [existingEmailFound, setExistingEmailFound] = useState<string | null>(null);
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
    if (serverError) setServerError(null);
    if (existingEmailFound) setExistingEmailFound(null);
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsGoogleLoading(true);
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (err) {
      console.error("Google sign-up error:", err);
      setIsGoogleLoading(false);
      setServerError("Could not initiate Google sign up. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setExistingEmailFound(null);
    setFieldErrors({});

    // Client-side Zod validation
    const validation = registerSchema.safeParse(formData);
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          employeeId: formData.employeeId.trim().toUpperCase(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          companyName: formData.companyName.trim() || "Tech Mahindra",
          department: formData.department.trim(),
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.accountExists) {
          setExistingEmailFound(formData.email.trim().toLowerCase());
        }
        setServerError(data.error || "Failed to create account. Please check your details.");
        setIsLoading(false);
        return;
      }

      // Success -> Redirect to login with success flag
      router.push(`/login?registered=true&email=${encodeURIComponent(formData.email.trim().toLowerCase())}`);
    } catch (err: unknown) {
      console.error("Registration request error:", err);
      setServerError("A network error occurred during registration. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-none border-0 bg-white rounded-none overflow-hidden my-0">
      {/* Top Tab Bar */}
      <div className="flex border-b border-slate-100 bg-slate-50 text-xs font-semibold">
        <Link
          href="/login"
          className="flex-1 py-3.5 text-center text-slate-500 hover:text-emerald-700 transition-colors"
        >
          Sign In
        </Link>
        <div className="flex-1 py-3.5 text-center border-b-2 border-emerald-600 text-emerald-700 bg-white font-bold">
          Sign Up
        </div>
      </div>

      <CardHeader className="space-y-1 text-center pt-5 pb-3">
        <CardTitle className="text-2xl font-extrabold tracking-tight text-slate-900">
          Employee Registration
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-slate-500">
          Register with your official campus Employee ID
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-6">
        {/* Account Exists Warning Box with Direct Action */}
        {existingEmailFound ? (
          <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-amber-900 space-y-2 animate-in fade-in-50">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Account Already Exists</span>
            </div>
            <p className="text-xs text-amber-700">
              A corporate profile with <strong>{existingEmailFound}</strong> is already registered. You only need to sign in.
            </p>
            <Link
              href={`/login?email=${encodeURIComponent(existingEmailFound)}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-white border border-amber-200 px-3 py-1.5 rounded-lg shadow-xs hover:bg-emerald-50 transition-colors"
            >
              Sign In With This Account <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : serverError ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-xs sm:text-sm text-rose-900 border border-rose-200 animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{serverError}</span>
          </div>
        ) : null}

        {/* Google OAuth Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignUp}
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
          <span className="font-semibold text-slate-800 text-sm">Sign up with Google</span>
        </Button>

        {/* Separator */}
        <div className="relative flex items-center justify-center my-1">
          <div className="w-full border-t border-slate-100" />
          <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            or fill employee details
          </span>
          <div className="w-full border-t border-slate-100" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Full Name */}
          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Sarah Jenkins"
                value={formData.name}
                onChange={handleChange}
                disabled={isLoading || isGoogleLoading}
                className={`pl-9 rounded-xl ${fieldErrors.name ? "border-rose-500" : "border-slate-200"}`}
                required
              />
            </div>
            {fieldErrors.name && (
              <p className="text-xs text-rose-600">{fieldErrors.name}</p>
            )}
          </div>

          {/* Grid: Company ID & Company Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="employeeId" className="text-xs font-semibold text-slate-700">
                  Company ID
                </Label>
                <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5">
                  <Info className="h-3 w-3" /> Required
                </span>
              </div>
              <div className="relative">
                <BadgeCheck className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  placeholder="EMP-9042"
                  value={formData.employeeId}
                  onChange={handleChange}
                  disabled={isLoading || isGoogleLoading}
                  className={`pl-9 uppercase font-mono rounded-xl ${fieldErrors.employeeId ? "border-rose-500" : "border-slate-200"}`}
                  required
                />
              </div>
              {fieldErrors.employeeId && (
                <p className="text-xs text-rose-600">{fieldErrors.employeeId}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="companyName" className="text-xs font-semibold text-slate-700">
                Company / Organization
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="e.g. Tech Mahindra, Infosys"
                  value={formData.companyName}
                  onChange={handleChange}
                  disabled={isLoading || isGoogleLoading}
                  className={`pl-9 rounded-xl ${fieldErrors.companyName ? "border-rose-500" : "border-slate-200"}`}
                  required
                />
              </div>
              {fieldErrors.companyName && (
                <p className="text-xs text-rose-600">{fieldErrors.companyName}</p>
              )}
            </div>
          </div>

          {/* Grid: Department & Phone Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="department" className="text-xs font-semibold text-slate-700">
                Department
              </Label>
              <div className="relative">
                <Building className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="department"
                  name="department"
                  type="text"
                  placeholder="Engineering"
                  value={formData.department}
                  onChange={handleChange}
                  disabled={isLoading || isGoogleLoading}
                  className={`pl-9 rounded-xl ${fieldErrors.department ? "border-rose-500" : "border-slate-200"}`}
                  required
                />
              </div>
              {fieldErrors.department && (
                <p className="text-xs text-rose-600">{fieldErrors.department}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isLoading || isGoogleLoading}
                  className={`pl-9 rounded-xl ${fieldErrors.phone ? "border-rose-500" : "border-slate-200"}`}
                  required
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-rose-600">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          {/* Corporate Email */}
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
                placeholder="s.jenkins@company.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading || isGoogleLoading}
                className={`pl-9 rounded-xl ${fieldErrors.email ? "border-rose-500" : "border-slate-200"}`}
                required
              />
            </div>
            {fieldErrors.email && (
              <p className="text-xs text-rose-600">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Password
              </Label>
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
                  className={`pl-9 pr-9 rounded-xl ${fieldErrors.password ? "border-rose-500" : "border-slate-200"}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-rose-600">{fieldErrors.password}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isLoading || isGoogleLoading}
                  className={`pl-9 pr-9 rounded-xl ${fieldErrors.confirmPassword ? "border-rose-500" : "border-slate-200"}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-rose-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <CarLoader size="inline" showRoad={false} carColor="#ffffff" className="w-8 h-4 scale-75 inline-flex" />
                  <span>Submitting Registration...</span>
                </span>
              ) : (
                "Register & Submit for Approval"
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col items-center justify-center border-t border-slate-100 py-4 bg-slate-50/50">
        <p className="text-xs text-slate-600">
          Already have a corporate account?{" "}
          <Link
            href="/login"
            className="font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
          >
            Sign in here <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
