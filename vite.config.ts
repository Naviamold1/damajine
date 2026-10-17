import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Dev only: serves `api/gemini.ts` at /api/gemini so `pnpm dev` talks to real Gemini without `vercel dev`.
 * Reads GEMINI_* from `.env.local` into the server process; nothing reaches the client bundle.
 */
function geminiDevApi(): Plugin {
  return {
    name: 'gemini-dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, 'GEMINI_')
      Object.assign(process.env, env)
      server.middlewares.use('/api/gemini', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const { POST } = await server.ssrLoadModule('/api/gemini.ts')
        const response: Response = await POST(
          new Request('http://localhost/api/gemini', {
            method: req.method,
            headers: { 'content-type': 'application/json', 'x-forwarded-for': req.socket.remoteAddress ?? '' },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          }),
        )
        res.statusCode = response.status
        res.setHeader('content-type', 'application/json')
        res.end(await response.text())
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), geminiDevApi()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { exclude: ['**/node_modules/**', '.claude/**'] },
})
