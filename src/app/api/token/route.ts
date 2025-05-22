
import { NextResponse } from 'next/server';
import Twilio from 'twilio';

const { AccessToken } = Twilio.jwt;
const { VideoGrant } = AccessToken;

export async function POST(request: Request) {
  try {
    const { identity, roomName } = await request.json();

    if (!identity || !roomName) {
      return NextResponse.json({ error: 'Missing identity or roomName' }, { status: 400 });
    }

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioApiKeySid = process.env.TWILIO_API_KEY_SID;
    const twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    if (!twilioAccountSid || !twilioApiKeySid || !twilioApiKeySecret) {
      console.error('Twilio credentials not configured in .env.local');
      return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    const token = new AccessToken(twilioAccountSid, twilioApiKeySid, twilioApiKeySecret, {
      identity: identity,
    });

    const videoGrant = new VideoGrant({ room: roomName });
    token.addGrant(videoGrant);
    
    const jwtToken = token.toJwt();

    return NextResponse.json({ token: jwtToken });

  } catch (error: any) {
    console.error("Error generating Twilio token:", error);
    return NextResponse.json({ error: `Failed to generate token: ${error.message}` }, { status: 500 });
  }
}
