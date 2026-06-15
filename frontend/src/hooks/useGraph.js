import { useContext } from 'react';
import { GraphContext } from '../context/GraphContextValue';

export default function useGraph() {
    const ctx = useContext(GraphContext);
    if (!ctx) throw new Error('useGraph must be used inside GraphProvider');
    return ctx;
}
