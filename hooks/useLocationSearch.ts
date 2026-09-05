"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { geocodingService, LocationResult } from "@/lib/services/geocoding";

export function useLocationSearch(initialQuery: string = "", debounceMs: number = 150) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchRequestIdRef = useRef(0);

  const searchLocations = useCallback(async (searchQuery: string) => {
    const currentRequestId = ++searchRequestIdRef.current;

    if (!searchQuery || searchQuery.trim().length < 1) {
      setSuggestions([]);
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
      setIsOpen(true);
    } catch (err: any) {
      if (currentRequestId !== searchRequestIdRef.current) return;
      console.warn("Location search error:", err);
      setError("Unable to fetch location suggestions.");
      setSuggestions([]);
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
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      searchLocations(text);
    }, debounceMs);
  };

  const selectSuggestion = (item: LocationResult) => {
    setQuery(item.shortName || item.displayName);
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
    isLoading,
    isOpen,
    error,
    handleQueryChange,
    selectSuggestion,
    closeDropdown,
    searchLocations,
  };
}
