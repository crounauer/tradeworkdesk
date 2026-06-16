import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
}

interface CustomerAutocompleteProps {
  customers: Customer[];
  selectedId?: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function CustomerAutocomplete({ customers, selectedId, onSelect, className }: CustomerAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() =>
    [...customers].sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      return nameA.localeCompare(nameB);
    }),
    [customers]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase().trim();
    return sorted.filter(c => {
      const full = `${c.first_name} ${c.last_name}`.toLowerCase();
      return full.includes(q) || c.first_name.toLowerCase().startsWith(q) || c.last_name.toLowerCase().startsWith(q);
    });
  }, [sorted, search]);

  const selectedCustomer = customers.find(c => c.id === selectedId);
  const displayValue = selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : "";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={className || "space-y-1.5"} ref={containerRef}>
      <Label>Customer *</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Search customers..."
          value={isOpen ? search : displayValue}
          onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
          onFocus={() => { setIsOpen(true); setSearch(""); }}
          className="w-full"
          autoComplete="off"
        />
        {selectedId && !isOpen && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            onClick={() => { onSelect(""); setSearch(""); inputRef.current?.focus(); }}
          >
            ✕
          </button>
        )}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No customers found</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${c.id === selectedId ? "bg-accent font-medium" : ""}`}
                  onClick={() => {
                    onSelect(c.id);
                    setSearch("");
                    setIsOpen(false);
                  }}
                >
                  {c.first_name} {c.last_name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
