import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema } from "@/lib/schema";

export default function PrivacyPolicyPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Privacy Policy"
        description="BoilerTech privacy policy. How we collect, use, store, and protect your personal data under UK GDPR and the Data Protection Act 2018."
        canonical={`${SITE_URL}/privacy-policy`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Privacy Policy", url: `${SITE_URL}/privacy-policy` },
          ]),
        ]}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: 1 March 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">1. Who We Are</h2>
            <p>BoilerTech Ltd ("we", "us", "our") is a company registered in England and Wales. We operate the BoilerTech platform at boilertech.replit.app. We are the data controller for the personal data we process through our platform.</p>
            <p>For data protection enquiries, contact us at: privacy@boilertech.co.uk</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">2. What Data We Collect</h2>
            <p>We collect the following categories of personal data:</p>
            <p><strong>Account information:</strong> Name, email address, phone number, company name, and role when you register for an account.</p>
            <p><strong>Customer data:</strong> Names, addresses, phone numbers, and email addresses of your customers that you enter into the platform to manage your boiler service business.</p>
            <p><strong>Job and service records:</strong> Details of jobs, service records, inspection forms, commissioning records, and other work documentation you create through the platform.</p>
            <p><strong>Usage data:</strong> Information about how you use the platform, including pages visited, features used, and session duration.</p>
            <p><strong>Payment information:</strong> When you subscribe to a paid plan, payment details are processed by our payment provider (Stripe). We do not store your full card details on our servers.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">3. How We Use Your Data</h2>
            <p>We use your data for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Providing and operating the BoilerTech platform</li>
              <li>Managing your account and subscription</li>
              <li>Sending service-related communications (e.g., billing, security, feature updates)</li>
              <li>Providing customer support</li>
              <li>Improving and developing our platform</li>
              <li>Complying with legal obligations</li>
            </ul>
            <p>Our legal bases for processing under UK GDPR are: performance of a contract (providing the service you've subscribed to), legitimate interests (improving our platform, preventing fraud), and legal obligation (tax and accounting requirements).</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">4. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Infrastructure providers:</strong> Our platform is hosted on secure cloud infrastructure within UK/EU data centres</li>
              <li><strong>Payment processor:</strong> Stripe processes payment transactions on our behalf</li>
              <li><strong>Email provider:</strong> We use a third-party email service to send transactional emails</li>
            </ul>
            <p>All third-party providers are bound by data processing agreements and process data only on our instructions.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">5. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. When you cancel your account, we retain your data for 30 days to allow reactivation, after which it is securely deleted.</p>
            <p>Job records and service documentation are retained for a minimum of 6 years in line with UK limitation periods and industry best practice for gas safety records.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">6. Your Rights</h2>
            <p>Under UK GDPR, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access</strong> — Request a copy of the personal data we hold about you</li>
              <li><strong>Rectification</strong> — Request correction of inaccurate data</li>
              <li><strong>Erasure</strong> — Request deletion of your data (subject to legal retention requirements)</li>
              <li><strong>Portability</strong> — Request your data in a machine-readable format</li>
              <li><strong>Restriction</strong> — Request that we limit processing of your data</li>
              <li><strong>Objection</strong> — Object to processing based on legitimate interests</li>
            </ul>
            <p>To exercise any of these rights, contact us at privacy@boilertech.co.uk. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">7. Cookies</h2>
            <p>We use essential cookies to keep you logged in and maintain your session. We do not use tracking cookies or third-party advertising cookies. No cookie consent banner is required for essential-only cookies under UK law.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">8. Security</h2>
            <p>We implement appropriate technical and organisational measures to protect your data, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Encryption in transit (TLS/HTTPS) and at rest</li>
              <li>Role-based access controls</li>
              <li>Regular security reviews</li>
              <li>Automated backups</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">9. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Material changes will be communicated via email or a notice in the platform. The "Last updated" date at the top of this page indicates when the policy was last revised.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-slate-900">10. Complaints</h2>
            <p>If you have concerns about how we handle your data, please contact us first at privacy@boilertech.co.uk. You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk.</p>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}
