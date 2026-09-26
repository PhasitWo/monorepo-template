import { useEffect, useRef, useCallback } from 'react';

// Define a generic type for the callback function
type CallbackFunction<T extends unknown[]> = (...args: T) => void;

interface DebounceOptions {
  delay?: number;
  immediate?: boolean; // New configuration option
}

export function useDebounce<T extends unknown[]>(
  callback: CallbackFunction<T>,
  options: DebounceOptions = {},
): CallbackFunction<T> {
  // Destructure with default values
  const { delay = 500, immediate = false } = options;

  const callbackRef = useRef<CallbackFunction<T>>(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Remember the latest callback if it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Clean up the timer when the component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Return the debounced version of the function
  return useCallback(
    (...args: T) => {
      // Check if there's no active timer (meaning we are not currently cooling down)
      const callNow = immediate && !timerRef.current;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (callNow) {
        // Run immediately on the leading edge
        callbackRef.current(...args);

        // Set a dummy timer just to act as a "lock" or cooldown period.
        // Once the delay passes, we reset the timer to null so the next click can be immediate again.
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
        }, delay);
      } else {
        // Standard trailing edge behavior
        timerRef.current = setTimeout(() => {
          if (!immediate) {
            callbackRef.current(...args);
          }
          timerRef.current = null; // Clear reference when execution finishes
        }, delay);
      }
    },
    [delay, immediate],
  );
}
