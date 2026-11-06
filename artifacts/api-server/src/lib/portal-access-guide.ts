type PortalAccessGuideOptions = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  loginUrl: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
} & (
  | { isRegistered: true }
  | { isRegistered: false; registerUrl: string; inviteExpiresAt: string }
);

export function buildPortalAccessGuide(options: PortalAccessGuideOptions): string {
  const gettingStarted = options.isRegistered
    ? `1. SIGN IN TO YOUR EXISTING ACCOUNT
Your customer portal account is already set up. You do not need to register again or request access.
Open: ${options.loginUrl}
Enter ${options.customerEmail} and the password you chose when registering, then select "Sign In".`
    : `1. CREATE YOUR ACCOUNT
Open your personal invitation link:
${options.registerUrl}
Use ${options.customerEmail}, choose a password of at least 8 characters, enter it again to confirm, then select "Create Account".
This invitation expires on ${new Date(options.inviteExpiresAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "long", timeStyle: "short" })} (UK time). If it has expired, contact us for a new invitation.
Once your account is created, select "Sign In" and use your email and chosen password. If the invitation says it has already been used, sign in with your existing account instead.`;

  const contact = [
    options.contactEmail ? `Email: ${options.contactEmail}` : "",
    options.contactPhone ? `Phone: ${options.contactPhone}` : "",
  ].filter(Boolean).join("\n");

  return `Dear ${options.customerName},

Here is your complete guide to accessing the ${options.companyName} customer portal. You can use it in a web browser on your phone, tablet or computer; no app installation is required.

${gettingStarted}

2. RETURNING TO THE PORTAL
Save or bookmark this sign-in page for future visits:
${options.loginUrl}
Your sign-in email is: ${options.customerEmail}
Use the Customer Portal sign-in page, not the TradeWorkDesk business/staff login.

3. FORGOTTEN YOUR PASSWORD?
Open ${options.loginUrl}
Enter your email address and select "Forgot your password?".
Check your inbox and spam/junk folder for the password-reset email. Open its link, choose a new password of at least 8 characters and confirm it.
Then return to the customer portal sign-in page above and sign in with your new password.
Password reset is for accounts that have already been registered. If you have not created your account yet, use your invitation first.

4. FINDING YOUR INFORMATION
Dashboard: see an overview of your records and upcoming work.
Properties: open a property to view its details and appliances.
Jobs: view appointments and service history, and open available certificates or reports.
Invoices: view invoices and quotes, download available PDFs, respond to quotes, and pay online where a payment option is offered.
On a phone, use the navigation links below the portal header.
Only records and documents made available by ${options.companyName} will appear. If something is missing or incorrect, contact us.

5. TROUBLE SIGNING IN?
Check that you are using ${options.customerEmail} and the correct password.
If you already registered, use "Forgot your password?" rather than "Request Access".
If access is disabled, an invitation has expired, or you still cannot sign in, contact us and describe the message shown on screen. Never send us your password.

6. KEEP YOUR ACCOUNT SAFE
Keep your password and personal invitation link private. Select "Sign Out" when finished, especially on a shared device.

Need help? Contact ${options.companyName}${contact ? `:\n${contact}` : " using your usual contact details."}

Kind regards,
${options.companyName}`;
}
