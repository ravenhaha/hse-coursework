import { useState, useCallback } from 'react';
import { GraphContext } from './GraphContextValue';

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
