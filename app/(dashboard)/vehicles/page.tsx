"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Car,
  Plus,
  Edit2,
  Trash2,
  Users,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle,
  Hash,
  Upload,
  Camera,
  Image as ImageIcon,
  Check,
  Clock,
  X,
  FileBadge,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { CarLoader } from "@/components/common/CarLoader";
import { vehicleSchema } from "@/validations/vehicle.schema";
import { compressImage } from "@/lib/utils/imageCompressor";

interface IVehicle {
  _id: string;
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  fuelType?: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";
  engineCapacity?: string;
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
  createdAt: string;
}

export default function VehiclesPage() {
  const { data: session, status: sessionStatus } = useSession();

  const [vehicles, setVehicles] = useState<IVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [compressingField, setCompressingField] = useState<string | null>(null);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active vehicle under edit/delete
  const [selectedVehicle, setSelectedVehicle] = useState<IVehicle | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    vehicleType: "Car" as "Car" | "SUV" | "Van" | "Bike" | "Other",
    fuelType: "Petrol" as "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid",
    engineCapacity: "",
    vehicleModel: "",
    registrationNumber: "",
    seatingCapacity: 4,
    availableSeats: 3,
    vehiclePhoto: "",
    numberPlatePhoto: "",
    drivingLicensePhoto: "",
    status: "active" as "active" | "inactive",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const vehicleFileInputRef = useRef<HTMLInputElement>(null);
  const plateFileInputRef = useRef<HTMLInputElement>(null);
  const licenseFileInputRef = useRef<HTMLInputElement>(null);

  const fetchVehicles = async () => {
    try {
      const res = await fetch("/api/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
      }
    } catch (err) {
      console.error("Failed to load vehicles:", err);
      setErrorMessage("Failed to load vehicles from database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchVehicles();
    } else if (sessionStatus === "unauthenticated") {
      setIsLoading(false);
    }
  }, [sessionStatus]);

  const resetForm = () => {
    setFormData({
      vehicleType: "Car",
      fuelType: "Petrol",
      engineCapacity: "",
      vehicleModel: "",
      registrationNumber: "",
      seatingCapacity: 4,
      availableSeats: 3,
      vehiclePhoto: "",
      numberPlatePhoto: "",
      drivingLicensePhoto: "",
      status: "active",
    });
    setFieldErrors({});
    setSelectedVehicle(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleOpenEdit = (vehicle: IVehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      vehicleType: vehicle.vehicleType,
      fuelType: vehicle.fuelType || "Petrol",
      engineCapacity: vehicle.engineCapacity || "",
      vehicleModel: vehicle.vehicleModel,
      registrationNumber: vehicle.registrationNumber,
      seatingCapacity: vehicle.seatingCapacity,
      availableSeats: vehicle.availableSeats,
      vehiclePhoto: vehicle.vehiclePhoto || "",
      numberPlatePhoto: vehicle.numberPlatePhoto || "",
      drivingLicensePhoto: vehicle.drivingLicensePhoto || "",
      status: vehicle.status,
    });
    setFieldErrors({});
    setIsEditOpen(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleOpenDelete = (vehicle: IVehicle) => {
    setSelectedVehicle(vehicle);
    setIsDeleteOpen(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleTypeChange = (value: "Car" | "SUV" | "Van" | "Bike" | "Other") => {
    let cap = formData.seatingCapacity;
    let avail = formData.availableSeats;

    if (value === "Bike") {
      cap = 2;
      avail = 1;
    } else if (value === "Car" && cap === 2) {
      cap = 4;
      avail = 3;
    } else if (value === "SUV" && cap < 6) {
      cap = 6;
      avail = 4;
    }

    setFormData((prev) => ({
      ...prev,
      vehicleType: value,
      seatingCapacity: cap,
      availableSeats: avail,
    }));
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "vehiclePhoto" | "numberPlatePhoto" | "drivingLicensePhoto"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressingField(field);
      setDialogError(null);

      // Auto-compress mobile camera photo to lightweight ~80-120KB JPEG
      const compressedDataUrl = await compressImage(file, 1000, 0.75);

      setFormData((prev) => ({
        ...prev,
        [field]: compressedDataUrl,
      }));
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    } catch (err) {
      console.error("Image compression error:", err);
      setFieldErrors((prev) => ({
        ...prev,
        [field]: "Could not process this image. Please choose another photo.",
      }));
    } finally {
      setCompressingField(null);
      e.target.value = "";
    }
  };

  // Submit Handler for Add / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    setDialogError(null);
    setFieldErrors({});

    const validation = vehicleSchema.safeParse(formData);
    if (!validation.success) {
      const formattedErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          formattedErrors[err.path[0].toString()] = err.message;
        }
      });
      const firstError = validation.error.errors[0]?.message || "Please complete all required fields.";
      setFieldErrors(formattedErrors);
      setDialogError(firstError);
      return;
    }

    if (!formData.vehiclePhoto) {
      const msg = "Please upload the full vehicle photo.";
      setFieldErrors((prev) => ({ ...prev, vehiclePhoto: msg }));
      setDialogError(msg);
      return;
    }

    if (!formData.numberPlatePhoto) {
      const msg = "Please upload the number plate photo.";
      setFieldErrors((prev) => ({ ...prev, numberPlatePhoto: msg }));
      setDialogError(msg);
      return;
    }

    if (!formData.drivingLicensePhoto) {
      const msg = "Please upload the driver's license copy.";
      setFieldErrors((prev) => ({ ...prev, drivingLicensePhoto: msg }));
      setDialogError(msg);
      return;
    }

    setIsSubmitting(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const endpoint = selectedVehicle ? `/api/vehicles/${selectedVehicle._id}` : "/api/vehicles";
      const method = selectedVehicle ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data.error || (data.details ? data.details.join(", ") : "Failed to register vehicle.");
        setDialogError(errorMsg);
        setErrorMessage(errorMsg);
        setIsSubmitting(false);
        return;
      }

      if (selectedVehicle) {
        setVehicles((prev) =>
          prev.map((v) => (v._id === selectedVehicle._id ? data.vehicle : v))
        );
        setSuccessMessage("Vehicle details updated successfully.");
        setIsEditOpen(false);
      } else {
        setVehicles((prev) => [data.vehicle, ...prev]);
        setSuccessMessage("Vehicle and documents submitted for campus admin verification!");
        setIsAddOpen(false);
      }
      resetForm();
    } catch (err: any) {
      console.error("Vehicle submission error:", err);
      const msg =
        err.name === "AbortError"
          ? "Submission timed out. Please check your internet connection and try again."
          : "A network error occurred while submitting. Please try again.";
      setDialogError(msg);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVehicle) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/vehicles/${selectedVehicle._id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to delete vehicle.");
        setIsSubmitting(false);
        return;
      }

      setVehicles((prev) => prev.filter((v) => v._id !== selectedVehicle._id));
      setSuccessMessage("Vehicle removed successfully.");
      setIsDeleteOpen(false);
      resetForm();
    } catch (err) {
      console.error("Vehicle delete error:", err);
      setErrorMessage("Failed to delete vehicle. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Vehicle Management
          </h1>
          <p className="text-sm text-slate-500">
            Register your car or two-wheeler with number plate & driver&apos;s license verification to offer rides
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-2 self-start sm:self-auto rounded-xl shadow-xs"
        >
          <Plus className="h-4 w-4" /> Register New Vehicle
        </Button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200 animate-in fade-in-50">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200 animate-in fade-in-50">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Vehicles Grid / Empty State */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <CarLoader size="page" message="Loading your registered vehicles..." />
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No registered vehicles"
          description="Register your car or two-wheeler with vehicle photo, number plate, and driving license to start offering rides."
          actionLabel="Register Vehicle"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => {
            const isApproved = vehicle.isApproved || vehicle.verificationStatus === "approved";
            const isPending = !isApproved && vehicle.verificationStatus !== "rejected";

            return (
              <Card
                key={vehicle._id}
                className="border-slate-200 bg-white hover:border-slate-300 shadow-sm rounded-2xl overflow-hidden transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Photo Preview Header */}
                  <div className="relative h-44 w-full bg-slate-100 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                    {vehicle.vehiclePhoto ? (
                      <img
                        src={vehicle.vehiclePhoto}
                        alt={vehicle.vehicleModel}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
                        <Car className="h-10 w-10 stroke-1" />
                        <span className="text-xs">No Photo Uploaded</span>
                      </div>
                    )}

                    {/* Number Plate Badge Overlay */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-xs font-mono font-bold shadow-md border border-white/20">
                      <Hash className="h-3 w-3 text-emerald-400" />
                      <span>{vehicle.registrationNumber}</span>
                    </div>

                    {/* Verification Status Overlay */}
                    <div className="absolute top-2 right-2">
                      {isApproved ? (
                        <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-bold shadow-sm">
                          Verified
                        </Badge>
                      ) : vehicle.verificationStatus === "rejected" ? (
                        <Badge variant="destructive" className="text-[10px] font-bold shadow-sm">
                          Rejected
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500 text-white border-0 text-[10px] font-bold shadow-sm">
                          Pending Approval
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardHeader className="pb-3 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {vehicle.vehicleType}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-medium border-emerald-200 text-emerald-800 bg-emerald-50">
                          {vehicle.fuelType || "Petrol"}
                        </Badge>
                        {vehicle.engineCapacity && (
                          <Badge variant="outline" className="text-[11px] font-normal text-slate-500">
                            {vehicle.engineCapacity}
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant={vehicle.status === "active" ? "outline" : "secondary"}
                        className="text-[11px]"
                      >
                        {vehicle.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900 mt-2">
                      {vehicle.vehicleModel}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3 text-xs text-slate-600">
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Total Capacity</span>
                        <span className="font-semibold text-slate-800">{vehicle.seatingCapacity} seats</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Offerable Seats</span>
                        <span className="font-semibold text-emerald-700">{vehicle.availableSeats} available</span>
                      </div>
                    </div>

                    {/* Documents Thumbnail preview */}
                    <div className="flex items-center gap-3 pt-1">
                      {vehicle.numberPlatePhoto && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Plate:</span>
                          <img
                            src={vehicle.numberPlatePhoto}
                            alt="Plate"
                            className="h-6 w-10 object-cover rounded border border-slate-200"
                          />
                        </div>
                      )}

                      {vehicle.drivingLicensePhoto && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">License:</span>
                          <img
                            src={vehicle.drivingLicensePhoto}
                            alt="License"
                            className="h-6 w-10 object-cover rounded border border-slate-200"
                          />
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200/60 leading-tight">
                        Awaiting campus admin review. You can offer rides once verified.
                      </p>
                    )}
                  </CardContent>
                </div>

                <CardFooter className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 pb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(vehicle)}
                    className="h-8 gap-1 text-xs"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDelete(vehicle)}
                    className="h-8 gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* REGISTER / EDIT VEHICLE DIALOG */}
      <Dialog
        open={isAddOpen || isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setIsEditOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {isEditOpen ? "Edit Vehicle & Document Details" : "Register New Vehicle"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Upload your vehicle photo, number plate, and driving license for campus security authorization.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {dialogError && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-800 border border-rose-200 animate-in fade-in-50">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{dialogError}</span>
                </div>
              )}

              {/* Vehicle Type */}
              <div className="space-y-1.5">
                <Label htmlFor="vehicleType" className="text-xs font-semibold text-slate-700">
                  Vehicle Type
                </Label>
                <Select
                  value={formData.vehicleType}
                  onValueChange={(val: "Car" | "SUV" | "Van" | "Bike" | "Other") => handleTypeChange(val)}
                >
                  <SelectTrigger id="vehicleType" className="rounded-xl">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Car">Car (Sedan / Hatchback)</SelectItem>
                    <SelectItem value="SUV">SUV / Compact SUV</SelectItem>
                    <SelectItem value="Bike">Bike / Two-Wheeler</SelectItem>
                    <SelectItem value="Van">Van / Minivan</SelectItem>
                    <SelectItem value="Other">Other Vehicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fuel Type & Engine Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fuelType" className="text-xs font-semibold text-slate-700">
                    Fuel Type
                  </Label>
                  <Select
                    value={formData.fuelType}
                    onValueChange={(val: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid") =>
                      setFormData((prev) => ({ ...prev, fuelType: val }))
                    }
                  >
                    <SelectTrigger id="fuelType" className="rounded-xl">
                      <SelectValue placeholder="Select fuel type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Petrol">Petrol</SelectItem>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="CNG">CNG</SelectItem>
                      <SelectItem value="Electric">Electric (Zero Tailpipe)</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="engineCapacity" className="text-xs font-semibold text-slate-700">
                    Engine Capacity (Optional)
                  </Label>
                  <Input
                    id="engineCapacity"
                    placeholder="e.g. 1197cc or 1.5L"
                    value={formData.engineCapacity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, engineCapacity: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Vehicle Model */}
              <div className="space-y-1.5">
                <Label htmlFor="vehicleModel" className="text-xs font-semibold text-slate-700">
                  Vehicle Make & Model
                </Label>
                <Input
                  id="vehicleModel"
                  placeholder="e.g. Honda City, Hyundai Creta, Royal Enfield Classic"
                  value={formData.vehicleModel}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, vehicleModel: e.target.value }));
                    if (fieldErrors.vehicleModel) {
                      setFieldErrors((prev) => {
                        const upd = { ...prev };
                        delete upd.vehicleModel;
                        return upd;
                      });
                    }
                  }}
                  className={`rounded-xl ${fieldErrors.vehicleModel ? "border-rose-500" : ""}`}
                  required
                />
                {fieldErrors.vehicleModel && (
                  <p className="text-xs text-rose-600">{fieldErrors.vehicleModel}</p>
                )}
              </div>

              {/* Registration Number */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="registrationNumber" className="text-xs font-semibold text-slate-700">
                    Registration Plate Number
                  </Label>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Format: TN 07 AB 1234
                  </span>
                </div>
                <Input
                  id="registrationNumber"
                  placeholder="e.g. TN 07 AB 1234 or KA 01 MN 2468"
                  value={formData.registrationNumber}
                  onChange={(e) => {
                    const formatted = e.target.value
                      .toUpperCase()
                      .replace(/-/g, " ")
                      .replace(/\s+/g, " ");
                    setFormData((prev) => ({
                      ...prev,
                      registrationNumber: formatted,
                    }));
                    if (fieldErrors.registrationNumber) {
                      setFieldErrors((prev) => {
                        const upd = { ...prev };
                        delete upd.registrationNumber;
                        return upd;
                      });
                    }
                  }}
                  className={`uppercase font-mono rounded-xl ${fieldErrors.registrationNumber ? "border-rose-500" : ""}`}
                  required
                />
                {fieldErrors.registrationNumber ? (
                  <p className="text-xs text-rose-600 font-medium">{fieldErrors.registrationNumber}</p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    State code (2 letters) + RTO (1-2 digits) + Series (1-3 letters) + Number (1-4 digits). Examples: <span className="font-mono font-bold text-slate-700">TN 07 AB 1234</span>, <span className="font-mono font-bold text-slate-700">TN 38 BK 5678</span>, <span className="font-mono font-bold text-slate-700">KA 01 MN 2468</span>
                  </p>
                )}
              </div>

              {/* Capacities */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="seatingCapacity" className="text-xs font-semibold text-slate-700">
                    Total Capacity
                  </Label>
                  <Input
                    id="seatingCapacity"
                    type="number"
                    min={1}
                    max={20}
                    value={formData.seatingCapacity}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        seatingCapacity: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="availableSeats" className="text-xs font-semibold text-slate-700">
                    Offerable Seats
                  </Label>
                  <Input
                    id="availableSeats"
                    type="number"
                    min={1}
                    max={formData.seatingCapacity}
                    value={formData.availableSeats}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        availableSeats: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* PHOTO UPLOADS SECTION */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Verification Documents & Photos (Required)
                </Label>

                {/* 1. Vehicle Photo Upload */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>1. Full Vehicle Photo</span>
                    {formData.vehiclePhoto && (
                      <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                        <Check className="h-3 w-3" /> Uploaded
                      </span>
                    )}
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    ref={vehicleFileInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "vehiclePhoto")}
                  />

                  {formData.vehiclePhoto ? (
                    <div className="relative h-24 w-full rounded-xl overflow-hidden border border-slate-200 group">
                      <img
                        src={formData.vehiclePhoto}
                        alt="Vehicle Preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, vehiclePhoto: "" }))}
                        className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-600 text-white p-1 rounded-full text-xs shadow transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : compressingField === "vehiclePhoto" ? (
                    <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-3 text-center flex items-center justify-center gap-2 text-xs text-emerald-700 font-medium">
                      <CarLoader size="inline" showRoad={false} className="w-8 h-4 scale-75 origin-right" />
                      <span>Optimizing photo...</span>
                    </div>
                  ) : (
                    <div
                      onClick={() => vehicleFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-xs text-slate-500 ${
                        fieldErrors.vehiclePhoto ? "border-rose-400 bg-rose-50/50" : "border-slate-200"
                      }`}
                    >
                      <Camera className="h-4 w-4 text-emerald-600" />
                      <span>Upload Vehicle Photo (PNG/JPG)</span>
                    </div>
                  )}
                  {fieldErrors.vehiclePhoto && (
                    <p className="text-xs text-rose-600">{fieldErrors.vehiclePhoto}</p>
                  )}
                </div>

                {/* 2. Number Plate Photo Upload */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>2. Number Plate Photo</span>
                    {formData.numberPlatePhoto && (
                      <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                        <Check className="h-3 w-3" /> Uploaded
                      </span>
                    )}
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    ref={plateFileInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "numberPlatePhoto")}
                  />

                  {formData.numberPlatePhoto ? (
                    <div className="relative h-24 w-full rounded-xl overflow-hidden border border-slate-200 group">
                      <img
                        src={formData.numberPlatePhoto}
                        alt="Plate Preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, numberPlatePhoto: "" }))}
                        className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-600 text-white p-1 rounded-full text-xs shadow transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : compressingField === "numberPlatePhoto" ? (
                    <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-3 text-center flex items-center justify-center gap-2 text-xs text-emerald-700 font-medium">
                      <CarLoader size="inline" showRoad={false} className="w-8 h-4 scale-75 origin-right" />
                      <span>Optimizing photo...</span>
                    </div>
                  ) : (
                    <div
                      onClick={() => plateFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-xs text-slate-500 ${
                        fieldErrors.numberPlatePhoto ? "border-rose-400 bg-rose-50/50" : "border-slate-200"
                      }`}
                    >
                      <Upload className="h-4 w-4 text-emerald-600" />
                      <span>Upload Number Plate Photo (PNG/JPG)</span>
                    </div>
                  )}
                  {fieldErrors.numberPlatePhoto && (
                    <p className="text-xs text-rose-600">{fieldErrors.numberPlatePhoto}</p>
                  )}
                </div>

                {/* 3. Driver's License Photo Upload */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>3. Driver&apos;s License Photo</span>
                    {formData.drivingLicensePhoto && (
                      <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                        <Check className="h-3 w-3" /> Uploaded
                      </span>
                    )}
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    ref={licenseFileInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "drivingLicensePhoto")}
                  />

                  {formData.drivingLicensePhoto ? (
                    <div className="relative h-24 w-full rounded-xl overflow-hidden border border-slate-200 group">
                      <img
                        src={formData.drivingLicensePhoto}
                        alt="License Preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, drivingLicensePhoto: "" }))}
                        className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-600 text-white p-1 rounded-full text-xs shadow transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : compressingField === "drivingLicensePhoto" ? (
                    <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-3 text-center flex items-center justify-center gap-2 text-xs text-emerald-700 font-medium">
                      <CarLoader size="inline" showRoad={false} className="w-8 h-4 scale-75 origin-right" />
                      <span>Optimizing photo...</span>
                    </div>
                  ) : (
                    <div
                      onClick={() => licenseFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-xs text-slate-500 ${
                        fieldErrors.drivingLicensePhoto ? "border-rose-400 bg-rose-50/50" : "border-slate-200"
                      }`}
                    >
                      <FileBadge className="h-4 w-4 text-emerald-600" />
                      <span>Upload Driver&apos;s License Copy (PNG/JPG)</span>
                    </div>
                  )}
                  {fieldErrors.drivingLicensePhoto && (
                    <p className="text-xs text-rose-600">{fieldErrors.drivingLicensePhoto}</p>
                  )}
                </div>
              </div>
            </div>

            {dialogError && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200 mb-3 animate-in fade-in-50">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{dialogError}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                  resetForm();
                }}
                disabled={isSubmitting}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <CarLoader size="inline" showRoad={false} carColor="#ffffff" className="w-8 h-4 scale-75 inline-flex" />
                    <span>Submitting...</span>
                  </span>
                ) : isEditOpen ? (
                  "Save Changes"
                ) : (
                  "Submit for Verification"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Remove Vehicle
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 pt-2">
              Are you sure you want to remove{" "}
              <strong>
                {selectedVehicle?.vehicleModel} ({selectedVehicle?.registrationNumber})
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-1.5">
                  <CarLoader size="inline" showRoad={false} carColor="#ffffff" className="w-8 h-4 scale-75 inline-flex" />
                  <span>Removing...</span>
                </span>
              ) : (
                "Delete Vehicle"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
