"use client";

import React, { useEffect, useState, useRef } from "react";
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
  CheckCircle2,
  AlertCircle,
  Shield,
  ShieldCheck,
  Lock,
  Briefcase,
  Camera,
  Upload,
  Image as ImageIcon,
  Eye,
  Crop,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Trash2,
  Sliders,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CarLoader } from "@/components/common/CarLoader";
import { updateProfileSchema } from "@/validations/profile.schema";
import { compressImage } from "@/lib/utils/imageCompressor";
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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo View & Adjustment Modal States
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustImageSrc, setAdjustImageSrc] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isCampusAdmin = profile?.role === "campus_admin";
  const isAdminOrCampusAdmin = isAdmin || isCampusAdmin;

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

  // Open adjustment modal for new file upload
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, or WEBP).");
      return;
    }

    try {
      setErrorMessage(null);
      setSuccessMessage(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const rawUrl = event.target?.result as string;
        setAdjustImageSrc(rawUrl);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setRotation(0);
        setIsAdjustModalOpen(true);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Profile photo load error:", err);
      setErrorMessage("Failed to read image file. Please try another photo.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Open adjustment modal for existing uploaded photo
  const openAdjustExistingPhoto = () => {
    if (!formData.profileImage) return;
    setAdjustImageSrc(formData.profileImage);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setIsAdjustModalOpen(true);
  };

  // Drag-to-pan handlers for interactive photo adjust
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setZoom((prev) => Math.min(Math.max(1, Math.round((prev + delta) * 100) / 100), 3));
  };

  // Save adjusted photo from Canvas
  const handleSaveAdjustedPhoto = async () => {
    if (!adjustImageSrc) return;

    try {
      setIsSavingAdjust(true);
      setErrorMessage(null);

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = adjustImageSrc;

      await new Promise((resolve, reject) => {
        if (img.complete) {
          resolve(true);
        } else {
          img.onload = () => resolve(true);
          img.onerror = reject;
        }
      });

      const canvasSize = 600;
      const previewSize = 280; // Size of circular preview in modal
      const scaleFactor = canvasSize / previewSize;

      const canvas = document.createElement("canvas");
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      ctx.save();
      // Move to center of canvas
      ctx.translate(canvasSize / 2, canvasSize / 2);
      // Rotate
      ctx.rotate((rotation * Math.PI) / 180);
      // Zoom
      ctx.scale(zoom, zoom);
      // Pan translation adjusted for rotation angle
      const rad = (-rotation * Math.PI) / 180;
      const rotatedPanX = pan.x * Math.cos(rad) - pan.y * Math.sin(rad);
      const rotatedPanY = pan.x * Math.sin(rad) + pan.y * Math.cos(rad);
      ctx.translate(rotatedPanX * scaleFactor, rotatedPanY * scaleFactor);

      // Draw aspect-covered image centered
      const aspect = img.width / img.height;
      let drawW = canvasSize;
      let drawH = canvasSize;
      if (aspect > 1) {
        drawW = canvasSize * aspect;
        drawH = canvasSize;
      } else {
        drawW = canvasSize;
        drawH = canvasSize / aspect;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const adjustedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

      setFormData((prev) => ({
        ...prev,
        profileImage: adjustedDataUrl,
      }));

      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated.profileImage;
        return updated;
      });

      // Save directly to MongoDB
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim() || profile?.name || "",
          phone: formData.phone.trim() || profile?.phone || "",
          department: formData.department.trim() || profile?.department || "General",
          companyName: formData.companyName.trim() || profile?.companyName || "Tech Mahindra",
          profileImage: adjustedDataUrl,
          homeLocation: formData.homeLocation.trim() || profile?.homeLocation || "",
          commutePreferences: {
            departureTimePreference: formData.departureTimePreference.trim(),
            notes: formData.notes.trim(),
            smokingPreference: formData.smokingPreference,
            musicPreference: formData.musicPreference,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        setSuccessMessage("Profile photo saved successfully!");
        await updateSession({ image: adjustedDataUrl });
        setIsAdjustModalOpen(false);
      } else {
        setErrorMessage(data.error || "Failed to save profile photo.");
      }
    } catch (err) {
      console.error("Save adjusted photo error:", err);
      setErrorMessage("Failed to process and save adjusted photo.");
    } finally {
      setIsSavingAdjust(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setIsUploadingPhoto(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      setFormData((prev) => ({
        ...prev,
        profileImage: "",
      }));

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim() || profile?.name || "",
          phone: formData.phone.trim() || profile?.phone || "",
          department: formData.department.trim() || profile?.department || "General",
          companyName: formData.companyName.trim() || profile?.companyName || "Tech Mahindra",
          profileImage: "",
          homeLocation: formData.homeLocation.trim() || profile?.homeLocation || "",
          commutePreferences: {
            departureTimePreference: formData.departureTimePreference.trim(),
            notes: formData.notes.trim(),
            smokingPreference: formData.smokingPreference,
            musicPreference: formData.musicPreference,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        setSuccessMessage("Profile photo removed.");
        await updateSession({
          image: "",
        });
      } else {
        setErrorMessage(data.error || "Failed to remove profile photo.");
      }
    } catch (err) {
      console.error("Remove profile photo error:", err);
      setErrorMessage("Failed to remove profile photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    setFieldErrors({});

    // Enforce official profile photo for corporate employees
    if (!isAdminOrCampusAdmin && !formData.profileImage.trim()) {
      setErrorMessage("Please upload your official profile photo before saving. All employees are required to have a profile photo.");
      setFieldErrors((prev) => ({
        ...prev,
        profileImage: "Profile photo is required for all employees.",
      }));
      return;
    }

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

      // Refresh client session with new name/dept/image
      await updateSession({
        name: data.profile.name,
        department: data.profile.department,
        phone: data.profile.phone,
        image: data.profile.profileImage || "",
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

      {/* Corporate Policy Photo Alert for Employees */}
      {!isAdminOrCampusAdmin && !formData.profileImage && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-50/80 to-orange-50 p-3.5 border border-amber-200 text-amber-900 shadow-2xs animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 border border-amber-300 text-amber-700 shrink-0">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <span>Employee Profile Photo Required</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-800">
                  Campus Policy
                </span>
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                All employees must upload an official profile photo for corporate commute verification, ride boarding clearance, and campus security.
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-4 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0 gap-1.5 shadow-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Photo Now
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Identity & Security Credentials (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-3.5 flex flex-col justify-between">
          {/* Identity Card */}
          <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden flex-1">
            <CardHeader className="text-center py-4 px-4 bg-slate-50/70 border-b border-slate-100">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
                disabled={isUploadingPhoto || isSaving}
              />

              {/* Avatar Container with Upload Interaction */}
              <div className="relative mx-auto mb-2 w-fit">
                <div
                  onClick={() => {
                    if (formData.profileImage) {
                      setIsViewModalOpen(true);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-emerald-500 bg-emerald-100 text-lg font-bold text-emerald-800 shadow-sm transition-all hover:ring-4 hover:ring-emerald-100"
                  title={formData.profileImage ? "Click to view full size photo" : "Click to upload photo"}
                >
                  {formData.profileImage ? (
                    <img
                      src={formData.profileImage}
                      alt={profile?.name || "Employee"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(profile?.name || "PP")}</span>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                    {formData.profileImage ? (
                      <>
                        <Eye className="h-4 w-4" />
                        <span className="mt-0.5 text-[9px] font-semibold">View</span>
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        <span className="mt-0.5 text-[9px] font-semibold">Upload</span>
                      </>
                    )}
                  </div>

                  {/* Uploading Spinner Overlay */}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                      <span className="mt-0.5 text-[8px] font-medium">Loading...</span>
                    </div>
                  )}
                </div>

                {/* Floating Camera Button Badge for upload/change */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto || isSaving}
                  className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-sm transition-transform hover:scale-110 hover:bg-emerald-700"
                  title="Upload or change profile photo"
                >
                  <Camera className="h-3 w-3" />
                </button>
              </div>

              {/* Photo Actions: View, Adjust, Remove */}
              <div className="mb-2 flex items-center justify-center gap-1.5">
                {formData.profileImage ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsViewModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors"
                      title="View full size profile photo"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      View
                    </button>

                    <button
                      type="button"
                      onClick={openAdjustExistingPhoto}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors"
                      title="Adjust photo zoom, pan, and rotation"
                    >
                      <Crop className="h-3.5 w-3.5 text-emerald-600" />
                      Adjust
                    </button>

                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={isUploadingPhoto || isSaving}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
                      title="Remove profile photo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto || isSaving}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-full transition-colors cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-amber-600" /> Upload Photo (Required)
                  </button>
                )}
              </div>
              {fieldErrors.profileImage && (
                <p className="text-[10px] text-rose-600 mb-2 font-medium">{fieldErrors.profileImage}</p>
              )}

              <CardTitle className="text-base font-bold text-slate-900 leading-tight">
                {profile?.name}
              </CardTitle>

              <div className="pt-1.5 flex justify-center">
                {isAdmin ? (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 gap-1 text-[11px] font-semibold py-0.5 px-2.5 rounded-lg">
                    <Shield className="h-3 w-3" /> Super Admin
                  </Badge>
                ) : isCampusAdmin ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 gap-1 text-[11px] font-semibold py-0.5 px-2.5 rounded-lg">
                    <Shield className="h-3 w-3" /> Campus Admin
                  </Badge>
                ) : profile?.verificationStatus === "approved" || profile?.isApproved ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold py-0.5 px-2.5 rounded-lg">
                    Verified Employee
                  </Badge>
                ) : profile?.verificationStatus === "rejected" ? (
                  <Badge variant="destructive" className="text-[11px] font-semibold py-0.5 px-2.5 rounded-lg">
                    Verification Rejected
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-semibold py-0.5 px-2.5 rounded-lg">
                    Pending Verification
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-3.5 space-y-2.5 text-xs">
              {/* Corporate Email */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Corporate Email</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-slate-800 font-semibold text-xs truncate">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{profile?.email}</span>
                </div>
              </div>

              {/* Campus info for campus_admin */}
              {isCampusAdmin && (
                <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100">
                  <span className="text-[9px] font-bold text-blue-500 block uppercase tracking-wider">Assigned Physical Campus</span>
                  <div className="flex items-center justify-between gap-1.5 mt-0.5 text-blue-900 font-semibold text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{profile?.campusName || "—"}</span>
                    </div>
                    <span className="font-mono text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                      {profile?.campusId}
                    </span>
                  </div>
                </div>
              )}

              {/* For employees: show ID, Company, and Campus */}
              {!isAdminOrCampusAdmin && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Emp Id</span>
                      <div className="flex items-center gap-1 mt-0.5 font-mono font-bold text-slate-800 text-xs truncate">
                        <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{profile?.employeeId}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Company</span>
                      <div className="flex items-center gap-1 mt-0.5 text-slate-800 font-medium text-xs truncate">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{profile?.companyName || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Physical Campus</span>
                    <div className="flex items-center justify-between gap-1.5 mt-0.5 text-slate-800 font-medium text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-semibold">{profile?.campusName || "—"}</span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
                        {profile?.campusId}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Security & Access Clearance Card */}
          <Card className="border-slate-200 bg-slate-50/50 shadow-2xs rounded-2xl p-3 space-y-2 border-dashed">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Enterprise Security
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
              <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5 text-slate-400" /> Phone Masking
                </div>
                <div className="text-[9px] text-slate-400">Enabled on listings</div>
              </div>
              <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <CheckCircle className="h-2.5 w-2.5 text-emerald-600" /> Ride OTP
                </div>
                <div className="text-[9px] text-slate-400">Boarding PIN active</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Personal & Commute Settings Form (8 cols on lg) */}
        <div className="lg:col-span-8 flex flex-col">
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <Card className="border-slate-200 shadow-2xs bg-white rounded-2xl overflow-hidden flex-1 flex flex-col justify-between">
              <div>
                <CardHeader className="py-3 px-5 bg-slate-50/70 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                    {isAdminOrCampusAdmin ? "Contact & Display Settings" : "Personal & Commute Settings"}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    {isAdminOrCampusAdmin
                      ? "Update your display name and contact phone number"
                      : "Update your contact details, company, and default carpooling preferences"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 space-y-3.5">
                  {/* Row 1: Name & Phone (2 cols) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold text-slate-700">Full Name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          value={formData.name}
                          onChange={handleChange}
                          disabled={isSaving}
                          className={`pl-9 h-9 text-xs rounded-xl ${fieldErrors.name ? "border-rose-500" : ""}`}
                          required
                        />
                      </div>
                      {fieldErrors.name && <p className="text-[10px] text-rose-600">{fieldErrors.name}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={formData.phone}
                          onChange={handleChange}
                          disabled={isSaving}
                          className={`pl-9 h-9 text-xs rounded-xl ${fieldErrors.phone ? "border-rose-500" : ""}`}
                          required
                        />
                      </div>
                      {fieldErrors.phone && <p className="text-[10px] text-rose-600">{fieldErrors.phone}</p>}
                    </div>
                  </div>

                  {/* Employee-only fields: 2-column grid */}
                  {!isAdminOrCampusAdmin && (
                    <>
                      {/* Row 2: Company & Department */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <Label htmlFor="companyName" className="text-xs font-semibold text-slate-700">Company / Organization</Label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                              id="companyName"
                              name="companyName"
                              type="text"
                              placeholder="e.g. Tech Mahindra"
                              value={formData.companyName}
                              onChange={handleChange}
                              disabled={isSaving}
                              className={`pl-9 h-9 text-xs rounded-xl ${fieldErrors.companyName ? "border-rose-500" : ""}`}
                              required
                            />
                          </div>
                          {fieldErrors.companyName && <p className="text-[10px] text-rose-600">{fieldErrors.companyName}</p>}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="department" className="text-xs font-semibold text-slate-700">Department</Label>
                          <div className="relative">
                            <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                              id="department"
                              name="department"
                              type="text"
                              placeholder="e.g. Cloud & AI"
                              value={formData.department}
                              onChange={handleChange}
                              disabled={isSaving}
                              className={`pl-9 h-9 text-xs rounded-xl ${fieldErrors.department ? "border-rose-500" : ""}`}
                              required
                            />
                          </div>
                          {fieldErrors.department && <p className="text-[10px] text-rose-600">{fieldErrors.department}</p>}
                        </div>
                      </div>

                      {/* Row 3: Home Location & Morning Time */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <Label htmlFor="homeLocation" className="text-xs font-semibold text-slate-700">Home / Starting Neighborhood</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                              id="homeLocation"
                              name="homeLocation"
                              type="text"
                              placeholder="e.g. Tambaram, Velachery"
                              value={formData.homeLocation}
                              onChange={handleChange}
                              disabled={isSaving}
                              className="pl-9 h-9 text-xs rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="departureTimePreference" className="text-xs font-semibold text-slate-700">Morning Departure Time</Label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                              id="departureTimePreference"
                              name="departureTimePreference"
                              type="text"
                              placeholder="e.g. 08:30 AM"
                              value={formData.departureTimePreference}
                              onChange={handleChange}
                              disabled={isSaving}
                              className="pl-9 h-9 text-xs rounded-xl"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Notes */}
                      <div className="space-y-1.5">
                        <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">Ride Preferences & Commute Notes</Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            id="notes"
                            name="notes"
                            type="text"
                            placeholder="e.g. Prefer pickup near Metro Station"
                            value={formData.notes}
                            onChange={handleChange}
                            disabled={isSaving}
                            className="pl-9 h-9 text-xs rounded-xl"
                          />
                        </div>
                      </div>

                      {/* Row 5: Amenities */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                              <Music className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800">Music En Route</div>
                              <div className="text-[10px] text-slate-500">Enjoy radio & music while commuting</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="musicPreference"
                            checked={formData.musicPreference}
                            onChange={handleChange}
                            disabled={isSaving}
                            className="h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer"
                          />
                        </label>

                        <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
                              <Cigarette className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800">Smoking Allowed</div>
                              <div className="text-[10px] text-slate-500">Non-smoking vehicle by default</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="smokingPreference"
                            checked={formData.smokingPreference}
                            onChange={handleChange}
                            disabled={isSaving}
                            className="h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer"
                          />
                        </label>
                      </div>
                    </>
                  )}
                </CardContent>
              </div>

              <CardFooter className="flex justify-end border-t border-slate-100 py-3.5 px-5 bg-slate-50/50">
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 px-6 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
      {/* View Profile Photo Dialog */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-sm p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Profile Photo
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {profile?.name} • {profile?.employeeId}
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 flex justify-center">
            <div className="relative h-64 w-64 rounded-full overflow-hidden border-4 border-emerald-500 shadow-md bg-slate-900">
              {formData.profileImage ? (
                <img
                  src={formData.profileImage}
                  alt={profile?.name || "Employee"}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsViewModalOpen(false);
                openAdjustExistingPhoto();
              }}
              className="gap-1.5 text-xs font-semibold text-slate-700 rounded-xl"
            >
              <Crop className="h-3.5 w-3.5 text-emerald-600" />
              Adjust Photo
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsViewModalOpen(false);
                  fileInputRef.current?.click();
                }}
                className="gap-1.5 text-xs font-semibold text-slate-700 rounded-xl"
              >
                <Camera className="h-3.5 w-3.5" />
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsViewModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 rounded-xl"
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Profile Photo Dialog */}
      <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Crop className="h-4 w-4 text-emerald-600" />
              Adjust Profile Photo
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Drag to reposition, zoom, or rotate your photo inside the circular frame.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Interactive Circular Preview Area */}
            <div
              className="relative mx-auto w-[280px] h-[280px] overflow-hidden rounded-full border-4 border-emerald-500 shadow-lg bg-slate-950 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
            >
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transition: isDragging ? "none" : "transform 0.05s ease-out",
                }}
              >
                {adjustImageSrc && (
                  <img
                    src={adjustImageSrc}
                    alt="Adjust preview"
                    className="max-w-none w-full h-full object-cover select-none pointer-events-none"
                    draggable={false}
                  />
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center font-medium">
              Drag image to reposition • Scroll or use slider to zoom
            </p>

            {/* Adjustment Controls */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              {/* Zoom Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-emerald-600" />
                    Zoom
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.1) * 10) / 10))}
                    className="p-1 rounded-md hover:bg-slate-200 text-slate-500"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10))}
                    className="p-1 rounded-md hover:bg-slate-200 text-slate-500"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Rotate and Reset Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="h-8 gap-1.5 text-xs text-slate-700 rounded-lg"
                >
                  <RotateCw className="h-3.5 w-3.5 text-emerald-600" />
                  Rotate 90°
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    setRotation(0);
                  }}
                  className="h-8 gap-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAdjustModalOpen(false)}
              disabled={isSavingAdjust}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAdjustedPhoto}
              disabled={isSavingAdjust}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
            >
              {isSavingAdjust ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Adjusted Photo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
