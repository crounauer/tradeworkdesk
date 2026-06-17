"use client";

interface Brand {
  name: string;
  logo_url?: string;
}

interface Props {
  content: {
    heading?: string;
    label?: string;
    brands?: Brand[];
    items?: Brand[];
    background_color?: string;
  } & Record<string, unknown>;
}

export default function BrandsBlock({ content }: Props) {
  const {
    heading,
    label,
    background_color = "#ffffff",
  } = content;
  const brands = (Array.isArray(content.brands) ? content.brands : Array.isArray(content.items) ? content.items : []) as Brand[];
  if (!brands.length) return null;

  return (
    <section style={{ padding: "40px 24px", backgroundColor: background_color, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {(label || heading) && (
          <p style={{ textAlign: "center", fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 24 }}>
            {label || heading}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 32 }}>
          {brands.map((brand, i) =>
            brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={brand.logo_url} alt={brand.name} style={{ height: 36, objectFit: "contain", opacity: 0.65, filter: "grayscale(1)" }} />
            ) : (
              <span key={i} style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#9ca3af" }}>{brand.name}</span>
            )
          )}
        </div>
      </div>
    </section>
  );
}
