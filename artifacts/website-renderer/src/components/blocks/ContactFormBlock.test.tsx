import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ContactFormBlock from "./ContactFormBlock";

function renderForm(fields?: Array<{ name: string; label: string; type: string; required?: boolean }>) {
  return renderToStaticMarkup(
    <ContactFormBlock content={{ website_id: "test-website", allow_photos: false, fields }} />,
  );
}

test("default contact form requires separate First Name and Surname fields", () => {
  const html = renderForm();
  assert.match(html, /First Name/);
  assert.match(html, /Surname/);
  assert.match(html, /id="first_name"[^>]*required=""[^>]*autoComplete="given-name"/);
  assert.match(html, /id="last_name"[^>]*required=""[^>]*autoComplete="family-name"/);
  assert.doesNotMatch(html, /Full Name|name="name"/);
  assert.match(html, /name="phone"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="message"/);
});

for (const name of ["name", "full_name", "contact_name"]) {
  test(`existing ${name} fields are split without losing custom fields`, () => {
    const html = renderForm([
      { name, label: "Full Name", type: "text", required: true },
      { name: "service", label: "Service Required", type: "text" },
    ]);
    assert.match(html, /id="first_name"[^>]*required=""/);
    assert.match(html, /id="last_name"[^>]*required=""/);
    assert.doesNotMatch(html, new RegExp(`name="${name}"`));
    assert.match(html, /Service Required/);
    assert.match(html, /name="service"/);
  });
}

test("already split fields are preserved and not duplicated by legacy fields", () => {
  const html = renderForm([
    { name: "first_name", label: "First Name", type: "text", required: true },
    { name: "last_name", label: "Surname", type: "text", required: true },
    { name: "name", label: "Full Name", type: "text", required: true },
    { name: "full_name", label: "Full Name", type: "text", required: true },
  ]);
  assert.equal(html.match(/name="first_name"/g)?.length, 1);
  assert.equal(html.match(/name="last_name"/g)?.length, 1);
  assert.doesNotMatch(html, /Full Name/);
});
