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
  campusId?: string;
  campusName?: string;
  role: "employee" | "admin" | "campus_admin";
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
        <CarLoader size="page" message="Loading your profile details..." />
      </div>
    );
  }

  const isAdmin = profile?.role === "admin";
  const isCampusAdmin = profile?.role === "campus_admin";
  const isAdminOrCampusAdmin = isAdmin || isCampusAdmin;

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">
          {isAdmin ? "Super Admin Profile" : isCampusAdmin ? "Campus Admin Profile" : "Employee Profile"}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAdminOrCampusAdmin
            ? "Manage your name and contact number"
            : "Manage your personal information and commute preferences"}
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 animate-in fade-in-50">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200 animate-in fade-in-50">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left: Compact Identity Card (4 cols on lg) */}
        <div className="lg:col-span-4">
          <Card className="border-slate-200 bg-white shadow-2xs rounded-xl overflow-hidden">
            <CardHeader className="text-center py-3.5 px-4 bg-slate-50/70 border-b border-slate-100">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 border-2 border-emerald-500 text-sm font-bold text-emerald-800 shadow-2xs mb-1.5">
                {getInitials(profile?.name || "PP")}
              </div>
              <CardTitle className="text-sm font-bold text-slate-900 leading-tight">
                {profile?.name}
              </CardTitle>

              <div className="pt-1 flex justify-center">
                {isAdmin ? (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 gap-1 text-[10px] font-semibold py-0.5 px-2">
                    <Shield className="h-2.5 w-2.5" /> Super Admin
                  </Badge>
                ) : isCampusAdmin ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 gap-1 text-[10px] font-semibold py-0.5 px-2">
                    <Shield className="h-2.5 w-2.5" /> Campus Admin
                  </Badge>
                ) : profile?.verificationStatus === "approved" || profile?.isApproved ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0.5 px-2">
                    ✓ Verified Employee
                  </Badge>
                ) : profile?.verificationStatus === "rejected" ? (
                  <Badge variant="destructive" className="text-[10px] font-semibold py-0.5 px-2">
                    Verification Rejected
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-semibold py-0.5 px-2">
                    Pending Verification
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-3 space-y-2 text-xs">
              {/* Email */}
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Corporate Email</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-slate-800 font-medium text-xs truncate">
                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{profile?.email}</span>
                </div>
              </div>

              {/* Campus info for campus_admin */}
              {isCampusAdmin && (
                <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100">
                  <span className="text-[9px] font-bold text-blue-500 block uppercase tracking-wider">Assigned Campus</span>
                  <div className="flex items-center justify-between gap-1.5 mt-0.5 text-blue-900 font-semibold text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 text-blue-600 shrink-0" />
                      <span className="truncate">{profile?.campusName || "—"}</span>
                    </div>
                    <span className="font-mono text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                      {profile?.campusId}
                    </span>
                  </div>
                </div>
              )}

              {/* For employees: show ID, Campus, and Company */}
              {!isAdminOrCampusAdmin && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Employee ID</span>
                      <div className="flex items-center gap-1 mt-0.5 font-mono font-bold text-slate-800 text-[11px] truncate">
                        <BadgeCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{profile?.employeeId}</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Company</span>
                      <div className="flex items-center gap-1 mt-0.5 text-slate-800 font-medium text-xs truncate">
                        <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{profile?.companyName || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Physical Campus</span>
                    <div className="flex items-center justify-between gap-1 mt-0.5 text-slate-800 font-medium text-xs">
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{profile?.campusName || "—"}</span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 shrink-0">
                        {profile?.campusId}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Compact Edit Form (8 cols on lg) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit}>
            <Card className="border-slate-200 shadow-2xs bg-white rounded-xl overflow-hidden">
              <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b border-slate-100">
                <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-purple-600" />
                  {isAdminOrCampusAdmin ? "Contact Settings" : "Personal & Commute Preferences"}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-3.5 space-y-2.5">
                {/* Row 1: Name & Phone (2 cols) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="name" className="text-[11px] font-semibold text-slate-700">Full Name</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={isSaving}
                        className={`pl-8 h-8 text-xs rounded-lg ${fieldErrors.name ? "border-rose-500" : ""}`}
                        required
                      />
                    </div>
                    {fieldErrors.name && <p className="text-[10px] text-rose-600">{fieldErrors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="phone" className="text-[11px] font-semibold text-slate-700">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={handleChange}
                        disabled={isSaving}
                        className={`pl-8 h-8 text-xs rounded-lg ${fieldErrors.phone ? "border-rose-500" : ""}`}
                        required
                      />
                    </div>
                    {fieldErrors.phone && <p className="text-[10px] text-rose-600">{fieldErrors.phone}</p>}
                  </div>
                </div>

                {/* Employee-only fields: 2-column compact grid */}
                {!isAdminOrCampusAdmin && (
                  <>
                    {/* Row 2: Company & Department */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="companyName" className="text-[11px] font-semibold text-slate-700">Company / Organization</Label>
                        <div className="relative">
                          <Building2 className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            id="companyName"
                            name="companyName"
                            type="text"
                            placeholder="e.g. Tech Mahindra"
                            value={formData.companyName}
                            onChange={handleChange}
                            disabled={isSaving}
                            className={`pl-8 h-8 text-xs rounded-lg ${fieldErrors.companyName ? "border-rose-500" : ""}`}
                            required
                          />
                        </div>
                        {fieldErrors.companyName && <p className="text-[10px] text-rose-600">{fieldErrors.companyName}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="department" className="text-[11px] font-semibold text-slate-700">Department</Label>
                        <div className="relative">
                          <Building className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            id="department"
                            name="department"
                            type="text"
                            placeholder="e.g. Cloud & AI"
                            value={formData.department}
                            onChange={handleChange}
                            disabled={isSaving}
                            className={`pl-8 h-8 text-xs rounded-lg ${fieldErrors.department ? "border-rose-500" : ""}`}
                            required
                          />
                        </div>
                        {fieldErrors.department && <p className="text-[10px] text-rose-600">{fieldErrors.department}</p>}
                      </div>
                    </div>

                    {/* Row 3: Home Location & Morning Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="homeLocation" className="text-[11px] font-semibold text-slate-700">Home / Starting Neighborhood</Label>
                        <div className="relative">
                          <MapPin className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            id="homeLocation"
                            name="homeLocation"
                            type="text"
                            placeholder="e.g. Tambaram, Velachery"
                            value={formData.homeLocation}
                            onChange={handleChange}
                            disabled={isSaving}
                            className="pl-8 h-8 text-xs rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="departureTimePreference" className="text-[11px] font-semibold text-slate-700">Morning Departure Time</Label>
                        <div className="relative">
                          <Clock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            id="departureTimePreference"
                            name="departureTimePreference"
                            type="text"
                            placeholder="e.g. 08:30 AM"
                            value={formData.departureTimePreference}
                            onChange={handleChange}
                            disabled={isSaving}
                            className="pl-8 h-8 text-xs rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Notes */}
                    <div className="space-y-1">
                      <Label htmlFor="notes" className="text-[11px] font-semibold text-slate-700">Ride Preferences & Commute Notes</Label>
                      <div className="relative">
                        <FileText className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          id="notes"
                          name="notes"
                          type="text"
                          placeholder="e.g. Prefer pickup near Metro Station"
                          value={formData.notes}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="pl-8 h-8 text-xs rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Row 5: Compact Micro Toggles */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-1.5">
                          <Music className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-800">Music En Route</span>
                        </div>
                        <input
                          type="checkbox"
                          name="musicPreference"
                          checked={formData.musicPreference}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-emerald-600"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-1.5">
                          <Cigarette className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-800">Smoking Allowed</span>
                        </div>
                        <input
                          type="checkbox"
                          name="smokingPreference"
                          checked={formData.smokingPreference}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-emerald-600"
                        />
                      </label>
                    </div>
                  </>
                )}
              </CardContent>

              <CardFooter className="flex justify-end border-t border-slate-100 py-2.5 px-4 bg-slate-50/50">
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
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
