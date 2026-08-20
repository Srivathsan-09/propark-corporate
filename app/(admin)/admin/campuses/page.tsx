"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Building,
  Plus,
  MapPin,
  Users,
  Search,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Briefcase,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarLoader } from "@/components/common/CarLoader";

interface ICampus {
  _id: string;
  campusId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  companies: string[];
  status: "active" | "inactive";
  employeeCount?: number;
  companiesCount?: number;
}

export default function AdminCampusesPage() {
  const [campuses, setCampuses] = useState<ICampus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");

  // Modal State for Adding Campus
  const [isAddCampusOpen, setIsAddCampusOpen] = useState(false);
  const [newCampus, setNewCampus] = useState({
    campusId: "",
    name: "",
    address: "",
    city: "",
    state: "",
    companiesInput: "",
  });
  const [isSubmittingCampus, setIsSubmittingCampus] = useState(false);

  // Inline Company Add State per campus
  const [addingCompanyForId, setAddingCompanyForId] = useState<string | null>(null);
  const [companyInputs, setCompanyInputs] = useState<Record<string, string>>({});
  const [companyActionLoadingId, setCompanyActionLoadingId] = useState<string | null>(null);

  // Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCampuses = async () => {
    try {
      const res = await fetch("/api/admin/campuses");
      if (res.ok) {
        const data = await res.json();
        setCampuses(data.campuses || []);
      }
    } catch (err) {
      console.error("Failed to load campuses:", err);
      setErrorMessage("Failed to load campus directory.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampuses();
  }, []);

  const handleCreateCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newCampus.campusId || !newCampus.name || !newCampus.city || !newCampus.state) {
      setErrorMessage("Please fill in Campus ID, Name, City, and State.");
      return;
    }

    setIsSubmittingCampus(true);

    try {
      const companiesArray = newCampus.companiesInput
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const res = await fetch("/api/admin/campuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campusId: newCampus.campusId.trim().toUpperCase(),
          name: newCampus.name.trim(),
          address: newCampus.address.trim(),
          city: newCampus.city.trim(),
          state: newCampus.state.trim(),
          companies: companiesArray,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to create campus.");
        setIsSubmittingCampus(false);
        return;
      }

      setSuccessMessage(`Campus "${data.campus.name}" (${data.campus.campusId}) created successfully!`);
      setIsAddCampusOpen(false);
      setNewCampus({
        campusId: "",
        name: "",
        address: "",
        city: "",
        state: "",
        companiesInput: "",
      });
      await fetchCampuses();
    } catch (err) {
      console.error("Error adding campus:", err);
      setErrorMessage("Network error while creating campus.");
    } finally {
      setIsSubmittingCampus(false);
    }
  };

  const handleAddCompany = async (campusId: string) => {
    const compName = companyInputs[campusId]?.trim();
    if (!compName) return;

    setCompanyActionLoadingId(`${campusId}-add`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/campuses/${campusId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_company",
          companyName: compName,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCampuses((prev) =>
          prev.map((c) => (c.campusId === campusId ? { ...c, companies: data.campus.companies } : c))
        );
        setCompanyInputs((prev) => ({ ...prev, [campusId]: "" }));
        setSuccessMessage(`Added "${compName}" to ${campusId}!`);
      } else {
        setErrorMessage(data.error || "Failed to add company.");
      }
    } catch (err) {
      console.error("Error adding company:", err);
      setErrorMessage("Failed to add company.");
    } finally {
      setCompanyActionLoadingId(null);
    }
  };

  const handleRemoveCompany = async (campusId: string, companyName: string) => {
    if (!confirm(`Are you sure you want to remove "${companyName}" from campus ${campusId}?`)) return;

    setCompanyActionLoadingId(`${campusId}-remove-${companyName}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/campuses/${campusId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_company",
          companyName,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCampuses((prev) =>
          prev.map((c) => (c.campusId === campusId ? { ...c, companies: data.campus.companies } : c))
        );
        setSuccessMessage(`Removed "${companyName}" from ${campusId}.`);
      } else {
        setErrorMessage(data.error || "Failed to remove company.");
      }
    } catch (err) {
      console.error("Error removing company:", err);
      setErrorMessage("Failed to remove company.");
    } finally {
      setCompanyActionLoadingId(null);
    }
  };

  const handleDeleteCampus = async (campusId: string, campusName: string) => {
    if (!confirm(`Are you sure you want to delete "${campusName}" (${campusId})? This cannot be undone.`)) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/campuses/${campusId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setCampuses((prev) => prev.filter((c) => c.campusId !== campusId));
        setSuccessMessage(data.message || `Campus ${campusName} deleted successfully.`);
      } else {
        setErrorMessage(data.error || "Failed to delete campus.");
      }
    } catch (err) {
      console.error("Error deleting campus:", err);
      setErrorMessage("Failed to delete campus.");
    }
  };

  // Metrics
  const totalCampuses = campuses.length;
  const totalCompaniesCount = campuses.reduce((acc, c) => acc + (c.companies?.length || 0), 0);
  const totalEmployeesCount = campuses.reduce((acc, c) => acc + (c.employeeCount || 0), 0);
  const uniqueCities = Array.from(new Set(campuses.map((c) => c.city).filter(Boolean)));

  const filteredCampuses = campuses.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.campusId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.companies.some((comp) => comp.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCity = selectedCity === "all" || c.city === selectedCity;

    return matchesSearch && matchesCity;
  });

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <CarLoader size="page" message="Loading Campus & Company directory..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-slate-500 hover:text-purple-600 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin Overview
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-purple-600" />
            Campus & Company Directory
          </h1>
          <p className="text-xs text-slate-500">
            Configure physical business complexes and manage operating corporate enterprises inside each campus
          </p>
        </div>

        <Button
          onClick={() => {
            // Suggest next campus ID: CAMP001 -> CAMP004
            const maxNum = campuses.reduce((acc, c) => {
              const match = c.campusId.match(/^CAMP(\d+)$/i);
              return match ? Math.max(acc, parseInt(match[1], 10)) : acc;
            }, 0);
            const nextId = `CAMP${String(maxNum + 1).padStart(3, "0")}`;
            setNewCampus({
              campusId: nextId,
              name: "",
              address: "",
              city: "",
              state: "",
              companiesInput: "",
            });
            setIsAddCampusOpen(true);
          }}
          className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add New Campus
        </Button>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200 animate-in fade-in-50">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg bg-rose-50 p-3.5 text-xs text-rose-800 border border-rose-200 animate-in fade-in-50">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Physical Campuses</span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalCampuses}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Tech complexes</span>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Operating Companies</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalCompaniesCount}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Across all campuses</span>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Commuters</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalEmployeesCount}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Active registered users</span>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cities Covered</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{uniqueCities.length}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{uniqueCities.join(", ")}</span>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-xs"
          >
            <option value="all">📍 All Cities ({campuses.length})</option>
            {uniqueCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search campus, city, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Campus Cards List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredCampuses.map((campus) => (
          <Card key={campus._id} className="border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              {/* Campus Card Header */}
              <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md border border-purple-200">
                        {campus.campusId}
                      </span>
                      <CardTitle className="text-base font-bold text-slate-900">{campus.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{campus.address}</span>
                      <span className="text-slate-300">•</span>
                      <strong className="text-slate-700 font-semibold">{campus.city}, {campus.state}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                      Active Campus
                    </Badge>
                    <button
                      onClick={() => handleDeleteCampus(campus.campusId, campus.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Delete Campus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Campus Sub-Metrics */}
                <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200/60 font-medium">
                    <Briefcase className="h-3 w-3 text-blue-500" />
                    <span><strong>{campus.companies.length}</strong> Operating Companies</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200/60 font-medium">
                    <Users className="h-3 w-3 text-emerald-600" />
                    <span><strong>{campus.employeeCount || 0}</strong> Registered Commuters</span>
                  </div>
                </div>
              </CardHeader>

              {/* Operating Companies Section */}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    Companies Operating Inside ({campus.companies.length})
                  </span>
                </div>

                {/* Companies Tags */}
                <div className="flex flex-wrap gap-2 min-h-[48px] p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  {campus.companies.length === 0 ? (
                    <span className="text-xs text-slate-400 italic py-1">No companies added yet. Add below.</span>
                  ) : (
                    campus.companies.map((company) => (
                      <div
                        key={company}
                        className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs text-xs font-semibold text-slate-800 animate-in fade-in-50"
                      >
                        <span>{company}</span>
                        <button
                          onClick={() => handleRemoveCompany(campus.campusId, company)}
                          disabled={companyActionLoadingId === `${campus.campusId}-remove-${company}`}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                          title={`Remove ${company}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Add Company to this Campus */}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder={`Add company to ${campus.name}...`}
                    value={companyInputs[campus.campusId] || ""}
                    onChange={(e) =>
                      setCompanyInputs((prev) => ({ ...prev, [campus.campusId]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCompany(campus.campusId);
                      }
                    }}
                    className="h-8 text-xs rounded-lg"
                  />
                  <Button
                    type="button"
                    onClick={() => handleAddCompany(campus.campusId)}
                    disabled={
                      !companyInputs[campus.campusId]?.trim() ||
                      companyActionLoadingId === `${campus.campusId}-add`
                    }
                    className="h-8 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white shrink-0 rounded-lg gap-1 font-semibold"
                  >
                    {companyActionLoadingId === `${campus.campusId}-add` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Add Company
                  </Button>
                </div>
              </CardContent>
            </div>

            {/* Footer: View Campus Employees Link */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">Campus Code: <strong className="font-mono text-slate-700">{campus.campusId}</strong></span>
              <Link
                href={`/admin/employees?campus=${campus.campusId}`}
                className="font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
              >
                View Employees <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        ))}

        {filteredCampuses.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-slate-800">No campuses matched your search</h3>
            <p className="mt-1 text-xs text-slate-500">Try refining your search terms or add a new campus above.</p>
          </div>
        )}
      </div>

      {/* ADD NEW CAMPUS MODAL */}
      {isAddCampusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-purple-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-600" /> Add Physical Campus
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create a new corporate campus and define the companies operating inside
                </p>
              </div>
              <button
                onClick={() => setIsAddCampusOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampus} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="campusId" className="text-xs font-semibold text-slate-700">
                    Campus ID (Unique)
                  </Label>
                  <Input
                    id="campusId"
                    value={newCampus.campusId}
                    onChange={(e) => setNewCampus({ ...newCampus, campusId: e.target.value.toUpperCase() })}
                    placeholder="e.g. CAMP004"
                    className="h-8.5 font-mono uppercase text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                    Campus Name
                  </Label>
                  <Input
                    id="name"
                    value={newCampus.name}
                    onChange={(e) => setNewCampus({ ...newCampus, name: e.target.value })}
                    placeholder="e.g. DLF Cyber City"
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-xs font-semibold text-slate-700">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={newCampus.city}
                    onChange={(e) => setNewCampus({ ...newCampus, city: e.target.value })}
                    placeholder="e.g. Gurgaon"
                    className="h-8.5 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="state" className="text-xs font-semibold text-slate-700">
                    State
                  </Label>
                  <Input
                    id="state"
                    value={newCampus.state}
                    onChange={(e) => setNewCampus({ ...newCampus, state: e.target.value })}
                    placeholder="e.g. Haryana"
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs font-semibold text-slate-700">
                  Address / Landmark
                </Label>
                <Input
                  id="address"
                  value={newCampus.address}
                  onChange={(e) => setNewCampus({ ...newCampus, address: e.target.value })}
                  placeholder="e.g. Sector 24, DLF Phase 2"
                  className="h-8.5 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="companiesInput" className="text-xs font-semibold text-slate-700">
                  Initial Operating Companies (Comma separated)
                </Label>
                <Input
                  id="companiesInput"
                  value={newCampus.companiesInput}
                  onChange={(e) => setNewCampus({ ...newCampus, companiesInput: e.target.value })}
                  placeholder="e.g. IBM, Cognizant, Dell Technologies"
                  className="h-8.5 text-xs"
                />
                <span className="text-[10px] text-slate-400">You can also add more companies later at any time.</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddCampusOpen(false)}
                  className="h-8.5 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingCampus}
                  className="h-8.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5"
                >
                  {isSubmittingCampus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create Campus
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
