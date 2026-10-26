export function sessionExpired(error) {
  return error.response?.status === 401 && ['AUTH_REQUIRED', 'SESSION_INVALID'].includes(error.response?.data?.code);
}
export function errorMessage(error) {
  if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
  if (error.response.status >= 500) return 'Service temporarily unavailable. Please try again.';
  return error.response.data?.message || 'Request failed. Please try again.';
}
