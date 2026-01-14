import NotebookEditor from "./components/NoteBookEditor";
import Sidebar from "./components/Sidebar";

function App() {

  return (
    <>
      <div className = 'flex h-screen bg-white'>
        <Sidebar />
        <main className = "flex-1 overflow-hidden">
          <NotebookEditor />
        </main>
      </div>
    </>)

}

export default App;