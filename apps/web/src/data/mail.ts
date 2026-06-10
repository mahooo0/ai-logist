export type MailFolder = "inbox" | "starred" | "sent" | "drafts" | "spam" | "trash" | "archive";
export type MailLabel = "work" | "personal" | "team" | "billing" | "social";

export type Mail = {
  id: string;
  from: { name: string; email: string };
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  folder: MailFolder;
  labels: MailLabel[];
  hasAttachment?: boolean;
};

export const LABEL_COLORS: Record<MailLabel, string> = {
  work: "bg-sky-500",
  personal: "bg-emerald-500",
  team: "bg-violet-500",
  billing: "bg-amber-500",
  social: "bg-rose-500",
};

export const mails: Mail[] = [
  {
    id: "m1",
    from: { name: "Eddie Lake", email: "eddie@acme.com" },
    to: "you@company.com",
    subject: "Q3 forecast — review needed before 2pm",
    preview:
      "Hey, can you review the assumptions section in the Q3 forecast? I've added comments inline and would love your sign-off before…",
    body: "Hey,\n\nCan you review the assumptions section in the Q3 forecast? I've added comments inline and would love your sign-off before the partner sync at 2pm today.\n\nKey items:\n• Revenue mix assumes 60/40 split (was 50/50)\n• CAC payback shortened from 14 → 11 months\n• Churn floor reset to 1.8% MoM\n\nLet me know what looks off.\n\nThanks,\nEddie",
    date: "9:42 AM",
    read: false,
    starred: true,
    folder: "inbox",
    labels: ["work", "team"],
    hasAttachment: true,
  },
  {
    id: "m2",
    from: { name: "GitHub", email: "noreply@github.com" },
    to: "you@company.com",
    subject: "[zenith/admin] PR #482 was merged into main",
    preview:
      "Your pull request was successfully merged. The deploy to production has been triggered automatically and will be available in…",
    body: "Your pull request was successfully merged.\n\nPR #482 — Add notifications sheet and customize panel\nMerged by Jamik Tashpulatov · main\n\nThe deploy to production has been triggered automatically and will be available in approximately 4 minutes.\n\nView the deploy: https://vercel.com/zenith/admin/deployments",
    date: "9:14 AM",
    read: false,
    starred: false,
    folder: "inbox",
    labels: ["work"],
  },
  {
    id: "m3",
    from: { name: "Stripe", email: "receipts@stripe.com" },
    to: "you@company.com",
    subject: "Your receipt from Acme Inc. — $248.00",
    preview:
      "Thank you for your purchase. Your receipt is attached. If you need a tax invoice, you can request one from your billing portal.",
    body: "Thank you for your purchase.\n\nReceipt #1041-AC\nAmount: $248.00 USD\nPaid via: Visa •••• 4242\n\nIf you need a tax invoice, you can request one from your billing portal at any time.\n\n— Stripe",
    date: "Yesterday",
    read: true,
    starred: false,
    folder: "inbox",
    labels: ["billing"],
    hasAttachment: true,
  },
  {
    id: "m4",
    from: { name: "Sevinc Aliyeva", email: "sevinc@design.studio" },
    to: "you@company.com",
    subject: "Mockups for the new dashboard — feedback?",
    preview:
      "Hi! Sharing v2 of the mocks. I tried two density options and a softer color palette — let me know which direction feels better.",
    body: "Hi!\n\nSharing v2 of the dashboard mocks. I tried two density options (Comfortable / Spacious) and a softer color palette — let me know which direction feels better.\n\nFigma: https://figma.com/file/abc/zenith-dashboard\n\nNo rush on this one.\n\nCheers,\nSevinc",
    date: "Yesterday",
    read: true,
    starred: true,
    folder: "inbox",
    labels: ["work", "team"],
  },
  {
    id: "m5",
    from: { name: "Mom", email: "mom@home.example" },
    to: "you@company.com",
    subject: "Sunday lunch?",
    preview: "Are you free this Sunday for lunch? Your sister will be here too. Don't forget the bread :)",
    body: "Hi sweetheart,\n\nAre you free this Sunday for lunch? Your sister will be here too — she's bringing the kids. Don't forget the bread you promised :)\n\nLove,\nMom",
    date: "2 days ago",
    read: true,
    starred: false,
    folder: "inbox",
    labels: ["personal"],
  },
  {
    id: "m6",
    from: { name: "LinkedIn", email: "messages@linkedin.com" },
    to: "you@company.com",
    subject: "5 new messages and 12 connection requests",
    preview:
      "You have new opportunities in your network. See who viewed your profile this week and discover roles tailored to…",
    body: "You have new opportunities in your network.\n\nSee who viewed your profile this week and discover roles tailored to your skills.\n\nView on LinkedIn →",
    date: "3 days ago",
    read: true,
    starred: false,
    folder: "inbox",
    labels: ["social"],
  },
  {
    id: "m7",
    from: { name: "Vercel", email: "team@vercel.com" },
    to: "you@company.com",
    subject: "Build failed — production",
    preview:
      "Your latest deploy to production failed. The error log shows a missing environment variable for STRIPE_SECRET_KEY…",
    body: "Your latest deploy to production failed.\n\nProject: zenith/admin\nCommit: 1ff6eab — chore: update deps\n\nError:\n  Missing required environment variable STRIPE_SECRET_KEY\n\nFix the env var in your Vercel project settings and redeploy.",
    date: "4 days ago",
    read: true,
    starred: false,
    folder: "inbox",
    labels: ["work"],
  },
  {
    id: "m8",
    from: { name: "You", email: "you@company.com" },
    to: "ali@partners.com",
    subject: "RE: Partnership terms — counter proposal",
    preview: "Thanks Ali, here's our counter on the volume tier pricing. Happy to jump on a call if it helps.",
    body: "Thanks Ali, here's our counter on the volume tier pricing. Happy to jump on a call if it helps.\n\nBest,",
    date: "Mar 11",
    read: true,
    starred: false,
    folder: "sent",
    labels: ["work"],
  },
  {
    id: "m9",
    from: { name: "You", email: "you@company.com" },
    to: "team@company.com",
    subject: "Draft: Q4 OKRs",
    preview: "Pasting our Q4 OKRs here for review — still working on the metrics for #3.",
    body: "Pasting our Q4 OKRs here for review — still working on the metrics for #3.",
    date: "Mar 9",
    read: true,
    starred: false,
    folder: "drafts",
    labels: ["work"],
  },
];
