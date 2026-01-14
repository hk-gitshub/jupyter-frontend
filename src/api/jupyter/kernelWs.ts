import { JUPYTER_SERVER_BASE_URL } from './http'
import type { ExecuteOptions, JupyterMessage, Json } from './types'

function buildKernelChannelsUrl(kernelId: string, sessionId: string): string {
  const base = new URL(JUPYTER_SERVER_BASE_URL, window.location.origin)
  const wsProto = base.protocol === 'https:' ? 'wss:' : 'ws:'

  const wsBase = new URL(base.toString())
  wsBase.protocol = wsProto

  const path = `${wsBase.pathname.replace(/\/$/, '')}/api/kernels/${encodeURIComponent(kernelId)}/channels`
  const url = new URL(path, wsBase.toString())
  url.searchParams.set('session_id', sessionId)
  return url.toString()
}

/**
 * Execute code over Jupyter kernel channels (real-time output).
 * This is WebSocket-based, not HTTP.
 */
export async function executeCode(kernelId: string, code: string, options: ExecuteOptions = {}) {
  const sessionId = crypto.randomUUID()
  const username = 'workbench'

  const wsUrl = buildKernelChannelsUrl(kernelId, sessionId)
  const ws = new WebSocket(wsUrl)

  const abort = () => {
    try {
      ws.close()
    } catch {
      // ignore
    }
  }

  if (options.signal) {
    if (options.signal.aborted) abort()
    options.signal.addEventListener('abort', abort, { once: true })
  }

  const msgId = crypto.randomUUID()

  const executeRequest: JupyterMessage = {
    header: {
      msg_id: msgId,
      username,
      session: sessionId,
      date: new Date().toISOString(),
      msg_type: 'execute_request',
      version: '5.3',
    },
    parent_header: {},
    metadata: {},
    content: {
      code,
      silent: false,
      store_history: true,
      user_expressions: {},
      allow_stdin: false,
      stop_on_error: true,
    },
  }

  const timeoutMs = options.timeoutMs ?? 60_000
  let timeoutHandle: number | undefined

  const waitForIdle = new Promise<void>((resolve, reject) => {
    timeoutHandle = window.setTimeout(() => {
      reject(new Error(`Kernel execute timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    ws.onopen = () => {
      ws.send(JSON.stringify(executeRequest))
    }

    ws.onerror = () => {
      reject(new Error('Kernel websocket error'))
    }

    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      if (!raw) return

      let msg: JupyterMessage
      try {
        msg = JSON.parse(raw) as JupyterMessage
      } catch {
        return
      }

      const parent = (msg.parent_header ?? {}) as { msg_id?: string }
      if (parent.msg_id !== msgId) return

      const msgType = msg.header?.msg_type
      const content = (msg.content ?? {}) as Json

      if (msgType === 'status') {
        const execution_state = String(content.execution_state ?? '')
        options.onEvent?.({ kind: 'status', execution_state })
        if (execution_state === 'idle') resolve()
        return
      }

      if (msgType === 'stream') {
        options.onEvent?.({
          kind: 'stream',
          name: (content.name as 'stdout' | 'stderr') ?? 'stdout',
          text: String(content.text ?? ''),
        })
        return
      }

      if (msgType === 'error') {
        options.onEvent?.({
          kind: 'error',
          ename: String(content.ename ?? ''),
          evalue: String(content.evalue ?? ''),
          traceback: Array.isArray(content.traceback) ? (content.traceback as string[]) : [],
        })
        return
      }

      if (msgType === 'execute_result' || msgType === 'display_data') {
        options.onEvent?.({
          kind: msgType,
          data: (content.data as Record<string, unknown>) ?? {},
          metadata: (content.metadata as Record<string, unknown>) ?? {},
        })
      }
    }

    ws.onclose = () => {
      if (options.signal?.aborted) resolve()
      else reject(new Error('Kernel websocket closed'))
    }
  })

  try {
    await waitForIdle
  } finally {
    if (timeoutHandle) window.clearTimeout(timeoutHandle)
    abort()
  }
}
