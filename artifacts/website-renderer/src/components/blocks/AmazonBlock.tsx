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
  } = content;

  const resolvedTitle = title || heading;
  const resolvedDescription = description || subheading;
  const resolvedDisclosureText = disclosure_text || disclosureText;
  const resolvedButtonText = button_text || "View on Amazon";
  const resolvedLayout = layout_variant === "carousel" ? "carousel" : layout;
  const openLinksInNewTab = open_in_new_tab !== false;

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
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-gray-500">
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
    <section className="py-12 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {resolvedTitle && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{resolvedTitle}</h2>
            {resolvedDescription && <p className="text-gray-600 text-lg">{resolvedDescription}</p>}
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
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Product Image */}
              {product.imageUrl && (
                <div className="aspect-square overflow-hidden bg-gray-100">
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
                  <div className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 mb-2">
                    {product.badgeText}
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                  {product.title}
                </h3>

                {/* Rating */}
                {product.rating !== undefined && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={`text-sm ${
                            i < Math.round(product.rating!)
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    {product.reviews !== undefined && (
                      <span className="text-sm text-gray-500">
                        ({product.reviews})
                      </span>
                    )}
                  </div>
                )}

                {/* Price */}
                {product.price && (
                  <p className="text-lg font-bold text-gray-900 mb-4">
                    {product.price}
                  </p>
                )}

                {/* Amazon Link */}
                <a
                  href={product.affiliateUrl || buildAmazonLink(product.asin, product.affiliateId)}
                  target={openLinksInNewTab ? "_blank" : undefined}
                  rel={openLinksInNewTab ? "noopener noreferrer" : undefined}
                  className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded text-center transition-colors"
                >
                  {resolvedButtonText}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Amazon Affiliate Disclosure */}
        {showDisclosure && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              {resolvedDisclosureText}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
