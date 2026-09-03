import { supabaseAdmin } from "./supabase";

export interface InvoicePaymentRecord {
  id: string;
  invoice_id: string;
  tenant_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  payment_reference: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InvoicePaymentSummary {
  payments: InvoicePaymentRecord[];
  totalPaid: number;
  balanceDue: number;
  latestPayment: InvoicePaymentRecord | null;
}

export async function loadInvoicePayments(invoiceId: string, tenantId: string, invoiceTotal: number): Promise<InvoicePaymentSummary> {
  const { data, error } = await supabaseAdmin
    .from("invoice_payments")
    .select("id, invoice_id, tenant_id, amount, payment_date, payment_method, payment_reference, created_by, created_at")
    .eq("invoice_id", invoiceId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const payments = (data || []) as InvoicePaymentRecord[];
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;

  return {
    payments,
    totalPaid: Math.round(totalPaid * 100) / 100,
    balanceDue: Math.max(0, Math.round((Number(invoiceTotal) - totalPaid) * 100) / 100),
    latestPayment,
  };
}

export async function recordInvoicePayment(opts: {
  invoiceId: string;
  tenantId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  createdBy?: string | null;
}): Promise<{ invoice: Record<string, unknown>; payment: InvoicePaymentRecord; summary: InvoicePaymentSummary }> {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const { data: invoice, error: invoiceErr } = await supabaseAdmin
    .from("invoices")
    .select("id, tenant_id, type, status, total, paid_amount")
    .eq("id", opts.invoiceId)
    .eq("tenant_id", opts.tenantId)
    .maybeSingle();

  if (invoiceErr) throw new Error(invoiceErr.message);
  if (!invoice) throw new Error("Invoice not found");
  if ((invoice as { type?: string }).type !== "invoice") throw new Error("Payments can only be recorded against invoices");
  if (["cancelled", "declined", "converted"].includes(String((invoice as { status?: string }).status || ""))) {
    throw new Error("Cannot record a payment against a cancelled, declined, or converted invoice");
  }

  const currentPaid = Math.round(Number((invoice as { paid_amount?: number | null }).paid_amount ?? 0) * 100) / 100;
  const invoiceTotal = Math.round(Number((invoice as { total?: number | null }).total ?? 0) * 100) / 100;
  const remainingBefore = Math.max(0, Math.round((invoiceTotal - currentPaid) * 100) / 100);
  if (amount - remainingBefore > 0.01) {
    throw new Error("Payment amount cannot exceed the remaining balance");
  }

  const { data: payment, error: paymentErr } = await supabaseAdmin
    .from("invoice_payments")
    .insert({
      invoice_id: opts.invoiceId,
      tenant_id: opts.tenantId,
      amount,
      payment_date: opts.paymentDate,
      payment_method: opts.paymentMethod || null,
      payment_reference: opts.paymentReference || null,
      created_by: opts.createdBy || null,
    })
    .select("id, invoice_id, tenant_id, amount, payment_date, payment_method, payment_reference, created_by, created_at")
    .single();

  if (paymentErr || !payment) {
    throw new Error(paymentErr?.message || "Failed to record payment");
  }

  try {
    const summary = await loadInvoicePayments(opts.invoiceId, opts.tenantId, invoiceTotal);
    const balanceDue = Math.max(0, Math.round((invoiceTotal - summary.totalPaid) * 100) / 100);
    const nextStatus = balanceDue <= 0 ? "paid" : String((invoice as { status?: string }).status || "draft");
    const latestPayment = summary.latestPayment;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("invoices")
      .update({
        paid_amount: summary.totalPaid,
        payment_date: latestPayment?.payment_date || opts.paymentDate,
        payment_method: latestPayment?.payment_method || opts.paymentMethod || null,
        payment_reference: latestPayment?.payment_reference || opts.paymentReference || null,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.invoiceId)
      .eq("tenant_id", opts.tenantId)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(updateErr?.message || "Failed to update invoice payment summary");
    }

    return {
      invoice: updated,
      payment: payment as InvoicePaymentRecord,
      summary: {
        ...summary,
        balanceDue,
      },
    };
  } catch (error) {
    await supabaseAdmin.from("invoice_payments").delete().eq("id", (payment as InvoicePaymentRecord).id).eq("tenant_id", opts.tenantId);
    throw error;
  }
}

async function updateInvoicePaymentSummary(invoiceId: string, tenantId: string): Promise<Record<string, unknown>> {
  const { data: invoice, error: invoiceErr } = await supabaseAdmin
    .from("invoices")
    .select("id, tenant_id, type, status, total, issue_date, due_date")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (invoiceErr) throw new Error(invoiceErr.message);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.type !== "invoice") throw new Error("Payments can only be changed against invoices");

  const summary = await loadInvoicePayments(invoiceId, tenantId, Number(invoice.total ?? 0));
  const latestPayment = summary.latestPayment;
  const wasPaid = invoice.status === "paid";
  const nextStatus = summary.balanceDue <= 0
    ? "paid"
    : wasPaid
      ? (invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10) ? "overdue" : "sent")
      : invoice.status;

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("invoices")
    .update({
      paid_amount: summary.totalPaid,
      payment_date: latestPayment?.payment_date || null,
      payment_method: latestPayment?.payment_method || null,
      payment_reference: latestPayment?.payment_reference || null,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (updateErr || !updated) throw new Error(updateErr?.message || "Failed to update invoice payment summary");
  return updated;
}

export async function amendInvoicePayment(opts: {
  invoiceId: string;
  paymentId: string;
  tenantId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
}): Promise<Record<string, unknown>> {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than zero");

  const { data: invoice, error: invoiceErr } = await supabaseAdmin
    .from("invoices")
    .select("id, total")
    .eq("id", opts.invoiceId)
    .eq("tenant_id", opts.tenantId)
    .maybeSingle();
  if (invoiceErr) throw new Error(invoiceErr.message);
  if (!invoice) throw new Error("Invoice not found");

  const summary = await loadInvoicePayments(opts.invoiceId, opts.tenantId, Number(invoice.total ?? 0));
  const existing = summary.payments.find((payment) => payment.id === opts.paymentId);
  if (!existing) throw new Error("Payment not found");
  if (summary.totalPaid - Number(existing.amount) + amount - Number(invoice.total) > 0.01) {
    throw new Error("Payment amount cannot exceed the remaining balance");
  }

  const { error: paymentErr } = await supabaseAdmin
    .from("invoice_payments")
    .update({
      amount,
      payment_date: opts.paymentDate,
      payment_method: opts.paymentMethod || null,
      payment_reference: opts.paymentReference || null,
    })
    .eq("id", opts.paymentId)
    .eq("invoice_id", opts.invoiceId)
    .eq("tenant_id", opts.tenantId);
  if (paymentErr) throw new Error(paymentErr.message);

  return updateInvoicePaymentSummary(opts.invoiceId, opts.tenantId);
}

export async function deleteInvoicePayment(opts: {
  invoiceId: string;
  paymentId: string;
  tenantId: string;
}): Promise<Record<string, unknown>> {
  const { data: payment, error: paymentErr } = await supabaseAdmin
    .from("invoice_payments")
    .delete()
    .eq("id", opts.paymentId)
    .eq("invoice_id", opts.invoiceId)
    .eq("tenant_id", opts.tenantId)
    .select("id")
    .maybeSingle();
  if (paymentErr) throw new Error(paymentErr.message);
  if (!payment) throw new Error("Payment not found");

  return updateInvoicePaymentSummary(opts.invoiceId, opts.tenantId);
}