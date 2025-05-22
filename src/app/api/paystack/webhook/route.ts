import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Utility to verify Paystack signature (conceptual)
// const verifySignature = (signature: string | null, body: string, secret: string): boolean => {
//   if (!signature) return false;
//   const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
//   return hash === signature;
// };

export async function POST(request: Request) {
  try {
    const rawBody = await request.text(); // Get raw body for signature verification
    const body = JSON.parse(rawBody); // Then parse it

    // const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    // const signature = request.headers.get('x-paystack-signature');

    // if (!paystackSecretKey) {
    //   console.error("Paystack secret key not configured.");
    //   return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    // }

    // if (!verifySignature(signature, rawBody, paystackSecretKey)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }
    
    console.log("Received Paystack webhook event:", body.event);
    console.log("Payload:", body.data);

    // Handle successful payment event (e.g., 'charge.success')
    if (body.event === 'charge.success') {
      const { reference, metadata } = body.data; //
      // metadata might contain roomName, clientEmail, minutesToExtend

      // 1. Retrieve consultation by roomName + client email (from metadata).
      // 2. Update endTime in MongoDB.
      // 3. Optionally, reschedule Twilio Room expiry.
      // 4. Notify frontend via WebSocket or polling (or client polls after payment).
      
      console.log(`Payment successful for reference: ${reference}. Metadata:`, metadata);
      // Add logic here to update consultation details based on payment.
      // e.g., await extendConsultationTime(metadata.roomName, metadata.minutesToExtend);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error("Error processing Paystack webhook:", error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
