import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Home {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  status: string;
  capacity: number;
  currentOccupancy: number;
  latitude?: number | null;
  longitude?: number | null;
}

interface HomesMapProps {
  homes: Home[];
  onHomeClick?: (homeId: number) => void;
}

const statusColors: Record<string, string> = {
  active: "#16a34a",
  inactive: "#6b7280",
  maintenance: "#d97706",
};

export function HomesMap({ homes, onHomeClick }: HomesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
    }

    const homesWithCoords = homes.filter((h) => h.latitude && h.longitude);

    const defaultCenter: [number, number] = [39.8283, -98.5795];
    const defaultZoom = 4;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (homesWithCoords.length > 0) {
      const bounds = L.latLngBounds(
        homesWithCoords.map((h) => [h.latitude!, h.longitude!] as [number, number])
      );

      homesWithCoords.forEach((home) => {
        const color = statusColors[home.status] || "#6b7280";
        const occupancyPct = Math.round((home.currentOccupancy / home.capacity) * 100);

        const icon = L.divIcon({
          className: "custom-home-marker",
          html: `<div style="
            width: 36px; height: 36px; border-radius: 50%;
            background: ${color}; border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; cursor: pointer;
          ">🏠</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        const marker = L.marker([home.latitude!, home.longitude!], { icon }).addTo(map);

        marker.bindPopup(`
          <div style="min-width: 200px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">${home.name}</div>
            <div style="color: #64748b; font-size: 13px; margin-bottom: 4px;">
              📍 ${home.address || ""} ${home.city || ""}, ${home.state || ""}
            </div>
            <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 13px;">
              <span style="color: ${color}; font-weight: 600;">● ${home.status}</span>
              <span>🛏️ ${home.currentOccupancy}/${home.capacity} (${occupancyPct}%)</span>
            </div>
            ${onHomeClick ? `<div style="margin-top: 10px;"><a href="/homes/${home.id}" style="color: #0a7ea4; font-weight: 600; font-size: 13px; text-decoration: none;">View Details →</a></div>` : ""}
          </div>
        `);

        if (onHomeClick) {
          marker.on("click", () => {
            marker.openPopup();
          });
        }
      });

      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

    mapInstance.current = map;

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [homes, onHomeClick]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-lg border border-border overflow-hidden"
      style={{ height: 400 }}
    />
  );
}
