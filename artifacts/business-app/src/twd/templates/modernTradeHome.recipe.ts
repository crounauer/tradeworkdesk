import type { TemplatePage } from './TemplatePageRenderer';

export const modernTradeHomePage: TemplatePage = {
  title: 'Home',
  blocks: [
    {
      type: 'site.header',
      props: {
        logoText: 'North East Eco Heat',
        navItems: [
          { label: 'Home', href: '/' },
          { label: 'Services', href: '/services' },
          { label: 'Areas', href: '/areas-covered' },
          { label: 'Reviews', href: '/reviews' },
          { label: 'Contact', href: '/contact' },
        ],
        phone: '01224 000000',
        ctaLabel: 'Book a visit',
        ctaHref: '#contact',
      },
    },
    {
      type: 'hero.standard',
      props: {
        eyebrow: 'Plumbing & heating specialists',
        title: 'Reliable plumbing and heating services across Aberdeenshire',
        subtitle: 'Professional boiler servicing, breakdowns, installations and heating upgrades from a trusted local business.',
        primaryCtaLabel: 'Request a quote',
        secondaryCtaLabel: 'View services',
        phone: '01224 000000',
        imageAlt: 'Engineer working on a heating system',
      },
    },
    {
      type: 'trust.badges',
      props: {
        badges: [
          { label: 'Local business', description: 'Based in the North East and trusted by local homeowners.' },
          { label: 'Clear pricing', description: 'Straightforward advice before work begins.' },
          { label: 'Practical repairs', description: 'Focused on reliable fixes, not unnecessary upselling.' },
        ],
      },
    },
    {
      type: 'services.grid',
      props: {
        eyebrow: 'Services',
        title: 'How we can help',
        subtitle: 'Core services for homeowners, landlords and small commercial properties.',
        services: [
          { title: 'Oil boiler servicing', description: 'Annual servicing to keep your boiler running safely and efficiently.', href: '/services/oil-boiler-servicing' },
          { title: 'Boiler breakdowns', description: 'Fault finding and repairs when your heating stops working.', href: '/services/boiler-breakdowns' },
          { title: 'Heating upgrades', description: 'Replacement boilers, controls and system improvements.', href: '/services/heating-upgrades' },
        ],
      },
    },
    {
      type: 'reviews.grid',
      props: {
        eyebrow: 'Reviews',
        title: 'What customers say',
        reviews: [
          { quote: 'Arrived when agreed, explained the issue clearly and got the boiler running again.', name: 'Customer', location: 'Ellon', rating: 5 },
          { quote: 'Professional service and tidy work. Would happily use again.', name: 'Customer', location: 'Inverurie', rating: 5 },
          { quote: 'Helpful advice and a straightforward repair without any fuss.', name: 'Customer', location: 'Peterhead', rating: 5 },
        ],
      },
    },
    {
      type: 'areas.grid',
      props: {
        eyebrow: 'Areas covered',
        title: 'Serving homes across the North East',
        subtitle: 'Local plumbing and heating support across towns and rural areas.',
        areas: [
          { name: 'Ellon', href: '/areas/ellon' },
          { name: 'Inverurie', href: '/areas/inverurie' },
          { name: 'Peterhead', href: '/areas/peterhead' },
          { name: 'Aberdeen', href: '/areas/aberdeen' },
        ],
      },
    },
    {
      type: 'faq.accordion',
      props: {
        eyebrow: 'FAQ',
        title: 'Common questions',
        faqs: [
          { question: 'Do you service oil boilers?', answer: 'Yes, this template supports oil boiler servicing content and can be adapted for other heating services.' },
          { question: 'Can customers request a quote online?', answer: 'Yes, this block structure can be connected to your future TWD enquiry form.' },
          { question: 'Can the areas be edited?', answer: 'Yes, areas are passed in as editable data and can be mapped to CMS fields later.' },
        ],
      },
    },
    {
      type: 'cta.banner',
      props: {
        title: 'Need help with your heating?',
        subtitle: 'Get practical advice and a clear next step from a local trade business.',
        primaryCtaLabel: 'Request a quote',
        secondaryCtaLabel: 'Call now',
        phone: '01224 000000',
      },
    },
    {
      type: 'contact.split',
      props: {
        eyebrow: 'Contact',
        title: 'Request a quote or ask a question',
        subtitle: 'Tell us what you need help with and we will get back to you.',
        phone: '01224 000000',
        email: 'hello@example.co.uk',
        address: 'Aberdeenshire, Scotland',
        openingHours: 'Monday to Friday, 8am to 5pm',
      },
    },
    {
      type: 'site.footer',
      props: {
        logoText: 'North East Eco Heat',
        description: 'Local plumbing and heating support for homeowners and landlords.',
        phone: '01224 000000',
        email: 'hello@example.co.uk',
        navItems: [
          { label: 'Services', href: '/services' },
          { label: 'Areas', href: '/areas-covered' },
          { label: 'Reviews', href: '/reviews' },
          { label: 'Contact', href: '/contact' },
        ],
        legalLinks: [
          { label: 'Privacy Policy', href: '/privacy-policy' },
          { label: 'Cookie Policy', href: '/cookie-policy' },
          { label: 'Terms', href: '/terms-conditions' },
        ],
      },
    },
  ],
};
