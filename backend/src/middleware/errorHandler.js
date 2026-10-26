const unavailableCodes = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const unavailable = unavailableCodes.has(err.code);
  const status = unavailable ? 503 : (err.status || err.statusCode || 500);
  if (status >= 500) console.error(err.message);
  const message = unavailable ? 'Service temporarily unavailable. Please try again.' : status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ success: false, ...(unavailable ? { code: 'SERVICE_UNAVAILABLE' } : {}), message });
};
module.exports = errorHandler;
