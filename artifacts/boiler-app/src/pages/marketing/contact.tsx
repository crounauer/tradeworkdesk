import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema } from "@/lib/schema";
import { Mail, Phone, Clock, MapPin } from "lucide-react";

const contactMethods = [
  {
    icon: Mail,
    title: "Email",
    detail: "support@boilertech.co.uk",
    desc: "We aim to respond within 4 hours during business hours.",
  },
  {
    icon: Phone,
    title: "Phone",
    detail: "0800 123 4567",
    desc: "Monday to Friday, 8am - 6pm GMT.",
  },
  {
    icon: Clock,
    title: "Support Hours",
    detail: "Mon - Fri, 8am - 6pm",
    desc: "Emergency support available for Business plan customers.",
  },
  {
    icon: MapPin,
    title: "Office",
    detail: "London, United Kingdom",
    desc: "Registered in England & Wales.",
  },
];

export default function ContactPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Contact Us — Get in Touch"
        description="Contact the BoilerTech team for support, sales questions, or partnership enquiries. UK-based support team available Monday to Friday."
        canonical={`${SITE_URL}/contact`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Contact", url: `${SITE_URL}/contact` },
          ]),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
              Get in touch
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Whether you have a question about features, pricing, or need help getting
              started, our UK-based team is here to help.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
            {contactMethods.map((method) => (
              <div
                key={method.title}
                className="flex items-start gap-5 p-6 rounded-2xl border border-slate-200 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <method.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-lg text-slate-900">{method.title}</h2>
                  <p className="text-primary font-medium mt-1">{method.detail}</p>
                  <p className="text-sm text-slate-500 mt-1">{method.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-2xl font-bold text-slate-900">
            Prefer to try it yourself?
          </h2>
          <p className="mt-4 text-slate-600">
            Start a 14-day free trial — no credit card required. Most questions are
            answered once you see the platform in action.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
