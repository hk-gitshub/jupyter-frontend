import { create } from 'zustand'

export type NotebookStoreState = {
  /** Current directory path used for listing (Jupyter Contents API). Empty string means root. */
  currentPath: string
  pathHistory: string[];
  selectedFilePath: string | null

  setCurrentPath: (path: string) => void
  navigateToDirectory: (path: string) => void
  goBack: () => void
  selectFile: (path: string | null) => void
  resetNavigation: () => void

  replacePathPrefix: (oldPrefix: string, newPrefix: string) => void
  handleDeletedPath: (deletedPath: string) => void
}

export const useNoteBookStore = create<NotebookStoreState>((set, get) => ({
  currentPath: '',
  pathHistory: [],
  selectedFilePath: null,

  setCurrentPath: (path) => set({ currentPath: path }),

  navigateToDirectory: (path) => {
    const { currentPath } = get()
    if (path === currentPath) return

    set((state) => ({
      currentPath: path,
      pathHistory: [...state.pathHistory, currentPath],
    }))
  },

  goBack: () => {
    const { pathHistory } = get()
    if (pathHistory.length === 0) return

    const prevPath = pathHistory[pathHistory.length - 1] ?? ''
    set({
      currentPath: prevPath,
      pathHistory: pathHistory.slice(0, -1),
    })
  },

  selectFile: (path) => set({ selectedFilePath: path }),

  resetNavigation: () => set({ currentPath: '', pathHistory: [], selectedFilePath: null }),

  replacePathPrefix: (oldPrefix, newPrefix) => {
    const oldP = (oldPrefix ?? '').replace(/^\//, '').replace(/\/+$/, '')
    const newP = (newPrefix ?? '').replace(/^\//, '').replace(/\/+$/, '')
    if (!oldP) return

    const mapPath = (p: string) => {
      const s = (p ?? '').replace(/^\//, '')
      if (s === oldP) return newP
      if (s.startsWith(oldP + '/')) return newP + s.slice(oldP.length)
      return s
    }

    set((state) => ({
      currentPath: mapPath(state.currentPath),
      pathHistory: state.pathHistory.map(mapPath),
      selectedFilePath: state.selectedFilePath ? mapPath(state.selectedFilePath) : null,
    }))
  },

  handleDeletedPath: (deletedPath) => {
    const del = (deletedPath ?? '').replace(/^\//, '').replace(/\/+$/, '')
    if (!del) return

    const isUnder = (p: string) => {
      const s = (p ?? '').replace(/^\//, '')
      return s === del || s.startsWith(del + '/')
    }

    const parentDir = (p: string) => {
      const s = (p ?? '').replace(/^\//, '').replace(/\/+$/, '')
      const idx = s.lastIndexOf('/')
      if (idx <= -1) return ''
      return s.slice(0, idx)
    }

    set((state) => ({
      currentPath: isUnder(state.currentPath) ? parentDir(del) : state.currentPath,
      pathHistory: state.pathHistory.filter((p) => !isUnder(p)),
      selectedFilePath: state.selectedFilePath && isUnder(state.selectedFilePath) ? null : state.selectedFilePath,
    }))
  },
}))

export const useNotebookStore = useNoteBookStore
