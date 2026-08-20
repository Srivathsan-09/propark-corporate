"use client";

import React, { useEffect, useState } from "react";
import { Car, Search, ArrowLeft, Check, X, Loader2, Clock, Camera } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CarLoader } from "@/components/common/CarLoader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IVehicle {
  _id: string;
  vehicleType: string;
  vehicleModel: string;
  registrationNumber: string;
  seatingCapacity: number;
  availableSeats: number;
  vehiclePhoto?: string;
  numberPlatePhoto?: string;
  drivingLicensePhoto?: string;
  verificationStatus?: "pending" | "approved" | "rejected";
  isApproved?: boolean;
  rejectionReason?: string;
  status: "active" | "inactive";
  owner?: {
    name: string;
    employeeId: string;
    email: string;
    department: string;
  };
  createdAt: string;
}

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<IVehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Photo viewer modal state
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const fetchVehicles = async () => {
    try {
      const res = await fetch("/api/admin/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
      }
    } catch (err) {
      console.error("Failed to load vehicles:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleVerify = async (vehicleId: string, action: "approve" | "reject") => {
    try {
      setActionLoadingId(vehicleId);
      const res = await fetch(`/api/admin/vehicles/${vehicleId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const data = await res.json();
        setVehicles((prev) =>
          prev.map((v) =>
            v._id === vehicleId
              ? {
                  ...v,
                  verificationStatus: action === "approve" ? "approved" : "rejected",
                  isApproved: action === "approve",
                }
              : v
          )
        );
      }
    } catch (e) {
      console.error("Failed to verify vehicle:", e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = vehicles.filter(
    (veh) =>
      veh.vehicleModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      veh.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      veh.vehicleType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (veh.owner?.name && veh.owner.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading employee vehicles & fleet records..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Campus Registered Fleet & Verification
          </h1>
          <p className="text-xs text-slate-500">
            Verify employee vehicle photos, number plates, and approve vehicles for campus carpooling
          </p>
        </div>

        <div className="w-full sm:w-80">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by model, plate, or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-sm rounded-xl"
            />
          </div>
        </div>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900">
            Registered Fleet ({filtered.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <CarLoader size="lg" message="Loading employee vehicles..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No vehicles found matching search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-3 px-4 font-semibold">Vehicle</th>
                    <th className="py-3 px-4 font-semibold">Plate Number</th>
                    <th className="py-3 px-4 font-semibold">Photos</th>
                    <th className="py-3 px-4 font-semibold">Owner</th>
                    <th className="py-3 px-4 font-semibold">Capacity</th>
                    <th className="py-3 px-4 font-semibold">Verification</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((veh) => {
                    const isApproved = veh.isApproved || veh.verificationStatus === "approved";

                    return (
                      <tr key={veh._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div>{veh.vehicleModel}</div>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">
                            {veh.vehicleType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                          {veh.registrationNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {veh.vehiclePhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: veh.vehiclePhoto!,
                                    title: `Vehicle: ${veh.vehicleModel} (${veh.registrationNumber})`,
                                  })
                                }
                                className="relative h-10 w-12 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity"
                                title="Click to view full vehicle photo"
                              >
                                <img
                                  src={veh.vehiclePhoto}
                                  alt="Vehicle"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">No Photo</span>
                            )}

                            {veh.numberPlatePhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: veh.numberPlatePhoto!,
                                    title: `Number Plate: ${veh.registrationNumber}`,
                                  })
                                }
                                className="relative h-10 w-12 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity"
                                title="Click to view license plate photo"
                              >
                                <img
                                  src={veh.numberPlatePhoto}
                                  alt="Plate"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : null}

                            {veh.drivingLicensePhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: veh.drivingLicensePhoto!,
                                    title: `Driver's License: ${veh.owner?.name || "Employee"} (${veh.registrationNumber})`,
                                  })
                                }
                                className="relative h-10 w-12 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity"
                                title="Click to view driver's license photo"
                              >
                                <img
                                  src={veh.drivingLicensePhoto}
                                  alt="License"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">{veh.owner?.name || "Employee"}</span>
                          <div className="text-[11px] text-slate-500 font-mono">{veh.owner?.employeeId}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          <div>{veh.seatingCapacity} Total</div>
                          <div className="text-emerald-700 font-semibold">{veh.availableSeats} Offerable</div>
                        </td>
                        <td className="py-3 px-4">
                          {isApproved ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                              Verified
                            </Badge>
                          ) : veh.verificationStatus === "rejected" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Rejected
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                              Pending Review
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isApproved && (
                              <Button
                                size="sm"
                                onClick={() => handleVerify(veh._id, "approve")}
                                disabled={actionLoadingId === veh._id}
                                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-semibold rounded-lg shadow-xs"
                              >
                                {actionLoadingId === veh._id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </Button>
                            )}
                            {veh.verificationStatus !== "rejected" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleVerify(veh._id, "reject")}
                                disabled={actionLoadingId === veh._id}
                                className="h-8 px-3 border-rose-300 text-rose-700 hover:bg-rose-50 text-xs gap-1.5 rounded-lg font-semibold"
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PHOTO PREVIEW MODAL */}
      <Dialog open={Boolean(previewPhoto)} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {previewPhoto?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 max-h-[70vh] flex items-center justify-center bg-slate-950">
            {previewPhoto && (
              <img
                src={previewPhoto.url}
                alt="Enlarged verification preview"
                className="max-h-[65vh] w-auto object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
