import { AtSign, Camera, FileText, Globe, Mail, Newspaper, Phone, Send } from "lucide-react";
import type { Channel, ItemType } from "@/lib/types";

// Kanalen: klein monochroom icoon, geen merkkleuren.
const ICONS: Record<Channel, typeof Mail> = {
  linkedin: AtSign,
  instagram: Camera,
  email: Mail,
  phone: Phone,
  letter: Send,
  blog: Globe,
  newsletter: Newspaper,
};

export function ChannelIcon({ channel, size = 16 }: { channel: Channel; size?: number }) {
  const Icon = ICONS[channel] ?? FileText;
  return <Icon size={size} strokeWidth={1.5} aria-hidden />;
}

const CHANNEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  email: "E-mail",
  phone: "Bellen",
  letter: "Brief",
  blog: "Blog",
  newsletter: "Nieuwsbrief",
};
export const channelLabel = (c: Channel) => CHANNEL[c];

const TYPE: Record<ItemType, string> = {
  post: "post",
  carousel: "carrousel",
  reel: "reel",
  comment: "reactie",
  dm: "DM",
  connect: "connectie",
  email: "mail",
  call: "belkaart",
  letter: "brief",
  blog: "blog",
  newsletter: "nieuwsbrief",
  pitch: "linkpitch",
  brief: "blogbrief",
};
export const typeLabel = (t: ItemType) => TYPE[t];
