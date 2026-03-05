import styles from "./MainLayout.module.css";

function MainLayout({ children }) {
    return (
        <div className={styles.layout}>
            {/* Тут потом будет Header */}
            <main className={styles.main}>
                {children}
            </main>
            {/* Тут потом будет Footer */}
        </div>
    );
}

export default MainLayout;