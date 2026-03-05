import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout/MainLayout'
import HomePage from './pages/HomePage/HomePage.jsx'
import WorkspaceLayout from "./layouts/WorkspaceLayout/WorkspaceLayout.jsx";
import WorkspacePage from "./pages/WorkspacePage/WorkspacePage.jsx";
import DevNav from "./components/DevNav/DevNav.jsx";
import AuthPage from './components/Auth/AuthPage.jsx';
import AuthLayout from "./layouts/AuthLayout/AuthLayout.jsx";
import LumosCursor from './components/Effects/LumosCursor/LumosCursor.jsx';
import FloatingParticles from './components/Effects/FloatingParticles/FloatingParticles.jsx';
import SmoothScroll from './components/Effects/SmoothScroll/SmoothScroll.jsx';
import AmbientGradient from './components/Effects/AmbientGradient/AmbientGradient.jsx';

export default function App() {
    return (
        <BrowserRouter>
            <SmoothScroll>
                <AmbientGradient />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <LumosCursor />
                    <FloatingParticles />
                    <DevNav />
                    <Routes>
                        <Route element={<MainLayout />}>
                            <Route path="/" element={<HomePage />} />
                        </Route>
                        <Route element={<WorkspaceLayout />}>
                            <Route path="/workspace" element={<WorkspacePage />} />
                        </Route>
                        <Route element={<AuthLayout />}>
                            <Route path="/auth" element={<AuthPage />} />
                        </Route>
                    </Routes>
                </div>
            </SmoothScroll>
        </BrowserRouter>
    )
}