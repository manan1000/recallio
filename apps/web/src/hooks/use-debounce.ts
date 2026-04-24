import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // set a timer to update the debounced value after the delay
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // if value changes before the delay is up, cancel the previous timer
        // and start a new one — this is what "debouncing" actually means
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}