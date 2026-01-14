

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { FiMove, FiPlay, FiPlus, FiSave, FiTrash2 } from 'react-icons/fi'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useContents, useCreateSession, usePutNotebook } from '../api/jupyterHooks'
import { executeCode } from '../api/jupyterClient'
import type { ContentsModel, ExecuteResultEvent, JupyterNotebook, SessionModel } from '../api/jupyter/types'
import { useNoteBookStore } from '../state/notebookStore'

type SortableCellProps = {
    cellId: string
    measureRef?: (node: HTMLElement | null) => void
    children: (opts: {
        setActivatorNodeRef: (node: HTMLElement | null) => void
        attributes: Record<string, unknown>
        listeners: Record<string, unknown>
        isDragging: boolean
    }) => ReactNode
}

function SortableCell({ cellId, measureRef, children }: SortableCellProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: cellId,
    })

    const setRefs = useCallback(
        (node: HTMLElement | null) => {
            setNodeRef(node)
            measureRef?.(node)
        },
        [setNodeRef, measureRef]
    )

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    }

    return (
        <div ref={setRefs} style={style}>
            {children({
                setActivatorNodeRef,
                attributes: attributes as unknown as Record<string, unknown>,
                listeners: listeners as unknown as Record<string, unknown>,
                isDragging,
            })}
        </div>
    )
}

type UiCell = {
    id: string
    cell_type: 'code' | 'markdown' | 'raw'
    source: string
    execution_count: number | null
}

type UiOutput =
    | { kind: 'stream'; name: 'stdout' | 'stderr'; text: string }
    | { kind: 'error'; ename: string; evalue: string; traceback: string[] }
    | { kind: 'display'; text: string }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function normalizeSource(source: unknown): string {
    if (Array.isArray(source)) return source.map((s) => String(s ?? '')).join('')
    if (typeof source === 'string') return source
    return ''
}

function toLines(source: string): string[] {
    // Jupyter expects `source` to be an array of strings (typically lines).
    // Keep it simple and preserve newlines.
    const parts = source.split('\n')
    return parts.map((line, idx) => (idx < parts.length - 1 ? `${line}\n` : line))
}

function parseNotebookCells(contents: ContentsModel | undefined): UiCell[] {
    const notebook = contents?.content
    if (!isRecord(notebook)) return []
    const rawCells = notebook.cells
    if (!Array.isArray(rawCells)) return []

    const parsed = rawCells.map((c): UiCell | null => {
        if (!isRecord(c)) return null
        const cellType = String(c.cell_type ?? 'code') as UiCell['cell_type']
        const id = String((c.id as string | undefined) ?? crypto.randomUUID())
        const source = normalizeSource(c.source)
        const execution_count = (c.execution_count as number | null | undefined) ?? null
        return { id, cell_type: cellType, source, execution_count }
    })

    return parsed.filter((x): x is UiCell => x !== null)
}

function renderEventToOutput(ev: ExecuteResultEvent): UiOutput | null {
    if (ev.kind === 'stream') return { kind: 'stream', name: ev.name, text: ev.text }
    if (ev.kind === 'error') return { kind: 'error', ename: ev.ename, evalue: ev.evalue, traceback: ev.traceback }

    if (ev.kind === 'execute_result' || ev.kind === 'display_data') {
        const textPlain = ev.data?.['text/plain']
        if (typeof textPlain === 'string') return { kind: 'display', text: textPlain }
        // Fallback: stringify the data
        return { kind: 'display', text: JSON.stringify(ev.data, null, 2) }
    }

    return null
}

const NotebookEditor = () => {
    const selectedFilePath = useNoteBookStore((s) => s.selectedFilePath)

    const contentsQuery = useContents(selectedFilePath ?? '', !!selectedFilePath)
    const createSession = useCreateSession()
    const putNotebook = usePutNotebook()

    const [session, setSession] = useState<SessionModel | null>(null)
    const [cells, setCells] = useState<UiCell[]>([])
    const [runningCellId, setRunningCellId] = useState<string | null>(null)
    const [cellOutputs, setCellOutputs] = useState<Record<string, UiOutput[]>>({})

    const notebookName = contentsQuery.data?.name ?? ''

    // Load notebook cells whenever a notebook is opened/refetched.
    useEffect(() => {
        if (!selectedFilePath) {
            setSession(null)
            setCells([])
            setCellOutputs({})
            setRunningCellId(null)
            return
        }

        if (contentsQuery.data?.type === 'notebook') {
            setCells(parseNotebookCells(contentsQuery.data))
            setCellOutputs({})
            setRunningCellId(null)
            setSession(null)
        }
    }, [selectedFilePath, contentsQuery.data])

    const canRun = useMemo(() => {
        return !!selectedFilePath && contentsQuery.data?.type === 'notebook'
    }, [selectedFilePath, contentsQuery.data?.type])

    // NOTE: Hooks below must stay above any early returns.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const cellIds = useMemo(() => cells.map((c) => c.id), [cells])

    const scrollRef = useRef<HTMLDivElement | null>(null)

    const rowVirtualizer = useVirtualizer({
        count: cells.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 200,
        overscan: 8,
    })

    const virtualItems = rowVirtualizer.getVirtualItems()

    const handleDragEnd = useCallback(
        (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
            const { active, over } = event
            if (!over) return

            const activeId = String(active.id)
            const overId = String(over.id)
            if (activeId === overId) return

            setCells((prev) => {
                const oldIndex = prev.findIndex((c) => c.id === activeId)
                const newIndex = prev.findIndex((c) => c.id === overId)
                if (oldIndex < 0 || newIndex < 0) return prev
                return arrayMove(prev, oldIndex, newIndex)
            })
        },
        []
    )

    const ensureKernelId = async (): Promise<string> => {
        if (!selectedFilePath) throw new Error('No notebook selected')
        if (session?.kernel?.id) return session.kernel.id

        const s = await createSession.mutateAsync({
            path: selectedFilePath,
            type: 'notebook',
            kernel: { name: 'python3' },
            name: notebookName || undefined,
        })
        setSession(s)
        return s.kernel.id
    }

    const runCell = async (cellId: string) => {
        if (!canRun) return
        const cell = cells.find((c) => c.id === cellId)
        if (!cell || cell.cell_type !== 'code') return

        setRunningCellId(cellId)
        setCellOutputs((prev) => ({ ...prev, [cellId]: [] }))

        try {
            const kernelId = await ensureKernelId()
            await executeCode(kernelId, cell.source, {
                onEvent: (ev) => {
                    const out = renderEventToOutput(ev)
                    if (!out) return
                    setCellOutputs((prev) => ({
                        ...prev,
                        [cellId]: [...(prev[cellId] ?? []), out],
                    }))
                },
            })
        } catch (e) {
            setCellOutputs((prev) => ({
                ...prev,
                [cellId]: [
                    ...(prev[cellId] ?? []),
                    {
                        kind: 'error',
                        ename: 'Error',
                        evalue: e instanceof Error ? e.message : String(e),
                        traceback: [],
                    },
                ],
            }))
        } finally {
            setRunningCellId(null)
        }
    }

    const addCodeCell = () => {
        setCells((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                cell_type: 'code',
                source: '',
                execution_count: null,
            },
        ])
    }

    const onChangeSource = useCallback((cellId: string, value: string) => {
        setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, source: value } : c)))
    }, [])

    const deleteCell = (cellId: string) => {
        setCells((prev) => prev.filter((c) => c.id !== cellId))
        setCellOutputs((prev) => {
            const next = { ...prev }
            delete next[cellId]
            return next
        })
    }

    const saveNotebook = async () => {
        if (!selectedFilePath) return
        if (contentsQuery.data?.type !== 'notebook') return

        const notebook: JupyterNotebook = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: isRecord(contentsQuery.data.content) && isRecord(contentsQuery.data.content.metadata)
                ? (contentsQuery.data.content.metadata as Record<string, unknown>)
                : {},
            cells: cells.map((c) => ({
                cell_type: c.cell_type,
                metadata: {},
                source: toLines(c.source),
                execution_count: c.execution_count ?? null,
                outputs: [],
            })),
        }

        await putNotebook.mutateAsync({ path: selectedFilePath, notebook })
        await contentsQuery.refetch()
    }

    if (!selectedFilePath) {
        return (
            <div className="h-full w-full bg-white">
                <div className="p-6 text-sm text-gray-600">Select a notebook from the sidebar.</div>
            </div>
        )
    }

    if (contentsQuery.isLoading) {
        return <div className="h-full w-full bg-white p-6 text-sm text-gray-600">Loading…</div>
    }

    if (contentsQuery.isError) {
        return <div className="h-full w-full bg-white p-6 text-sm text-red-600">Failed to load notebook.</div>
    }

    if (contentsQuery.data?.type !== 'notebook') {
        return <div className="h-full w-full bg-white p-6 text-sm text-gray-600">Not a notebook.</div>
    }

    return (
        <div className="h-full w-full bg-white flex flex-col">
            <div className="shrink-0 bg-white border-b border-gray-200">
                <div className="px-4 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-900">{notebookName}</div>
                        <div className="text-xs text-gray-500 truncate">{selectedFilePath}</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={addCodeCell}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                        >
                            <FiPlus />
                            Code Cell
                        </button>
                        <button
                            type="button"
                            onClick={saveNotebook}
                            disabled={putNotebook.isPending}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors"
                        >
                            <FiSave />
                            {putNotebook.isPending ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            {/* cells */}
            <div ref={scrollRef} className="flex-1 overflow-auto">
                <div className="px-4 py-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={cellIds} strategy={verticalListSortingStrategy}>
                            <div className="" >
                                {virtualItems.map((v) => {
                                    const cell = cells[v.index]
                                    if (!cell) return null

                                    const outputs = cellOutputs[cell.id] ?? []
                                    const isRunning = runningCellId === cell.id

                                    return (
                                        <div
                                            key={cell.id}
                                            // className="absolute left-0 top-0 w-full"
                                            // style={{ transform: `translateY(${v.start}px)` }}
                                        >
                                            <SortableCell cellId={cell.id} measureRef={rowVirtualizer.measureElement}>
                                                {({ setActivatorNodeRef, attributes, listeners }) => (
                                                    <div className="border border-gray-200 rounded-lg bg-white">
                                                        <div className="flex items-stretch">
                                                            {/* Left gutter */}
                                                            <div className="w-14 shrink-0 border-r border-gray-100 bg-gray-50 text-[11px] text-gray-500 flex flex-col items-center py-2">
                                                                <div className="font-mono">{cell.execution_count ?? ''}</div>
                                                                <div className="mt-1">[{v.index + 1}] </div>
                                                                <button
                                                                    type="button"
                                                                    ref={setActivatorNodeRef}
                                                                    className="inline-flex items-center justify-center mt-1 h-7 w-7 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-300"
                                                                    title="Drag to reorder"
                                                                    {...(attributes as unknown as HTMLAttributes<HTMLElement>)}
                                                                    {...(listeners as unknown as HTMLAttributes<HTMLElement>)}
                                                                >
                                                                    <FiMove />
                                                                </button>
                                                            </div>

                                                            {/* main */}
                                                            <div className="flex-1">
                                                                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                                                            {cell.cell_type}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => runCell(cell.id)}
                                                                            disabled={!canRun || cell.cell_type !== 'code' || isRunning || runningCellId !== null}
                                                                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                            title="Run cell"
                                                                        >
                                                                            <FiPlay />
                                                                            {isRunning ? 'Running…' : 'Run'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => deleteCell(cell.id)}
                                                                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                                                                            title="Delete cell"
                                                                        >
                                                                            <FiTrash2 />
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <div className="p-3">
                                                                    <textarea
                                                                        value={cell.source}
                                                                        onChange={(e) => onChangeSource(cell.id, e.target.value)}
                                                                        spellCheck={false}
                                                                        className="w-full field-sizing-content min-h-[3lh] font-mono text-sm leading-5 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 p-2"
                                                                        placeholder={cell.cell_type === 'code' ? 'Write Python code…' : 'Write cell content…'}
                                                                    />
                                                                </div>

                                                                {/* outputs */}
                                                                {outputs.length > 0 && (
                                                                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                                                                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                                                            Output
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {outputs.map((o, i) => {
                                                                                if (o.kind === 'stream') {
                                                                                    return (
                                                                                        <pre key={i} className="whitespace-pre-wrap font-mono text-xs text-gray-800">
                                                                                            {o.text}
                                                                                        </pre>
                                                                                    )
                                                                                }
                                                                                if (o.kind === 'display') {
                                                                                    return (
                                                                                        <pre key={i} className="whitespace-pre-wrap font-mono text-xs text-gray-800">
                                                                                            {o.text}
                                                                                        </pre>
                                                                                    )
                                                                                }
                                                                                return (
                                                                                    <div key={i} className="rounded-md border border-red-200 bg-red-50 p-2">
                                                                                        <div className="text-xs font-semibold text-red-700">
                                                                                            {o.ename}: {o.evalue}
                                                                                        </div>
                                                                                        {o.traceback.length > 0 && (
                                                                                            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-red-800">
                                                                                                {o.traceback.join('\n')}
                                                                                            </pre>
                                                                                        )}
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </SortableCell>

                                            <div className="h-4" />
                                        </div>
                                    )
                                })}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    )
}

export default NotebookEditor