export type Json = Record<string, unknown>

export type JupyterHeader = {
  msg_id: string
  username: string
  session: string
  date: string
  msg_type: string
  version: string
}

export type JupyterMessage = {
  header: JupyterHeader
  parent_header: Record<string, unknown>
  metadata: Record<string, unknown>
  content: Record<string, unknown>
  channel?: string
}

export type JupyterNotebook = {
  nbformat: number
  nbformat_minor: number
  metadata: Record<string, unknown>
  cells: Array<{
    cell_type: 'code' | 'markdown' | 'raw'
    metadata: Record<string, unknown>
    source: string[]
    outputs?: unknown[]
    execution_count?: number | null
  }>
}

export type ContentsModel = {
  name: string
  path: string
  type: 'file' | 'directory' | 'notebook'
  writable: boolean
  created?: string
  last_modified?: string
  mimetype?: string | null
  format?: 'text' | 'base64' | 'json' | null
  content?: unknown
}

export type CreateSessionRequest = {
  /** notebook path, e.g. "work/demo.ipynb" */
  path: string
  type?: 'notebook'
  kernel?: { name: string }
  name?: string
}

export type SessionModel = {
  id: string
  path: string
  name?: string
  type: string
  kernel: {
    id: string
    name: string
  }
}

export type KernelModel = {
  id: string
  name: string
  last_activity?: string
  execution_state?: string
  connections?: number
}

export type HubUserModel = {
  name: string
  admin?: boolean
  roles?: string[]
  server?: string | null
  pending?: string | null
}

export type ExecuteResultEvent =
  | {
      kind: 'stream'
      name: 'stdout' | 'stderr'
      text: string
    }
  | {
      kind: 'execute_result' | 'display_data'
      data: Record<string, unknown>
      metadata?: Record<string, unknown>
    }
  | {
      kind: 'error'
      ename: string
      evalue: string
      traceback: string[]
    }
  | {
      kind: 'status'
      execution_state: string
    }

export type ExecuteOptions = {
  onEvent?: (event: ExecuteResultEvent) => void
  signal?: AbortSignal
  timeoutMs?: number
}
