let client;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error('Stripe is not configured. Contact the arena to complete payment.');
    error.status = 503;
    throw error;
  }
  client ||= require('stripe')(process.env.STRIPE_SECRET_KEY);
  return client;
}
module.exports = { getStripe };
