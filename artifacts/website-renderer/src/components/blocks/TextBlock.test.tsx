import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TextBlock from "./TextBlock";

test("TextBlock applies theme and font props in legacy payloads", () => {
  const html = renderToStaticMarkup(
    <TextBlock
      content={{
        html: "<p>Hello</p>",
        heading_color: "#123456",
        body_color: "#abcdef",
        body_font_family: "Inter",
        heading_font_family: "Poppins",
        heading_size: "2rem",
        body_size: "18px",
        background_color: "#fefefe",
        max_width: "900px",
        padding_y: "64px",
        padding_x: "20px",
        layout_variant: "center",
      }}
    />,
  );

  expect(html).toContain("#123456");
  expect(html).toContain("#abcdef");
  expect(html).toContain("Inter");
  expect(html).toContain("Poppins");
  expect(html).toContain("900px");
  expect(html).toContain("64px");
});
