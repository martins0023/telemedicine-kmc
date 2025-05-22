
import { NextResponse } from 'next/server';
import Twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const { roomName } = await request.json();

    if (!roomName) {
      return NextResponse.json({ error: 'Missing roomName' }, { status: 400 });
    }

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioApiKeySid = process.env.TWILIO_API_KEY_SID; 
    const twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    if (!twilioAccountSid || !twilioApiKeySid || !twilioApiKeySecret) {
      console.error('Twilio credentials check for room completion:');
      console.error(` - TWILIO_ACCOUNT_SID: ${twilioAccountSid ? 'Loaded' : 'MISSING'}`);
      console.error(` - TWILIO_API_KEY_SID: ${twilioApiKeySid ? 'Loaded' : 'MISSING'}`);
      console.error(` - TWILIO_API_KEY_SECRET: ${twilioApiKeySecret ? 'Loaded' : 'MISSING (should be loaded)'}`);
      console.error('Please ensure all Twilio credentials are correctly set in .env.local for room completion and the server has been restarted.');
      return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    const client = Twilio(twilioApiKeySid, twilioApiKeySecret, { accountSid: twilioAccountSid });

    try {
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
