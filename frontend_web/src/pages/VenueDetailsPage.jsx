import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import useLiveRefresh from '../services/useLiveRefresh';
import { VenueLocation } from '../components/VenueMap';
export default function VenueDetailsPage() {
  const { id } = useParams();
  const [venue, setVenue] = useState(null), [error, setError] = useState('');
  const load = useCallback(() => api.get(`/venues/${id}`).then(r => { setVenue(r.data.data); setError(''); }).catch(() => setError('Could not load this venue. Please retry.')), [id]);
  useEffect(() => { load(); }, [load]); useLiveRefresh('equipment', load); useLiveRefresh('venues', load);
  if (error) return <div role="alert" className="card">{error} <button className="btn btn-secondary" onClick={load}>Retry</button></div>;
  if (!venue) return <p role="status">Loading venue…</p>;
  const gear = venue.equipment || [];
  return <div><div className="card venue-hero"><p className="page-subtitle">{venue.sport.name}</p><h1 className="page-title">{venue.name}</h1><p>{venue.description || 'Explore this venue and its available equipment.'}</p><div className="flex gap-8"><span className="badge badge-info">{venue.openingTime} – {venue.closingTime} · Pakistan time</span><span className="badge badge-info">PKR {venue.pricePerSlot} / session</span>{venue.capacity && <span className="badge badge-info">{venue.capacity} players</span>}</div><p>Closed days: {(venue.closedWeekdays || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'None scheduled'}</p><div className="flex gap-8"><Link className="btn btn-primary" to={`/reserve?venueId=${id}`}>View court availability</Link><Link className="btn btn-secondary" to={`/equipment?venueId=${id}`}>Reserve equipment</Link></div></div>
  <VenueLocation venue={venue} />
  {!!venue.closures?.length && <div className="card mb-24"><h2>Scheduled closures</h2>{venue.closures.map(c => <p key={c.id}>{new Date(c.startAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} – {new Date(c.endAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}: {c.reason}</p>)}</div>}
  <h2 style={{ margin: '24px 0' }}>What you can play with</h2><p className="text-muted mb-24">Equipment specifications supplied by venue staff. Date-specific availability and prices are shown when you reserve.</p><div className="grid-3">{gear.map(item => <article className="card" key={item.id}><h3>{item.name}</h3><p>{item.description}</p><dl className="gear-specs">{[['Brand / model', [item.brand, item.model].filter(Boolean).join(' ')], ['Material / surface', item.material], ['Ball type', item.ballType], ['Condition', item.condition]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || 'Not specified by venue'}</dd></div>)}</dl><p>PKR {item.pricePerSlot} / unit / day · {item.quantity} rentable units</p><span className={`badge ${item.isActive ? 'badge-success' : 'badge-danger'}`}>{item.isActive ? 'Listed for rental' : 'Unavailable'}</span></article>)}</div>{!gear.length && <div className="empty-state">This venue has not listed its own equipment yet. <Link to="/equipment">Browse shared inventory</Link> or ask staff for specifications.</div>}</div>;
}
