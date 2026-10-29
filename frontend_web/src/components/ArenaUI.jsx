import { ArrowUpRight, MapPin, RefreshCw, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import useThemeStore from '../store/themeStore';
import { sportImage, statusLabels } from '../utils/arena';
export function BrandMark() {
  return <svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M7 5v26M29 5 7 27M14 17l15 14M16 5h13v10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d="m21 5-6 7" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" /></svg>;
}
export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  return <button type="button" className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>;
}
export function StatusBadge({ status, children }) {
  return <span className={`status-badge status-${String(status).toLowerCase()}`}><span className="status-dot" />{children || statusLabels[status] || String(status).replaceAll('_', ' ').toLowerCase()}</span>;
}
export function PageHeading({ eyebrow, title, description, actions }) {
  return <div className="page-header arena-page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="page-title">{title}</h1>{description && <p className="page-subtitle">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
export function StatCard({ icon: Icon, value, label, note, tone = '' }) {
  return <div className={`stat-card ${tone}`}><span className="stat-icon">{Icon && <Icon size={22} />}</span><div><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{note && <small className="text-muted">{note}</small>}</div></div>;
}
export function ErrorPanel({ message, onRetry }) {
  return <div className="error-panel" role="alert"><span>{message}</span>{onRetry && <button className="btn btn-secondary btn-sm" onClick={onRetry}><RefreshCw size={15} />Retry</button>}</div>;
}
export function SportPhoto({ venue, className = '', showLabel = true }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const fallback = sportImage(venue?.sport?.name || venue?.name);
  const supplied = venue?.imageUrl && venue.imageUrl !== failedUrl;
  const src = supplied ? venue.imageUrl : fallback;
  return <div className={`sport-photo ${className}`}>{src ? <img src={src} alt={supplied ? venue.name : `${venue?.sport?.name || 'Sport'} illustration`} loading="lazy" onError={e => { if (supplied) setFailedUrl(venue.imageUrl); else e.currentTarget.style.visibility = 'hidden'; }} /> : <MapPin size={34} />}{showLabel && !supplied && <span className="image-caption">Illustrative image</span>}</div>;
}
export function PanelHeading({ title, children }) { return <div className="panel-heading"><h2>{title}</h2>{children || <ArrowUpRight size={17} aria-hidden="true" />}</div>; }
