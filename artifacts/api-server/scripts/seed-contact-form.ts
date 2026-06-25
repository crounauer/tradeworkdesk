import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase config");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  try {
    // Get the ecoheat website
    const { data: domains, error: domainError } = await db
      .from("website_domains")
      .select("website_id")
      .eq("domain", "north-east-ecoheat-ltd.tradeworkdesk.co.uk")
      .single();

    if (domainError || !domains?.website_id) {
      console.error("Could not find website:", domainError);
      return;
    }

    const websiteId = domains.website_id;
    console.log("Found website:", websiteId);

    // Get the contact page
    const { data: contactPage, error: pageError } = await db
      .from("website_pages")
      .select("id, tenant_id")
      .eq("website_id", websiteId)
      .eq("slug", "contact")
      .single();

    if (pageError || !contactPage) {
      console.error("Could not find contact page:", pageError);
      return;
    }

    console.log("Found contact page:", contactPage.id);

    // Create the contact form block
    const { data: block, error: blockError } = await db
      .from("website_blocks")
      .insert([
        {
          page_id: contactPage.id,
          tenant_id: contactPage.tenant_id,
          block_type: "contact_form",
          content: {
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
          },
          sort_order: 1,
          is_visible: true,
        },
      ])
      .select()
      .single();

    if (blockError) {
      console.error("Error creating block:", blockError);
      return;
    }

    console.log("✓ Created contact form block:", block.id);
    console.log("\n✅ Contact page seeded successfully!");
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

main();
