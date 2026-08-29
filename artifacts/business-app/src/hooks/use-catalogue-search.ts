import { useCallback, useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react";

export type CatalogueItemType = "product" | "service";

export interface CatalogueItem {
  id: string;
  name: string;
  default_price: number | null;
  type: CatalogueItemType;
}

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Debounced, race-safe catalogue typeahead shared by the job, quote and invoice pages.
 * `key` identifies which input the current suggestions belong to.
 */
export function useCatalogueSearch() {
  const [suggestions, setSuggestions] = useState<CatalogueItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const clear = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (abortRef.current) abortRef.current.abort();
    seqRef.current++;
    setSuggestions([]);
    setActiveKey(null);
  }, []);

  const search = useCallback((query: string, key: string | number, type: CatalogueItemType) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (!query.trim()) {
      setSuggestions([]);
      setActiveKey(null);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const path = type === "service" ? "api/services/search" : "api/products/search";
      try {
        const data = await customFetch(
          `${import.meta.env.BASE_URL}${path}?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal },
        );
        if (seq !== seqRef.current) return;
        const items = (Array.isArray(data) ? data : [])
          .slice(0, 12)
          .map((i: { id: string; name: string; default_price: number | null }) => ({ ...i, type }));
        setSuggestions(items);
        setActiveKey(key);
      } catch {
        if (seq !== seqRef.current) return;
        setSuggestions([]);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const addToCatalogue = useCallback(
    async (type: CatalogueItemType, name: string, defaultPrice?: number | null) => {
      const endpoint =
        type === "service"
          ? `${import.meta.env.BASE_URL}api/admin/service-catalogue`
          : `${import.meta.env.BASE_URL}api/admin/products`;
      return (await customFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          default_price: defaultPrice != null ? Number(defaultPrice) : undefined,
        }),
      })) as { id: string; name: string; default_price: number | null };
    },
    [],
  );

  return { suggestions, activeKey, setActiveKey, search, clear, addToCatalogue };
}
