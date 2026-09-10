import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface Expense {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  vat_reclaimable: boolean;
  vat_amount: number | null;
  notes: string | null;
  source: "manual" | "import";
  receipt_file_id: string | null;
  creator?: { full_name: string | null } | null;
  created_at: string;
}

export interface ExpensesResponse {
  items: Expense[];
  pagination: { page: number; limit: number; total: number };
  totals: { amount: number; vat_amount: number };
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  category?: string;
  q?: string;
  page?: number;
}

const expensesKeys = {
  all: ["expenses"] as const,
  list: (filters: ExpenseFilters) => ["expenses", "list", filters] as const,
};

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  return customFetch(url, opts) as Promise<T>;
}

function buildQuery(filters: ExpenseFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);
  if (filters.page) params.set("page", String(filters.page));
  return params.toString();
}

export function useListExpenses(filters: ExpenseFilters) {
  return useQuery<ExpensesResponse>({
    queryKey: expensesKeys.list(filters),
    queryFn: () => apiFetch(`${import.meta.env.BASE_URL}api/expenses?${buildQuery(filters)}`),
  });
}

export function useExpenseCategories() {
  return useQuery<{ categories: string[] }>({
    queryKey: ["expenses", "categories"],
    queryFn: () => apiFetch(`${import.meta.env.BASE_URL}api/expenses/categories`),
    staleTime: 60 * 60_000,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation<Expense, Error, Partial<Expense>>({
    mutationFn: (input) => apiFetch(`${import.meta.env.BASE_URL}api/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKeys.all }),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation<Expense, Error, { id: string; patch: Partial<Expense> }>({
    mutationFn: ({ id, patch }) => apiFetch(`${import.meta.env.BASE_URL}api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKeys.all }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiFetch(`${import.meta.env.BASE_URL}api/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKeys.all }),
  });
}

export interface ImportExpensesResult {
  imported: number;
  skipped_duplicates: number;
  skipped_credits: number;
  skipped_unparseable: number;
}

export function useImportExpensesCsv() {
  const qc = useQueryClient();
  return useMutation<ImportExpensesResult, Error, File>({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch(`${import.meta.env.BASE_URL}api/expenses/import`, { method: "POST", body: formData });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKeys.all }),
  });
}
