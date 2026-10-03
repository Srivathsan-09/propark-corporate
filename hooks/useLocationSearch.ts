"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { geocodingService, LocationResult } from "@/lib/services/geocoding";

export function useLocationSearch(initialQuery: string = "", debounceMs: number = 90) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [topPrediction, setTopPrediction] = useState<LocationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchRequestIdRef = useRef(0);

  const searchLocations = useCallback(async (searchQuery: string) => {
    const currentRequestId = ++searchRequestIdRef.current;

    if (!searchQuery || searchQuery.trim().length < 1) {
      setSuggestions([]);
      setTopPrediction(null);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await geocodingService.search(searchQuery, 8);
      if (currentRequestId !== searchRequestIdRef.current) {
        return;
      }
      setSuggestions(results);
      setTopPrediction(results[0] || null);
      if (results.length > 0) {
        setIsOpen(true);
      }
    } catch (err: any) {
      if (currentRequestId !== searchRequestIdRef.current) return;
      console.warn("Location search error:", err);
      // Fallback to local prediction
      const fallback = geocodingService.searchLocalSync(searchQuery, 6);
      if (fallback.length > 0) {
        setSuggestions(fallback);
        setTopPrediction(fallback[0] || null);
        setIsOpen(true);
      } else {
        setError("Unable to fetch location suggestions.");
      }
    } finally {
      if (currentRequestId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length < 1) {
      setSuggestions([]);
      setTopPrediction(null);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    // 1. INSTANT ZERO-LATENCY PREDICTION (0ms delay):
    // Instantly predicts as user types, even with typos or misspelling!
    const instantResults = geocodingService.searchLocalSync(text, 6);
    if (instantResults.length > 0) {
      setSuggestions(instantResults);
      setTopPrediction(instantResults[0]);
      setIsOpen(true);
    }

    // 2. Continuous background sync with live real-world OpenStreetMap
    debounceTimerRef.current = setTimeout(() => {
      searchLocations(text);
    }, debounceMs);
  };

  const selectSuggestion = (item: LocationResult) => {
    setQuery(item.shortName || item.displayName);
    setTopPrediction(item);
    setSuggestions([]);
    setIsOpen(false);
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    topPrediction,
    isLoading,
    isOpen,
    error,
    handleQueryChange,
    selectSuggestion,
    closeDropdown,
    searchLocations,
  };
}
