import { restAPI } from './http'
import type { CreateSessionRequest, SessionModel } from './types'

export async function listSessions(): Promise<SessionModel[]> {
  const res = await restAPI.get<SessionModel[]>('/api/sessions')
  return res.data
}

export async function createSession(req: CreateSessionRequest): Promise<SessionModel> {
  const res = await restAPI.post<SessionModel>('/api/sessions', {
    path: req.path,
    type: req.type ?? 'notebook',
    kernel: req.kernel ?? { name: 'python3' },
    name: req.name,
  })
  return res.data
}

export async function deleteSession(sessionId: string): Promise<void> {
  await restAPI.delete(`/api/sessions/${encodeURIComponent(sessionId)}`)
}
