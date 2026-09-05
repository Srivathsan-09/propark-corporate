"use client";

import React, { useEffect, useState } from "react";
import {
  Car,
  Search,
  ArrowLeft,
  Check,
  X,
  Loader2,
  Clock,
  Camera,
  Shield,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Eye,
  AlertTriangle,
  FileText,
  Building2,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CarLoader } from "@/components/common/CarLoader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface IVehicle {
  _id: string;
  vehicleType: string;
  make?: string;
  vehicleModel: string;
  color?: string;
  registrationNumber: string;
  normalizedRegistrationNumber?: string;
  seatingCapacity: number;
  availableSeats: number;
  vehiclePhoto?: string;
  numberPlatePhoto?: string;
  drivingLicensePhoto?: string;
  fuelType?: string;
  engineCapacity?: string;
  verificationStatus?:
    | "pending"
    | "approved"
    | "rejected"
    | "PENDING"
    | "VERIFICATION_IN_PROGRESS"
    | "VERIFIED"
    | "MANUAL_REVIEW"
    | "REJECTED"
    | "VERIFICATION_FAILED";
  isApproved?: boolean;
  verificationProvider?: string;
  verificationReference?: string;
  verificationCheckedAt?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  rejectionReason?: string;
  rcData?: {
    rcNumber?: string;
    rcStatus?: string;
    makerDescription?: string;
    makerModel?: string;
    vehicleCategory?: string;
    bodyType?: string;
    fuelType?: string;
    color?: string;
    registrationDate?: string;
    fitnessUpto?: string;
    insuranceUpto?: string;
    insuranceCompany?: string;
    mismatchDetails?: string[];
  };
  status: "active" | "inactive";
  owner?: {
    _id?: string;
    name: string;
    employeeId: string;
    email: string;
    department: string;
    campusId?: string;
    phone?: string;
  };
  createdAt: string;
}

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<IVehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Photo viewer modal state
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  // Verification Details Modal
  const [detailsVehicle, setDetailsVehicle] = useState<IVehicle | null>(null);

  // Rejection Reason Modal
  const [rejectVehicle, setRejectVehicle] = useState<IVehicle | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

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

  const handleVerify = async (
    vehicleId: string,
    action: "approve" | "reject" | "manual_review" | "reverify",
    rejectionReason?: string
  ) => {
    try {
      setActionLoadingId(vehicleId);
      setActionMessage(null);

      const res = await fetch(`/api/admin/vehicles/${vehicleId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const updated = data.vehicle;
        setVehicles((prev) =>
          prev.map((v) => (v._id === vehicleId ? { ...v, ...updated } : v))
        );

        if (detailsVehicle && detailsVehicle._id === vehicleId) {
          setDetailsVehicle((prev) => (prev ? { ...prev, ...updated } : null));
        }

        setActionMessage({
          type: "success",
          text: data.message || `Action ${action} completed successfully.`,
        });

        // Close reject modal if open
        setRejectVehicle(null);
        setRejectionReasonInput("");
      } else {
        setActionMessage({
          type: "error",
          text: data.error || "Action failed. Please try again.",
        });
      }
    } catch (e) {
      console.error("Failed to execute vehicle action:", e);
      setActionMessage({
        type: "error",
        text: "Network error while connecting to verification service.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const submitRejection = () => {
    if (!rejectionReasonInput.trim()) {
      setRejectError("Please enter a reason for rejection.");
      return;
    }
    if (rejectVehicle) {
      handleVerify(rejectVehicle._id, "reject", rejectionReasonInput.trim());
    }
  };

  const filtered = vehicles.filter((veh) => {
    const term = searchTerm.toLowerCase();
    return (
      veh.vehicleModel.toLowerCase().includes(term) ||
      veh.registrationNumber.toLowerCase().includes(term) ||
      veh.vehicleType.toLowerCase().includes(term) ||
      (veh.make && veh.make.toLowerCase().includes(term)) ||
      (veh.owner?.name && veh.owner.name.toLowerCase().includes(term)) ||
      (veh.owner?.employeeId && veh.owner.employeeId.toLowerCase().includes(term)) ||
      (veh.owner?.department && veh.owner.department.toLowerCase().includes(term)) ||
      (veh.verificationStatus && veh.verificationStatus.toLowerCase().includes(term))
    );
  });

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
            <Link
              href="/admin"
              className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Vehicle RC Verification
          </h1>
          <p className="text-xs text-slate-500">
            Review, verify, and approve employee vehicles with Way2API vehicle RC registry.
          </p>
        </div>

        <div className="w-full sm:w-80">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search plate, model, maker, or driver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-sm rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900">
            Registered Fleet ({filtered.length})
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Verified:{" "}
              {vehicles.filter((v) => v.verificationStatus === "VERIFIED" || v.verificationStatus === "approved" || v.isApproved).length}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Review:{" "}
              {vehicles.filter((v) => v.verificationStatus === "MANUAL_REVIEW").length}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Rejected:{" "}
              {vehicles.filter((v) => v.verificationStatus === "REJECTED" || v.verificationStatus === "rejected").length}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No vehicles found matching search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-3 px-4 font-semibold">Driver</th>
                    <th className="py-3 px-4 font-semibold">Vehicle</th>
                    <th className="py-3 px-4 font-semibold">Plate No.</th>
                    <th className="py-3 px-4 font-semibold">Photos</th>
                    <th className="py-3 px-4 font-semibold">RC Status</th>
                    <th className="py-3 px-4 font-semibold">Checked On</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((veh) => {
                    const isApproved =
                      veh.isApproved ||
                      veh.verificationStatus === "approved" ||
                      veh.verificationStatus === "VERIFIED";

                    const status = veh.verificationStatus || (isApproved ? "VERIFIED" : "PENDING");
                    const isVerified = status === "VERIFIED" || status === "approved" || isApproved;
                    const isManualReview = status === "MANUAL_REVIEW";
                    const isRejected = status === "REJECTED" || status === "rejected";
                    const isFailed = status === "VERIFICATION_FAILED";

                    return (
                      <tr key={veh._id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Driver Column */}
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <span className="font-semibold text-slate-900 block">
                            {veh.owner?.name || "Employee"}
                          </span>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {veh.owner?.employeeId}
                          </div>
                          {veh.owner?.campusId && (
                            <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                              <Building2 className="h-2.5 w-2.5" />
                              {veh.owner.campusId}
                            </div>
                          )}
                        </td>

                        {/* Vehicle Column */}
                        <td className="py-3 px-4 text-slate-900">
                          <div className="font-semibold text-xs">
                            {veh.make ? `${veh.make} ` : ""}
                            {veh.vehicleModel}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {veh.vehicleType}
                            </Badge>
                            {veh.color && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-600">
                                {veh.color}
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Plate Number */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                          {veh.registrationNumber}
                        </td>

                        {/* Photos */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {veh.vehiclePhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: veh.vehiclePhoto!,
                                    title: `Vehicle: ${veh.vehicleModel} (${veh.registrationNumber})`,
                                  })
                                }
                                className="h-8 w-10 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity"
                                title="View Vehicle Photo"
                              >
                                <img
                                  src={veh.vehiclePhoto}
                                  alt="Vehicle"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">No Photo</span>
                            )}

                            {veh.numberPlatePhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: veh.numberPlatePhoto!,
                                    title: `Plate: ${veh.registrationNumber}`,
                                  })
                                }
                                className="h-8 w-10 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity"
                                title="View Plate Photo"
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
                                    title: `License: ${veh.owner?.name || "Employee"} (${veh.registrationNumber})`,
                                  })
                                }
                                className="h-8 w-10 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity"
                                title="View License"
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

                        {/* RC Verification Status */}
                        <td className="py-3 px-4">
                          {isVerified ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold gap-1">
                              <CheckCircle className="h-3 w-3 text-emerald-600" /> Verified
                            </Badge>
                          ) : isManualReview ? (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-semibold gap-1">
                              <Clock className="h-3 w-3 text-amber-600" /> Manual Review
                            </Badge>
                          ) : isRejected ? (
                            <Badge variant="destructive" className="text-[10px] font-semibold gap-1">
                              <X className="h-3 w-3" /> Rejected
                            </Badge>
                          ) : isFailed ? (
                            <Badge className="bg-slate-100 text-slate-800 border-slate-300 text-[10px] font-semibold gap-1">
                              <AlertCircle className="h-3 w-3 text-slate-600" /> Provider Failed
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold">
                              Pending
                            </Badge>
                          )}
                          {veh.rcData?.mismatchDetails && veh.rcData.mismatchDetails.length > 0 && (
                            <span
                              className="text-[10px] text-amber-700 font-semibold block mt-0.5 truncate max-w-[140px]"
                              title={veh.rcData.mismatchDetails.join("; ")}
                            >
                              ⚠ Mismatch flagged
                            </span>
                          )}
                        </td>

                        {/* Checked On */}
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div>
                            {veh.verificationCheckedAt
                              ? new Date(veh.verificationCheckedAt).toLocaleDateString()
                              : new Date(veh.createdAt).toLocaleDateString()}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {veh.verificationProvider || "Way2API"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDetailsVehicle(veh)}
                              className="h-8 px-2.5 text-xs gap-1 rounded-lg text-slate-700 hover:bg-slate-100"
                              title="View RC details & verification audit"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </Button>

                            {/* Re-verify */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerify(veh._id, "reverify")}
                              disabled={actionLoadingId === veh._id}
                              className="h-8 px-2 text-xs rounded-lg text-slate-600 hover:bg-slate-100"
                              title="Re-run Way2API Verification"
                            >
                              {actionLoadingId === veh._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                            </Button>

                            {/* Approve */}
                            {!isVerified && (
                              <Button
                                size="sm"
                                onClick={() => handleVerify(veh._id, "approve")}
                                disabled={actionLoadingId === veh._id}
                                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-semibold rounded-lg shadow-xs"
                              >
                                {actionLoadingId === veh._id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </Button>
                            )}

                            {/* Reject */}
                            {!isRejected && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRejectVehicle(veh);
                                  setRejectionReasonInput(veh.rejectionReason || "");
                                  setRejectError(null);
                                }}
                                disabled={actionLoadingId === veh._id}
                                className="h-8 px-2.5 border-rose-300 text-rose-700 hover:bg-rose-50 text-xs gap-1 rounded-lg font-semibold"
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

      {/* DETAILS MODAL */}
      <Dialog open={Boolean(detailsVehicle)} onOpenChange={() => setDetailsVehicle(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              <span>Vehicle RC Verification Details</span>
            </DialogTitle>
          </DialogHeader>

          {detailsVehicle && (
            <div className="space-y-4 text-xs text-slate-700 pt-2">
              {/* Driver Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Driver</span>
                  <span className="font-bold text-slate-900">{detailsVehicle.owner?.name || "Employee"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Employee ID</span>
                  <span className="font-mono">{detailsVehicle.owner?.employeeId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Campus</span>
                  <span>{detailsVehicle.owner?.campusId || "Default"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Department</span>
                  <span>{detailsVehicle.owner?.department || "General"}</span>
                </div>
              </div>

              {/* Mismatch Alert Box */}
              {detailsVehicle.rcData?.mismatchDetails && detailsVehicle.rcData.mismatchDetails.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Registry Discrepancy Warnings Detected</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                    {detailsVehicle.rcData.mismatchDetails.map((msg, idx) => (
                      <li key={idx}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Comparison Table: Driver Input vs Way2API Official RC */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800 text-xs border-b border-slate-200">
                  Data Comparison (Driver Submission vs National Registry)
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500">
                      <th className="py-2 px-3 font-semibold">Field</th>
                      <th className="py-2 px-3 font-semibold">Driver Submitted</th>
                      <th className="py-2 px-3 font-semibold">Way2API Registry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Plate Number</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        {detailsVehicle.registrationNumber}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-800">
                        {detailsVehicle.rcData?.rcNumber || detailsVehicle.normalizedRegistrationNumber || detailsVehicle.registrationNumber}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Make / Manufacturer</td>
                      <td className="py-2 px-3">{detailsVehicle.make || "Not specified"}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {detailsVehicle.rcData?.makerDescription || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Model</td>
                      <td className="py-2 px-3 font-medium">{detailsVehicle.vehicleModel}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {detailsVehicle.rcData?.makerModel || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Vehicle Type / Category</td>
                      <td className="py-2 px-3">{detailsVehicle.vehicleType}</td>
                      <td className="py-2 px-3">
                        {detailsVehicle.rcData?.vehicleCategory || detailsVehicle.rcData?.bodyType || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Fuel Type</td>
                      <td className="py-2 px-3">{detailsVehicle.fuelType || "Petrol"}</td>
                      <td className="py-2 px-3">{detailsVehicle.rcData?.fuelType || "—"}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Color</td>
                      <td className="py-2 px-3">{detailsVehicle.color || "—"}</td>
                      <td className="py-2 px-3">{detailsVehicle.rcData?.color || "—"}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">RC Active Status</td>
                      <td className="py-2 px-3">—</td>
                      <td className="py-2 px-3">
                        <Badge
                          className={
                            detailsVehicle.rcData?.rcStatus === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 border-0"
                              : "bg-rose-100 text-rose-800 border-0"
                          }
                        >
                          {detailsVehicle.rcData?.rcStatus || "ACTIVE"}
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Fitness Valid Upto</td>
                      <td className="py-2 px-3">—</td>
                      <td className="py-2 px-3 font-medium">
                        {detailsVehicle.rcData?.fitnessUpto || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Insurance Validity</td>
                      <td className="py-2 px-3">—</td>
                      <td className="py-2 px-3">
                        {detailsVehicle.rcData?.insuranceCompany ? (
                          <div>
                            <span>{detailsVehicle.rcData.insuranceCompany}</span>
                            {detailsVehicle.rcData.insuranceUpto && (
                              <div className="text-[10px] text-slate-500">
                                Upto: {detailsVehicle.rcData.insuranceUpto}
                              </div>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Audit & Notes */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Provider:</span>
                  <span className="font-mono text-slate-800">
                    {detailsVehicle.verificationProvider || "way2api"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Order / Reference ID:</span>
                  <span className="font-mono text-slate-800">
                    {detailsVehicle.verificationReference || "—"}
                  </span>
                </div>
                {detailsVehicle.rejectionReason && (
                  <div className="pt-1 border-t border-slate-200">
                    <span className="font-bold text-rose-700 block">Rejection Reason:</span>
                    <span className="text-rose-800">{detailsVehicle.rejectionReason}</span>
                  </div>
                )}
                {detailsVehicle.verificationNotes && (
                  <div className="pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-700 block">Verification Notes:</span>
                    <span className="text-slate-800">{detailsVehicle.verificationNotes}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer inside modal */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVerify(detailsVehicle._id, "reverify")}
                  disabled={actionLoadingId === detailsVehicle._id}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Re-verify with Way2API
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectVehicle(detailsVehicle);
                      setRejectionReasonInput(detailsVehicle.rejectionReason || "");
                      setRejectError(null);
                    }}
                    disabled={actionLoadingId === detailsVehicle._id}
                    className="border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleVerify(detailsVehicle._id, "approve")}
                    disabled={actionLoadingId === detailsVehicle._id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve Vehicle
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON PROMPT MODAL */}
      <Dialog open={Boolean(rejectVehicle)} onOpenChange={() => setRejectVehicle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              <span>Reject Vehicle Verification</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-slate-600">
              Please enter the reason for rejecting vehicle{" "}
              <strong className="text-slate-900">{rejectVehicle?.registrationNumber}</strong>. This
              reason will be displayed to the driver so they can correct their details.
            </p>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Rejection Reason *</label>
              <Input
                placeholder="e.g. Vehicle model does not match RC verification."
                value={rejectionReasonInput}
                onChange={(e) => {
                  setRejectionReasonInput(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                className="rounded-xl text-xs"
              />
              {rejectError && <p className="text-xs text-rose-600">{rejectError}</p>}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400">Quick Reasons:</span>
              {[
                "Vehicle model does not match RC verification.",
                "Vehicle manufacturer mismatch.",
                "RC status is suspended/inactive.",
                "Invalid registration plate number.",
              ].map((reason, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRejectionReasonInput(reason)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md"
                >
                  {reason.slice(0, 24)}...
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectVehicle(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitRejection}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold"
              disabled={Boolean(actionLoadingId)}
            >
              {actionLoadingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
