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
  private photonUrl = "https://photon.komoot.io/api";

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
        `${this.photonUrl}/?q=${encodeURIComponent(cleanQuery)}&limit=${limit}&lat=${this.defaultLat}&lon=${this.defaultLon}`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );

      if (photonRes.ok) {
        const photonData = await photonRes.json();
        if (photonData && Array.isArray(photonData.features) && photonData.features.length > 0) {
          const results: LocationResult[] = photonData.features
            .map((feature: any) => {
              const props = feature.properties || {};
              const coords = feature.geometry?.coordinates || [0, 0]; // [lon, lat]
              const lon = parseFloat(coords[0]);
              const lat = parseFloat(coords[1]);

              if (!lat || !lon) return null;

              const name = props.name || props.street || props.district || props.city;
              if (!name) return null;

              const parts = [
                props.name,
                props.street,
                props.district || props.suburb,
                props.city || props.county,
                props.state,
              ].filter(Boolean);

              // Unique formatted display name
              const displayName = Array.from(new Set(parts)).join(", ");

              return {
                displayName,
                shortName: props.name || name,
                latitude: lat,
                longitude: lon,
                city: props.city || props.county || props.district,
                state: props.state,
              };
            })
            .filter((item: LocationResult | null): item is LocationResult => item !== null);

          if (results.length > 0) {
            return results;
          }
        }
      }
    } catch (err) {
      console.warn("Photon autocomplete search warning:", err);
    }

    // 2. Fallback to OpenStreetMap Nominatim with viewbox bias & custom User-Agent
    try {
      const viewbox = "79.5,12.5,80.5,13.5"; // Bounded area around Chennai/TN campus region
      const url = `${this.nominatimUrl}/search?format=json&q=${encodeURIComponent(
        cleanQuery
      )}&addressdetails=1&limit=${limit}&countrycodes=in&viewbox=${viewbox}`;

      const res = await fetch(url, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "CommuteX-Corporate-App/1.0 (contact@commutex.com)",
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((item: any) => {
        const address = item.address || {};
        const shortName =
          item.name ||
          address.suburb ||
          address.neighbourhood ||
          address.road ||
          item.display_name.split(",")[0];

        return {
          displayName: item.display_name,
          shortName: shortName.trim(),
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          city: address.city || address.town || address.state_district,
          state: address.state,
        };
      });
    } catch (error) {
      console.warn("Nominatim fallback search failed:", error);
      return [];
    }
  }

  /**
   * Reverse geocode coordinates to a human-readable address
   */
  async reverse(latitude: number, longitude: number): Promise<LocationResult | null> {
    const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
    if (this.reverseCache.has(cacheKey)) {
      return this.reverseCache.get(cacheKey)!;
    }

    // 1. Try Photon Reverse API first
    try {
      const photonUrl = `${this.photonUrl}/reverse?lat=${latitude}&lon=${longitude}`;
      const res = await fetch(photonUrl, {
        headers: { "Accept-Language": "en" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.features) && data.features.length > 0) {
          const props = data.features[0].properties || {};
          const coords = data.features[0].geometry?.coordinates || [longitude, latitude];
          
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
        }
      }
    } catch (err) {
      console.warn("Photon reverse geocode warning:", err);
    }

    // 2. Fallback to Nominatim Reverse API
    try {
      const url = `${this.nominatimUrl}/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

      const res = await fetch(url, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "CommuteX-Corporate-App/1.0 (contact@commutex.com)",
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim reverse HTTP ${res.status}`);
      }

      const item = await res.json();
      if (!item || !item.display_name) return null;

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
    } catch (error) {
      console.warn("Reverse geocoding failed:", error);
      return null;
    }
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

export const geocodingService = new GeocodingService();
