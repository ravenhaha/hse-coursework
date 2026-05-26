import { Link } from "react-router-dom";
import useGraph from "../../hooks/useGraph";
import { mockGraphData } from "../Workspace/components/Graph/mockGraphData";

function DevNav() {
    const { tree, loadTree, clearTree } = useGraph();

    return (
        <div style={{ padding: 20, display: "flex", gap: 10, alignItems: "center" }}>
            <Link to="/">Home</Link>
            <Link to="/workspace">Workspace</Link>
            <Link to="/auth">Auth</Link>
            <button
                type="button"
                onClick={() => (tree ? clearTree() : loadTree(mockGraphData))}
                style={{
                    marginLeft: 8,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #215676",
                    background: tree ? "#12445f" : "#0c3146",
                    color: "#7cdde3",
                    cursor: "pointer",
                    fontSize: 13,
                }}
            >
                {tree ? "Clear mock" : "Mock graph"}
            </button>
        </div>
    );
}

export default DevNav;
