import type { TenantWebsiteContent } from "@/features/website-builder/websiteBuilderTypes";

export const classicSampleContent: TenantWebsiteContent = {
  business: {
    businessName: "North East Ecoheat LTD",
    tagline: "Modern Heating Solutions for Efficient Homes",
    phone: "0191 123 4567",
    email: "hello@northeastecoheat.co.uk",
    address: "1 High Street, Newcastle, NE1 1AA",
    logoUrl: "",
    accreditations: ["MCS Certified", "Gas Safe Registered", "500+ Installations"],
  },
  hero: {
    eyebrow: "North East Ecoheat LTD",
    heading: "Modern Heating Solutions for Efficient Homes",
    subheading: "Heat pumps, underfloor heating, solar thermal and boiler upgrades designed around your property.",
    primaryButtonText: "Book a Survey",
    primaryButtonUrl: "/contact",
    secondaryButtonText: "View Services",
    secondaryButtonUrl: "/services",
    imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600",
    imageAlt: "Modern home with efficient heating system",
  },
  benefits: {
    heading: "Why choose us",
    items: [
      { title: "Certified Engineers", description: "MCS and Gas Safe qualified specialists.", icon: "shield" },
      { title: "Bespoke Design", description: "Systems designed for your property and usage.", icon: "settings" },
      { title: "Clear Pricing", description: "Transparent quotes with no hidden extras.", icon: "wallet" },
      { title: "Aftercare", description: "Support, servicing and optimisation after install.", icon: "heart" },
    ],
  },
  services: {
    heading: "Heating Solutions for Every Property",
    intro: "Expert installation of heat pumps, underfloor heating, solar thermal and boiler upgrades.",
    items: [
      {
        title: "Air Source Heat Pumps",
        description: "High-efficiency low-carbon heating for modern homes.",
        imageUrl: "",
        imageAlt: "Heat pump outdoor unit",
        slug: "air-source-heat-pumps",
        features: ["MCS design", "Grant guidance", "Commissioning"],
      },
      {
        title: "Underfloor Heating",
        description: "Comfortable even heat with smart zoning controls.",
        imageUrl: "",
        imageAlt: "Underfloor heating manifold",
        slug: "underfloor-heating",
        features: ["Retrofit", "New build", "Smart controls"],
      },
    ],
  },
  process: {
    heading: "How It Works",
    steps: [
      { title: "Survey", description: "We inspect your property and requirements." },
      { title: "Design", description: "We design the right system and controls." },
      { title: "Install", description: "Our engineers install and commission safely." },
      { title: "Support", description: "Ongoing servicing and optimisation." },
    ],
  },
  reviews: {
    heading: "What Our Customers Say",
    items: [
      { customerName: "S. Bennett", location: "Winchester", rating: 5, quote: "Fantastic install and clear communication.", service: "Heat pump installation" },
      { customerName: "A. Green", location: "Southampton", rating: 5, quote: "Professional team and tidy finish.", service: "Underfloor heating" },
    ],
  },
  areas: {
    heading: "Areas We Cover",
    intro: "Based in Winchester, we serve Hampshire and surrounding counties.",
    items: [
      { name: "Winchester", slug: "winchester" },
      { name: "Southampton", slug: "southampton" },
      { name: "Portsmouth", slug: "portsmouth" },
      { name: "Basingstoke", slug: "basingstoke" },
    ],
  },
  faqs: {
    heading: "Frequently Asked Questions",
    items: [
      { question: "Do heat pumps work in older homes?", answer: "Yes, with correct design and emitters they work very well." },
      { question: "Can you help with grants?", answer: "Yes, we can guide you through available options and eligibility." },
    ],
  },
  contact: {
    heading: "Get in Touch",
    intro: "Book a survey or ask a question and we will get back to you quickly.",
    phone: "0191 123 4567",
    email: "hello@northeastecoheat.co.uk",
    address: "1 High Street, Newcastle, NE1 1AA",
    openingHours: "Mon-Fri 08:00-17:30",
    emergencyText: "Emergency callouts available.",
    formEnabled: true,
  },
};
