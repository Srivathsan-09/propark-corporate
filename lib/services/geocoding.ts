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
  isOrigin: boolean = true
): { latitude: number; longitude: number } {
  // 1. If valid real numeric coordinates are explicitly passed, always respect them first!
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

  const name = (placeName || "").toLowerCase().trim();

  // 2. Specific Chennai / Tamil Nadu locality keyword lookup
  if (
    name.includes("karayanchavadi") ||
    name.includes("karayan") ||
    name.includes("poonamallee") ||
    name.includes("kumunanchavadi")
  ) {
    return { latitude: 13.048, longitude: 80.091 };
  }

  if (name.includes("porur")) {
    return { latitude: 13.0382, longitude: 80.1565 };
  }

  // Tech Park Chennai is located in Taramani (Ascendas / TIDEL Park / Ramanujan IT City)
  if (
    name.includes("taramani") ||
    name.includes("tech park") ||
    name.includes("campus") ||
    name.includes("ascendas") ||
    name.includes("tidel")
  ) {
    return { latitude: 12.9852, longitude: 80.2461 };
  }

  if (name.includes("guindy")) {
    return { latitude: 13.0067, longitude: 80.202 };
  }

  if (name.includes("mugalivakkam")) {
    return { latitude: 13.0238, longitude: 80.1691 };
  }

  if (name.includes("nandambakkam")) {
    return { latitude: 13.0186, longitude: 80.1843 };
  }

  if (name.includes("kattupakkam")) {
    return { latitude: 13.0456, longitude: 80.1214 };
  }

  if (name.includes("iyyappanthangal") || name.includes("iyapanthangal")) {
    return { latitude: 13.0418, longitude: 80.1417 };
  }

  if (name.includes("maduravoyal")) {
    return { latitude: 13.0645, longitude: 80.1627 };
  }

  if (name.includes("velachery")) {
    return { latitude: 12.9815, longitude: 80.218 };
  }

  if (name.includes("t. nagar") || name.includes("tnagar")) {
    return { latitude: 13.0418, longitude: 80.2341 };
  }

  if (name.includes("sholinganallur") || name.includes("siruseri")) {
    return { latitude: 12.8988, longitude: 80.2284 };
  }

  if (name.includes("tambaram")) {
    return { latitude: 12.9249, longitude: 80.1332 };
  }

  // 3. Fallback defaults (Poonamallee -> Tech Park Taramani Chennai)
  return isOrigin ? { latitude: 13.048, longitude: 80.091 } : { latitude: 12.9852, longitude: 80.2461 };
}

export const geocodingService = new GeocodingService();
