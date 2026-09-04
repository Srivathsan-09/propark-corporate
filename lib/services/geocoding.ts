export interface LocationResult {
  displayName: string;
  shortName: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
}

/**
 * High-Performance Dual Geocoding Service
 * Combines Photon OSM Typeahead Autocomplete (fast prefix search-as-you-type)
 * with OpenStreetMap Nominatim for maximum accuracy and fuzzy matching.
 */
class GeocodingService {
  private nominatimUrl = "https://nominatim.openstreetmap.org";
  private photonBaseUrl = "https://photon.komoot.io";

  // Preferred center focus (Chennai / Tamil Nadu campus region)
  private defaultLat = 13.048;
  private defaultLon = 80.091;

  // High-Speed In-Memory LRU Caches for zero-latency lookups
  private searchCache = new Map<string, LocationResult[]>();
  private reverseCache = new Map<string, LocationResult | null>();

  /**
   * Instant Autocomplete & Search for locations matching a query string
   * Resolves results starting from the very first letters typed (e.g. "Karaya" -> "Karayanchavadi")
   */
  async search(query: string, limit: number = 8): Promise<LocationResult[]> {
    if (!query || query.trim().length < 1) return [];

    const cleanQuery = query.trim().toLowerCase();
    const cacheKey = `${cleanQuery}_${limit}`;

    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    // 1. Try Photon OSM Typeahead API (Built specifically for instant prefix search)
    try {
      const photonRes = await fetch(
        `${this.photonBaseUrl}/api/?q=${encodeURIComponent(cleanQuery)}&limit=${limit}&lat=${this.defaultLat}&lon=${this.defaultLon}`,
        {
          headers: {
            "Accept-Language": "en",
          },
          signal: AbortSignal.timeout(3500),
        }
      );

      if (photonRes.ok) {
        const text = await photonRes.text();
        let photonData: any = null;
        try {
          photonData = JSON.parse(text);
        } catch {
          // not JSON
        }
        if (photonData && Array.isArray(photonData.features) && photonData.features.length > 0) {
          const results: LocationResult[] = photonData.features
            .map((feat: any) => {
              const props = feat.properties || {};
              const coords = feat.geometry?.coordinates || [0, 0];
              const shortName = extractLocalityName(props, props.name || props.street || props.city);

              const parts = [
                shortName,
                props.street !== shortName ? props.street : null,
                props.district || props.suburb,
                props.city || props.county,
                props.state,
              ].filter(Boolean);

              return {
                displayName: Array.from(new Set(parts)).join(", "),
                shortName,
                latitude: parseFloat(coords[1]),
                longitude: parseFloat(coords[0]),
                city: props.city || props.county,
                state: props.state,
              };
            })
            .filter(
              (r: LocationResult) =>
                !isNaN(r.latitude) &&
                !isNaN(r.longitude) &&
                Math.abs(r.latitude) > 0.01 &&
                Math.abs(r.longitude) > 0.01
            );

          if (results.length > 0) {
            this.searchCache.set(cacheKey, results);
            return results;
          }
        }
      }
    } catch (err) {
      console.warn("Photon typeahead warning:", err);
    }

    // 2. Fallback to Nominatim Search API
    try {
      const url = `${this.nominatimUrl}/search?format=json&q=${encodeURIComponent(
        cleanQuery
      )}&limit=${limit}&addressdetails=1&countrycodes=in&viewbox=79.7,13.4,80.4,12.7`;

      const headers: Record<string, string> = { "Accept-Language": "en" };
      if (typeof window === "undefined") {
        headers["User-Agent"] = "CommuteX-Corporate-App/1.0 (contact@commutex.com)";
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
      }

      const text = await res.text();
      let data: any = [];
      try {
        data = JSON.parse(text);
      } catch {
        // not JSON
      }
      if (!Array.isArray(data)) return [];

      const results: LocationResult[] = data
        .map((item: any) => {
          const address = item.address || {};
          const shortName = extractLocalityName(address, item.name || item.display_name);

          return {
            displayName: item.display_name,
            shortName,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            city: address.city || address.town || address.state_district,
            state: address.state,
          };
        })
        .filter(
          (r: LocationResult) =>
            !isNaN(r.latitude) &&
            !isNaN(r.longitude) &&
            Math.abs(r.latitude) > 0.01 &&
            Math.abs(r.longitude) > 0.01
        );

      this.searchCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.warn("Geocoding search failed:", error);
      return [];
    }
  }

  /**
   * Reverse geocode coordinates to a human-readable address
   */
  async reverse(latitude: number, longitude: number): Promise<LocationResult | null> {
    if (isNaN(latitude) || isNaN(longitude) || Math.abs(latitude) < 0.01 || Math.abs(longitude) < 0.01) {
      return null;
    }

    const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
    if (this.reverseCache.has(cacheKey)) {
      return this.reverseCache.get(cacheKey)!;
    }

    // 1. Try Photon Reverse API first (fast, open, exact locality names)
    try {
      const photonUrl = `${this.photonBaseUrl}/reverse?lat=${latitude}&lon=${longitude}&lang=en`;
      const res = await fetch(photonUrl, {
        headers: { "Accept-Language": "en" },
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          // not JSON
        }

        if (data && Array.isArray(data.features) && data.features.length > 0) {
          const props = data.features[0].properties || {};
          const coords = data.features[0].geometry?.coordinates || [longitude, latitude];
          
          const shortName = extractLocalityName(props, props.name || props.street || props.city);

          const parts = [
            shortName,
            props.street && props.street !== shortName ? props.street : null,
            props.district || props.suburb,
            props.city || props.county,
            props.state,
          ].filter(Boolean);

          const result: LocationResult = {
            displayName: Array.from(new Set(parts)).join(", "),
            shortName,
            latitude: parseFloat(coords[1]) || latitude,
            longitude: parseFloat(coords[0]) || longitude,
            city: props.city || props.county,
            state: props.state,
          };

          this.reverseCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (err) {
      console.warn("Photon reverse geocode warning:", err);
    }

    // 2. Fallback to Nominatim Reverse API
    try {
      const url = `${this.nominatimUrl}/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

      const headers: Record<string, string> = {
        "Accept-Language": "en",
      };
      if (typeof window === "undefined") {
        headers["User-Agent"] = "CommuteX-Corporate-App/1.0 (contact@commutex.com)";
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const text = await res.text();
        let item: any = null;
        try {
          item = JSON.parse(text);
        } catch {
          // not JSON
        }

        if (item && item.display_name) {
          const address = item.address || {};
          const shortName = extractLocalityName(address, item.name || item.display_name);

          const result: LocationResult = {
            displayName: item.display_name,
            shortName,
            latitude: parseFloat(item.lat) || latitude,
            longitude: parseFloat(item.lon) || longitude,
            city: address.city || address.town || address.state_district,
            state: address.state,
          };

          this.reverseCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (error) {
      console.warn("Reverse geocoding failed:", error);
    }

    // 3. Fallback: Exact coordinates format so map-picking NEVER fails
    const fallback: LocationResult = {
      displayName: `Selected Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      shortName: "Selected Point",
      latitude,
      longitude,
    };
    this.reverseCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Helper to extract recognizable human-friendly locality / place name
 * Prioritizes suburb, neighbourhood, town, village, amenity, building over raw road names.
 */
function extractLocalityName(propsOrAddress: any, fallbackDisplayName?: string): string {
  if (!propsOrAddress) return fallbackDisplayName?.split(",")[0] || "Location";

  const p = propsOrAddress;

  // 1. Prefer suburb, neighbourhood, locality, quarter, town, village
  const locality =
    p.suburb ||
    p.neighbourhood ||
    p.quarter ||
    p.residential ||
    p.locality ||
    p.district ||
    p.city_district ||
    p.town ||
    p.village;

  if (locality && typeof locality === "string" && locality.trim().length > 0) {
    return locality.trim();
  }

  // 2. Prefer specific landmark / amenity / station / building
  const landmark = p.amenity || p.building || p.station || p.bus_stop || p.railway;
  if (landmark && typeof landmark === "string" && landmark.trim().length > 0) {
    return landmark.trim();
  }

  // 3. Check name (if it's not a raw highway/road name)
  const name = p.name;
  if (name && typeof name === "string" && name.trim().length > 0) {
    const cleanName = name.trim();
    const isHighway = /highway|expressway|bypass|national highway|nh\s*\d|sh\s*\d|road|salai/i.test(cleanName);
    if (!isHighway) {
      return cleanName;
    }
  }

  // 4. Fallback to street or first part of display name
  const street = p.street || p.road;
  if (street && typeof street === "string" && street.trim().length > 0) {
    return street.trim();
  }

  if (fallbackDisplayName) {
    return fallbackDisplayName.split(",")[0].trim();
  }

  return "Location";
}

/**
 * Smart Dynamic Place-to-Coordinate Resolver
 * Ensures origin/destination coordinates match the place string (e.g. Karayanchavadi -> 13.048, Tech Park -> 12.8988)
 */
export function resolvePlaceCoordinates(
  placeName: string | undefined,
  existingLat?: number,
  existingLng?: number,
  isOrigin: boolean = true,
  preferMainRoad: boolean = true
): { latitude: number; longitude: number } {
  const name = (placeName || "").toLowerCase().trim();

  // Helper with authoritative main highway/arterial road coordinates
  const lookupMainRoadPlace = (str: string): { latitude: number; longitude: number } | null => {
    if (
      str.includes("karayanchavadi") ||
      str.includes("karayan") ||
      str.includes("poonamallee") ||
      str.includes("kumunanchavadi")
    ) {
      return { latitude: 13.048, longitude: 80.091 }; // Poonamallee High Road / Bus Terminus
    }

    if (str.includes("porur bypass") || str.includes("porur")) {
      return { latitude: 13.0382, longitude: 80.1565 }; // Mount-Poonamallee / Porur Junction
    }

    if (str.includes("mugalivakkam")) {
      return { latitude: 13.0285, longitude: 80.1715 }; // Mount-Poonamallee High Road at Mugalivakkam Main Junction
    }

    if (str.includes("ramapuram") || str.includes("dlf")) {
      return { latitude: 13.0298, longitude: 80.1770 }; // Mount-Poonamallee High Road (DLF IT Park Gate)
    }

    if (str.includes("nandambakkam")) {
      return { latitude: 13.0186, longitude: 80.1843 }; // Mount-Poonamallee High Road (Trade Centre)
    }

    if (str.includes("kathipara") || str.includes("guindy")) {
      return { latitude: 13.0067, longitude: 80.202 }; // Kathipara / GST Main Road / Guindy Metro
    }

    if (str.includes("alandur")) {
      return { latitude: 13.0035, longitude: 80.2005 }; // GST Main Road / Alandur Metro
    }

    if (str.includes("saidapet") || str.includes("little mount")) {
      return { latitude: 13.0175, longitude: 80.2205 }; // Anna Salai Main Road
    }

    if (str.includes("vadapalani")) {
      return { latitude: 13.0500, longitude: 80.2121 }; // 100 Feet Road / Vadapalani Junction
    }

    if (str.includes("ashok nagar")) {
      return { latitude: 13.0368, longitude: 80.2132 }; // 100 Feet Road (Ashok Pillar)
    }

    if (str.includes("koyambedu")) {
      return { latitude: 13.0694, longitude: 80.1948 }; // Poonamallee High Road / CMBT Main Road
    }

    if (str.includes("maduravoyal")) {
      return { latitude: 13.0645, longitude: 80.1627 }; // Maduravoyal Bypass / Grade Separator
    }

    if (str.includes("kattupakkam")) {
      return { latitude: 13.0456, longitude: 80.1214 }; // Mount-Poonamallee High Road
    }

    if (str.includes("iyyappanthangal") || str.includes("iyapanthangal")) {
      return { latitude: 13.0418, longitude: 80.1417 }; // Mount-Poonamallee High Road Bus Depot
    }

    if (str.includes("ambattur")) {
      return { latitude: 13.1147, longitude: 80.1548 }; // Ambattur Industrial Estate Main Road
    }

    if (str.includes("avadi")) {
      return { latitude: 13.1188, longitude: 80.1017 }; // Avadi Main Road / Railway Station
    }

    if (str.includes("chromepet")) {
      return { latitude: 12.9516, longitude: 80.1413 }; // GST Road / Chromepet Main Road
    }

    if (str.includes("pallavaram")) {
      return { latitude: 12.9675, longitude: 80.1491 }; // GST Road / Pallavaram Flyover
    }

    if (str.includes("tambaram")) {
      return { latitude: 12.9249, longitude: 80.1332 }; // GST Road / Tambaram Sanatorium Main Road
    }

    if (
      str.includes("taramani") ||
      str.includes("tech park") ||
      str.includes("campus") ||
      str.includes("ascendas") ||
      str.includes("tidel")
    ) {
      return { latitude: 12.9852, longitude: 80.2461 }; // OMR / Taramani Main Road
    }

    if (str.includes("velachery")) {
      return { latitude: 12.9815, longitude: 80.218 }; // Velachery Main Road / Bypass
    }

    if (str.includes("t. nagar") || str.includes("tnagar")) {
      return { latitude: 13.0418, longitude: 80.2341 }; // Usman Road / Panagal Park Main Road
    }

    if (str.includes("sholinganallur") || str.includes("siruseri")) {
      return { latitude: 12.8988, longitude: 80.2284 }; // Rajiv Gandhi Salai / OMR Main Road
    }

    if (str.includes("anna nagar")) {
      return { latitude: 13.0850, longitude: 80.2101 }; // 2nd Avenue / Anna Nagar Roundtana
    }

    return null;
  };

  // 1. If preferMainRoad is enabled (default true for corridors), check known arterial hubs first
  if (preferMainRoad && name) {
    const mainRoadMatch = lookupMainRoadPlace(name);
    if (mainRoadMatch) {
      return mainRoadMatch;
    }
  }

  // 2. If valid numeric coordinates are explicitly passed, use them
  if (
    typeof existingLat === "number" &&
    !isNaN(existingLat) &&
    existingLat > 8 &&
    existingLat < 38 &&
    typeof existingLng === "number" &&
    !isNaN(existingLng) &&
    existingLng > 68 &&
    existingLng < 98
  ) {
    return { latitude: existingLat, longitude: existingLng };
  }

  // 3. Fallback check name
  if (name) {
    const mainRoadMatch = lookupMainRoadPlace(name);
    if (mainRoadMatch) {
      return mainRoadMatch;
    }
  }

  // 4. Fallback defaults (Poonamallee -> Tech Park Taramani Chennai)
  return isOrigin ? { latitude: 13.048, longitude: 80.091 } : { latitude: 12.9852, longitude: 80.2461 };
}

export const geocodingService = new GeocodingService();
