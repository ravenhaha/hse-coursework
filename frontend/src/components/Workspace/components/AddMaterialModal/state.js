// ============================================
// Стейт модалки «Добавить материал»
// ============================================

export const initialState = {
    mode: 'upload',
    collection: null,
    error: '',

    // Режим 1: Загрузить файлы
    files: [],

    // Режим 2: Создать заметку
    title: '',
    editorTags: [],
    editorImportant: false,
};

export const ACTIONS = {
    SET_MODE: 'SET_MODE',
    SET_COLLECTION: 'SET_COLLECTION',
    SET_ERROR: 'SET_ERROR',
    CLEAR_ERROR: 'CLEAR_ERROR',
    RESET: 'RESET',

    // Файлы
    ADD_FILES: 'ADD_FILES',
    REMOVE_FILE: 'REMOVE_FILE',
    UPDATE_FILE_TAGS: 'UPDATE_FILE_TAGS',
    TOGGLE_FILE_IMPORTANT: 'TOGGLE_FILE_IMPORTANT',

    // Редактор
    SET_TITLE: 'SET_TITLE',
    SET_EDITOR_TAGS: 'SET_EDITOR_TAGS',
    TOGGLE_EDITOR_IMPORTANT: 'TOGGLE_EDITOR_IMPORTANT',
};

export function wrapFile(file) {
    return {
        id: crypto.randomUUID(),
        file,
        tags: [],
        isImportant: false,
    };
}

export function reducer(state, action) {
    switch (action.type) {

        case ACTIONS.SET_MODE:
            return { ...state, mode: action.payload, error: '' };

        case ACTIONS.SET_COLLECTION:
            return { ...state, collection: action.payload };

        case ACTIONS.SET_ERROR:
            return { ...state, error: action.payload };

        case ACTIONS.CLEAR_ERROR:
            return { ...state, error: '' };

        case ACTIONS.RESET:
            return initialState;

        // ── Режим 1: файлы ──

        case ACTIONS.ADD_FILES: {
            const newFiles = action.payload.map(wrapFile);
            return {
                ...state,
                files: [...state.files, ...newFiles],
                error: '',
            };
        }

        case ACTIONS.REMOVE_FILE:
            return {
                ...state,
                files: state.files.filter(f => f.id !== action.payload),
            };

        case ACTIONS.UPDATE_FILE_TAGS:
            return {
                ...state,
                files: state.files.map(f =>
                    f.id === action.payload.id
                        ? { ...f, tags: action.payload.tags }
                        : f
                ),
            };

        case ACTIONS.TOGGLE_FILE_IMPORTANT:
            return {
                ...state,
                files: state.files.map(f =>
                    f.id === action.payload
                        ? { ...f, isImportant: !f.isImportant }
                        : f
                ),
            };

        // ── Режим 2: редактор ──

        case ACTIONS.SET_TITLE:
            return { ...state, title: action.payload };

        case ACTIONS.SET_EDITOR_TAGS:
            return { ...state, editorTags: action.payload };

        case ACTIONS.TOGGLE_EDITOR_IMPORTANT:
            return { ...state, editorImportant: !state.editorImportant };

        default:
            return state;
    }
}