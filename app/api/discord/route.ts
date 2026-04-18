import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { waitUntil } from '@vercel/functions';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const body = await req.text();

  if (!signature || !timestamp) {
    return new NextResponse('Missing headers', { status: 401 });
  }

  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, 'hex'),
    Buffer.from(process.env.DISCORD_PUBLIC_KEY || '', 'hex')
  );

  if (!isVerified) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const json = JSON.parse(body);

  if (json.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  if (json.type === 2) {
    const userQuestion = json.data.options[0].value;
    const interactionToken = json.token;
    
    // REPLACE THIS WITH YOUR ACTUAL DISCORD APP ID (from register.js)
    const appId = '1494977957704503398'; 

    // 1. Run the AI generation in the background
    waitUntil(
      (async () => {
        try {
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          const prompt = `You are a senior Next.js developer. Provide direct, highly optimized, production-ready Next.js code. Answer this: ${userQuestion}`;
          
          const result = await model.generateContent(prompt);
          const responseText = result.response.text();

          // 2. Send a PATCH request to edit the "thinking..." message with the final code
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: responseText.substring(0, 2000) })
          });
        } catch (error) {
          console.error("GEMINI ERROR:", error);
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: "Error processing the AI request." })
          });
        }
      })()
    );

    // 3. INSTANTLY return a "Deferred" response so Discord doesn't timeout!
    return NextResponse.json({ type: 5 });
  }

  return new NextResponse('Bad request', { status: 400 });
}