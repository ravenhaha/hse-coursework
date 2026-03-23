import { Link } from "react-router-dom";

function DevNav() {
    return (
        <div style={{ padding: 20, display: "flex", gap: 10 }}>
            <Link to="/">Home</Link>
            <Link to="/workspace">Workspace</Link>
            <Link to="/auth">Auth</Link>
        </div>
    );
}

export default DevNav;