import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────

export type InvoiceType = "invoice" | "quote";
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled"
  | "accepted"
  | "declined"
  | "converted";

export interface InvoiceLineItem {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
  item_type?: string;
  sort_order?: number;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  job_id: string;
  customer_id: string;
  type: InvoiceType;
  status: InvoiceStatus;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  expiry_date: string | null;
  currency: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  works_order: string | null;
  notes: string | null;
  customer_notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  converted_to_invoice_id: string | null;
  paid_amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  pdf_storage_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations (present on detail endpoint)
  line_items?: InvoiceLineItem[];
  customer?: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    mobile?: string | null;
    address_line1?: string | null;
    city?: string | null;
    postcode?: string | null;
  } | null;
  job?: {
    description: string | null;
    scheduled_date: string | null;
    job_type?: string | null;
    property_id?: string | null;
  } | null;
  // From list endpoint (nested relations)
  customers?: { first_name: string; last_name: string } | null;
  jobs?: { description: string | null; scheduled_date: string | null } | null;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface InvoiceFilters {
  type?: InvoiceType;
  status?: InvoiceStatus;
  statuses?: InvoiceStatus[];
  job_id?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface CreateInvoiceInput {
  job_id: string;
  type?: InvoiceType;
  line_items?: InvoiceLineItem[];
  issue_date?: string;
  due_date?: string;
  expiry_date?: string;
  notes?: string;
  customer_notes?: string;
  vat_rate?: number;
}

export interface UpdateInvoiceInput {
  line_items?: InvoiceLineItem[];
  works_order?: string;
  notes?: string;
  customer_notes?: string;
  issue_date?: string;
  due_date?: string;
  expiry_date?: string;
  vat_rate?: number;
}

export interface MarkPaidInput {
  paid_amount?: number;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────

export const invoiceKeys = {
  all: ["/api/invoices"] as const,
  list: (filters?: InvoiceFilters) => [...invoiceKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...invoiceKeys.all, "detail", id] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildInvoiceUrl(filters: InvoiceFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.statuses && filters.statuses.length > 0) {
    params.set("statuses", filters.statuses.join(","));
  } else if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.job_id) params.set("job_id", filters.job_id);
  if (filters.customer_id) params.set("customer_id", filters.customer_id);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return `/api/invoices${qs ? `?${qs}` : ""}`;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Hooks ───────────────────────────────────────────────────────────────

export function useListInvoices(filters: InvoiceFilters = {}) {
  return useQuery<InvoiceListResponse>({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => apiFetch<InvoiceListResponse>(buildInvoiceUrl(filters)),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useGetInvoice(id: string) {
  return useQuery<Invoice>({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => apiFetch<Invoice>(`/api/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, CreateInvoiceInput>({
    mutationFn: (input) =>
      apiFetch<Invoice>("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, UpdateInvoiceInput>({
    mutationFn: (input) =>
      apiFetch<Invoice>(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiFetch<void>(`/api/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useSendInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation<Invoice & { sent_to: string }, Error, { override_email?: string }>({
    mutationFn: (input) =>
      apiFetch(`/api/invoices/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useMarkInvoicePaid(id: string) {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, MarkPaidInput>({
    mutationFn: (input) =>
      apiFetch<Invoice>(`/api/invoices/${id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useAcceptQuote(id: string) {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, void>({
    mutationFn: () =>
      apiFetch<Invoice>(`/api/invoices/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useDeclineQuote(id: string) {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, void>({
    mutationFn: () =>
      apiFetch<Invoice>(`/api/invoices/${id}/decline`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useConvertToInvoice(quoteId: string) {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, void>({
    mutationFn: () =>
      apiFetch<Invoice>(`/api/invoices/${quoteId}/convert`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useMarkInvoiceSent(id: string) {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, void>({
    mutationFn: () =>
      apiFetch<Invoice>(`/api/invoices/${id}/mark-sent`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useUnsendInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, void>({
    mutationFn: () =>
      apiFetch<Invoice>(`/api/invoices/${id}/unsend`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}
