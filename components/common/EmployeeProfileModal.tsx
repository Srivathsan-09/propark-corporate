"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  MapPin,
  Car,
  Calendar,
  X,
  Award,
  Music,
  Cigarette,
  CigaretteOff,
  Navigation,
  CheckCircle2,
  Clock,
  Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CarLoader } from "@/components/common/CarLoader";
import { getInitials } from "@/lib/utils";

interface EmployeeProfileData {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
  phone?: string;
  companyName: string;
  department: string;
  campusId?: string;
  campusName?: string;
  role: string;
  profileImage?: string;
  verificationStatus: string;
  isApproved: boolean;
  homeLocation?: string;
  commutePreferences?: {
    departureTimePreference?: string;
    notes?: string;
    smokingPreference?: boolean;
    musicPreference?: boolean;
  };
  createdAt?: string;
  vehicles?: {
    _id: string;
    vehicleModel: string;
    vehicleType: string;
    registrationNumber: string;
    seatingCapacity: number;
    verificationStatus: string;
  }[];
  stats?: {
    ridesOffered: number;
    ridesCompleted: number;
    ridesTaken: number;
  };
}

interface EmployeeProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  fallbackData?: Partial<EmployeeProfileData> | null;
}

export function EmployeeProfileModal({
  isOpen,
  onClose,
  userId,
  fallbackData,
}: EmployeeProfileModalProps) {
  const [profile, setProfile] = useState<EmployeeProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProfile(null);
      setError(null);
      return;
    }

    if (userId) {
      setIsLoading(true);
      setError(null);
      fetch(`/api/profile/${userId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile) {
            setProfile(data.profile);
          } else {
            // Fall back to provided fallbackData
            if (fallbackData) {
              setProfile(fallbackData as EmployeeProfileData);
            } else {
              setError(data.error || "Failed to load employee profile.");
            }
          }
        })
        .catch(() => {
          if (fallbackData) {
            setProfile(fallbackData as EmployeeProfileData);
          } else {
            setError("Network error while retrieving employee details.");
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (fallbackData) {
      setProfile(fallbackData as EmployeeProfileData);
      setIsLoading(false);
    }
  }, [isOpen, userId, fallbackData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Corporate Employee Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[82vh] overflow-y-auto space-y-4 text-xs">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <CarLoader size="inline" message="Loading employee credentials..." />
            </div>
          ) : error && !profile ? (
            <div className="py-8 text-center text-rose-600 space-y-2">
              <p className="font-semibold">{error}</p>
              <Button size="sm" variant="outline" onClick={onClose} className="rounded-lg text-xs">
                Close
              </Button>
            </div>
          ) : profile ? (
            <>
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-gradient-to-br from-purple-50/50 via-slate-50 to-indigo-50/40 border border-slate-200/80">
                <div className="h-16 w-16 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xl shadow-md border-2 border-white shrink-0">
                  {getInitials(profile.name || "Employee")}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                    <span className="font-mono text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded border border-purple-200 tracking-wide">
                      {profile.employeeId}
                    </span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-slate-600">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-emerald-800">{profile.companyName || "Tech Mahindra"}</span>
                    <span>• {profile.department || "General"}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0.5 px-2 gap-1">
                      <ShieldCheck className="h-3 w-3" /> Corporate Verified
                    </Badge>
                    {profile.campusId && (
                      <Badge variant="outline" className="text-slate-600 border-slate-200 text-[10px] py-0.5 px-2 font-medium">
                        Campus: {profile.campusId}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Commute Statistics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Rides Offered</span>
                  <span className="text-sm font-bold text-purple-700 mt-0.5 block">
                    {profile.stats?.ridesOffered ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Completed</span>
                  <span className="text-sm font-bold text-emerald-700 mt-0.5 block">
                    {profile.stats?.ridesCompleted ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Rides Taken</span>
                  <span className="text-sm font-bold text-blue-700 mt-0.5 block">
                    {profile.stats?.ridesTaken ?? 0}
                  </span>
                </div>
              </div>

              {/* Corporate Contact & Location Information */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Corporate Verification & Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </div>

                  {profile.phone && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{profile.phone}</span>
                    </div>
                  )}

                  {profile.campusName && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{profile.campusName}</span>
                    </div>
                  )}

                  {profile.homeLocation && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Navigation className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">Home: {profile.homeLocation}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Fleet (Vehicles) */}
              {profile.vehicles && profile.vehicles.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5 text-slate-500" />
                    Verified Campus Vehicles ({profile.vehicles.length})
                  </span>

                  <div className="space-y-1.5">
                    {profile.vehicles.map((v) => (
                      <div
                        key={v._id}
                        className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900 text-xs">{v.vehicleModel}</span>
                          <span className="text-[11px] text-slate-500 block">
                            {v.vehicleType} • {v.seatingCapacity} Seater
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 block">
                            {v.registrationNumber}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 inline-block">
                            ✓ Verified
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commute Preferences */}
              {profile.commutePreferences && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Commute Preferences
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1">
                      <Music className="h-3 w-3 text-purple-600" />
                      Music: {profile.commutePreferences.musicPreference !== false ? "Allowed" : "Quiet Ride"}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1">
                      <CigaretteOff className="h-3 w-3 text-emerald-600" />
                      Smoking: Non-Smoking
                    </span>
                    {profile.commutePreferences.departureTimePreference && (
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-blue-600" />
                        Preferred: {profile.commutePreferences.departureTimePreference}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-3.5 bg-slate-50 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-4 text-xs font-semibold rounded-lg"
          >
            Close Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
