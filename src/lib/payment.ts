import Razorpay from 'razorpay';
import crypto from 'crypto';

export async function createRazorpayOrder(amount: number, credentials: { key_id: string; key_secret: string }) {
  const razorpay = new Razorpay({
    key_id: credentials.key_id,
    key_secret: credentials.key_secret,
  });

  const options = {
    amount: amount * 100, // amount in the smallest currency unit (paise)
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Razorpay Order Error:', error);
    throw error;
  }
}

export function verifyRazorpayPayment(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  key_secret: string
) {
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", key_secret)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === razorpay_signature;
}
