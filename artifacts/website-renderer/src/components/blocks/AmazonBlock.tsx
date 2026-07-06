"use client";

import React from "react";

interface AmazonProduct {
  asin: string;
  title: string;
  price?: string;
  rating?: number;
  reviews?: number;
  imageUrl?: string;
  affiliateId?: string;
}

interface AmazonBlockContent {
  products?: AmazonProduct[];
  title?: string;
  description?: string;
  showDisclosure?: boolean;
  disclosureText?: string;
  layout?: "grid" | "carousel";
  columns?: number;
  affiliate_id?: string;
  template_slug?: string;
}

export default function AmazonBlock({ content }: { content: AmazonBlockContent }) {
  const {
    products = [],
    title,
    description,
    showDisclosure = true,
    disclosureText = "As an Amazon Associate, we earn from qualifying purchases.",
    layout = "grid",
    columns = 3,
    affiliate_id,
  } = content;

  if (!products || products.length === 0) {
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

  return (
    <section className="py-12 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {title && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
            {description && <p className="text-gray-600 text-lg">{description}</p>}
          </div>
        )}

        <div
          className={
            layout === "grid"
              ? `grid grid-cols-1 md:grid-cols-${columns > 4 ? 2 : columns} gap-6`
              : "flex overflow-x-auto gap-6 pb-4"
          }
        >
          {products.map((product) => (
            <div
              key={product.asin}
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
                  href={buildAmazonLink(product.asin, product.affiliateId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded text-center transition-colors"
                >
                  View on Amazon
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Amazon Affiliate Disclosure */}
        {showDisclosure && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              {disclosureText}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
