"use client";

import L from "leaflet";
import { Marker, Polyline, useMapEvents } from "react-leaflet";
import type { LatLon } from "../route";

type Props = {
  waypoints: LatLon[];
  /** Line colour: the accent while planning, the verdict's colour once Jev has judged this route. */
  color: string;
  disabled: boolean;
  onAdd: (p: LatLon) => void;
  onMove: (index: number, p: LatLon) => void;
  onRemove: (index: number) => void;
};

const icon = (kind: "start" | "point" | "end") =>
  L.divIcon({ className: `route-point route-point-${kind}`, iconSize: kind === "point" ? [14, 14] : [20, 20] });
const ICONS = { start: icon("start"), point: icon("point"), end: icon("end") };

/** The route being drawn: tap the map to add a point, drag a point to move it, tap a point to remove it. */
export default function RunMapLayers({ waypoints, color, disabled, onAdd, onMove, onRemove }: Props) {
  useMapEvents({
    click(e) {
      if (!disabled) onAdd({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });

  return (
    <>
      {waypoints.length > 1 && (
        <Polyline positions={waypoints.map((p) => [p.lat, p.lon])} pathOptions={{ color, weight: 4, opacity: 0.9 }} />
      )}
      {waypoints.map((p, i) => (
        <Marker
          // Index keys are right here: points are identified by their position in the route.
          key={i}
          position={[p.lat, p.lon]}
          icon={i === 0 ? ICONS.start : i === waypoints.length - 1 ? ICONS.end : ICONS.point}
          draggable={!disabled}
          title={i === 0 ? "Start · drag to move, tap to remove" : "Drag to move, tap to remove"}
          eventHandlers={{
            click: () => !disabled && onRemove(i),
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onMove(i, { lat: ll.lat, lon: ll.lng });
            },
          }}
        />
      ))}
    </>
  );
}
