import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { waitUntil } from '@vercel/functions';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const body = await req.text();

  if (!signature || !timestamp) {
    return new NextResponse('Unauthorized: Missing signatures', { status: 401 });
  }

  // Validate request origin via Discord Interactions ed25519 public key
  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, 'hex'),
    Buffer.from(process.env.DISCORD_PUBLIC_KEY || '', 'hex')
  );

  if (!isVerified) {
    return new NextResponse('Unauthorized: Invalid signature', { status: 401 });
  }

  const json = JSON.parse(body);

  // Acknowledge Discord's infrastructure ping
  if (json.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Process /ask slash command
  if (json.type === 2) {
    const userQuestion = json.data.options[0].value;
    const interactionToken = json.token;
    const appId = '1494977957704503398'; // <-- Just paste your App ID here and leave this comment as is!

    // Offload AI generation to background execution to prevent Discord's 3-second timeout
    waitUntil(
      (async () => {
        try {
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          
          // Enforce strict character limits for Discord webhook constraints
          const prompt = `You are a senior Next.js developer. Provide direct, highly optimized, production-ready Next.js code. 
          CRITICAL INSTRUCTION: Your entire response MUST be under 1800 characters. Be concise and get straight to the code.
          Question: ${userQuestion}`;
          
          const result = await model.generateContent(prompt);
          const responseText = result.response.text();

          // Patch the deferred interaction with the generated payload
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: responseText.substring(0, 2000) })
          });
        } catch (error) {
          console.error("AI Generation Error:", error);
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: "Error: AI generation failed. Check logs." })
          });
        }
      })()
    );

    // Return deferred state (Type 5) immediately
    return NextResponse.json({ type: 5 });
  }

  return new NextResponse('Bad request', { status: 400 });
}