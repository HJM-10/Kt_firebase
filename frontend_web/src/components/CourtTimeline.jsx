import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { SportPhoto, StatusBadge } from './ArenaUI';
import { minutes, slotState, timelineBounds } from '../utils/arena';

export default function CourtTimeline({ venues, date, maxRows = 5, onSelect }) {
  const [offset, setOffset] = useState(0), [expanded, setExpanded] = useState(false);
  const published = venues.filter(v => v.slots?.length);
  const ordered = [...published].sort((a, b) => Number(b.slots.some(s => s.bookings?.length)) - Number(a.slots.some(s => s.bookings?.length)));
  const rows = maxRows && !expanded ? ordered.slice(0, maxRows) : ordered;
  const bounds = timelineBounds(published);
  const reserved = published.flatMap(v => v.slots).filter(s => s.bookings?.some(b => ['CONFIRMED', 'SCANNED', 'PENDING_PAYMENT'].includes(b.status)));
  const anchor = reserved.length ? Math.floor(Math.min(...reserved.map(s => minutes(s.startTime))) / 60) * 60 : bounds.start;
  const start = Math.max(bounds.start, Math.min(Math.max(bounds.start, bounds.end - 240), anchor + offset * 60));
  const end = start + 240;
  const hour = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  if (!rows.length) return <div className="empty-state"><CalendarDays size={32} /><h3>No published sessions</h3><p>Choose another day or publish court availability.</p><Link className="btn btn-primary mt-16" to={`/reserve?date=${date}`}>Open schedule</Link></div>;
  return <>
    <div className="timeline-navigation"><span>{hour(start)}–{hour(end)} <small>Pakistan time</small></span><div><button className="icon-button" aria-label="Earlier schedule hours" disabled={start <= bounds.start} onClick={() => setOffset(offset - 2)}><ChevronLeft size={17} /></button><button className="icon-button" aria-label="Later schedule hours" disabled={end >= bounds.end} onClick={() => setOffset(offset + 2)}><ChevronRight size={17} /></button></div></div>
    <div className="court-timeline-scroll" role="region" aria-label="Daily court timetable" tabIndex={0}><div className="court-timeline"><div className="court-axis"><span>Venue / court</span>{[0, 1, 2, 3].map(i => <span key={i}>{hour(start + i * 60)}</span>)}</div>
      {rows.map(venue => <div className="court-row" key={venue.id}><Link className="court-label" to={`/venues/${venue.id}`}><SportPhoto venue={venue} showLabel={false} /><strong>{venue.name}</strong><small>{venue.sport?.name}</small></Link><div className="court-track">{venue.slots.filter(s => minutes(s.startTime) < end && minutes(s.endTime) > start).map(slot => {
        const state = slotState(slot), left = Math.max(start, minutes(slot.startTime)), right = Math.min(end, minutes(slot.endTime));
        const content = <><strong>{state.label}</strong><small>{slot.startTime}–{slot.endTime}</small><StatusBadge status={state.status} /></>;
        const props = { className: `court-session state-${state.status.toLowerCase()}`, style: { left: `${(left - start) / 240 * 100}%`, width: `calc(${(right - left) / 240 * 100}% - 5px)` }, title: `${venue.name}: ${slot.startTime}–${slot.endTime}, ${state.label}` };
        return onSelect ? <button key={slot.id} {...props} onClick={() => onSelect({ ...slot, venue }, state.booking)}>{content}</button> : <Link key={slot.id} {...props} to={state.booking ? `/bookings?date=${date}&booking=${state.booking.id}` : `/reserve?venueId=${venue.id}&date=${date}&slotId=${slot.id}`}>{content}</Link>;
      })}</div></div>)}
    </div></div>
    <div className="timeline-footer"><div className="schedule-legend">{['CONFIRMED', 'PENDING_PAYMENT', 'SCANNED', 'OPEN'].map(s => <StatusBadge key={s} status={s} />)}</div>{maxRows > 0 && published.length > maxRows && <button className="text-button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer courts' : `Show all ${published.length} courts`}</button>}</div>
  </>;
}
