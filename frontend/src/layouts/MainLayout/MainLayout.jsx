import styles from "./MainLayout.module.css";

function MainLayout({ children }) {
import { Outlet } from 'react-router-dom'
import styles from './MainLayout.module.css'
import Footer from "../../components/Home/components/Footer/Footer.jsx";

export default function MainLayout() {
    return (
        <div className={styles.layout}>
            {/* Тут потом будет Header */}
            <main className={styles.main}>
                {children}
            </main>
            {/* Тут потом будет Footer */}
        <div className={styles.container}>
            <Outlet />
            <Footer />
        </div>
    );
    )
}

export default MainLayout;