# Design Notes: Interactive Model Analysis Workbench (Frontend)

This document explains the architectural choices in the React frontend (`frontend/jupyter-frontend`). It focuses on three areas:

- Zustand store structure
- WebSocket connection/subscription strategy (Jupyter kernel channels)
- Component breakdown rationale

---

## Zustand Store Structure

**File:** `src/state/notebookStore.ts`

The store is intentionally small and UI-focused: it holds only cross-component UI state that must be shared between the file browser (Sidebar) and the editor (Notebook view).

### State Shape

The store state is:

- `currentPath: string`
  - The *directory* currently being listed via Jupyter Contents API.
  - An empty string represents the root.

- `pathHistory: string[]`
  - A simple stack to support a Back button.
  - Each navigation into a directory pushes the previous `currentPath`.

- `selectedFilePath: string | null`
  - The notebook/file currently selected for viewing/editing.
  - `null` means “nothing selected”.

### Actions

Navigation & selection actions:

- `setCurrentPath(path)`
  - Direct setter (rarely used directly; `navigateToDirectory` is preferred).

- `navigateToDirectory(path)`
  - Pushes current directory into `pathHistory` and updates `currentPath`.

- `goBack()`
  - Pops from `pathHistory` and sets `currentPath` to the previous entry.

- `selectFile(path | null)`
  - Sets the editor selection.

- `resetNavigation()`
  - Clears `currentPath`, `pathHistory`, and `selectedFilePath`.

Rename/delete consistency helpers:

- `replacePathPrefix(oldPrefix, newPrefix)`
  - Used after renaming a file or directory.
  - Updates `currentPath`, every entry in `pathHistory`, and `selectedFilePath` if they match or are children of the renamed prefix.
  - This avoids stale navigation/selection state after a rename.

- `handleDeletedPath(deletedPath)`
  - Used after deleting a file or directory.
  - If the current directory is inside the deleted path, it navigates to the deleted path’s parent.
  - Removes history entries that are under the deleted path.
  - Clears `selectedFilePath` if the selected item was deleted.

---

## WebSocket Strategy (Kernel Execution)

**File:** `src/api/jupyter/kernelWs.ts`

### What the WebSocket Is Used For

Jupyter executes code over **kernel channels** (WebSocket), which is required for real-time output streaming (stdout/stderr, display data, errors, status updates). REST endpoints are used only for:

- Listing/reading/writing notebook contents
- Creating sessions/kernels

### Connection Lifecycle

The current execution strategy is intentionally simple and safe:

- Each `executeCode(kernelId, code, options)` call creates a **new WebSocket** connection to:
  - `/api/kernels/{kernelId}/channels?session_id=...`
- The function:
  - Sends a single `execute_request`
  - Listens for messages whose `parent_header.msg_id` matches the request
  - Streams events to the caller via `options.onEvent`
  - Resolves when the kernel reports `status: idle`
  - Closes the socket in `finally` to prevent leaks

This yields predictable behavior and avoids “dangling subscriptions” during rapid UI changes.

### Subscription Model

Instead of exposing raw WS events, the implementation translates Jupyter message types into a small UI-friendly event union (`ExecuteResultEvent`), including:

- `stream` (stdout/stderr)
- `error`
- `execute_result` / `display_data`
- `status`

The Notebook UI stores streamed outputs per-cell and renders them incrementally.

### Abort/Timeout

`executeCode` supports:

- `AbortSignal` to cancel execution and close the socket
- A timeout (`timeoutMs`, default 60s) to avoid hanging forever if the kernel never returns to idle

### Why Not a Single Long-Lived WebSocket

A long-lived shared connection is possible, but it adds complexity:

- Needs multiplexing across multiple in-flight executions and cells
- Requires explicit subscription management, reconnection, and backpressure handling
- Increases the risk of state leaks when switching notebooks or kernels

Given the current app scope (interactive single-user notebook runs), a per-execution connection is a good tradeoff: simple, robust, and easy to reason about.

---

## Component Breakdown

### `Sidebar`

**File:** `src/components/Sidebar.tsx`

Responsibilities:

- Displays current directory contents from the Jupyter Contents API
- Navigation (enter directory, back)
- Selection (`selectedFilePath`)
- File operations: create notebook/folder, rename, delete

Design rationale:

- Keeping filesystem operations in one place reduces accidental duplication of path logic.
- Sidebar is stateful for UI-only concerns (hover states, prompts), while data is fetched via React Query.

### `NotebookEditor`

**File:** `src/components/NoteBookEditor.tsx`

Responsibilities:

- Loads the selected notebook via `useContents(selectedFilePath)`
- Renders and edits cells locally
- Runs a cell by creating a session (REST) and executing code (WebSocket)
- Tracks per-cell outputs and “running” state
- Saves notebook back via `usePutNotebook`

Design rationale:

- Notebook editing requires local, rapid UI updates; it is intentionally kept in component state (`cells`, `cellOutputs`) rather than global state.
- The editor depends only on the store’s `selectedFilePath`, keeping coupling minimal.
- Drag/drop + virtualization are implemented inside the editor because they are tightly coupled to the cell list and its rendering performance.

### API Layer + Hooks

- `src/api/jupyter/*` contains the low-level HTTP and WS clients.
- `src/api/jupyterHooks.ts` wraps REST calls using TanStack React Query.

Design rationale:

- Keeping HTTP/WS logic out of components makes UI code easier to maintain and test.
- React Query provides caching and deduplication automatically (e.g., `useContents` calls shared across components).

---

## Key Tradeoffs

- **Global state vs server cache:** Zustand holds only UI navigation/selection; React Query owns server data.
- **WS simplicity vs efficiency:** per-execution sockets are simpler than a shared socket; acceptable for current scope.
- **Editor-local state:** keeps typing/dragging snappy and avoids global re-renders.
