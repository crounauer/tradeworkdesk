import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, organizationSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, Wrench, Award } from "lucide-react";

const team = [
  {
    name: "James Harrison",
    role: "Founder & Lead Engineer",
    bio: "Gas Safe registered engineer with 15+ years in the heating industry. Built BoilerTech after experiencing the pain of paper-based job management first-hand.",
  },
  {
    name: "Sarah Mitchell",
    role: "Head of Product",
    bio: "Former operations manager at a 30-engineer heating firm. Understands the day-to-day challenges of running a service company from the office side.",
  },
  {
    name: "David Chen",
    role: "Technical Director",
    bio: "Software engineer with a decade of experience building field service platforms. Passionate about making technology that works in a boiler cupboard.",
  },
];

const values = [
  {
    icon: Wrench,
    title: "Built by Engineers, for Engineers",
    desc: "We're not a Silicon Valley startup guessing what tradespeople need. Our founder is a Gas Safe registered engineer who built this because he needed it.",
  },
  {
    icon: Shield,
    title: "Compliance First",
    desc: "Every form, every workflow, every record structure is designed around UK gas safety regulations. We stay up to date so you don't have to.",
  },
  {
    icon: Users,
    title: "UK-Based Support",
    desc: "When you call us, you speak to someone who understands the heating industry. No offshore call centres, no chatbots.",
  },
  {
    icon: Award,
    title: "Continuous Improvement",
    desc: "We ship updates every week based on feedback from real engineers in the field. If something isn't working, we fix it fast.",
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="About BoilerTech — Built by Heating Engineers"
        description="BoilerTech was founded by a Gas Safe registered engineer who understood the industry's need for purpose-built job management software. Meet the team behind the platform."
        canonical={`${SITE_URL}/about`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "About", url: `${SITE_URL}/about` },
          ]),
          organizationSchema(),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
              Built by heating engineers, for heating engineers
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              BoilerTech started in 2023 when our founder — a Gas Safe registered engineer
              with 15 years in the trade — got fed up with paper forms, lost records, and
              software that didn't understand his industry.
            </p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              He built the tool he wished existed: a platform that speaks the language of
              gas engineers, handles compliance naturally, and works from a phone in a
              boiler cupboard with no signal.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-12">Our values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((v) => (
              <div key={v.title} className="flex items-start gap-5 p-6 rounded-2xl border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <v.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-slate-900">{v.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">The team</h2>
          <p className="text-lg text-slate-600 mb-12 max-w-2xl">
            A small, focused team that combines deep industry knowledge with modern software engineering.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((person) => (
              <div key={person.name} className="bg-white rounded-2xl p-8 border border-slate-200">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-display font-bold text-primary">
                    {person.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-slate-900">{person.name}</h3>
                <p className="text-sm text-primary font-medium">{person.role}</p>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{person.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-display text-3xl font-bold">Want to see what we've built?</h2>
          <p className="mt-4 text-lg text-blue-100">
            Start your free trial and explore every feature. No credit card required.
          </p>
          <Link href="/register">
            <Button size="lg" className="mt-8 bg-white text-primary hover:bg-blue-50 text-base px-8 h-12">
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
