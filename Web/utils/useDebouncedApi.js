/**
 * useDebouncedApi.js — React hook for debounced + cancellable API calls.
 *
 * Prevents rapid-fire duplicate API calls when users type fast, click
 * repeatedly, or interact with auto-refreshing components. At 50000 users,
 * debouncing reduces backend load by 80-90% for search/filter inputs.
 *
 * Usage:
 *   const { data, loading, error, cancel } = useDebouncedApi(
 *     (signal) => apiClient.get('/api/search', { params: { q }, signal }),
 *     [q],           // re-run when `q` changes
 *     500            // debounce 500ms
 *   );
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function useDebouncedApi(fetchFn, deps = [], debounceMs = 300) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cancel();

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const result = await fetchFn(controller.signal);
        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          setError(err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, cancel };
}

/**
 * usePollingApi — Polls an API endpoint at a fixed interval.
 * Automatically cancels in-flight requests on unmount.
 *
 * Usage:
 *   const { data, loading, error } = usePollingApi(
 *     (signal) => apiClient.get('/api/status', { signal }),
 *     30000  // poll every 30s
 *   );
 */
export function usePollingApi(fetchFn, intervalMs = 30000, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      const controller = new AbortController();
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = controller;

      try {
        const result = await fetchFn(controller.signal);
        if (!controller.signal.aborted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          setError(err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return { data, loading, error };
}

export default useDebouncedApi;
