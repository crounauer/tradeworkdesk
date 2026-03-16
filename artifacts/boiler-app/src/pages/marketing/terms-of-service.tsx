import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema } from "@/lib/schema";

export default function TermsOfServicePage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Terms of Service"
        description="BoilerTech terms of service. The agreement between you and BoilerTech Ltd governing your use of the BoilerTech platform."
        canonical={`${SITE_URL}/terms-of-service`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Terms of Service", url: `${SITE_URL}/terms-of-service` },
          ]),
        ]}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: 1 March 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">1. Agreement</h2>
            <p>These terms of service ("Terms") are a legal agreement between you and BoilerTech Ltd ("BoilerTech", "we", "us"), a company registered in England and Wales. By creating an account or using the BoilerTech platform, you agree to these Terms.</p>
            <p>If you are using BoilerTech on behalf of a business, you represent that you have authority to bind that business to these Terms.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">2. The Service</h2>
            <p>BoilerTech provides a cloud-based platform for managing boiler service operations, including job management, customer records, digital forms, and reporting tools ("the Service"). The Service is provided on a subscription basis.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">3. Account Registration</h2>
            <p>To use the Service, you must create an account providing accurate and complete information. You are responsible for maintaining the security of your account credentials and for all activities that occur under your account.</p>
            <p>You must notify us immediately if you become aware of any unauthorised use of your account.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">4. Subscriptions and Payment</h2>
            <p><strong>Free trial:</strong> New accounts receive a 14-day free trial with full access to the features of your chosen plan. No payment information is required during the trial.</p>
            <p><strong>Billing:</strong> After the trial period, you must subscribe to a paid plan to continue using the Service. Subscriptions are billed monthly or annually, depending on your chosen billing cycle.</p>
            <p><strong>Price changes:</strong> We may change our prices with 30 days' notice. Price changes take effect at the start of your next billing cycle.</p>
            <p><strong>Refunds:</strong> Monthly subscriptions are not refundable. Annual subscriptions may be refunded on a pro-rata basis within the first 30 days.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">5. Your Data</h2>
            <p>You retain all rights to the data you enter into the Service ("Your Data"). We do not claim ownership of Your Data.</p>
            <p>You grant us a limited licence to store, process, and display Your Data solely for the purpose of providing the Service to you.</p>
            <p>You are responsible for the accuracy and legality of Your Data. You must ensure you have the necessary consents to enter customer personal data into the platform.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorised access to the Service or other users' accounts</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use the Service to store or transmit malicious code</li>
              <li>Resell or sublicense access to the Service without our written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">7. Service Availability</h2>
            <p>We aim to maintain 99.9% uptime but do not guarantee uninterrupted access. We may perform scheduled maintenance with reasonable notice. We are not liable for downtime caused by factors outside our control.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">8. Cancellation</h2>
            <p>You may cancel your subscription at any time. Your account will remain active until the end of your current billing period. After cancellation, you may export your data for 30 days before it is permanently deleted.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">9. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, BoilerTech's total liability to you for any claims arising from or related to the Service is limited to the amount you have paid us in the 12 months preceding the claim.</p>
            <p>We are not liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities.</p>
            <p>Nothing in these Terms limits our liability for death or personal injury caused by our negligence, fraud, or any other liability that cannot be excluded by law.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">10. Intellectual Property</h2>
            <p>The Service, including its design, code, features, and documentation, is owned by BoilerTech and protected by intellectual property laws. Your subscription grants you a limited, non-exclusive, non-transferable right to use the Service.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">11. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. Material changes will be communicated via email at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">12. Governing Law</h2>
            <p>These Terms are governed by the laws of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">13. Contact</h2>
            <p>For questions about these Terms, contact us at: legal@boilertech.co.uk</p>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}
