# Next.js AI Developer Utility

A high-performance serverless Discord integration that provides production-ready Next.js code snippets via Google Gemini. 

## 🚀 Technical Highlights
- **Serverless Architecture:** Deployed on Vercel using Next.js App Router and API routes.
- **Asynchronous Processing:** Leverages Vercel's `waitUntil` to manage long-running LLM inference outside the 3s Discord Interaction window.
- **Cryptographic Security:** Implements `ed25519` signature verification using `tweetnacl` for secure webhook handshakes.
- **Optimized Prompt Engineering:** Custom system instructions to enforce high-density technical output within platform character constraints.

## 🛠️ Stack
- **Framework:** Next.js (App Router)
- **Runtime:** Node.js (Vercel Edge/Serverless)
- **AI Model:** Gemini 2.5 Flash
- **Security:** TweetNaCl.js
- **Platform:** Discord Interactions API
