import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  // 1. Get Discord security headers
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const body = await req.text();

  if (!signature || !timestamp) {
    return new NextResponse('Missing headers', { status: 401 });
  }

  // 2. Verify the request genuinely came from Discord
  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, 'hex'),
    Buffer.from(process.env.DISCORD_PUBLIC_KEY || '', 'hex')
  );

  if (!isVerified) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const json = JSON.parse(body);

  // 3. Handle Discord's initial connection ping
  if (json.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 4. Handle your custom /ask command
  if (json.type === 2) {
    const userQuestion = json.data.options[0].value;

    try {
      // Initialize Gemini
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // The System Prompt 
      const prompt = `You are a senior Next.js developer. Provide direct, highly optimized, production-ready Next.js code. Answer this: ${userQuestion}`;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Send the AI response back to Discord
      return NextResponse.json({
        type: 4,
        data: {
          content: responseText.substring(0, 2000), // Discord has a 2000 char limit
        },
      });
    } catch (error) {
        console.error("GEMINI API ERROR:", error);
      return NextResponse.json({
        type: 4,
        data: { content: "Error processing the request." },
      });
    }
  }

  return new NextResponse('Bad request', { status: 400 });
}