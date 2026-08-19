"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  User as UserIcon,
  BadgeCheck,
  Mail,
  Phone,
  Building,
  Building2,
  MapPin,
  Clock,
  Music,
  Cigarette,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CarLoader } from "@/components/common/CarLoader";
import { updateProfileSchema } from "@/validations/profile.schema";
import { getInitials } from "@/lib/utils";

interface UserProfileData {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  department: string;
  companyName?: string;
  role: "employee" | "admin";
  verificationStatus?: "pending" | "approved" | "rejected";
  isApproved?: boolean;
  profileImage?: string;
  homeLocation?: string;
  commutePreferences?: {
    departureTimePreference?: string;
    notes?: string;
    smokingPreference?: boolean;
    musicPreference?: boolean;
  };
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    department: "",
    companyName: "",
    profileImage: "",
    homeLocation: "",
    departureTimePreference: "",
    notes: "",
    smokingPreference: false,
    musicPreference: true,
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          const p: UserProfileData = data.profile;
          setProfile(p);
          setFormData({
            name: p.name || "",
            phone: p.phone || "",
            department: p.department || "",
            companyName: p.companyName || "Tech Mahindra",
            profileImage: p.profileImage || "",
            homeLocation: p.homeLocation || "",
            departureTimePreference: p.commutePreferences?.departureTimePreference || "",
            notes: p.commutePreferences?.notes || "",
            smokingPreference: p.commutePreferences?.smokingPreference ?? false,
            musicPreference: p.commutePreferences?.musicPreference ?? true,
          });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        setErrorMessage("Failed to load profile details. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    }

    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === "checkbox";
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: isCheckbox ? checked : value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
    if (successMessage) setSuccessMessage(null);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    setFieldErrors({});

    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      department: formData.department.trim(),
      companyName: formData.companyName.trim() || "Tech Mahindra",
      profileImage: formData.profileImage.trim(),
      homeLocation: formData.homeLocation.trim(),
      commutePreferences: {
        departureTimePreference: formData.departureTimePreference.trim(),
        notes: formData.notes.trim(),
        smokingPreference: formData.smokingPreference,
        musicPreference: formData.musicPreference,
      },
    };

    const validation = updateProfileSchema.safeParse(payload);
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

    setIsSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to update profile.");
        setIsSaving(false);
        return;
      }

      setProfile(data.profile);
      setSuccessMessage("Profile updated successfully!");

      // Refresh client session with new name/dept
      await updateSession({
        name: data.profile.name,
        department: data.profile.department,
        phone: data.profile.phone,
      });
    } catch (err) {
      console.error("Profile save error:", err);
      setErrorMessage("Network error while updating profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
        <CarLoader size="lg" message="Loading your profile details..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Employee Profile
        </h1>
        <p className="text-sm text-slate-500">
          Manage your personal information, corporate company, department, and commute preferences
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200 animate-in fade-in-50">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200 animate-in fade-in-50">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Read-Only Identity Card */}
        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 border-2 border-emerald-500 text-xl font-bold text-emerald-800 shadow-sm mb-3">
                {getInitials(profile?.name || "PP")}
              </div>
              <CardTitle className="text-lg font-bold text-slate-900">
                {profile?.name}
              </CardTitle>
              
              {/* Company & Department Display */}
              <div className="mt-1 flex flex-col items-center gap-0.5 text-xs text-slate-600">
                <span className="font-semibold text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <Building2 className="h-3 w-3 text-emerald-600" />
                  {profile?.companyName || "Tech Mahindra"}
                </span>
                <span className="text-slate-500 mt-0.5">{profile?.department}</span>
              </div>

              <div className="pt-2 flex justify-center gap-2">
                {profile?.role === "admin" ? (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 gap-1 text-xs font-semibold">
                    <Shield className="h-3 w-3" /> Campus Admin
                  </Badge>
                ) : profile?.verificationStatus === "approved" || profile?.isApproved ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold">
                    Verified Employee
                  </Badge>
                ) : profile?.verificationStatus === "rejected" ? (
                  <Badge variant="destructive" className="text-xs font-semibold">
                    Verification Rejected
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-semibold">
                    Pending Verification
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3.5 border-t border-slate-100 pt-4 text-sm">
              <div>
                <span className="text-xs font-medium text-slate-400 block uppercase tracking-wider">
                  Employee ID (Read-Only)
                </span>
                <div className="flex items-center gap-2 mt-1 font-mono font-semibold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
                  <BadgeCheck className="h-4 w-4 text-emerald-600" />
                  <span>{profile?.employeeId}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-400 block uppercase tracking-wider">
                  Company / Organization
                </span>
                <div className="flex items-center gap-2 mt-1 font-semibold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
                  <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{profile?.companyName || "Tech Mahindra"}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-400 block uppercase tracking-wider">
                  Corporate Work Email (Read-Only)
                </span>
                <div className="flex items-center gap-2 mt-1 text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80 truncate">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="truncate">{profile?.email}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-400 block uppercase tracking-wider">
                  Account Created
                </span>
                <span className="text-xs text-slate-600 block mt-0.5">
                  {profile ? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }) : ""}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Editable Profile & Commute Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit}>
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-900">
                  Personal & Commute Settings
                </CardTitle>
                <CardDescription>
                  Update your contact details, company, and default carpooling preferences
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Section 1: Basic Information */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Contact, Company & Department
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                        Full Name
                      </Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          value={formData.name}
                          onChange={handleChange}
                          disabled={isSaving}
                          className={`pl-9 rounded-xl ${fieldErrors.name ? "border-rose-500" : ""}`}
                          required
                        />
                      </div>
                      {fieldErrors.name && (
                        <p className="text-xs text-rose-600">{fieldErrors.name}</p>
                      )}
                    </div>

                    {/* Company / Organization Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName" className="text-xs font-semibold text-slate-700">
                        Company / Organization
                      </Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="companyName"
                          name="companyName"
                          type="text"
                          placeholder="e.g. Tech Mahindra, Infosys, TCS"
                          value={formData.companyName}
                          onChange={handleChange}
                          disabled={isSaving}
                          className={`pl-9 rounded-xl ${fieldErrors.companyName ? "border-rose-500" : ""}`}
                          required
                        />
                      </div>
                      {fieldErrors.companyName && (
                        <p className="text-xs text-rose-600">{fieldErrors.companyName}</p>
                      )}
                    </div>

                    {/* Department */}
                    <div className="space-y-1.5">
                      <Label htmlFor="department" className="text-xs font-semibold text-slate-700">
                        Department
                      </Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="department"
                          name="department"
                          type="text"
                          placeholder="e.g. Engineering, Product, HR"
                          value={formData.department}
                          onChange={handleChange}
                          disabled={isSaving}
                          className={`pl-9 rounded-xl ${fieldErrors.department ? "border-rose-500" : ""}`}
                          required
                        />
                      </div>
                      {fieldErrors.department && (
                        <p className="text-xs text-rose-600">{fieldErrors.department}</p>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5 sm:col-span-2">
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
                          disabled={isSaving}
                          className={`pl-9 rounded-xl ${fieldErrors.phone ? "border-rose-500" : ""}`}
                          required
                        />
                      </div>
                      {fieldErrors.phone && (
                        <p className="text-xs text-rose-600">{fieldErrors.phone}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: Commute Preferences */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Commute & Location Defaults
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="homeLocation" className="text-xs font-semibold text-slate-700">
                        Home / Starting Neighborhood
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="homeLocation"
                          name="homeLocation"
                          type="text"
                          placeholder="e.g. Tambaram, Sholinganallur, Velachery, Whitefield"
                          value={formData.homeLocation}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="pl-9 rounded-xl"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Helps match you with colleagues offering rides from your area
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="departureTimePreference" className="text-xs font-semibold text-slate-700">
                        Typical Morning Departure Time
                      </Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="departureTimePreference"
                          name="departureTimePreference"
                          type="text"
                          placeholder="e.g. 08:30 AM"
                          value={formData.departureTimePreference}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="pl-9 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Commute Note */}
                    <div className="space-y-1.5">
                      <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">
                        Ride Preferences & Commute Notes
                      </Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="notes"
                          name="notes"
                          type="text"
                          placeholder="e.g. Prefer pickup near Metro Station, flexible on return timing"
                          value={formData.notes}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="pl-9 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Toggle Preferences */}
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                        <div className="flex items-center gap-2.5">
                          <Music className="h-4 w-4 text-emerald-600" />
                          <div>
                            <div className="text-xs font-bold text-slate-800">Music En Route</div>
                            <div className="text-[11px] text-slate-500">Enjoy music during commute</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          name="musicPreference"
                          checked={formData.musicPreference}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                        <div className="flex items-center gap-2.5">
                          <Cigarette className="h-4 w-4 text-slate-500" />
                          <div>
                            <div className="text-xs font-bold text-slate-800">Smoking Allowed</div>
                            <div className="text-[11px] text-slate-500">Allow smoking in vehicle</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          name="smokingPreference"
                          checked={formData.smokingPreference}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end border-t border-slate-100 pt-4 bg-slate-50/50 rounded-b-2xl">
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <CarLoader size="inline" showRoad={false} carColor="#ffffff" className="w-8 h-4 scale-75 inline-flex" />
                      <span>Saving Profile...</span>
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
