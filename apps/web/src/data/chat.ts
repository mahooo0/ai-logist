export type Channel = "whatsapp" | "telegram" | "instagram" | "messenger" | "email" | "livechat" | "sms";
export type ConversationStatus = "open" | "pending" | "resolved";
export type Sender = "customer" | "agent" | "bot";

export type Message = {
  id: string;
  sender: Sender;
  authorName?: string;
  text: string;
  time: string; // display label
  attachments?: { name: string; size: string; type?: string }[];
};

export type Conversation = {
  id: string;
  channel: Channel;
  status: ConversationStatus;
  customer: {
    name: string;
    handle: string; // @username, phone, email
    email?: string;
    phone?: string;
    location?: string;
    company?: string;
    tags?: string[];
    lastSeen?: string;
  };
  assignee?: { name: string; initials: string };
  unread: number;
  lastMessage: string;
  lastTime: string;
  pinned?: boolean;
  messages: Message[];
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  messenger: "Messenger",
  email: "Email",
  livechat: "Live chat",
  sms: "SMS",
};

export const CHANNEL_TINT: Record<Channel, string> = {
  whatsapp: "bg-emerald-500",
  telegram: "bg-sky-500",
  instagram: "bg-rose-500",
  messenger: "bg-blue-500",
  email: "bg-amber-500",
  livechat: "bg-violet-500",
  sms: "bg-zinc-500",
};

export const STATUS_TINT: Record<ConversationStatus, string> = {
  open: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  resolved: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
};

export const conversations: Conversation[] = [
  {
    id: "c1",
    channel: "whatsapp",
    status: "open",
    customer: {
      name: "Eddie Lake",
      handle: "+994 50 123 45 67",
      phone: "+994501234567",
      email: "eddie@acme.com",
      location: "Baku, AZ",
      company: "Acme Corp",
      tags: ["VIP", "Enterprise"],
      lastSeen: "Online",
    },
    assignee: { name: "You", initials: "YU" },
    unread: 2,
    lastMessage: "Got it — sending the wire details now. Anything else you need?",
    lastTime: "2m",
    pinned: true,
    messages: [
      { id: "m1", sender: "customer", text: "Hey! I'd like to upgrade our plan to Enterprise.", time: "9:31 AM" },
      {
        id: "m2",
        sender: "agent",
        authorName: "You",
        text: "Sure! I'll send over the wire instructions.",
        time: "9:32 AM",
      },
      {
        id: "m3",
        sender: "customer",
        text: "Perfect. Also — can we get an annual invoice instead of monthly?",
        time: "9:38 AM",
      },
      {
        id: "m4",
        sender: "agent",
        authorName: "You",
        text: "Yes, I can switch you to annual billing. You'll save ~15%.",
        time: "9:39 AM",
      },
      {
        id: "m5",
        sender: "customer",
        text: "Got it — sending the wire details now. Anything else you need?",
        time: "9:42 AM",
      },
    ],
  },
  {
    id: "c2",
    channel: "telegram",
    status: "pending",
    customer: {
      name: "Sevinc Aliyeva",
      handle: "@sevinc_a",
      location: "Istanbul, TR",
      company: "Studio Lumen",
      tags: ["Designer"],
      lastSeen: "Last seen 12m ago",
    },
    assignee: { name: "Jamik", initials: "JT" },
    unread: 1,
    lastMessage: "When can I expect feedback on the v2 mockups?",
    lastTime: "11m",
    messages: [
      { id: "m1", sender: "customer", text: "Sharing the v2 of the dashboard mocks 🎨", time: "Yesterday" },
      { id: "m2", sender: "customer", text: "When can I expect feedback on the v2 mockups?", time: "11m ago" },
    ],
  },
  {
    id: "c3",
    channel: "instagram",
    status: "open",
    customer: {
      name: "Rauf Mammadov",
      handle: "@rauf.mmd",
      location: "Baku, AZ",
      tags: ["Lead"],
      lastSeen: "Active now",
    },
    unread: 0,
    lastMessage: "Sounds good, I'll check the link tomorrow!",
    lastTime: "32m",
    messages: [
      { id: "m1", sender: "customer", text: "Saw your post about the new product, looks awesome!", time: "Yesterday" },
      { id: "m2", sender: "agent", authorName: "Bot", text: "Thanks! Want a 14-day trial link?", time: "Yesterday" },
      { id: "m3", sender: "customer", text: "Sounds good, I'll check the link tomorrow!", time: "32m ago" },
    ],
  },
  {
    id: "c4",
    channel: "livechat",
    status: "open",
    customer: {
      name: "Anonymous visitor",
      handle: "anon-2941",
      location: "Frankfurt, DE",
      tags: ["New"],
      lastSeen: "Browsing /pricing",
    },
    unread: 3,
    lastMessage: "Is the team plan billed per user or flat?",
    lastTime: "Just now",
    messages: [
      { id: "m1", sender: "bot", authorName: "Bot", text: "Hi! 👋 How can we help today?", time: "12:00 PM" },
      { id: "m2", sender: "customer", text: "Looking at your pricing page", time: "12:00 PM" },
      { id: "m3", sender: "customer", text: "Is the team plan billed per user or flat?", time: "12:01 PM" },
    ],
  },
  {
    id: "c5",
    channel: "email",
    status: "pending",
    customer: {
      name: "Leyla Quliyeva",
      handle: "leyla@partners.com",
      email: "leyla@partners.com",
      company: "Partners Co.",
      tags: ["Partner"],
      lastSeen: "—",
    },
    assignee: { name: "Aigars", initials: "AS" },
    unread: 0,
    lastMessage: "Forwarded the contract draft, please review by EOW.",
    lastTime: "1h",
    messages: [
      { id: "m1", sender: "customer", text: "Forwarded the contract draft, please review by EOW.", time: "1h ago" },
    ],
  },
  {
    id: "c6",
    channel: "messenger",
    status: "resolved",
    customer: {
      name: "Tural Babayev",
      handle: "Tural Babayev",
      tags: ["Customer"],
      lastSeen: "—",
    },
    assignee: { name: "You", initials: "YU" },
    unread: 0,
    lastMessage: "Perfect, thanks for the help!",
    lastTime: "Yesterday",
    messages: [
      { id: "m1", sender: "customer", text: "Hey, my login isn't working", time: "Yesterday" },
      {
        id: "m2",
        sender: "agent",
        authorName: "You",
        text: "Can you try resetting via the email link?",
        time: "Yesterday",
      },
      { id: "m3", sender: "customer", text: "Perfect, thanks for the help!", time: "Yesterday" },
    ],
  },
  {
    id: "c7",
    channel: "sms",
    status: "open",
    customer: {
      name: "+1 (415) 555-0102",
      handle: "+14155550102",
      phone: "+14155550102",
      tags: ["SMS"],
      lastSeen: "—",
    },
    unread: 1,
    lastMessage: "Yes, please confirm my order #4421",
    lastTime: "3h",
    messages: [{ id: "m1", sender: "customer", text: "Yes, please confirm my order #4421", time: "3h ago" }],
  },
  {
    id: "c8",
    channel: "whatsapp",
    status: "open",
    customer: {
      name: "Ali Hasanli",
      handle: "+994 55 987 65 43",
      phone: "+994559876543",
      location: "Ganja, AZ",
      tags: ["Customer"],
      lastSeen: "Online",
    },
    assignee: { name: "Jamik", initials: "JT" },
    unread: 0,
    lastMessage: "I'll send the documents in 10 minutes",
    lastTime: "5h",
    messages: [
      { id: "m1", sender: "customer", text: "Salam, I need to update my billing address", time: "5h ago" },
      {
        id: "m2",
        sender: "agent",
        authorName: "Jamik",
        text: "Send me a recent utility bill and we'll update.",
        time: "5h ago",
      },
      { id: "m3", sender: "customer", text: "I'll send the documents in 10 minutes", time: "5h ago" },
    ],
  },
];

export const QUICK_REPLIES = [
  { label: "Greeting", text: "Hi there! 👋 Thanks for reaching out — how can I help today?" },
  { label: "Wait", text: "One moment, let me check that for you." },
  { label: "Resolved", text: "Marking this as resolved for now — feel free to reply if anything else comes up." },
  { label: "Pricing", text: "You can find our pricing here: https://example.com/pricing" },
];
