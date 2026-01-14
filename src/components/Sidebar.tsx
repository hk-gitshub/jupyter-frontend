
import React, { useEffect, useState } from 'react';
// import { useNotebookStore } from '../store/useNotebookStore';
// import { FileSystemItem } from '../types';
import { useContents, useCreateDirectory, useCreateEmptyNotebook, useDeleteContents, useRenameContents } from "../api/jupyterHooks"
import { FaArrowLeft, FaBrain, FaFile, FaFileCode, FaFileCirclePlus, FaFolder, FaFolderPlus, FaPen, FaTrash } from "react-icons/fa6"

import { useNoteBookStore } from "../state/notebookStore"

import type { ContentsModel } from "../api/jupyter/types"


function isContentsModel(value: unknown): value is ContentsModel {
  return typeof value === 'object' && value !== null
}

function joinJupyterPath(dir: string, name: string): string {
  const left = (dir ?? '').replace(/^\//, '').replace(/\/+$/, '')
  const right = (name ?? '').replace(/^\//, '')
  if (!left) return right
  return `${left}/${right}`
}

function dirnameJupyterPath(path: string): string {
  const safe = (path ?? '').replace(/^\//, '').replace(/\/+$/, '')
  const idx = safe.lastIndexOf('/')
  if (idx <= -1) return ''
  return safe.slice(0, idx)
}

function basenameJupyterPath(path: string): string {
  const safe = (path ?? '').replace(/^\//, '').replace(/\/+$/, '')
  const idx = safe.lastIndexOf('/')
  return idx <= -1 ? safe : safe.slice(idx + 1)
}


const Sidebar: React.FC = () => {
  const [noteBookList, setNoteBookList] = useState<ContentsModel[]>([])

  const currentPath = useNoteBookStore((s) => s.currentPath)
  const pathHistory = useNoteBookStore((s) => s.pathHistory)
  const navigateToDirectory = useNoteBookStore((s) => s.navigateToDirectory)
  const goBack = useNoteBookStore((s) => s.goBack)
  const selectFile = useNoteBookStore((s) => s.selectFile)
  const replacePathPrefix = useNoteBookStore((s) => s.replacePathPrefix)
  const handleDeletedPath = useNoteBookStore((s) => s.handleDeletedPath)

  const contentsQuery = useContents(currentPath)
  const createEmptyNotebook = useCreateEmptyNotebook()
  const createDirectory = useCreateDirectory()
  const renameContents = useRenameContents()
  const deleteContents = useDeleteContents()

  useEffect(() => {
    if (contentsQuery?.data?.type === "directory") {
      const content = (contentsQuery.data as { content?: unknown }).content

      const list = Array.isArray(content) ? content.filter(isContentsModel) : []
      const sorted = [...list].sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1

        const an = a.name ?? ''
        const bn = b.name ?? ''
        return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' })
      })

      setNoteBookList(sorted)
    }
    if (contentsQuery.error) {
      console.error('contents error', contentsQuery.error)
    }
  }, [contentsQuery.data, contentsQuery.error])

  const handleBack = () => {
    goBack()
  }

  const handleNoteBook = (content: ContentsModel) => {
    const nextPath = content.path ?? ''

    if (content.type === 'directory') {
      navigateToDirectory(nextPath)
      return
    }

    selectFile(nextPath)
  }

  const handleCreateNotebook = async () => {
    const raw = window.prompt('Notebook name', 'Untitled.ipynb')
    if (!raw) return
    const name = raw.trim()
    if (!name) return

    const filename = name.toLowerCase().endsWith('.ipynb') ? name : `${name}.ipynb`
    const path = joinJupyterPath(currentPath, filename)

    try {
      await createEmptyNotebook.mutateAsync({ path })
      await contentsQuery.refetch()
      selectFile(path)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  const handleCreateFolder = async () => {
    const raw = window.prompt('Folder name', 'New Folder')
    if (!raw) return
    const name = raw.trim()
    if (!name) return

    const path = joinJupyterPath(currentPath, name)

    try {
      await createDirectory.mutateAsync({ path })
      await contentsQuery.refetch()
      navigateToDirectory(path)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  const handleRename = async (content: ContentsModel) => {
    const oldPath = content.path ?? ''
    if (!oldPath) return

    const oldName = basenameJupyterPath(oldPath)
    const raw = window.prompt('Rename to', oldName)
    if (!raw) return
    const name = raw.trim()
    if (!name) return

    const parent = dirnameJupyterPath(oldPath)
    const newPath = joinJupyterPath(parent, name)

    try {
      await renameContents.mutateAsync({ oldPath, newPath })
      replacePathPrefix(oldPath, newPath)
      await contentsQuery.refetch()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDelete = async (content: ContentsModel) => {
    const path = content.path ?? ''
    if (!path) return

    const ok = window.confirm(`Delete "${content.name}"?`)
    if (!ok) return

    try {
      await deleteContents.mutateAsync({ path })
      handleDeletedPath(path)
      await contentsQuery.refetch()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }


  return (
    <div className="w-72 h-full bg-gray-900 text-gray-300 flex flex-col border-r border-gray-800 select-none">
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        <h1 className="text-white font-bold flex items-center gap-2">
          <FaBrain />
          Workbench
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleCreateNotebook}
            disabled={createEmptyNotebook.isPending}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
            title="New Notebook"
          >
            <FaFileCirclePlus />
          </button>
          <button
            onClick={handleCreateFolder}
            disabled={createDirectory.isPending}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
            title="New Folder"
          >
            <FaFolderPlus />
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3">
          <span>Server Status</span>
          {contentsQuery.isLoading ? (
            <span className="flex items-center gap-1.5 text-yellow-500">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
              Loading
            </span>
          ) : contentsQuery.isError ? (
            <span className="flex items-center gap-1.5 text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Error
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Online
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-600 bg-gray-950/50 p-2 rounded">
          <i className="fa-solid fa-link"></i>
          <span className="truncate">localhost:8000</span>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-auto">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={pathHistory?.length === 0}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-300 border border-gray-800 bg-gray-950/30 hover:bg-gray-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={pathHistory?.length === 0 ? 'No previous folder' : 'Back'}
          >
            <FaArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div
            className="min-w-0 flex-1 truncate text-right text-[11px] text-gray-500"
            title={currentPath || '/'}
          >
            {currentPath || '/'}
          </div>
        </div>
        {
          noteBookList?.map((content, index:number) => (
            <div
              className="group flex items-center gap-2 cursor-pointer rounded-md px-2 py-0.5 mb-1 border border-transparent hover:border-gray-800 hover:bg-gray-800/60 transition-colors"
              role="button"
              key={index}

              onClick={()=>handleNoteBook(content)}
            >
              <span className="flex items-center text-gray-500 group-hover:text-gray-200 transition-colors">
                {
                  content.type === "notebook"
                    ? <FaFileCode className="h-4 w-4"/> 
                    :  content.type === "directory"
                        ? <FaFolder className="h-4 w-4" />
                        : <FaFile className="h-4 w-4" />
                }
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-200">
                {content?.name}
              </span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRename(content) }}
                  disabled={renameContents.isPending}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                  title="Rename"
                >
                  <FaPen className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(content) }}
                  disabled={deleteContents.isPending}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-600/20 text-gray-400 hover:text-red-300"
                  title="Delete"
                >
                  <FaTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
};

export default Sidebar;
