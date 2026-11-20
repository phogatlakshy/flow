import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = new URL(env.OLLAMA_HOST_URL || 'http://127.0.0.1:11434')
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.protocol !== 'http:') {
    throw new Error('OLLAMA_HOST_URL must be an HTTP loopback address.')
  }
  const proxy: Record<string, ProxyOptions> = {
    '^/ollama/api/(tags|chat)(?:\\?|$)': {
      target: target.origin,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/ollama/, ''),
      configure(server) {
        server.on('proxyReq', (request) => request.removeHeader('origin'))
      },
    },
  }
  return {
    plugins: [react(), tailwindcss()], server: { proxy }, preview: { proxy },
    build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'employee-roster', test: /[\\/]src[\\/]data[\\/]roster\.json$/ }] } } } },
  }
})
