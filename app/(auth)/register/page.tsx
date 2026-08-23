"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  BadgeCheck,
  Mail,
  Phone,
  Building,
  Building2,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Info,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CarLoader } from "@/components/common/CarLoader";
import { registerSchema } from "@/validations/auth.schema";

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<"form" | "verify_otp">("form");

  const [formData, setFormData] = useState({
    name: "",
    employeeId: "",
    email: "",
    phone: "",
    companyName: "",
    campusId: "",
    department: "",
    password: "",
    confirmPassword: "",
  });

  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [existingEmailFound, setExistingEmailFound] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [devOtpNotice, setDevOtpNotice] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "verify_otp" && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

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

  // Step 1: Request Email OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
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

    setIsSendingOtp(true);

    try {
      const res = await fetch("/api/auth/register/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          employeeId: formData.employeeId.trim().toUpperCase(),
          campusId: formData.campusId.trim().toUpperCase(),
          companyName: formData.companyName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.accountExists) {
          setExistingEmailFound(formData.email.trim().toLowerCase());
        }
        setServerError(data.error || "Failed to dispatch verification code. Please check your details.");
        setIsSendingOtp(false);
        return;
      }

      if (data.devOtp) {
        setDevOtpNotice(data.devOtp);
      }

      setStep("verify_otp");
      setResendTimer(60);
      setCanResend(false);
    } catch (err: unknown) {
      console.error("OTP dispatch request error:", err);
      setServerError("A network error occurred while sending verification code. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend || isSendingOtp) return;
    setIsSendingOtp(true);
    setServerError(null);

    try {
      const res = await fetch("/api/auth/register/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          employeeId: formData.employeeId.trim().toUpperCase(),
          campusId: formData.campusId.trim().toUpperCase(),
          companyName: formData.companyName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || "Failed to resend verification code.");
      } else {
        setResendTimer(60);
        setCanResend(false);
        if (data.devOtp) {
          setDevOtpNotice(data.devOtp);
        }
      }
    } catch (err) {
      setServerError("Failed to resend code due to network error.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Final Registration with Verified OTP
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!otp || otp.trim().length !== 6) {
      setServerError("Please enter the complete 6-digit verification code sent to your email.");
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
          companyName: formData.companyName.trim(),
          campusId: formData.campusId.trim().toUpperCase(),
          department: formData.department.trim(),
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          otp: otp.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error || "Registration failed. Please check your verification code.");
        setIsLoading(false);
        return;
      }

      // Success -> Redirect to login
      router.push(`/login?registered=true&email=${encodeURIComponent(formData.email.trim().toLowerCase())}`);
    } catch (err: unknown) {
      console.error("Registration submission error:", err);
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
          className="flex-1 py-2.5 text-center text-slate-500 hover:text-emerald-700 transition-colors"
        >
          Sign In
        </Link>
        <div className="flex-1 py-2.5 text-center border-b-2 border-emerald-600 text-emerald-700 bg-white font-bold">
          Sign Up
        </div>
      </div>

      <CardHeader className="space-y-0.5 text-center pt-3 pb-1.5">
        <CardTitle className="text-xl font-extrabold tracking-tight text-slate-900">
          {step === "form" ? "Employee Registration" : "Email Verification"}
        </CardTitle>
        <CardDescription className="text-[11px] text-slate-500">
          {step === "form"
            ? "Register with your corporate ID to join the CommuteX campus pool"
            : `Enter the 6-digit authorization code sent to ${formData.email}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 px-5 py-2">
        {/* Account Exists Warning Box with Direct Action */}
        {existingEmailFound ? (
          <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-amber-900 space-y-1 animate-in fade-in-50">
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Account Already Exists</span>
            </div>
            <p className="text-[11px] text-amber-700">
              A corporate profile with <strong>{existingEmailFound}</strong> is already registered.
            </p>
            <Link
              href={`/login?email=${encodeURIComponent(existingEmailFound)}`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white border border-amber-200 px-2.5 py-1 rounded shadow-xs hover:bg-emerald-50 transition-colors"
            >
              Sign In With This Account <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : serverError ? (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-900 border border-rose-200 animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{serverError}</span>
          </div>
        ) : null}

        {/* STEP 1: REGISTRATION FORM */}
        {step === "form" ? (
          <form onSubmit={handleRequestOtp} className="space-y-2.5">
            {/* Row 1: Full Name & Corporate Work Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="name" className="text-[11px] font-semibold text-slate-700">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Sarah Jenkins"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={isSendingOtp}
                    className={`h-8.5 pl-8 text-xs rounded-lg ${fieldErrors.name ? "border-rose-500" : "border-slate-200"}`}
                    required
                  />
                </div>
                {fieldErrors.name && (
                  <p className="text-[10px] text-rose-600">{fieldErrors.name}</p>
                )}
              </div>

              <div className="space-y-0.5">
                <Label htmlFor="email" className="text-[11px] font-semibold text-slate-700">
                  Corporate Work Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="s.jenkins@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isSendingOtp}
                    className={`h-8.5 pl-8 text-xs rounded-lg ${fieldErrors.email ? "border-rose-500" : "border-slate-200"}`}
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[10px] text-rose-600">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            {/* Row 2: Company / Organization & Campus ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="companyName" className="text-[11px] font-semibold text-slate-700">
                  Company / Organization
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="companyName"
                    name="companyName"
                    type="text"
                    placeholder="e.g. ABC Technologies"
                    value={formData.companyName}
                    onChange={handleChange}
                    disabled={isSendingOtp}
                    className={`h-8.5 pl-8 text-xs rounded-lg ${fieldErrors.companyName ? "border-rose-500" : "border-slate-200"}`}
                    required
                  />
                </div>
                {fieldErrors.companyName && (
                  <p className="text-[10px] text-rose-600">{fieldErrors.companyName}</p>
                )}
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="campusId" className="text-[11px] font-semibold text-slate-700">
                    Campus ID
                  </Label>
                  <span className="text-[9px] text-emerald-700 font-medium flex items-center gap-0.5">
                    <Info className="h-2.5 w-2.5" /> Required
                  </span>
                </div>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="campusId"
                    name="campusId"
                    type="text"
                    placeholder="e.g. CAMP001"
                    value={formData.campusId}
                    onChange={handleChange}
                    disabled={isSendingOtp}
                    className={`h-8.5 pl-8 uppercase font-mono text-xs rounded-lg ${fieldErrors.campusId ? "border-rose-500" : "border-slate-200"}`}
                    required
                  />
                </div>
                {fieldErrors.campusId && (
                  <p className="text-[10px] text-rose-600">{fieldErrors.campusId}</p>
                )}
              </div>
            </div>

            {/* Row 3: Company ID & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="employeeId" className="text-[11px] font-semibold text-slate-700">
                  Company ID (Employee Badge)
                </Label>
                <div className="relative">
                  <BadgeCheck className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="employeeId"
                    name="employeeId"
                    type="text"
                    placeholder="e.g. EMP-001"
                    value={formData.employeeId}
                    onChange={handleChange}
                    disabled={isSendingOtp}
                    className={`h-8.5 pl-8 uppercase font-mono text-xs rounded-lg ${fieldErrors.employeeId ? "border-rose-500" : "border-slate-200"}`}
                    required
                  />
                </div>
                {fieldErrors.employeeId && (
                  <p className="text-[10px] text-rose-600">{fieldErrors.employeeId}</p>
                )}
              </div>

              <div className="space-y-0.5">
                <Label htmlFor="department" className="text-[11px] font-semibold text-slate-700">
                  Department
                </Label>
                <div className="relative">
                  <Building className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="department"
                    name="department"
                    type="text"
                    placeholder="Engineering"
                    value={formData.department}
                    onChange={handleChange}
                    disabled={isSendingOtp}
                    className={`h-8.5 pl-8 text-xs rounded-lg ${fieldErrors.department ? "border-rose-500" : "border-slate-200"}`}
                    required
                  />
                </div>
                {fieldErrors.department && (
                  <p className="text-[10px] text-rose-600">{fieldErrors.department}</p>
                )}
              </div>
            </div>

            {/* Row 4: Phone Number */}
            <div className="space-y-0.5">
              <Label htmlFor="phone" className="text-[11px] font-semibold text-slate-700">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isSendingOtp}
                  className={`h-8.5 pl-8 text-xs rounded-lg ${fieldErrors.phone ? "border-rose-500" : "border-slate-200"}`}
                  required
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-[10px] text-rose-600">{fieldErrors.phone}</p>
              )}
            </div>

            {/* Row 5: Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="password" className="text-[11px] font-semibold text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSendingOtp}
                    className={`h-8.5 pl-8 pr-8 text-xs rounded-lg ${fieldErrors.password ? "border-rose-500" : "border-slate-200"}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[10px] text-rose-600">{fieldErrors.password}</p>
                )}
              </div>

              <div className="space-y-0.5">
                <Label htmlFor="confirmPassword" className="text-[11px] font-semibold text-slate-700">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isSendingOtp}
                    className={`h-8.5 pl-8 pr-8 text-xs rounded-lg ${fieldErrors.confirmPassword ? "border-rose-500" : "border-slate-200"}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-[10px] text-rose-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Next Button: Send OTP */}
            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-colors text-xs flex items-center justify-center gap-1.5"
                disabled={isSendingOtp}
              >
                {isSendingOtp ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <CarLoader size="inline" showRoad={false} carColor="#ffffff" className="w-8 h-4 scale-75 inline-flex" />
                    <span>Sending Verification Code...</span>
                  </span>
                ) : (
                  <>
                    <span>Verify Email & Register</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* STEP 2: ENTER OTP CODE */
          <form onSubmit={handleVerifyAndRegister} className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
            <div className="text-center p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1.5">
              <div className="inline-flex p-2 rounded-full bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Verify Your Email Address</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                We sent a 6-digit security code to:
                <span className="block font-bold text-emerald-800 mt-0.5">{formData.email}</span>
              </p>
            </div>

            {/* OTP Code Entry */}
            <div className="space-y-1.5">
              <Label htmlFor="otp" className="text-center block text-xs font-semibold text-slate-700">
                Enter 6-Digit Verification Code
              </Label>
              <Input
                id="otp"
                type="text"
                maxLength={6}
                autoFocus
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                disabled={isLoading}
                className="h-12 text-center text-2xl font-mono font-extrabold tracking-[0.4em] rounded-xl border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white"
                required
              />
              <p className="text-[10px] text-center text-slate-400">
                Code valid for 10 minutes. Single-use only.
              </p>
            </div>

            {devOtpNotice && (
              <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] text-center">
                Development OTP Code: <strong className="font-mono">{devOtpNotice}</strong>
              </div>
            )}

            {/* Submit & Navigation Buttons */}
            <div className="space-y-2 pt-1">
              <Button
                type="submit"
                className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-colors text-xs flex items-center justify-center gap-1.5"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <CarLoader size="inline" showRoad={false} carColor="#ffffff" className="w-8 h-4 scale-75 inline-flex" />
                    <span>Verifying Code & Creating Account...</span>
                  </span>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm & Complete Registration</span>
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setServerError(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Edit Details
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!canResend || isSendingOtp}
                  className={`flex items-center gap-1 font-semibold transition-colors ${
                    canResend
                      ? "text-emerald-700 hover:text-emerald-900"
                      : "text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <RotateCcw className={`h-3 w-3 ${isSendingOtp ? "animate-spin" : ""}`} />
                  {canResend ? "Resend Code" : `Resend in ${resendTimer}s`}
                </button>
              </div>
            </div>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-center justify-center border-t border-slate-100 py-2.5 bg-slate-50/50">
        <p className="text-[11px] text-slate-600">
          Already have a corporate account?{" "}
          <Link
            href="/login"
            className="font-bold text-emerald-700 hover:underline inline-flex items-center gap-0.5"
          >
            Sign in here <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
