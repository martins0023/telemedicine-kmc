
import { NextResponse } from 'next/server';
import Twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const { roomName } = await request.json();

    if (!roomName) {
      return NextResponse.json({ error: 'Missing roomName' }, { status: 400 });
    }

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioApiKeySid = process.env.TWILIO_API_KEY_SID; // For client initialization, an API Key SID/Secret is good practice
    const twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET; // Or use Account SID and Auth Token

    if (!twilioAccountSid || !twilioApiKeySid || !twilioApiKeySecret) {
      console.error('Twilio credentials not configured in .env.local for room completion.');
      return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    // If using API Key SID/Secret for the client:
    const client = Twilio(twilioApiKeySid, twilioApiKeySecret, { accountSid: twilioAccountSid });
    // If using Account SID and Auth Token (less common for this specific SDK use, but possible):
    // const authToken = process.env.TWILIO_AUTH_TOKEN; // ensure this is set if using
    // const client = Twilio(twilioAccountSid, authToken);


    try {
      // Check if room exists and is in-progress before trying to complete
      const roomInstance = await client.video.v1.rooms(roomName).fetch();
      if (roomInstance.status !== 'completed') {
        const room = await client.video.v1.rooms(roomName).update({ status: 'completed' });
        console.log(`Room ${room.sid} completed successfully.`);
        return NextResponse.json({ success: true, message: `Room ${roomName} completed.` });
      } else {
        console.log(`Room ${roomName} was already completed.`);
        return NextResponse.json({ success: true, message: `Room ${roomName} already completed.` });
      }
    } catch (twilioError: any) {
      // If room not found, Twilio throws a 404. Consider this as "already completed or never existed".
      if (twilioError.status === 404) {
        console.warn(`Room ${roomName} not found. Assuming completed or never existed.`);
        return NextResponse.json({ success: true, message: `Room ${roomName} not found or already completed.` });
      }
      console.error(`Failed to complete Twilio room ${roomName}:`, twilioError);
      return NextResponse.json({ error: `Failed to complete room: ${twilioError.message}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Error in complete room API:", error);
    return NextResponse.json({ error: `Failed to process request: ${error.message}` }, { status: 500 });
  }
}
