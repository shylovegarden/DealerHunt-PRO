"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom dark/neon icons for different types
const createIcon = (color: string) => {
  return new L.DivIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 10px ${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const icons = {
  auction: createIcon("var(--amber)"),
  dealer: createIcon("var(--blue)"),
  private: createIcon("var(--green)"),
  hub: createIcon("var(--red)"),
};

export interface MapPoint {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  type?: "auction" | "dealer" | "private" | "hub";
  label?: string;
}

interface DealerMapProps {
  points?: MapPoint[];
}

export default function DealerMap({ points = [] }: DealerMapProps) {
  const [mapKey, setMapKey] = useState("map-initial");

  useEffect(() => {
    setMapKey(`map-${Date.now()}`);
  }, []);

  const validPoints = points.filter(
    (p) =>
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      !Number.isNaN(p.lat) &&
      !Number.isNaN(p.lng),
  );

  return (
    <div className="w-full h-full min-h-[400px] md:min-h-[500px] rounded-[var(--r4)] overflow-hidden border border-[var(--b1)] shadow-inner z-0 relative">
      <MapContainer
        key={mapKey}
        center={[39.8283, -98.5795]}
        zoom={4}
        style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
        zoomControl={false}
      >
        {/* Dark theme basemap */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {validPoints.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={icons[point.type ?? "dealer"]}
          >
            <Popup className="custom-popup">
              <div className="p-1">
                <h3 className="font-bold text-[var(--t1)] text-sm mb-1">
                  {point.name}
                </h3>
                {point.label && (
                  <div className="text-xs text-[var(--t4)]">{point.label}</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Empty-state overlay when there is no real geo data to plot */}
      {validPoints.length === 0 && (
        <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          <div
            className="border border-[var(--b1)] rounded-xl px-5 py-4 shadow-lg"
            style={{ background: "rgba(250,246,242,0.9)" }}
          >
            <p className="text-sm font-bold text-[var(--t1)]">
              No mapped locations yet
            </p>
            <p className="text-xs text-[var(--t4)] mt-1">
              Deals with geocoded locations will appear here.
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      {validPoints.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-[var(--s1)] border border-[var(--b1)] p-3 rounded-xl shadow-lg z-[1000] flex flex-col gap-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--t4)] mb-1">
            Network
          </h4>
          <div className="flex items-center gap-2 text-xs text-[var(--t2)]">
            <div className="w-3 h-3 rounded-full bg-[var(--amber)]"></div>{" "}
            Auctions
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--t2)]">
            <div className="w-3 h-3 rounded-full bg-[var(--blue)]"></div>{" "}
            Wholesalers
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--t2)]">
            <div className="w-3 h-3 rounded-full bg-[var(--red)]"></div> Major
            Hubs
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--t2)]">
            <div className="w-3 h-3 rounded-full bg-[var(--green)]"></div>{" "}
            Private Sellers
          </div>
        </div>
      )}
    </div>
  );
}
