import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";

process.env.SUPABASE_URL = "https://invoice-discounts-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "invoice-discounts-test-key";
const { default: router } = await import("./invoices");
const { default: portalRouter } = await import("./portal");

const tenantId = "11111111-1111-4111-8111-111111111111";
const invoiceId = "22222222-2222-4222-8222-222222222222";
const customerId = "33333333-3333-4333-8333-333333333333";
const lineItems = [
  { description: "Service", quantity: 1, unit_price: 100, total: 100, item_type: "service" },
  { description: "To order", quantity: 1, unit_price: 50, total: 0, item_type: "product", status: "to_order" },
];

type Options = {
  method?: "post" | "put" | "get";
  body?: Record<string, unknown>;
  existing?: Record<string, unknown>;
  missing?: boolean;
  lineReadFailure?: boolean;
  draftReadFailure?: boolean;
  job?: Record<string, unknown> | null;
  jobFailure?: boolean;
  linkConflict?: boolean;
  linkFailure?: boolean;
  path?: string;
};

async function request(t: TestContext, options: Options = {}) {
  const writes: Array<{ table: string; method: string; body: Record<string, unknown> }> = [];
  const reads: URL[] = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "invoice-discounts-test.invalid");
    const table = url.pathname.split("/").pop()!;
    const method = init?.method || "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const existing = {
      id: invoiceId, tenant_id: tenantId, customer_id: customerId, type: "invoice",
      invoice_number: "INV-1", issue_date: "2026-10-29", currency: "GBP",
      status: "draft", vat_rate: 20, subtotal: 100, vat_amount: 18, total: 108,
      discount_type: "percentage", discount_value: 10, discount_amount: 10,
      ...options.existing,
    };
    if (method === "GET") reads.push(url);
    else writes.push({ table, method, body });
    let data: unknown;
    if (table === "invoices") {
      if (method === "GET" && !url.searchParams.has("id")) {
        if (options.draftReadFailure) return Response.json({ message: "Failed to read draft" }, { status: 500 });
        data = [{ ...existing, invoice_number: "INV-1", issue_date: "2026-10-29", currency: "GBP" }];
      } else {
        assert.equal(method === "POST" ? body.tenant_id : url.searchParams.get("tenant_id"), method === "POST" ? tenantId : `eq.${tenantId}`);
        if (method === "PATCH" && options.linkFailure) return Response.json({ message: "Failed to link invoice" }, { status: 500 });
        data = options.missing || (method === "PATCH" && options.linkConflict) ? null : { ...existing, ...body };
        if (method === "PATCH" && options.path?.endsWith("/link-job")) {
          assert.equal(url.searchParams.get("job_id"), "is.null");
          assert.equal(url.searchParams.get("customer_id"), `eq.${customerId}`);
          assert.equal(url.searchParams.get("type"), "eq.invoice");
          assert.equal(url.searchParams.get("status"), "in.(draft,sent,overdue,paid)");
          assert.equal(url.searchParams.get("property_id"), options.existing?.property_id ? `eq.${options.existing.property_id}` : "is.null");
          assert.deepEqual(Object.keys(body).sort(), ["job_id", "updated_at"]);
        }
      }
    } else if (table === "invoice_line_items") {
      if (method === "GET") {
        if (!options.path?.endsWith("/pdf")) assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        if (options.lineReadFailure) return Response.json({ message: "Failed to read lines" }, { status: 500 });
      }
      data = method === "GET" ? lineItems : null;
    } else if (table === "customers") data = { id: customerId, first_name: "Test", last_name: "Customer" };
    else if (table === "jobs") {
      if (options.jobFailure) return Response.json({ message: "Failed to load jobs" }, { status: 500 });
      data = options.job === undefined ? {
        id: invoiceId, status: "completed", customer_id: customerId, property_id: "property-1",
        is_active: true, job_ref: "JOB-123", created_at: "2026-10-29T09:00:00Z",
      } : options.job;
      if (options.path?.includes("link")) {
        assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        assert.equal(url.searchParams.get("customer_id"), `eq.${customerId}`);
      }
      if (options.path?.endsWith("/linkable-jobs")) {
        return new Response(JSON.stringify(data ? [data] : []), {
          headers: { "Content-Type": "application/json", "Content-Range": "0-0/21" },
        });
      }
    }
    else if (table === "job_services") data = [{ service_name: "Service", quantity: 1, unit_price: 200 }];
    else if (table === "job_parts" || table === "job_time_entries") data = [];
    else if (table === "company_settings") data = { default_vat_rate: 20, currency: "GBP" };
    else if (table === "next_invoice_number") data = "INV-NEW";
    else assert.fail(`Unexpected table: ${table}`);
    return Response.json(data);
  });
  const method = options.method || "put";
  const routePath = options.path || (method === "post" ? "/invoices" : "/invoices/:id");
  const activeRouter = routePath.startsWith("/portal/") ? portalRouter : router;
  const route = activeRouter.stack.find(layer => layer.route?.path === routePath && layer.route.stack.some(
    (entry: { method?: string }) => entry.method === method,
  ))?.route;
  assert.ok(route);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, customerId, userId: "admin-1", userRole: "admin" });
    next();
  });
  const entry = route.stack.at(-1);
  assert.ok(entry);
  const handler: RequestHandler = entry.handle;
  app[method](routePath, handler);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}${routePath.replace(":id", invoiceId)}${method === "get" && options.body ? `?${new URLSearchParams(Object.entries(options.body).map(([key, value]) => [key, String(value)]))}` : ""}`, {
    method: method.toUpperCase(), headers: { "Content-Type": "application/json" },
    ...(method === "get" ? {} : { body: JSON.stringify(options.body || {}) }),
  });
  return { response, writes, reads };
}

for (const status of ["draft", "sent", "overdue", "paid"]) {
  test(`an existing ${status} invoice can be attached without changing financial data`, async t => {
    const { response, writes } = await request(t, {
      method: "post", path: "/invoices/:id/link-job", existing: { status },
      body: { job_id: invoiceId, total: 0, customer_id: "other-customer" },
    });
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.ok(result && typeof result === "object" && "job_id" in result && "total" in result && "discount_amount" in result && "status" in result);
    assert.equal(result.job_id, invoiceId);
    assert.equal(result.total, 108);
    assert.equal(result.discount_amount, 10);
    assert.equal(result.status, status);
    assert.deepEqual(writes.map(write => [write.table, write.method]), [["invoices", "PATCH"]]);
  });
}

for (const existing of [
  { job_id: "already-linked" }, { type: "quote" }, { status: "cancelled" },
]) {
  test(`invoice job linking rejects incompatible documents: ${JSON.stringify(existing)}`, async t => {
    const { response, writes } = await request(t, {
      method: "post", path: "/invoices/:id/link-job", existing, body: { job_id: invoiceId },
    });
    assert.equal(response.status, 409);
    assert.equal(writes.length, 0);
  });
}

test("invoice job linking rejects invalid identifiers", async t => {
  const { response, writes } = await request(t, {
    method: "post", path: "/invoices/:id/link-job", body: { job_id: "invalid" },
  });
  assert.equal(response.status, 400);
  assert.equal(writes.length, 0);
});

test("invoice job linking rejects jobs outside the invoice's tenant or customer", async t => {
  const { response, writes } = await request(t, {
    method: "post", path: "/invoices/:id/link-job", job: null, body: { job_id: invoiceId },
  });
  assert.equal(response.status, 404);
  assert.equal(writes.length, 0);
});

for (const job of [
  { id: invoiceId, is_active: false }, { id: invoiceId, is_active: true, status: "cancelled" },
  { id: invoiceId, is_active: true, property_id: "another-property" },
]) {
  test(`invoice job linking rejects an ineligible job: ${JSON.stringify(job)}`, async t => {
    const { response, writes } = await request(t, {
      method: "post", path: "/invoices/:id/link-job", body: { job_id: invoiceId }, job,
      existing: { property_id: "property-1" },
    });
    assert.equal(response.status, 400);
    assert.equal(writes.length, 0);
  });
}

test("invoice job linking permits the invoice's selected service address", async t => {
  const { response, writes } = await request(t, {
    method: "post", path: "/invoices/:id/link-job", body: { job_id: invoiceId },
    existing: { property_id: "property-1" },
  });
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
});

test("invoice job linking does not overwrite a concurrent link or service-address change", async t => {
  const { response } = await request(t, {
    method: "post", path: "/invoices/:id/link-job", body: { job_id: invoiceId }, linkConflict: true,
  });
  assert.equal(response.status, 409);
});

for (const options of [{ jobFailure: true }, { linkFailure: true }]) {
  test(`invoice job linking reports database failures: ${JSON.stringify(options)}`, async t => {
    const { response } = await request(t, {
      method: "post", path: "/invoices/:id/link-job", body: { job_id: invoiceId }, ...options,
    });
    assert.equal(response.status, 500);
  });
}

test("linkable jobs are scoped, filtered, searchable and paginated", async t => {
  const { response, reads } = await request(t, {
    method: "get", path: "/invoices/:id/linkable-jobs",
    body: { page: 2, search: 'JOB-123,_%")' }, existing: { property_id: "property-1" },
  });
  assert.equal(response.status, 200, await response.clone().text());
  const jobs = reads.find(url => url.pathname.endsWith("/jobs"));
  assert.ok(jobs);
  assert.equal(jobs.searchParams.get("property_id"), "eq.property-1");
  assert.equal(jobs.searchParams.get("is_active"), "eq.true");
  assert.equal(jobs.searchParams.get("status"), "neq.cancelled");
  assert.equal(jobs.searchParams.get("offset"), "20");
  assert.equal(jobs.searchParams.get("limit"), "20");
  const pattern = JSON.stringify('%JOB-123,\\_\\%")%');
  assert.equal(jobs.searchParams.get("or"), `(job_ref.ilike.${pattern},description.ilike.${pattern})`);
  const result = await response.json();
  assert.ok(result && typeof result === "object" && "pagination" in result);
  const pagination = result.pagination;
  assert.ok(pagination && typeof pagination === "object" && "totalPages" in pagination);
  assert.equal(pagination.totalPages, 2);
});

test("linkable job searches surface database errors", async t => {
  const { response } = await request(t, {
    method: "get", path: "/invoices/:id/linkable-jobs", jobFailure: true,
  });
  assert.equal(response.status, 500);
});

for (const path of ["/invoices/:id/linkable-jobs", "/invoices/:id/link-job"]) {
  test(`missing or foreign invoices cannot be linked or searched: ${path}`, async t => {
    const { response, writes } = await request(t, {
      method: path.endsWith("link-job") ? "post" : "get", path, missing: true, body: { job_id: invoiceId },
    });
    assert.equal(response.status, 404);
    assert.equal(writes.length, 0);
  });
}

test("linkable job search rejects an invalid page", async t => {
  const { response } = await request(t, {
    method: "get", path: "/invoices/:id/linkable-jobs", body: { page: 0 },
  });
  assert.equal(response.status, 400);
});

test("already linked invoices do not expose job candidates", async t => {
  const { response, reads } = await request(t, {
    method: "get", path: "/invoices/:id/linkable-jobs", existing: { job_id: invoiceId },
  });
  assert.equal(response.status, 409);
  assert.equal(reads.filter(url => url.pathname.endsWith("/jobs")).length, 0);
});

test("creating and duplicating an invoice calculates and persists its discount", async t => {
  const { response, writes } = await request(t, {
    method: "post", body: { customer_id: customerId, line_items: lineItems, discount_type: "fixed", discount_value: 12.5 },
  });
  assert.equal(response.status, 201, await response.clone().text());
  assert.deepEqual(
    Object.fromEntries(Object.entries(writes.find(w => w.table === "invoices")!.body).filter(([key]) =>
      ["subtotal", "discount_type", "discount_value", "discount_amount", "vat_amount", "total"].includes(key))),
    { subtotal: 100, discount_type: "fixed", discount_value: 12.5, discount_amount: 12.5, vat_amount: 17.5, total: 105 },
  );
});

test("discount-only updates use stored tenant-scoped lines and ignore client totals", async t => {
  const { response, writes, reads } = await request(t, {
    body: { discount_type: "percentage", discount_value: 25, total: 1, discount_amount: 99 },
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.ok(reads.some(url => url.pathname.endsWith("invoice_line_items")));
  assert.deepEqual(writes.map(w => w.table), ["invoices"]);
  const body = writes[0].body;
  assert.equal(body.subtotal, 100);
  assert.equal(body.discount_amount, 25);
  assert.equal(body.vat_amount, 15);
  assert.equal(body.total, 90);
});

test("changing invoice lines preserves the saved discount and recalculates it", async t => {
  const { response, writes } = await request(t, {
    body: { line_items: [{ description: "Extra work", quantity: 1, unit_price: 200 }] },
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(writes[0].body.discount_value, 10);
  assert.equal(writes[0].body.discount_amount, 20);
  assert.equal(writes[0].body.vat_amount, 36);
  assert.equal(writes[0].body.total, 216);
});

test("VAT-only updates recalculate tax without losing the discount", async t => {
  const { response, writes } = await request(t, { body: { vat_rate: 5 } });
  assert.equal(response.status, 200);
  assert.equal(writes[0].body.vat_amount, 4.5);
  assert.equal(writes[0].body.total, 94.5);
});

test("removing a discount restores original totals", async t => {
  const { response, writes } = await request(t, { body: { discount_type: null } });
  assert.equal(response.status, 200);
  assert.equal(writes[0].body.discount_value, 0);
  assert.equal(writes[0].body.discount_amount, 0);
  assert.equal(writes[0].body.vat_amount, 20);
  assert.equal(writes[0].body.total, 120);
});

test("metadata-only edits leave saved financial totals unchanged", async t => {
  const { response, writes } = await request(t, { body: { notes: "Internal note" } });
  assert.equal(response.status, 200);
  assert.equal(writes[0].body.total, undefined);
  assert.equal(writes[0].body.discount_type, undefined);
});

for (const body of [
  { discount_type: "percentage", discount_value: 101 },
  { discount_type: "fixed", discount_value: 101 },
  { discount_type: "fixed", discount_value: -1 },
  { discount_type: "fixed", discount_value: "10" },
  { discount_type: "fixed", discount_value: 0.001 },
  { discount_type: "invalid", discount_value: 10 },
]) {
  test(`invalid discount is rejected without writes: ${JSON.stringify(body)}`, async t => {
    const { response, writes } = await request(t, { body });
    assert.equal(response.status, 400, await response.clone().text());
    assert.equal(writes.length, 0);
  });
}

test("a subtotal reduction cannot silently exceed a fixed discount", async t => {
  const { response, writes } = await request(t, {
    existing: { discount_type: "fixed", discount_value: 100 },
    body: { line_items: [{ description: "Service", quantity: 1, unit_price: 50 }] },
  });
  assert.equal(response.status, 400);
  assert.equal(writes.length, 0);
});

test("sent invoices cannot have their discounts changed", async t => {
  const { response, writes } = await request(t, { existing: { status: "sent" }, body: { discount_value: 25 } });
  assert.equal(response.status, 400);
  assert.equal(writes.length, 0);
});

test("missing or foreign invoices cannot receive discounts", async t => {
  const { response, writes } = await request(t, { missing: true, body: { discount_value: 25 } });
  assert.equal(response.status, 404);
  assert.equal(writes.length, 0);
});

test("discount changes fail explicitly if stored lines cannot be loaded", async t => {
  const { response, writes } = await request(t, { lineReadFailure: true, body: { discount_value: 25 } });
  assert.equal(response.status, 500);
  assert.equal(writes.length, 0);
});

test("quote editing is unchanged and does not gain invoice-only discounts", async t => {
  const { response, writes } = await request(t, {
    existing: { type: "quote", discount_type: null, discount_value: 0 },
    body: { discount_type: "percentage", discount_value: 10 },
  });
  assert.equal(response.status, 400);
  assert.equal(writes.length, 0);
});

test("refreshing a job invoice retains its discount and recalculates the deduction", async t => {
  const { response, writes } = await request(t, { method: "post", path: "/jobs/:id/create-internal-invoice" });
  assert.equal(response.status, 200, await response.clone().text());
  const invoiceWrite = writes.find(w => w.table === "invoices");
  assert.ok(invoiceWrite);
  assert.equal(invoiceWrite.body.discount_type, undefined, "refresh must preserve the stored discount type");
  assert.equal(invoiceWrite.body.discount_value, undefined, "refresh must preserve the stored discount value");
  assert.equal(invoiceWrite.body.discount_amount, 20);
  assert.equal(invoiceWrite.body.vat_amount, 36);
  assert.equal(invoiceWrite.body.total, 216);
});

test("refreshing a job cannot discard a fixed discount after prices fall", async t => {
  const { response, writes } = await request(t, {
    method: "post", path: "/jobs/:id/create-internal-invoice",
    existing: { discount_type: "fixed", discount_value: 250 },
  });
  assert.equal(response.status, 400, await response.clone().text());
  assert.equal(writes.length, 0);
});

test("refreshing a job fails explicitly if its existing draft cannot be read", async t => {
  const { response, writes } = await request(t, {
    method: "post", path: "/jobs/:id/create-internal-invoice", draftReadFailure: true,
  });
  assert.equal(response.status, 500);
  assert.equal(writes.length, 0);
});

test("CSV exports use the discounted net amount", async t => {
  const exportIndex = router.stack.findIndex(layer => layer.route?.path === "/invoices/export.csv");
  const detailIndex = router.stack.findIndex(layer => layer.route?.path === "/invoices/:id");
  assert.ok(exportIndex < detailIndex, "CSV route must not be captured as an invoice id");
  const { response } = await request(t, { method: "get", path: "/invoices/export.csv" });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /,90\.00,18\.00,108\.00,/);
});

for (const path of ["/invoices/:id/pdf", "/portal/invoices/:id/pdf"]) {
  test(`downloaded invoices show the saved discount: ${path}`, async t => {
    const { response } = await request(t, { method: "get", path, existing: { status: "sent" } });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("content-type") || "", /application\/pdf/);
    const pdf = Buffer.from(await response.arrayBuffer()).toString("latin1");
    assert.ok(pdf.includes("Discount \\(10%\\)"));
    assert.ok(pdf.includes("108.00"));
  });
}
