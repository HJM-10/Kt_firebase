import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { directionsUrl, hasPin } from '../utils/location';
import 'leaflet/dist/leaflet.css';

let googleLoader;
function googleMaps(key) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (!googleLoader) googleLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    window.arenaMapsReady = () => resolve(window.google.maps);
    window.gm_authFailure = () => reject(new Error('Map access is unavailable. Use the coordinates or directions link.'));
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, loading: 'async', callback: 'arenaMapsReady', v: 'weekly' })}`;
    script.onerror = () => { googleLoader = null; script.remove(); reject(new Error('Map could not load. Check your connection.')); };
    document.head.appendChild(script);
  });
  return googleLoader;
}

export function DirectionsLink({ venue, compact = false }) {
  const url = directionsUrl(venue);
  if (!url) return null;
  return <a className={`btn btn-secondary ${compact ? 'btn-sm' : ''}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${venue.name || 'this venue'} in Google Maps`}><Navigation size={16} />Directions</a>;
}

export default function VenueMap({ venue, onChange }) {
  const container = useRef(null), controller = useRef(null), change = useRef(onChange);
  change.current = onChange;
  const [error, setError] = useState('');
  const latest = useRef(venue);
  latest.current = venue;
  const latitude = venue?.latitude, longitude = venue?.longitude;
  const editable = !!onChange;
  useEffect(() => {
    let cancelled = false, dispose = () => {};
    const point = hasPin(venue) ? [venue.latitude, venue.longitude] : [30.3753, 69.3451];
    const zoom = hasPin(venue) ? 15 : 5;
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    async function init() {
      if (key) {
        const maps = await googleMaps(key);
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
        if (cancelled) return;
        const map = new Map(container.current, { center: { lat: point[0], lng: point[1] }, zoom, mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID', streetViewControl: false, mapTypeControl: false, gestureHandling: 'cooperative' });
        const marker = new AdvancedMarkerElement({ map, position: hasPin(venue) ? { lat: point[0], lng: point[1] } : null, gmpDraggable: editable, title: 'Venue entrance' });
        const move = event => change.current?.({ latitude: Number(event.latLng.lat().toFixed(6)), longitude: Number(event.latLng.lng().toFixed(6)) });
        const listeners = editable ? [map.addListener('click', move), marker.addListener('dragend', move)] : [];
        controller.current = value => { marker.position = value ? { lat: value.latitude, lng: value.longitude } : null; if (value) map.panTo(marker.position); };
        dispose = () => { listeners.forEach(l => l.remove()); marker.map = null; maps.event.clearInstanceListeners(map); };
      } else {
        const { default: L } = await import('leaflet');
        if (cancelled) return;
        const map = L.map(container.current, { scrollWheelZoom: false }).setView(point, zoom);
        L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map).on('tileerror', () => setError('Map imagery is unavailable. You can still enter coordinates or use Google Maps directions.'));
        const marker = L.circleMarker(point, { radius: 10, color: '#fff', weight: 3, fillColor: '#245744', fillOpacity: 1 });
        if (hasPin(venue)) marker.addTo(map);
        if (editable) map.on('click', e => change.current?.({ latitude: Number(e.latlng.lat.toFixed(6)), longitude: Number(e.latlng.lng.toFixed(6)) }));
        controller.current = value => { if (value) { marker.setLatLng([value.latitude, value.longitude]).addTo(map); map.panTo([value.latitude, value.longitude]); } else marker.remove(); };
        const resize = new ResizeObserver(() => map.invalidateSize()); resize.observe(container.current);
        dispose = () => { resize.disconnect(); map.remove(); };
      }
      controller.current?.(hasPin(latest.current) ? latest.current : null);
    }
    init().catch(e => { if (!cancelled) setError(e.message || 'Map unavailable. Use the coordinates below.'); });
    return () => { cancelled = true; controller.current = null; dispose(); };
    // Map instances live for the panel's lifetime; coordinates sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);
  useEffect(() => { controller.current?.(hasPin({ latitude, longitude }) ? { latitude, longitude } : null); }, [latitude, longitude]);
  return <div className="venue-location-map"><div ref={container} className="venue-map-canvas" role="region" aria-label={editable ? 'Venue entrance picker. Click the map to place a pin; coordinates can also be typed below.' : 'Venue entrance map'} />{error && <p className="map-message" role="status">{error}</p>}</div>;
}

export function VenueLocation({ venue }) {
  return <section className="card venue-location"><div className="flex justify-between items-center gap-8"><h2><MapPin size={20} />Find your way here</h2><DirectionsLink venue={venue} /></div><p>{venue.address || 'Street address has not been added yet.'}</p>{hasPin(venue) ? <><VenueMap venue={venue} /><p className="text-muted">Entrance: {venue.latitude.toFixed(6)}, {venue.longitude.toFixed(6)} · Google Maps uses your current location when available, or lets you choose a starting point.</p></> : <p className="text-muted">The venue has not added an entrance pin yet. Ask staff for the location before travelling.</p>}</section>;
}
