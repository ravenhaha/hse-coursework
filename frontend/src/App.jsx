import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout/MainLayout'
import HomePage from './pages/HomePage/HomePage.jsx'
import WorkspaceLayout from "./layouts/WorkspaceLayout/WorkspaceLayout.jsx";
import WorkspacePage from "./pages/WorkspacePage/WorkspacePage.jsx";
import DevNav from "./components/DevNav/DevNav.jsx";
import AuthPage from './components/Auth/AuthPage.jsx';
import AuthLayout from "./layouts/AuthLayout/AuthLayout.jsx";

export default function App() {
    return (
        <BrowserRouter>
            <DevNav/>
            <Routes>
                <Route element={<MainLayout/>}>
                    <Route path="/" element={<HomePage/>}/>
                </Route>

                <Route element={<WorkspaceLayout/>}>
                    <Route path="/workspace" element={<WorkspacePage/>}/>
                </Route>

                <Route element={<AuthLayout />}>
                    <Route path="/auth" element={<AuthPage/>}/>
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
