export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  author: string;
  authorRole: string;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  category: string;
  body: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-go-paperless-as-a-gas-engineer",
    title: "How to Go Paperless as a Gas Engineer",
    description:
      "A practical guide for gas engineers ready to ditch paper records and move to digital job management. Covers Gas Safe compliance, choosing software, and getting your team on board.",
    author: "James Harrison",
    authorRole: "Gas Safe Registered Engineer & TradeWorkDesk Founder",
    publishedAt: "2025-09-12",
    updatedAt: "2026-01-15",
    readingTimeMinutes: 7,
    category: "Guides",
    body: `Going paperless is no longer a nice-to-have for gas engineers — it's becoming essential. Between rising customer expectations, tightening compliance requirements, and the sheer hassle of managing filing cabinets full of service records, the case for digital has never been stronger.

## Why Paper Records Are a Liability

Every gas engineer knows the drill: you finish a job, fill out the paperwork in the van, and file it when you get back to the office — if you remember. Paper records get lost, damaged, and misfiled. Worse, when Gas Safe inspectors come calling, you need to produce records quickly or face consequences.

Paper also slows you down. Searching through folders for a customer's service history, chasing signatures, photocopying certificates — it all adds up. A typical engineer loses 3-5 hours per week on admin that could be handled digitally.

### The real cost of paper

- **Time**: Manual data entry, filing, and retrieval eat into billable hours
- **Errors**: Illegible handwriting leads to wrong part numbers, missed details
- **Compliance risk**: Lost records mean you can't prove work was completed to standard
- **Customer experience**: Customers expect digital receipts and instant access to their records

## What Records Must Be Digital

Under current Gas Safe regulations, you must retain records of all gas work for at least two years. While there's no requirement to store them digitally, electronic records are accepted and often preferred during inspections because they're searchable and verifiable.

Key records to digitise:

1. **Service and maintenance records** — including CP12/landlord certificates
2. **Breakdown reports** — documenting faults found and work carried out
3. **Commissioning records** — for new installations
4. **Risk assessments** — especially for oil tank installations
5. **Customer signatures** — digital signatures are legally valid under UK law

## Choosing the Right Software

Not all job management software is built for gas engineers. Here's what to look for:

### Must-have features

- **Pre-built gas forms** — Service records, breakdown reports, and commissioning forms that match industry standards
- **Digital signatures** — Capture customer sign-off on site
- **Photo and file attachments** — Document the job visually
- **Offline access** — You can't rely on mobile signal in every boiler cupboard
- **Customer and property records** — Link jobs to specific addresses and appliances

### Nice-to-have features

- Automatic PDF generation for customer certificates
- Integration with accounting software
- Team scheduling and job assignment
- Parts inventory tracking

### What to avoid

- Generic field service apps that don't understand gas industry requirements
- Software that forces you into long contracts
- Platforms without UK-based support

## Getting Your Team On Board

The biggest barrier to going paperless isn't the technology — it's people. Here's how to make the transition smooth:

1. **Start with one form**: Don't try to digitise everything at once. Pick your most-used form (usually the service record) and get comfortable with it
2. **Run paper and digital in parallel**: Keep paper as a backup for the first month while everyone learns
3. **Make it mandatory**: Set a hard date when paper forms stop being accepted. Without a deadline, adoption stalls
4. **Lead by example**: If you're the boss, use the app first. Engineers follow what management does

## Frequently Asked Questions

**Is a digital signature legally valid in the UK?**
Yes. Under the Electronic Communications Act 2000 and the eIDAS regulation, electronic signatures are legally binding in the UK for most contracts and service records.

**Can Gas Safe inspectors accept digital records?**
Yes. Gas Safe Register accepts electronic records during inspections. Digital records are often easier to review because they're searchable and consistently formatted.

**What if I don't have mobile signal on site?**
Good job management software works offline and syncs when you're back in signal. Always check this before choosing a platform.

**How long does it take to go fully paperless?**
Most small teams (1-5 engineers) can transition within 4-6 weeks. Larger teams may take 2-3 months for full adoption.`,
  },
  {
    slug: "gas-safe-record-keeping-guide",
    title: "Gas Safe Record Keeping: What Engineers Must Know",
    description:
      "Everything gas engineers need to know about Gas Safe record keeping requirements, retention periods, and how to stay compliant during inspections.",
    author: "James Harrison",
    authorRole: "Gas Safe Registered Engineer & TradeWorkDesk Founder",
    publishedAt: "2025-10-03",
    updatedAt: "2026-02-10",
    readingTimeMinutes: 6,
    category: "Compliance",
    body: `Record keeping is one of the most important — and most overlooked — responsibilities for Gas Safe registered engineers. Getting it wrong can result in formal warnings, conditions on your registration, or in serious cases, removal from the Gas Safe Register entirely.

## What Gas Safe Requires

Gas Safe Register requires all registered engineers to maintain accurate records of gas work carried out. This isn't optional guidance — it's a condition of your registration.

### Minimum record requirements

For every gas job you complete, you must record:

- **Customer name and address** — including the specific property if a landlord has multiple
- **Date of work** — when the job was carried out
- **Type of work** — service, repair, installation, or inspection
- **Appliance details** — manufacturer, model, type (boiler, fire, cooker, etc.)
- **Results of safety checks** — flue gas readings, gas rate, pressure tests
- **Any defects found** — and the action taken (repair, condemn, advise)
- **Engineer details** — your name, Gas Safe registration number, and ID card number

### Retention periods

You must keep records for a **minimum of two years** from the date the work was completed. However, best practice is to retain records for at least six years to align with:

- The Limitation Act 1980 (six-year statute of limitations for contract disputes)
- Landlord gas safety certificate requirements (annual renewal means historical records are frequently needed)
- Insurance claim timescales

## Common Record Keeping Mistakes

After years of working with gas engineers, these are the most common mistakes we see:

### 1. Incomplete service records

Many engineers record the basics but skip the detail. If you're not recording combustion readings, operating pressures, and visual inspection results, your records won't stand up to scrutiny.

### 2. No audit trail for unsafe situations

When you find an appliance that's Immediately Dangerous (ID) or At Risk (AR), you must document exactly what you found, what action you took, and that you informed the responsible person. A verbal warning isn't enough — it needs to be recorded.

### 3. Failing to link records to properties

Recording work against a customer name but not a specific property address creates problems when landlords have multiple properties. Always record the full address of the property where work was carried out.

### 4. Poor signature management

Customer signatures confirm they've been informed of the results of your work. Without a signature, it's your word against theirs. Digital signatures are now widely accepted and create a cleaner audit trail.

## How to Organise Your Records

The most effective approach is to organise records by **property**, not by customer or date. Here's why:

- Gas Safe inspectors will ask about work at a specific property
- Landlords need records linked to specific rental addresses
- Appliance history is tied to the property, not the person

A good structure looks like:

**Customer → Property → Appliance → Job records**

This hierarchy means you can instantly find every piece of work done at a property, on a specific appliance, in chronological order.

## Preparing for a Gas Safe Inspection

When Gas Safe calls, they'll typically want to see:

1. Records of recent work (last 6-12 months)
2. Evidence that unsafe situations were handled correctly
3. That your records match what's physically on site
4. Completed documentation for any installations

Having organised, searchable digital records makes inspections faster and less stressful. Inspectors appreciate engineers who can pull up records instantly rather than rummaging through a van full of carbon copies.

## Frequently Asked Questions

**Can I keep records on my phone?**
Yes, provided they're backed up and you can produce them when required. Cloud-based systems are ideal because they're accessible from any device and automatically backed up.

**Do I need to keep records for work I didn't charge for?**
Yes. If you carried out gas work, it must be recorded regardless of whether you charged for it. This includes warranty callbacks and goodwill visits.

**What happens if I lose my records?**
If you can't produce records during a Gas Safe inspection, it may result in a formal warning or conditions placed on your registration. In repeated cases, it could lead to removal from the register.

**Are digital records accepted by Gas Safe?**
Yes. Gas Safe Register accepts electronic records and many inspectors prefer them because they're typically more complete and easier to review.`,
  },
  {
    slug: "best-software-for-heating-engineers",
    title: "Best Software for Heating Engineers in 2025",
    description:
      "A comparison of the top job management software options for heating engineers in 2025. What to look for, what to avoid, and how to choose the right platform for your business.",
    author: "James Harrison",
    authorRole: "Gas Safe Registered Engineer & TradeWorkDesk Founder",
    publishedAt: "2025-11-15",
    updatedAt: "2026-03-01",
    readingTimeMinutes: 8,
    category: "Reviews",
    body: `Finding the right software for a heating and plumbing business isn't straightforward. Most job management platforms are built for general field service — electrical, HVAC, landscaping — and don't understand the specific needs of gas, oil, and heat pump engineers or plumbers working in the UK market.

## What Heating Engineers Actually Need

Before comparing platforms, it's worth being clear about what a heating engineer's day-to-day actually looks like, because this drives the requirements:

### Daily workflow
1. Receive job details (customer call, landlord request, or scheduled service)
2. Travel to site with relevant history and appliance details
3. Carry out work — service, repair, or install
4. Complete paperwork — service records, safety checks, commissioning forms
5. Get customer sign-off
6. Update job status and move to next job

### Industry-specific needs
- **Gas Safe compliant forms** — Service records, breakdown reports, and commissioning records that meet regulatory standards
- **Appliance tracking** — Record make, model, GC number, and location for every appliance serviced
- **Landlord gas safety certificates** — Annual CP12 certificates linked to properties
- **Oil industry forms** — OFTEC-compliant records for oil boiler engineers
- **Heat pump documentation** — As the industry shifts, MCS-compliant commissioning records are increasingly important

## Key Features to Evaluate

### 1. Job management
At minimum, you need to be able to create, assign, schedule, and track jobs. Look for software that lets you see all jobs at a glance, filter by status, and drill into details without excessive clicking.

### 2. Customer and property records
A centralised database of customers, their properties, and the appliances at each property is essential. This saves time on repeat visits and gives you instant access to service history.

### 3. Digital forms
This is where most generic software falls short. You need forms that are specifically designed for gas work — not generic "inspection" templates that require customisation. Pre-built forms save hours of setup time and ensure consistency.

### 4. Mobile experience
Engineers live on their phones. The software must work well on mobile devices, load quickly, and ideally work offline for sites with poor signal.

### 5. Reporting
Being able to generate reports — jobs completed, revenue per month, overdue services — helps you manage the business, not just the jobs.

### 6. Team features
If you have more than one engineer, you need job assignment, user roles (admin vs technician), and visibility into who's doing what.

## What to Avoid

**Long contracts**: Monthly rolling is standard now. Any platform asking for 12+ month commitments is a red flag.

**Per-engineer pricing that scales aggressively**: Some platforms are cheap for one user but become expensive quickly. Check the 5-user and 10-user price before committing.

**Overseas support only**: When you're stuck on a form at a customer's house, you need support that understands UK gas regulations, not a chatbot.

**Mandatory hardware**: Some platforms try to sell tablets or other hardware. Your engineers already have phones — the software should work on them.

## Making the Switch

If you're currently using paper, spreadsheets, or a generic platform, switching to purpose-built software for heating engineers typically pays for itself within the first month through:

- **Time savings**: 3-5 hours per engineer per week on admin
- **Fewer missed follow-ups**: Automated reminders for annual services
- **Better cash flow**: Faster invoicing when jobs are completed digitally
- **Reduced compliance risk**: Complete, consistent records for every job

The key is to choose a platform that was built specifically for your trade, not adapted from a general-purpose tool.

## Frequently Asked Questions

**How much should I expect to pay?**
Purpose-built software for heating engineers typically costs between £29-£99 per month depending on team size and features. Be wary of platforms significantly cheaper (they're usually missing key features) or significantly more expensive (you're paying for features you won't use).

**Can I import my existing customer data?**
Most modern platforms support CSV imports for customer data. Some also offer migration assistance to help you bring across property and appliance records.

**Do I need to train my team?**
Good software should be intuitive enough that basic training takes less than an hour. If a platform requires days of training, it's probably too complex for field use.

**What about GDPR compliance?**
Any UK-based platform should handle GDPR compliance for you, including secure data storage, data retention policies, and customer data export/deletion capabilities.`,
  },
  {
    slug: "managing-boiler-service-contracts",
    title: "How to Manage Boiler Service Contracts More Efficiently",
    description:
      "Practical tips for heating companies on managing annual boiler service contracts, reducing missed appointments, and improving customer retention.",
    author: "James Harrison",
    authorRole: "Gas Safe Registered Engineer & TradeWorkDesk Founder",
    publishedAt: "2025-12-08",
    updatedAt: "2026-02-20",
    readingTimeMinutes: 6,
    category: "Business",
    body: `Service contracts are the bread and butter of most heating engineering businesses. A well-managed contract book provides predictable revenue, keeps your engineers busy during quiet periods, and builds long-term customer relationships. But managing hundreds or thousands of annual service dates manually is where many businesses struggle.

## The Service Contract Challenge

The basic maths are simple: if you service 500 boilers annually, that's roughly 10 per week, every week. Each one needs to be scheduled within a reasonable window of its due date, confirmed with the customer, completed, and invoiced.

In practice, this means:

- Tracking 500+ service dates across multiple engineers
- Sending reminders to customers 4-6 weeks before their service is due
- Dealing with cancellations, reschedules, and no-access situations
- Ensuring no services fall through the cracks
- Managing the paperwork for each completed service

### What goes wrong

Most heating companies that struggle with contract management fall into one of these traps:

1. **Relying on memory or a wall calendar** — Works until you reach about 50 contracts, then services start getting missed
2. **Spreadsheet overload** — Excel can track dates, but it can't send reminders, assign jobs to engineers, or store service records
3. **No-access black holes** — When a customer doesn't answer, the job gets pushed back indefinitely and eventually forgotten
4. **Seasonal bunching** — If most customers signed up in autumn, you're overwhelmed October-December and quiet in spring

## Building a Better System

### 1. Centralise your service dates

Every contract should live in one system — not split between a diary, a spreadsheet, and your memory. Each entry needs:

- Customer name and contact details
- Property address
- Appliance details (make, model, type)
- Last service date
- Next service due date
- Contract type (annual, biannual, landlord)
- Any special notes (parking, access codes, pets)

### 2. Automate reminders

Customers should receive a reminder 4-6 weeks before their service is due, with a second reminder 1-2 weeks before if they haven't responded. This dramatically reduces the time your office staff spend chasing appointments.

### 3. Handle no-access systematically

Create a clear escalation process:

1. **First attempt**: If the customer doesn't respond to reminders, try calling
2. **Second attempt**: Send a letter or text message
3. **Third attempt**: For landlords, notify the letting agent or landlord directly
4. **Final notice**: Record that you've made reasonable attempts to arrange access

Document every step. For landlord properties, this is especially important — they need evidence that they tried to arrange the safety check.

### 4. Spread the load

If your contract book is heavily weighted to certain months, actively work to rebalance it. When customers miss their window, reschedule them to a quieter month rather than cramming them into the next available slot in the busy period.

### 5. Track renewal rates

Your renewal rate tells you how healthy your business is. Aim for 85%+ retention on service contracts. If you're below that, find out why:

- Are customers leaving for competitors?
- Is price an issue?
- Are you failing to follow up with non-renewals?

## The Revenue Impact

Good contract management directly affects your bottom line. Consider:

- A missed service is lost revenue (typically £80-£120)
- A missed service is also a missed opportunity to identify repair work
- Customers who miss their service are more likely to leave your contract
- Landlords who miss their gas safety check are legally exposed — and will blame you

If you're missing even 5% of your annual services, that's 25 lost jobs per year on a 500-boiler book — potentially £2,500-£3,000 in direct revenue, plus lost repair opportunities.

## Frequently Asked Questions

**How far in advance should I schedule annual services?**
Start the scheduling process 6 weeks before the due date. This gives enough time for reminders, responses, and rescheduling if needed.

**What's a good target for same-month completion?**
Aim to complete 90%+ of services in their due month. Anything below 80% suggests your scheduling process needs attention.

**Should I offer multi-year contracts?**
Multi-year contracts with a small discount (5-10%) improve retention and cash flow predictability. They also reduce the admin overhead of annual renewals.

**How do I handle price increases on contracts?**
Communicate price changes 3 months before renewal with a clear explanation. Increases of 3-5% annually are generally accepted without pushback if the service quality is good.`,
  },
  {
    slug: "heat-pump-service-software",
    title: "Heat Pump Service Software: What to Look For",
    description:
      "As heat pumps grow in the UK, engineers need software that handles MCS compliance, commissioning records, and performance monitoring. Here's what to look for.",
    author: "James Harrison",
    authorRole: "Gas Safe Registered Engineer & TradeWorkDesk Founder",
    publishedAt: "2026-01-20",
    updatedAt: "2026-03-10",
    readingTimeMinutes: 6,
    category: "Technology",
    body: `The UK heat pump market is growing rapidly. With the government's target to install 600,000 heat pumps per year by 2028 and the phase-out of new gas boiler installations from 2035, heating engineers who don't adapt will be left behind. But adapting isn't just about training — it's about having the right tools to manage heat pump installations and servicing.

## Why Heat Pumps Need Different Software

Heat pumps aren't just boilers with a different energy source. They require fundamentally different documentation, commissioning procedures, and ongoing monitoring:

### Different commissioning requirements
A gas boiler commissioning is relatively straightforward — benchmark the appliance, record gas rate and flue readings, job done. Heat pump commissioning involves:

- System design verification (heat loss calculations, emitter sizing)
- Refrigerant circuit checks
- Flow rate measurements
- Performance coefficient calculations (COP)
- MCS compliance documentation
- Noise level assessments
- Customer handover documentation

### MCS compliance
If you're installing heat pumps under the Microgeneration Certification Scheme (MCS) — which you need to be for customers to receive the Boiler Upgrade Scheme grant — your documentation requirements are extensive. MCS auditors will check that your commissioning records are complete and accurate.

### Ongoing performance monitoring
Unlike gas boilers, which are serviced annually with a relatively standard procedure, heat pumps benefit from performance monitoring over time. Tracking seasonal performance factors, energy consumption, and system efficiency helps identify problems before they become failures.

## Essential Features for Heat Pump Software

### 1. MCS-compliant commissioning forms
Your software needs commissioning forms that capture all the data points required for MCS certification. This includes heat loss calculations, design flow temperatures, measured COP, and refrigerant charge verification.

### 2. Heat pump-specific service records
Annual servicing of a heat pump is different from servicing a gas boiler. Your service record forms need fields for:

- Refrigerant pressures and temperatures
- Defrost cycle operation
- Compressor current draw
- Antifreeze concentration
- Filter condition
- Outdoor unit condition and airflow
- System performance vs design parameters

### 3. System design documentation
For MCS compliance, you need to store the original system design alongside the installation records. This includes heat loss calculations, emitter schedules, pipe sizing, and buffer/cylinder specifications.

### 4. Photo documentation
Heat pump installations are complex, and inspectors want to see photographic evidence of key stages. Your software should make it easy to attach and organise photos against specific jobs.

### 5. Integration with existing workflows
Most heating companies won't switch entirely to heat pumps overnight. You need software that handles both gas boiler work and heat pump work in the same system, so you're not running two separate platforms.

## Planning for the Transition

If you're a gas engineer looking to add heat pumps to your offering, here's a practical transition plan:

### Phase 1: Training and certification
Complete your heat pump training (Level 3 Award in the Installation and Maintenance of Heat Pump Systems or equivalent) and apply for MCS certification.

### Phase 2: Software setup
Ensure your job management software can handle heat pump commissioning and service records. If it can't, now is the time to switch to a platform that supports both gas and heat pump work.

### Phase 3: First installations
Start with straightforward retrofit installations (replacing an existing system with an air source heat pump) where the design is simpler. Document everything meticulously — these early records will form your portfolio for MCS audits.

### Phase 4: Scaling
Once you're comfortable with the installation process and documentation, start marketing heat pump services alongside your existing gas work. Your existing customer base is your best source of heat pump leads — they already trust you.

## The Business Case

Heat pump installations are significantly higher value than gas boiler replacements:

- Average air source heat pump installation: £8,000-£15,000
- Average gas boiler replacement: £2,500-£4,500
- Annual heat pump service: £120-£200 (vs £80-£120 for a gas boiler)

The Boiler Upgrade Scheme currently offers £7,500 towards air source heat pump installations, making them increasingly competitive with gas alternatives. Engineers who position themselves early will benefit from less competition and growing demand.

## Frequently Asked Questions

**Do I need separate software for heat pump work?**
No. The best approach is a single platform that handles both gas and heat pump work. This keeps all your customer records, job history, and documentation in one place.

**What training do I need before installing heat pumps?**
At minimum, you need the Level 3 Award in the Installation and Maintenance of Heat Pump Systems. For MCS certification, you'll also need to demonstrate competence through assessed installations.

**Can I use my existing Gas Safe forms for heat pump work?**
No. Heat pump work requires different forms and documentation. Gas Safe forms are specifically for gas appliances. Heat pump commissioning and service records have different data requirements.

**How long does MCS certification take?**
The application process typically takes 4-8 weeks from submission. You'll need to have completed your training, have appropriate insurance, and demonstrate your competence through documented installations.`,
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getRelatedPosts(currentSlug: string, limit = 3): BlogPost[] {
  const current = getPostBySlug(currentSlug);
  if (!current) return blogPosts.slice(0, limit);
  return blogPosts
    .filter((p) => p.slug !== currentSlug)
    .sort((a, b) => (a.category === current.category ? -1 : 1))
    .slice(0, limit);
}
