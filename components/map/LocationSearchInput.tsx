"use client";

import React, { useRef, useEffect } from "react";
import {
  Search,
  MapPin,
  Crosshair,
  Loader2,
  X,
  Building2,
  Navigation,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CarLoader } from "@/components/common/CarLoader";
import { useLocationSearch } from "@/hooks/useLocationSearch";
import { useGeolocation } from "@/hooks/useGeolocation";
import { LocationResult } from "@/lib/services/geocoding";

interface LocationSearchInputProps {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (location: { address: string; latitude: number; longitude: number }) => void;
  onSelectOnMap?: () => void;
  showCurrentLocation?: boolean;
  className?: string;
  hasError?: boolean;
  required?: boolean;
}

export default function LocationSearchInput({
  id,
  placeholder = "Search area or landmark...",
  value,
  onChange,
  onSelectOnMap,
  showCurrentLocation = true,
  className = "",
  hasError = false,
  required = false,
}: LocationSearchInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    suggestions,
    isLoading,
    isOpen,
    handleQueryChange,
    selectSuggestion,
    closeDropdown,
  } = useLocationSearch(value);

  const {
    isLoading: isLocating,
    error: geoError,
    getCurrentLocation,
  } = useGeolocation();

  // Sync external value with input query
  useEffect(() => {
    setQuery(value || "");
  }, [value, setQuery]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeDropdown]);

  const handlePickSuggestion = (item: LocationResult) => {
    selectSuggestion(item);
    onChange({
      address: item.displayName,
      latitude: item.latitude,
      longitude: item.longitude,
    });
  };

  const handleUseCurrentLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      setQuery(loc.displayName);
      onChange({
        address: loc.displayName,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent accidental form submission
      if (suggestions.length > 0) {
        handlePickSuggestion(suggestions[0]);
      } else if (query.trim().length >= 2) {
        // Auto-resolve fuzzy prediction on Enter
        const { resolveFuzzyLocation } = await import("@/lib/services/routeCorridor");
        const resolved = await resolveFuzzyLocation(query);
        if (resolved) {
          handlePickSuggestion(resolved);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-50" : "z-10"}`}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 h-4 w-4 text-emerald-600 pointer-events-none" />

        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={query}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            handleQueryChange(e.target.value);
            // Also notify parent of text changes
            onChange({
              address: e.target.value,
              latitude: 0,
              longitude: 0,
            });
          }}
          className={`pl-9 pr-20 text-xs rounded-xl h-10 ${
            hasError ? "border-rose-500 ring-rose-200" : ""
          } ${className}`}
          required={required}
          autoComplete="off"
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {isLoading && (
            <CarLoader size="inline" showRoad={false} className="w-8 h-4 scale-75 origin-right mr-1" />
          )}

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onChange({ address: "", latitude: 0, longitude: 0 });
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {showCurrentLocation && (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
              title="Use Current Location (GPS)"
            >
              {isLocating ? (
                <CarLoader size="inline" showRoad={false} className="w-6 h-4 scale-65" />
              ) : (
                <Crosshair className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {geoError && (
        <p className="text-[11px] text-rose-600 mt-1">{geoError}</p>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-[9999] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in-50 duration-150">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePickSuggestion(item)}
              className="w-full text-left p-2.5 hover:bg-emerald-50/60 transition-colors flex items-start gap-2.5 text-xs group"
            >
              <Navigation className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 truncate">
                  {item.shortName}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {item.displayName}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
