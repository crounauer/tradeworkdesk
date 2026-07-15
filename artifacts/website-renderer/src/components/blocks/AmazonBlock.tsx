"use client";

import React from "react";

interface AmazonProduct {
  asin?: string;
  title: string;
  price?: string;
  price_text?: string;
  rating?: number;
  rating_text?: string;
  reviews?: number;
  reviews_text?: string;
  imageUrl?: string;
  image_url?: string;
  affiliateId?: string;
  affiliate_id?: string;
  affiliate_url?: string;
  badge_text?: string;
}

interface AmazonBlockContent {
  products?: AmazonProduct[];
  title?: string;
  heading?: string;
  description?: string;
  subheading?: string;
  showDisclosure?: boolean;
  disclosureText?: string;
  disclosure_text?: string;
  button_text?: string;
  layout?: "grid" | "carousel";
  layout_variant?: string;
  columns?: number;
  affiliate_id?: string;
  open_in_new_tab?: boolean;
  template_slug?: string;
  section_bg?: string;
  card_bg?: string;
  heading_color?: string;
  description_color?: string;
  text_color?: string;
  muted_text_color?: string;
  accent_color?: string;
  border_color?: string;
  button_bg?: string;
  button_text_color?: string;
  padding_y?: string;
  padding_x?: string;
  max_width?: string;
  background_color?: string;
  muted_background_color?: string;
  primary_color?: string;
  primary_text_color?: string;
}

export default function AmazonBlock({ content }: { content: AmazonBlockContent }) {
  const {
    products = [],
    title,
    heading,
    description,
    subheading,
    showDisclosure = true,
    disclosureText = "As an Amazon Associate, we earn from qualifying purchases.",
    layout = "grid",
    layout_variant,
    columns = 3,
    affiliate_id,
    disclosure_text,
    button_text,
    open_in_new_tab,
    section_bg,
    card_bg,
    heading_color,
    description_color,
    text_color,
    muted_text_color,
    accent_color,
    border_color,
    button_bg,
    button_text_color,
    padding_y,
    padding_x,
    max_width,
  } = content;

  const resolvedTitle = title || heading;
  const resolvedDescription = description || subheading;
  const resolvedDisclosureText = disclosure_text || disclosureText;
  const resolvedButtonText = button_text || "View on Amazon";
  const resolvedLayout = layout_variant === "carousel" ? "carousel" : layout;
  const openLinksInNewTab = open_in_new_tab !== false;
  const sectionBg = section_bg || content.background_color || content.muted_background_color || "#f8fafc";
  const cardBg = card_bg || "#ffffff";
  const headingColor = heading_color || content.text_color || "#0f172a";
  const bodyColor = text_color || content.text_color || "#1f2937";
  const mutedColor = description_color || muted_text_color || content.muted_text_color || "#64748b";
  const badgeBg = border_color || content.border_color || "#e2e8f0";
  const accentColor = accent_color || content.accent_color || "#f59e0b";
  const sectionPaddingY = padding_y || "72px";
  const sectionPaddingX = padding_x || "24px";
  const containerMaxWidth = max_width || "1200px";
  const ctaBackground = button_bg || content.primary_color || accentColor;
  const ctaTextColor = button_text_color || content.primary_text_color || "#ffffff";

  const normalizedProducts = products.map((product) => {
    const ratingSource = product.rating ?? Number.parseFloat(String(product.rating_text || ""));
    const reviewsSource = product.reviews ?? Number.parseInt(String(product.reviews_text || ""), 10);

    return {
      title: String(product.title || ""),
      asin: product.asin ? String(product.asin) : "",
      price: product.price || product.price_text,
      rating: Number.isFinite(ratingSource) ? Number(ratingSource) : undefined,
      reviews: Number.isFinite(reviewsSource) ? Number(reviewsSource) : undefined,
      imageUrl: product.imageUrl || product.image_url,
      affiliateId: product.affiliateId || product.affiliate_id,
      affiliateUrl: product.affiliate_url,
      badgeText: product.badge_text,
    };
  });

  if (!normalizedProducts || normalizedProducts.length === 0) {
    return (
      <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, backgroundColor: sectionBg }}>
        <div className="mx-auto" style={{ maxWidth: containerMaxWidth }}>
          <div className="text-center" style={{ color: mutedColor }}>
            <p>No Amazon products configured for this block.</p>
          </div>
        </div>
      </section>
    );
  }

  const buildAmazonLink = (asin: string, customAffiliateId?: string) => {
    const id = customAffiliateId || affiliate_id || "tradeworkdesk-20";
    return `https://amazon.com/dp/${asin}?tag=${id}`;
  };

  const gridColsClass =
    columns >= 4
      ? "md:grid-cols-4"
      : columns === 3
        ? "md:grid-cols-3"
        : columns === 2
          ? "md:grid-cols-2"
          : "md:grid-cols-1";

  return (
    <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, backgroundColor: sectionBg }}>
      <div className="mx-auto" style={{ maxWidth: containerMaxWidth }}>
        {resolvedTitle && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2" style={{ color: headingColor }}>{resolvedTitle}</h2>
            {resolvedDescription && <p className="text-lg" style={{ color: mutedColor }}>{resolvedDescription}</p>}
          </div>
        )}

        <div
          className={
            resolvedLayout === "grid"
              ? `grid grid-cols-1 ${gridColsClass} gap-6`
              : "flex overflow-x-auto gap-6 pb-4"
          }
        >
          {normalizedProducts.map((product, index) => (
            <div
              key={product.asin || product.affiliateUrl || `${product.title}-${index}`}
              className="rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              style={{ backgroundColor: cardBg, borderColor: border_color || content.border_color || "rgba(15, 23, 42, 0.08)" }}
            >
              {/* Product Image */}
              {product.imageUrl && (
                <div className="aspect-square overflow-hidden" style={{ backgroundColor: sectionBg }}>
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>
              )}

              {/* Product Info */}
              <div className="p-4">
                {product.badgeText && (
                  <div
                    className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold mb-2"
                    style={{
                      backgroundColor: badgeBg,
                      color: headingColor,
                    }}
                  >
                    {product.badgeText}
                  </div>
                )}
                <h3 className="font-semibold line-clamp-2 mb-2" style={{ color: headingColor }}>
                  {product.title}
                </h3>

                {/* Rating */}
                {product.rating !== undefined && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="text-sm"
                          style={{ color: i < Math.round(product.rating!) ? accentColor : badgeBg }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    {product.reviews !== undefined && (
                      <span className="text-sm" style={{ color: mutedColor }}>
                        ({product.reviews})
                      </span>
                    )}
                  </div>
                )}

                {/* Price */}
                {product.price && (
                  <p className="text-lg font-bold mb-4" style={{ color: bodyColor }}>
                    {product.price}
                  </p>
                )}

                {/* Amazon Link */}
                <a
                  href={product.affiliateUrl || buildAmazonLink(product.asin, product.affiliateId)}
                  target={openLinksInNewTab ? "_blank" : undefined}
                  rel={openLinksInNewTab ? "noopener noreferrer" : undefined}
                  className="block w-full font-semibold py-2 px-4 rounded text-center transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: ctaBackground,
                    color: ctaTextColor,
                  }}
                >
                  {resolvedButtonText}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Amazon Affiliate Disclosure */}
        {showDisclosure && (
          <div className="mt-8 pt-6 border-t" style={{ borderColor: border_color || content.border_color || "rgba(15, 23, 42, 0.12)" }}>
            <p className="text-sm text-center" style={{ color: mutedColor }}>
              {resolvedDisclosureText}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
