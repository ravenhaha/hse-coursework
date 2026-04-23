import { createContext, useState, useContext, useCallback } from 'react';

const GraphContext = createContext(null);

export default function GraphProvider({ children }) {
    const [tree, setTree] = useState(null);

    const loadTree = useCallback((data) => setTree(data), []);
    const clearTree = useCallback(() => setTree(null), []);

    return (
        <GraphContext.Provider value={{ tree, loadTree, clearTree }}>
            {children}
        </GraphContext.Provider>
    );
}

export function useGraph() {
    const ctx = useContext(GraphContext);
    if (!ctx) throw new Error('useGraph must be used inside GraphProvider');
    return ctx;
}