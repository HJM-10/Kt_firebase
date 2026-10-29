import api from './axios.js';
export async function firebaseLogin(email, password, existingPassword) {
  const { data: { data: provider } } = await api.get('/auth/providers');
  if (!provider.firebase) throw new Error('Firebase sign-in is not configured. Use your existing account sign-in.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(provider.firebaseApiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error('Firebase sign-in failed. Check your email and password, or try again shortly.');
  return api.post('/auth/firebase', { idToken: data.idToken, ...(existingPassword ? { existingPassword } : {}) });
}
