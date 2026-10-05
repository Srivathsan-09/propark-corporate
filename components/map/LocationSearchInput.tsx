"use client";

import React, { useRef, useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";

interface LocationSearchInputProps {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (location: { name?: string; address: string; latitude: number; longitude: number; isConfirmed?: boolean; city?: string; state?: string }) => void;
  onPreviewLocation?: (location: LocationResult) => void;
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
  onPreviewLocation,
  onSelectOnMap,
  showCurrentLocation = true,
  className = "",
  hasError = false,
  required = false,
}: LocationSearchInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const {
    query,
    setQuery,
    suggestions,
    topPrediction,
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

  // Reset selected index when suggestions list updates
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  // Continuously notify parent of top predicted location as user types
  useEffect(() => {
    if (suggestions.length > 0 && onPreviewLocation) {
      const active = selectedIndex >= 0 ? suggestions[selectedIndex] : suggestions[0];
      if (active && active.latitude && active.longitude) {
        onPreviewLocation(active);
      }
    }
  }, [suggestions, selectedIndex, onPreviewLocation]);

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
      name: item.shortName,
      address: item.displayName,
      latitude: item.latitude,
      longitude: item.longitude,
      city: item.city,
      state: item.state,
      isConfirmed: true,
    });
  };

  const handleUseCurrentLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      setQuery(loc.displayName);
      onChange({
        name: loc.shortName || loc.displayName.split(",")[0].trim(),
        address: loc.displayName,
        latitude: loc.latitude,
        longitude: loc.longitude,
        city: loc.city,
        state: loc.state,
        isConfirmed: true,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev: number) => (prev + 1 < suggestions.length ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      if (suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev: number) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === "Enter") {
      if (suggestions.length > 0 && isOpen) {
        e.preventDefault();
        const pick = selectedIndex >= 0 ? suggestions[selectedIndex] : suggestions[0];
        handlePickSuggestion(pick);
      }
    } else if (e.key === "Tab") {
      if (suggestions.length > 0 && isOpen && !e.shiftKey) {
        e.preventDefault();
        const pick = selectedIndex >= 0 ? suggestions[selectedIndex] : suggestions[0];
        handlePickSuggestion(pick);
      }
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-50" : "z-10"}`}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-2.5 sm:left-3 h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 pointer-events-none" />

        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={query}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            handleQueryChange(e.target.value);
            onChange({
              address: e.target.value,
              latitude: 0,
              longitude: 0,
              isConfirmed: false,
            });
          }}
          className={cn(
            "pl-7 sm:pl-8 text-xs rounded-xl h-9 border-slate-200 bg-white",
            showCurrentLocation ? "pr-16" : "pr-7",
            hasError && "border-rose-500 ring-rose-200",
            className
          )}
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
                onChange({ address: "", latitude: 0, longitude: 0, isConfirmed: false });
                closeDropdown();
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
      {isOpen && (
        <div className="absolute z-[9999] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in-50 duration-150">
          {suggestions.length > 0 ? (
            suggestions.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              const isTop = idx === 0;

              return (
                <button
                  key={`${item.shortName}-${idx}`}
                  type="button"
                  onClick={() => handlePickSuggestion(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-2.5 transition-colors flex items-start gap-2.5 text-xs group ${
                    isSelected ? "bg-purple-50/80 text-purple-950" : "hover:bg-slate-50"
                  }`}
                >
                  <Navigation className={`h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform ${
                    isSelected ? "text-purple-600 scale-110" : "text-emerald-600 group-hover:scale-110"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="font-semibold text-slate-900 truncate">
                        {item.shortName}
                        {item.city && (
                          <span className="text-[10px] text-slate-500 font-normal ml-1">
                            ({item.city})
                          </span>
                        )}
                      </div>
                      {isTop && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 shrink-0">
                          Predicted
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.displayName}
                    </div>
                  </div>
                </button>
              );
            })
          ) : !isLoading && query.trim().length >= 2 ? (
            <div className="p-3 text-xs text-slate-500 text-center">
              No matching locations found. Try another spelling or tap location on map.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
