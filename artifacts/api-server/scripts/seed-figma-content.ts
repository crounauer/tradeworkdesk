import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function seedContent() {
  // Find ecoheat website
  const { data: websites } = await db
    .from("websites")
    .select("id, site_name, tenant_id")
    .ilike("site_name", "%ecoheat%");

  if (!websites?.length) {
    console.log("No website found");
    return;
  }

  const website = websites[0];
  const websiteId = website.id;
  const tenantId = website.tenant_id;
  console.log(`Seeding content for: ${website.site_name}\n`);

  // Get all pages
  const { data: pages } = await db
    .from("website_pages")
    .select("id, slug")
    .eq("website_id", websiteId)
    .order("nav_order");

  if (!pages) return;

  const pageMap = Object.fromEntries(pages.map((p: any) => [p.slug, p.id]));

  // Helper to create blocks
  async function createBlock(
    pageId: string,
    blockType: string,
    content: any,
    sortOrder: number
  ) {
    const { error } = await db.from("website_blocks").insert({
      page_id: pageId,
      block_type: blockType,
      content,
      sort_order: sortOrder,
      is_visible: true,
      tenant_id: tenantId,
    });
    if (error) console.error(`Error creating ${blockType}:`, error);
    else console.log(`✓ Created ${blockType} block`);
  }

  // HOME PAGE
  console.log("\nHome page:");
  const homePage = pageMap["home"];
  await createBlock(homePage, "hero", {
    title: "Modern Heating Solutions for Efficient Homes",
    subtitle: "Heat pumps, underfloor heating, solar thermal and boiler upgrades designed around your property.",
    image: "https://images.unsplash.com/photo-1621905167918-48416bd8575a?w=1200&h=600&fit=crop",
    buttons: [
      { text: "Book a Service", url: "/contact" },
      { text: "View Services", url: "/services" },
    ],
  }, 1);

  await createBlock(homePage, "features", {
    features: [
      {
        title: "Lower Energy Bills",
        description: "Reduce your heating costs with our energy-efficient solutions.",
        icon: "📉",
      },
      {
        title: "Year-Round Comfort",
        description: "Consistent temperatures throughout your home, every season.",
        icon: "🌡️",
      },
      {
        title: "Reduced Carbon Output",
        description: "Eco-friendly systems that benefit both you and the planet.",
        icon: "🌍",
      },
      {
        title: "Expert System Design",
        description: "Professionally designed systems tailored to your property.",
        icon: "🔧",
      },
    ],
  }, 2);

  await createBlock(homePage, "services", {
    title: "Heating Solutions for Every Property",
    subtitle: "Expert installation of heat pumps, underfloor heating, solar thermal and boiler upgrades.",
    services: [
      {
        title: "Heat Pumps",
        description: "Air source and ground source heat pump installations for maximum efficiency.",
        icon: "💨",
      },
      {
        title: "Underfloor Heating",
        description: "Modern underfloor heating systems for comfort and efficiency.",
        icon: "🔥",
      },
      {
        title: "Solar Thermal",
        description: "Solar thermal systems for hot water and heating.",
        icon: "☀️",
      },
      {
        title: "Gas Boiler Upgrades",
        description: "High-efficiency gas boiler installations and upgrades.",
        icon: "🔲",
      },
      {
        title: "Oil Boiler Upgrades",
        description: "Oil boiler installations and upgrades for rural properties.",
        icon: "🛢️",
      },
      {
        title: "Radiator Systems",
        description: "Complete radiator heating systems design and installation.",
        icon: "🌡️",
      },
    ],
  }, 3);

  await createBlock(homePage, "testimonials", {
    testimonials: [
      {
        quote: "Excellent service from start to finish. The heat pump installation was smooth and the engineers were very professional.",
        author: "Margaret Wilson",
        role: "Homeowner",
        rating: 5,
      },
      {
        quote: "We've noticed a significant drop in our energy bills since having the underfloor heating installed. Very happy!",
        author: "David Carmichael",
        role: "Property Owner",
        rating: 5,
      },
      {
        quote: "Knowledgeable team that took time to understand our needs. Highly recommend their solar thermal system.",
        author: "James & Linda McAllister",
        role: "Family",
        rating: 5,
      },
    ],
  }, 4);

  await createBlock(homePage, "cta", {
    title: "Ready to upgrade your heating?",
    subtitle: "Contact us today for a free consultation",
    buttonText: "Get a Quote",
    buttonUrl: "/contact",
  }, 5);

  // SERVICES PAGE
  console.log("\nServices page:");
  const servicesPage = pageMap["services"];
  await createBlock(servicesPage, "services", {
    title: "Our Heating Services",
    subtitle: "Comprehensive heating solutions for residential and commercial properties across the North East.",
    services: [
      {
        title: "Air Source Heat Pumps",
        description: "Extract heat from the air and transfer it to your heating system. Perfect for most properties.",
        icon: "💨",
      },
      {
        title: "Ground Source Heat Pumps",
        description: "Highly efficient systems using heat from the ground for maximum savings.",
        icon: "🌍",
      },
      {
        title: "Underfloor Heating",
        description: "Modern comfort with efficient underfloor heating systems.",
        icon: "🔥",
      },
      {
        title: "Solar Thermal Systems",
        description: "Harness the sun's energy for hot water and heating.",
        icon: "☀️",
      },
      {
        title: "Gas & Oil Boilers",
        description: "High-efficiency boiler installations and upgrades.",
        icon: "🔲",
      },
      {
        title: "Radiator Systems",
        description: "Professional radiator design, installation and maintenance.",
        icon: "🌡️",
      },
    ],
  }, 1);

  // HOW IT WORKS PAGE
  console.log("\nHow It Works page:");
  const howItWorksPage = pageMap["how-it-works"];
  await createBlock(howItWorksPage, "process", {
    title: "How It Works",
    subtitle: "A straightforward four-step process from initial consultation to a fully commissioned system.",
    steps: [
      {
        number: 1,
        title: "Free Site Survey",
        description: "We assess your property and discuss your requirements.",
      },
      {
        number: 2,
        title: "Bespoke Design",
        description: "Custom system design tailored to your specific needs.",
      },
      {
        number: 3,
        title: "Professional Installation",
        description: "Expert installation by certified engineers.",
      },
      {
        number: 4,
        title: "System Support",
        description: "Ongoing support and maintenance for years to come.",
      },
    ],
  }, 1);

  // PROJECTS PAGE
  console.log("\nProjects page:");
  const projectsPage = pageMap["projects"];
  await createBlock(projectsPage, "gallery", {
    heading: "Recent Projects",
    images: [
      {
        url: "https://images.unsplash.com/photo-1621905167918-48416bd8575a?w=400&h=300&fit=crop",
        caption: "Ground Source Heat Pump — UFH — Liphook, Hampshire",
        alt: "Heat pump installation",
      },
      {
        url: "https://images.unsplash.com/photo-1621905167918-48416bd8575a?w=400&h=300&fit=crop",
        caption: "Air Source Heat Pump Retrofit — Surrey",
        alt: "Air source heat pump",
      },
      {
        url: "https://images.unsplash.com/photo-1621905167918-48416bd8575a?w=400&h=300&fit=crop",
        caption: "Solar Thermal System — Sussex",
        alt: "Solar thermal installation",
      },
      {
        url: "https://images.unsplash.com/photo-1621905167918-48416bd8575a?w=400&h=300&fit=crop",
        caption: "Commercial Underfloor Heating — London",
        alt: "Underfloor heating system",
      },
    ],
  }, 1);

  // REVIEWS PAGE
  console.log("\nReviews page:");
  const reviewsPage = pageMap["reviews"];
  await createBlock(reviewsPage, "testimonials", {
    title: "What Our Customers Say",
    subtitle: "Trusted by homeowners across the UK. Read our latest customer reviews.",
    testimonials: [
      {
        quote: "We had an air source heat pump installed by this company and couldn't be happier. The team was professional, efficient and very knowledgeable. Highly recommend!",
        author: "Margaret Wilson",
        role: "Homeowner",
        rating: 5,
      },
      {
        quote: "Outstanding service from start to finish. They took time to understand our requirements and delivered exactly what we needed. The energy savings have been brilliant.",
        author: "David Carmichael",
        role: "Property Owner",
        rating: 5,
      },
      {
        quote: "From the initial survey through to commissioning, everything was professional and seamless. Great team, great work.",
        author: "James & Linda McAllister",
        role: "Homeowners",
        rating: 5,
      },
      {
        title: "Outstanding Service",
        quote: "Best experience I've had with any heating engineer. Would definitely recommend to anyone.",
        author: "Susan Phillips",
        role: "Homeowner",
        rating: 5,
      },
      {
        quote: "Very impressed with the quality of work and the aftercare support. Professional from day one.",
        author: "Robert Thomson",
        role: "Homeowner",
        rating: 5,
      },
      {
        quote: "Can't fault the service. The team was courteous, professional and delivered excellent results.",
        author: "Helen Stewart",
        role: "Property Manager",
        rating: 5,
      },
    ],
  }, 1);

  // AREAS WE COVER PAGE
  console.log("\nAreas We Cover page:");
  const areasPage = pageMap["areas-we-cover"];
  await createBlock(areasPage, "areas", {
    heading: "Areas We Cover",
    subheading: "Heating services across the North East and beyond.",
    areas: [
      "Aberdeen",
      "Aberdeenshire",
      "Dundee",
      "Angus",
      "Perth & Kinross",
      "Edinburgh",
      "Lothian",
      "Borders",
      "Fife",
      "Midlothian",
      "Glasgow",
      "Lanarkshire",
    ],
    body_text: "We provide professional heating solutions across Scotland and the UK.",
  }, 1);

  // CONTACT PAGE
  console.log("\nContact page:");
  const contactPage = pageMap["contact"];
  await createBlock(contactPage, "contact_form", {
    heading: "Get In Touch",
    subheading: "Have a question? Fill out the form below and we'll get back to you as soon as possible.",
    submit_label: "Send Message",
    success_message: "Thank you! We've received your message and will get back to you shortly.",
    fields: [
      { name: "name", label: "Your Name", type: "text", required: true },
      { name: "email", label: "Your Email", type: "email", required: true },
      { name: "phone", label: "Phone Number", type: "tel", required: false },
      { name: "message", label: "Your Message", type: "textarea", required: true },
    ],
  }, 1);

  console.log("\n✅ All pages seeded successfully!");
}

seedContent().catch(console.error);
