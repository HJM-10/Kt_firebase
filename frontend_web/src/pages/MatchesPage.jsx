import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Swords } from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const MatchesPage = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [scores, setScores] = useState({ team1: '', team2: '' });

  // Add Match State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentData, setSelectedTournamentData] = useState(null);
  const [matchData, setMatchData] = useState({
    tournamentId: '', team1: '', team2: '', scheduledAt: '', venue: '', round: ''
  });

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/matches');
      setMatches(res.data.data);
    } catch (err) {
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };
  const fetchTournaments = async () => {
    try {
      const res = await api.get('/tournaments');
      setTournaments(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useLiveRefresh('matches', fetchMatches);
  useEffect(() => { 
    fetchMatches(); 
    if (isAdmin) fetchTournaments();
  }, [isAdmin]);

  const handleTournamentSelect = async (e) => {
    const tId = e.target.value;
    setMatchData({ ...matchData, tournamentId: tId, team1: '', team2: '' });
    if (!tId) return setSelectedTournamentData(null);
    try {
      const res = await api.get(`/tournaments/${tId}`);
      setSelectedTournamentData(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    
    if (matchData.team1.trim().toLowerCase() === matchData.team2.trim().toLowerCase()) {
      return toast.error('Team 1 and Team 2 cannot be the same team');
    }

    try {
      await api.post('/matches', matchData);
      toast.success('Match scheduled successfully');
      setShowCreateModal(false);
      fetchMatches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create match');
    }
  };

  const openScoreModal = (match) => {
    setSelectedMatch(match);
    setScores({ team1: '', team2: '' });
    setScoreModalOpen(true);
  };

  const handleUpdateScore = async (e) => {
    e.preventDefault();
    const score1 = parseInt(scores.team1);
    const score2 = parseInt(scores.team2);
    if (isNaN(score1) || isNaN(score2)) return;
    
    const winner = score1 > score2 ? 'team1' : score2 > score1 ? 'team2' : 'draw';
    
    try {
      await api.put(`/matches/${selectedMatch.id}/result`, {
        team1Score: score1,
        team2Score: score2,
        result: `${score1} - ${score2}`,
        winner
      });
      toast.success('Match updated');
      fetchMatches();
      setScoreModalOpen(false);
    } catch (err) {
      toast.error('Failed to update match');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Matches</h1>
          <div className="page-subtitle">Tournament fixtures and results</div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + Add Match
          </button>
        )}
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="spinner"></div></div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Swords size={48} className="text-muted" /></div>
          <div className="empty-title">No Matches</div>
          <div className="text-muted">No matches have been scheduled yet.</div>
        </div>
      ) : (
        <div className="grid-2">
          {matches.map(m => (
            <div key={m.id} className="match-card flex-col items-start gap-12">
              <div className="flex justify-between w-full">
                <span className="badge badge-secondary">{m.tournament?.name}</span>
                <span className="text-muted flex items-center gap-8"><Calendar size={14}/> {new Date(m.scheduledAt).toLocaleString()}</span>
              </div>
              
              <div className="match-teams w-full mt-8">
                <div className="flex-1 text-right">{m.team1} {m.team1Score !== null && <span className="match-score ml-8">{m.team1Score}</span>}</div>
                <div className="match-vs">VS</div>
                <div className="flex-1">{m.team2Score !== null && <span className="match-score mr-8">{m.team2Score}</span>} {m.team2}</div>
              </div>

              {isAdmin && !m.isCompleted && (
                <button className="btn btn-primary btn-sm btn-full mt-8" onClick={() => openScoreModal(m)}>
                  Update Result
                </button>
              )}
              {m.isCompleted && (
                <div className="w-full text-center mt-8 text-muted">
                  Winner: <strong>{m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : 'Draw'}</strong>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {scoreModalOpen && selectedMatch && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Update Match Score</h2>
              <button className="modal-close" onClick={() => setScoreModalOpen(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleUpdateScore}>
              <div className="form-group">
                <label className="form-label">{selectedMatch.team1} Score</label>
                <input type="number" required className="form-input" value={scores.team1} onChange={e => setScores({...scores, team1: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{selectedMatch.team2} Score</label>
                <input type="number" required className="form-input" value={scores.team2} onChange={e => setScores({...scores, team2: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setScoreModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Result</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Schedule Match</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleCreateMatch}>
              <div className="form-group">
                <label className="form-label">Tournament</label>
                <select required className="form-input" value={matchData.tournamentId} onChange={handleTournamentSelect}>
                  <option value="">Select Tournament</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {selectedTournamentData && (
                <datalist id="tournament-teams">
                  {selectedTournamentData.registrations.map(r => (
                    <option key={r.id} value={r.teamName} />
                  ))}
                </datalist>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Team 1</label>
                  <input type="text" required list="tournament-teams" className="form-input" placeholder="Select or type team" value={matchData.team1} onChange={e => setMatchData({...matchData, team1: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Team 2</label>
                  <input type="text" required list="tournament-teams" className="form-input" placeholder="Select or type team" value={matchData.team2} onChange={e => setMatchData({...matchData, team2: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Scheduled Date & Time</label>
                <input type="datetime-local" required className="form-input" value={matchData.scheduledAt} onChange={e => setMatchData({...matchData, scheduledAt: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Venue (Optional)</label>
                  <input type="text" className="form-input" value={matchData.venue} onChange={e => setMatchData({...matchData, venue: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Round (Optional)</label>
                  <input type="text" className="form-input" placeholder="e.g. Quarter Finals" value={matchData.round} onChange={e => setMatchData({...matchData, round: e.target.value})} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchesPage;
