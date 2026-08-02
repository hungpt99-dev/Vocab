import { useEffect, useState } from 'react';
/** Return `value` only after it has stayed unchanged for `delayMs`. */
export function useDebouncedValue(value, delayMs = 250) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);
    return debounced;
}
