import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout/MainLayout';
import HomePage from './pages/HomePage/HomePage.jsx';
// import LumosCursor from './components/Effects/LumosCursor/LumosCursor.jsx';
import BlurFade from './components/Effects/BlurFade/BlurFade.jsx';
import DiveProvider from './context/DiveContext';
import GraphProvider from './context/GraphContext';
import useDive from './hooks/useDive';
import DevNav from './components/DevNav/DevNav.jsx';
import GrainOverlay from './components/Effects/GrainOverlay/GrainOverlay.jsx';
import AmbientParticles from './components/Effects/AmbientParticles/AmbientParticles.jsx';
import styles from './App.module.css';

const AuthPage = lazy(() => import('./pages/AuthPage/AuthPage.jsx'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage/WorkspacePage.jsx'));
const WorkspaceLayout = lazy(() => import('./layouts/WorkspaceLayout/WorkspaceLayout.jsx'));
const AuthLayout = lazy(() => import('./layouts/AuthLayout/AuthLayout.jsx'));

function AppContent() {
    const { blurActive } = useDive();
    const location = useLocation();
    const isAuth = location.pathname === '/auth';

    return (
        <div className={styles.root}>
            {!isAuth && <AmbientParticles />}
            <GrainOverlay />
            {/* {isHome && <LumosCursor />} */}
            <BlurFade active={blurActive} />
            <DevNav />
            <Suspense fallback={null}>
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
            </Suspense>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <DiveProvider>
                <GraphProvider>
                    <AppContent />
                </GraphProvider>
            </DiveProvider>
        </BrowserRouter>
    );
}
