import Stripe from "stripe";

const stripeKey = process.env.STRIPE_KEY;

// Fill STRIPE_KEY in .env.local for real requests.
export const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2024-06-20" })
  : null;
