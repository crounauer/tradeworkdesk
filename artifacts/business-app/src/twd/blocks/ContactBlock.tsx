export type ContactBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  phone?: string;
  email?: string;
  address?: string;
  openingHours?: string;
};

export function ContactBlock({
  eyebrow = 'Contact',
  title,
  subtitle,
  phone,
  email,
  address,
  openingHours,
}: ContactBlockProps) {
  return (
    <section id="contact" className="bg-slate-950 px-6 py-20 text-white lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 text-slate-300">{subtitle}</p> : null}

          <dl className="mt-8 grid gap-4 text-slate-200">
            {phone ? (
              <div>
                <dt className="font-semibold text-white">Phone</dt>
                <dd><a href={'tel:' + phone}>{phone}</a></dd>
              </div>
            ) : null}

            {email ? (
              <div>
                <dt className="font-semibold text-white">Email</dt>
                <dd><a href={'mailto:' + email}>{email}</a></dd>
              </div>
            ) : null}

            {address ? (
              <div>
                <dt className="font-semibold text-white">Address</dt>
                <dd>{address}</dd>
              </div>
            ) : null}

            {openingHours ? (
              <div>
                <dt className="font-semibold text-white">Opening hours</dt>
                <dd>{openingHours}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-6 text-slate-950">
          <p className="text-lg font-bold">Enquiry form placeholder</p>
          <p className="mt-2 text-slate-600">
            This block is ready for your website builder form fields later.
          </p>
        </div>
      </div>
    </section>
  );
}
