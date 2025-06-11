import { loadStripe } from "@stripe/stripe-js";

// Get Stripe publishable key from environment variables
const stripePublishableKey = 
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 
  process.env.STRIPE_PUBLISHABLE_KEY || 
  "pk_test_placeholder";

// Initialize Stripe
export const stripePromise = loadStripe(stripePublishableKey);

export const createPaymentIntent = async (amount: number) => {
  try {
    const response = await fetch("/api/create-payment-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    });

    if (!response.ok) {
      throw new Error("Failed to create payment intent");
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating payment intent:", error);
    throw error;
  }
};

// Payment processing utilities
export const processStripePayment = async (
  stripe: any,
  elements: any,
  clientSecret: string
) => {
  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation`,
      },
      redirect: "if_required",
    });

    if (error) {
      throw new Error(error.message);
    }

    return paymentIntent;
  } catch (error) {
    console.error("Payment processing error:", error);
    throw error;
  }
};
