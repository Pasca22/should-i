"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed, Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet";

type View = { center: [number, number]; zoom: number };

const VIEW_KEY = "should-i:map-view";
const WORLD: View = { center: [30, 10], zoom: 3 };
const LOCATED_ZOOM = 15;

// Kept for the whole browser session, across page switches: ask for the location once, not on every visit.
let located: [number, number] | null = null;
let askedForLocation = false;

function savedView(): View {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null");
    if (Array.isArray(v?.center) && typeof v?.zoom === "number") return v;
  } catch {
    // Storage blocked or corrupt: fall back to the world view.
  }
  return WORLD;
}

/** Leaflet only measures its container once; re-measure when it changes size (window resize, phone rotation). */
function FollowContainerSize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Remembers where the map was, so the next visit opens there even before the location is known. */
function RememberView() {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter();
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify({ center: [c.lat, c.lng], zoom: map.getZoom() }));
      } catch {
        // Not being able to remember the view is harmless.
      }
    },
  });
  return null;
}

/** Asks the browser for the user's location (once per session, or on the button) and centres the map there. */
function LocateMe() {
  const map = useMap();
  const [position, setPosition] = useState(located);
  const canLocate = "geolocation" in navigator;
  // The first visit asks automatically (see the effect below), so start in the "locating" state.
  const [locating, setLocating] = useState(() => canLocate && !askedForLocation);
  const [message, setMessage] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  const request = (fly: boolean) =>
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        located = [coords.latitude, coords.longitude];
        setPosition(located);
        setLocating(false);
        if (fly) map.flyTo(located, Math.max(map.getZoom(), LOCATED_ZOOM));
        else map.setView(located, LOCATED_ZOOM);
      },
      (err) => {
        setLocating(false);
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked for this site. Allow it in the browser, or just tap the map where you want to go."
            : "Couldn't find your location. Tap the map where you want to go.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );

  const locateFromButton = () => {
    if (!canLocate) return setMessage("This browser can't share your location. Tap the map instead.");
    setLocating(true);
    setMessage("");
    request(true);
  };

  useEffect(() => {
    // Clicks on the button must not also reach the map (where they would add a route point).
    if (buttonRef.current) L.DomEvent.disableClickPropagation(buttonRef.current);
    if (canLocate && !askedForLocation) {
      askedForLocation = true;
      request(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask once per browser session, on first mount
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <>
      {position && (
        <CircleMarker
          center={position}
          radius={7}
          interactive={false}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#4c8dff", fillOpacity: 1 }}
        />
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-label="Show my location"
        title="Show my location"
        onClick={locateFromButton}
        className="absolute top-16 right-3 z-[1000] grid size-10 place-items-center rounded-full border border-border bg-card/90 text-foreground shadow-md backdrop-blur hover:bg-muted"
      >
        {locating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
      </button>
      {message && (
        <div className="pointer-events-none absolute inset-x-3 top-28 z-[1000] mx-auto max-w-sm rounded-xl bg-card/95 px-3 py-2 text-center text-sm shadow-lg">
          {message}
        </div>
      )}
    </>
  );
}

/** Full-size dark map; sports draw their own layers as children. Client-only (Leaflet needs window). */
export default function MapView({ children }: { children?: ReactNode }) {
  const phone = window.matchMedia("(max-width: 767px)").matches;
  const [initial] = useState(() => (located ? { center: located, zoom: LOCATED_ZOOM } : savedView()));

  // Next.js keeps pages you navigate away from mounted but hidden (React <Activity>). Hiding runs effect
  // cleanups, so react-leaflet removes its Leaflet map yet keeps pointing at it, and the page crashes when
  // shown again. A new key on every hide makes the map mount fresh when the page comes back; the rest of
  // the page's state (route, plan, results) is kept.
  const [generation, setGeneration] = useState(0);
  useLayoutEffect(() => () => setGeneration((g) => g + 1), []);

  return (
    <MapContainer key={generation} center={initial.center} zoom={initial.zoom} zoomControl={false} className="h-full w-full">
      {/* Standard OpenStreetMap tiles (no API key), darkened to the theme in globals.css. */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      {/* Phones pinch to zoom; the buttons are for mouse users. */}
      {!phone && <ZoomControl position="bottomright" />}
      <FollowContainerSize />
      <RememberView />
      <LocateMe />
      {children}
    </MapContainer>
  );
}
