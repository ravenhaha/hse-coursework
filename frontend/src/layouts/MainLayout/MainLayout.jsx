import { Outlet } from 'react-router-dom'
import styles from './MainLayout.module.css'
import Footer from "../../components/Home/components/Footer/Footer.jsx";

export default function MainLayout() {
    return (
        <div className={styles.container}>
            <Outlet />
            <Footer />
        </div>
    )
}