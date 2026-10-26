import { useState, useEffect } from 'react';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import PromptModal from '../components/PromptModal';

const ComplaintsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promptData, setPromptData] = useState({ isOpen: false, id: null, status: null, currentNote: '' });

  const fetchComplaints = async () => {
    try {
      const endpoint = isAdmin ? '/complaints' : '/complaints/my';
      const res = await axios.get(endpoint);
      if (res.data.success) {
        setComplaints(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/complaints', { title, description });
      if (res.data.success) {
        toast.success('Complaint submitted successfully');
        setTitle('');
        setDescription('');
        fetchComplaints();
      }
    } catch (err) {
      toast.error('Failed to submit complaint');
    }
  };

  const handleUpdateStatus = (id, status, currentNote) => {
    setPromptData({ isOpen: true, id, status, currentNote });
  };

  const confirmUpdateStatus = async (adminNote) => {
    try {
      await axios.patch(`/complaints/${promptData.id}`, { status: promptData.status, adminNote });
      toast.success('Complaint updated');
      setPromptData({ isOpen: false, id: null, status: null, currentNote: '' });
      fetchComplaints();
    } catch (err) {
      toast.error('Failed to update complaint');
      setPromptData({ isOpen: false, id: null, status: null, currentNote: '' });
    }
  };

  if (loading) return <div className="p-6 text-white">Loading...</div>;

  return (
    <div className="p-6 text-white h-full overflow-auto max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400 mb-8">
        Help & Support
      </h1>

      <div className="card mb-8 border-t-4 border-t-red-500">
        <h2 className="text-xl font-semibold mb-4 text-white">File a Complaint</h2>
        <form onSubmit={handleSubmit} className="flex-col gap-16">
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input w-full"
              required
              placeholder="Brief subject of your issue"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input w-full h-32 resize-none"
              required
              placeholder="Please provide details about your issue..."
            />
          </div>
          <button type="submit" className="btn btn-primary mt-2 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            Submit Complaint
          </button>
        </form>
      </div>

      <h2 className="text-xl font-semibold mb-4 text-white">
        {isAdmin ? 'All Complaints' : 'My Previous Complaints'}
      </h2>
      <div className="space-y-4">
        {complaints.map(c => (
          <div key={c.id} className="card border-l-4 border-l-orange-500">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-bold text-white">{c.title}</h3>
                {isAdmin && <span className="text-xs text-gray-400">By: {c.user?.name} ({c.user?.email})</span>}
              </div>
              
              {isAdmin ? (
                <select 
                  className="form-select"
                  value={c.status}
                  onChange={(e) => handleUpdateStatus(c.id, e.target.value, c.adminNote)}
                >
                  <option value="OPEN" className="text-black">OPEN</option>
                  <option value="IN_PROGRESS" className="text-black">IN PROGRESS</option>
                  <option value="RESOLVED" className="text-black">RESOLVED</option>
                </select>
              ) : (
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  c.status === 'OPEN' ? 'bg-orange-500/20 text-orange-400' :
                  c.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {c.status}
                </span>
              )}
            </div>
            <p className="text-gray-300 text-sm mb-3 mt-2">{c.description}</p>
            <div className="text-xs text-gray-500">
              Submitted on: {new Date(c.createdAt).toLocaleDateString()}
            </div>
            {c.adminNote && (
              <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400 mb-1">Admin Response:</div>
                <div className="text-sm text-white">{c.adminNote}</div>
              </div>
            )}
          </div>
        ))}
        {complaints.length === 0 && (
          <div className="text-center py-8 text-gray-400 bg-white/5 rounded-xl">
            You haven't submitted any complaints yet.
          </div>
        )}
      </div>

      <PromptModal
        isOpen={promptData.isOpen}
        title="Update Complaint"
        message="Enter admin note (optional):"
        defaultValue={promptData.currentNote || ''}
        onConfirm={confirmUpdateStatus}
        onCancel={() => setPromptData({ isOpen: false, id: null, status: null, currentNote: '' })}
      />
    </div>
  );
};

export default ComplaintsPage;
