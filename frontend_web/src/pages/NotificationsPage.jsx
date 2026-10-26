import useLiveRefresh from '../services/useLiveRefresh';
import { useEffect, useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const load = async () => { try { const r = await api.get('/notifications', { params: { page } }); setItems(r.data.data); setHasMore(r.data.hasMore); setUnread(r.data.unreadCount); } catch { toast.error('Could not load notifications'); } finally { setLoading(false); } };
  useLiveRefresh('notifications', load);
  useEffect(() => { load(); const interval = setInterval(load, 30000); return () => clearInterval(interval); }, [page]);
  const read = async () => { try { await api.patch('/notifications/read', {}); load(); } catch { toast.error('Could not mark notifications read'); } };
  return <div><div className="page-header"><h1 className="page-title">Notifications ({unread} unread)</h1><button className="btn btn-secondary" onClick={read}>Mark all read</button></div>{loading ? <p>Loading…</p> : !items.length ? <div className="empty-state">No notifications yet.</div> : items.map(n => <article key={n.id} className="card mb-16"><h2>{n.title} {!n.isRead && <span className="badge badge-primary">New</span>}</h2><p>{n.body}</p><time className="text-muted">{new Date(n.createdAt).toLocaleString()}</time></article>)}<div className="flex gap-8"><button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button className="btn btn-secondary" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</button></div></div>;
}
