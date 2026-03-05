import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout/MainLayout'
import HomePage from './pages/HomePage/HomePage.jsx'
import WorkspaceLayout from "./layouts/WorkspaceLayout/WorkspaceLayout.jsx";
import WorkspacePage from "./pages/WorkspacePage/WorkspacePage.jsx";
import DevNav from "./components/DevNav/DevNav.jsx";

export default function App() {
    return (
        <BrowserRouter>
            <DevNav />
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<HomePage />} />
                </Route>

                <Route element={<WorkspaceLayout />}>
                    <Route path="/workspace" element={<WorkspacePage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App
