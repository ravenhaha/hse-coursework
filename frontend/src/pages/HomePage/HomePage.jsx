import styles from "./HomePage.module.css";
import Home from "../../components/Home/Home.jsx";

function HomePage() {
    return (
        <div className={styles.page}>
            <Home />
        </div>
    );
}

export default HomePage;