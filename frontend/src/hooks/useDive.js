import { useContext } from 'react';
import { DiveContext } from '../context/DiveContext';

export default function useDive() {
    return useContext(DiveContext);
}