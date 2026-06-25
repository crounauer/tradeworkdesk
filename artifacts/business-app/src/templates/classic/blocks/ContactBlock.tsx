import type { ContactContent } from "@/features/website-builder/websiteBuilderTypes";

export default function ContactBlock({ contact }: { contact: ContactContent }) {
  return (
    <section className="rounded-md border p-6 bg-white">
      <h3 className="text-lg font-semibold">{contact.heading}</h3>
      <p className="text-sm text-muted-foreground mt-1">{contact.intro}</p>
      <div className="grid md:grid-cols-2 gap-3 mt-4 text-sm">
        <p><span className="font-medium">Phone:</span> {contact.phone}</p>
        <p><span className="font-medium">Email:</span> {contact.email}</p>
        <p><span className="font-medium">Address:</span> {contact.address}</p>
        <p><span className="font-medium">Hours:</span> {contact.openingHours}</p>
      </div>
      {contact.formEnabled ? <p className="text-xs mt-3 text-muted-foreground">Contact form is enabled.</p> : null}
    </section>
  );
}
