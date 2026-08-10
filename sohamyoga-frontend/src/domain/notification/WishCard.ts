// Birthday, anniversary, and special occasion wish cards — sent automatically or manually

export type WishOccasion = "birthday" | "member_anniversary" | "class_milestone" | "challenge_completed" | "custom";
export type WishCardStatus = "PENDING" | "SENT" | "OPENED" | "FAILED";

export interface WishCardProps {
  id: string;
  recipientId: string;
  senderId: string;       // "system" for automated, userId for manual
  occasion: WishOccasion;
  title: string;
  message: string;
  style: "simple" | "animated" | "photo" | "yoga_themed";
  imageUrl?: string;
  sharedLink?: string;    // public link recipient can share (e.g. /wish/abc123)
  channel: "email" | "whatsapp" | "in_app";
  status: WishCardStatus;
  scheduledAt: Date;
  sentAt?: Date;
  openedAt?: Date;
  metadata: Record<string, unknown>;
}

export class WishCard {
  constructor(private props: WishCardProps) {
    if (!props.message.trim()) throw new Error("Message is required");
    if (!props.title.trim()) throw new Error("Title is required");
  }

  get id()           { return this.props.id; }
  get recipientId()  { return this.props.recipientId; }
  get senderId()     { return this.props.senderId; }
  get occasion()     { return this.props.occasion; }
  get title()        { return this.props.title; }
  get message()      { return this.props.message; }
  get style()        { return this.props.style; }
  get imageUrl()     { return this.props.imageUrl; }
  get sharedLink()   { return this.props.sharedLink; }
  get channel()      { return this.props.channel; }
  get status()       { return this.props.status; }
  get scheduledAt()  { return this.props.scheduledAt; }

  isOpened(): boolean { return this.props.status === "OPENED"; }

  markSent(): WishCard    { return new WishCard({ ...this.props, status: "SENT", sentAt: new Date() }); }
  markOpened(): WishCard  { return new WishCard({ ...this.props, status: "OPENED", openedAt: new Date() }); }
  markFailed(): WishCard  { return new WishCard({ ...this.props, status: "FAILED" }); }

  withShareLink(link: string): WishCard {
    return new WishCard({ ...this.props, sharedLink: link });
  }

  toJSON(): WishCardProps { return { ...this.props, metadata: { ...this.props.metadata } }; }
}

// Template messages used in automated wish sending
export const WISH_TEMPLATES: Record<WishOccasion, { title: string; message: string }> = {
  birthday: {
    title: "Happy Birthday from SohamYoga! 🎂",
    message: "Wishing you a beautiful day filled with peace, joy, and perhaps a little yoga. May this year bring you strength on and off the mat! 🧘‍♀️",
  },
  member_anniversary: {
    title: "Happy Yoga Anniversary! 🌿",
    message: "It's been {years} year(s) since you joined SohamYoga. Your dedication to your practice inspires everyone. Thank you for being part of our community!",
  },
  class_milestone: {
    title: "You've reached {count} classes! 🏅",
    message: "What an incredible milestone! {count} classes of dedication, growth, and inner peace. You are an inspiration to our whole community.",
  },
  challenge_completed: {
    title: "Challenge Complete! {reward} 🏆",
    message: "You completed the '{challenge}' challenge! Your commitment is extraordinary. A special reward has been added to your profile.",
  },
  custom: {
    title: "A message from SohamYoga",
    message: "",
  },
};
