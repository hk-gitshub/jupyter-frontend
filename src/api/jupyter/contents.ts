import { restAPI } from './http'
import type { ContentsModel, JupyterNotebook } from './types'

// get content list
export async function getContents(path: string): Promise<ContentsModel> {
  const safe = path.replace(/^\//, '')
  const res = await restAPI.get<ContentsModel>(`/api/contents/${encodeURIComponent(safe)}`)
  return res.data
}

// 
export async function putNotebook(path: string, notebook: JupyterNotebook): Promise<ContentsModel> {
  const safe = path.replace(/^\//, '')
  const res = await restAPI.put<ContentsModel>(
    `/api/contents/${encodeURIComponent(safe)}`,
    {
      type: 'notebook',
      format: 'json',
      content: notebook,
    },
  )
  return res.data
}

export async function createEmptyNotebook(path: string): Promise<ContentsModel> {
  const empty: JupyterNotebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: [],
  }
  return putNotebook(path, empty)
}

export async function createDirectory(path: string): Promise<ContentsModel> {
  const safe = path.replace(/^\//, '')
  const res = await restAPI.put<ContentsModel>(
    `/api/contents/${encodeURIComponent(safe)}`,
    {
      type: 'directory',
    },
  )
  return res.data
}

export async function renameContents(oldPath: string, newPath: string): Promise<ContentsModel> {
  const oldSafe = oldPath.replace(/^\//, '')
  const newSafe = newPath.replace(/^\//, '')
  const res = await restAPI.patch<ContentsModel>(
    `/api/contents/${encodeURIComponent(oldSafe)}`,
    {
      path: newSafe,
    },
  )
  return res.data
}

export async function deleteContents(path: string): Promise<void> {
  const safe = path.replace(/^\//, '')
  await restAPI.delete(`/api/contents/${encodeURIComponent(safe)}`)
}
