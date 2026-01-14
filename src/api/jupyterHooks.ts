import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  ContentsModel,
  CreateSessionRequest,
  HubUserModel,
  JupyterNotebook,
  KernelModel,
  SessionModel,
} from './jupyterClient'
import {
  createDirectory,
  createEmptyNotebook,
  createKernel,
  createSession,
  deleteContents,
  deleteSession,
  getContents,
  hubGetCurrentUser,
  listSessions,
  putNotebook,
  renameContents,
} from './jupyterClient'

/**
 * TanStack Query wrappers around the Jupyter REST APIs.
 *
 * Note: Kernel execution output is streamed over WebSocket (see jupyterClient.executeCode),
 * so it is not modeled as a query.
 */

export function useHubCurrentUser() {
  return useQuery<HubUserModel>({
    queryKey: ['jupyterhub', 'user'],
    queryFn: () => hubGetCurrentUser(),
  })
}

export function useContents(path?: string, enabled = true) {
  return useQuery<ContentsModel>({
    queryKey: ['jupyter', 'contents', path],
    queryFn: () => getContents(path ?? ''),
    enabled,
  })
}

export function usePutNotebook() {
  return useMutation<ContentsModel, Error, { path: string; notebook: JupyterNotebook }>({
    mutationFn: ({ path, notebook }) => putNotebook(path, notebook),
  })
}

export function useCreateEmptyNotebook() {
  return useMutation<ContentsModel, Error, { path: string }>({
    mutationFn: ({ path }) => createEmptyNotebook(path),
  })
}

export function useCreateDirectory() {
  return useMutation<ContentsModel, Error, { path: string }>({
    mutationFn: ({ path }) => createDirectory(path),
  })
}

export function useRenameContents() {
  return useMutation<ContentsModel, Error, { oldPath: string; newPath: string }>({
    mutationFn: ({ oldPath, newPath }) => renameContents(oldPath, newPath),
  })
}

export function useDeleteContents() {
  return useMutation<void, Error, { path: string }>({
    mutationFn: ({ path }) => deleteContents(path),
  })
}

export function useListSessions(enabled = true) {
  return useQuery<SessionModel[]>({
    queryKey: ['jupyter', 'sessions'],
    queryFn: () => listSessions(),
    enabled,
  })
}

export function useCreateSession() {
  return useMutation<SessionModel, Error, CreateSessionRequest>({
    mutationFn: (req) => createSession(req),
  })
}

export function useDeleteSession() {
  return useMutation<void, Error, { sessionId: string }>({
    mutationFn: ({ sessionId }) => deleteSession(sessionId),
  })
}

export function useCreateKernel() {
  return useMutation<KernelModel, Error, { name?: string }>({
    mutationFn: ({ name }) => createKernel(name ?? 'python3'),
  })
}
