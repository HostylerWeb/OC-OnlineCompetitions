import { LEGAL_CONTACT_EMAIL } from "@oc/utils";
import type { FaqCategory, FaqItem } from "./content-types";

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: "general", name: "General" },
  { id: "competitions", name: "Competitions" },
  { id: "instant", name: "Instant wins" },
  { id: "milestones", name: "Milestones & bonus prizes" },
  { id: "responsible", name: "Responsible play" },
  { id: "referrals", name: "Referrals" },
  { id: "payment", name: "Payment" },
  { id: "delivery", name: "Shipping & Delivery" },
];

export const FAQS_BY_CATEGORY: Record<string, FaqItem[]> = {
  general: [
    {
      question: "How do I enter a competition?",
      answer:
        "Browse our competitions, select your desired prize, choose how many tickets you'd like to purchase, and complete the checkout process. You'll receive a confirmation email with your ticket numbers.",
    },
    {
      question: "How are winners selected?",
      answer:
        "Winners are selected using a verified random number generator (RNG) that picks a winning ticket number after the competition closes. The winner is notified via email within 7 days of the draw.",
    },
    {
      question: "When will the draw take place?",
      answer:
        "Each competition page shows the scheduled draw date and time. The advertised date is not brought forward because tickets sell quickly. The draw runs when that time is reached, using verifiable random selection.",
    },
    {
      question: "How will I know if I've won?",
      answer:
        "We'll email the winner at the email address used during purchase. The winner's name and prize will also be displayed on our Winners page. Make sure to keep your account email up to date.",
    },
    {
      question: "How long does prize delivery take?",
      answer:
        "Once winner verification is complete, prizes are typically dispatched within 14 working days. UK deliveries usually arrive within 5-7 working days.",
    },
    {
      question: "Can I get a refund on my tickets?",
      answer:
        "All ticket purchases are final and non-refundable. Competition entries remain valid even if the draw date changes.",
    },
    {
      question: "Are there any age restrictions?",
      answer:
        "Yes, you must be 18 years or older to participate in any competition. We verify age at sign-up and checkout, and reserve the right to verify winners.",
    },
    {
      question: "Can I enter for free by post?",
      answer:
        "Yes. Free postal entry is available for active competitions. Visit our Free Postal Entry page for the postal address and what to include (your full name, address, contact details, competition name, and your Online Competitions account email). Incomplete entries cannot be accepted.",
    },
    {
      question: "Can I buy tickets for someone else?",
      answer:
        "Yes, you can purchase tickets as a gift. The tickets will be assigned to your account, but you can notify us after the draw to update delivery details.",
    },
  ],
  competitions: [
    {
      question: "What is the skill question?",
      answer:
        "Some competitions ask one multiple-choice question before you can complete your entry. Answer it correctly to finish checkout. Competitions that do not show a skill question do not require one.",
    },
    {
      question: "Where do I see my ticket numbers?",
      answer:
        "After a successful purchase you receive a confirmation email. Your entries are also listed in your dashboard under My Tickets.",
    },
    {
      question: "What if the competition does not sell out?",
      answer:
        "The draw still takes place at the advertised date and time. Unsold tickets do not cancel the prize or move the draw earlier.",
    },
  ],
  instant: [
    {
      question: "What is an instant win?",
      answer:
        "An instant win is a separate prize revealed with your entry, in addition to the main competition prize. The competition page shows how many instant prizes are available and how many have been claimed.",
    },
    {
      question: "Can I pay for an instant-win competition with a credit card?",
      answer:
        "No. If your basket includes an instant-win competition, credit cards cannot be used. Debit cards, Apple Pay, and Google Pay remain available.",
    },
  ],
  milestones: [
    {
      question: "What is a milestone?",
      answer:
        "A milestone is an extra prize unlocked when a competition reaches a set percentage of tickets sold. The competition page lists each milestone and whether it has been reached.",
    },
    {
      question: "How are bonus prizes paid?",
      answer:
        "A bonus win is recorded on your account. Our team fulfils it after the win is confirmed.",
    },
  ],
  responsible: [
    {
      question: "Is there a limit on credit card spend?",
      answer:
        "Yes. Credit card spend is limited to £250 per calendar month across all competitions. Debit cards, Apple Pay, and Google Pay are not part of this cap. Checkout shows your remaining allowance when the limit applies.",
    },
    {
      question: "Can I set my own spending limit?",
      answer:
        "Yes. In your dashboard, open Responsible Play and set a monthly spend limit. A lower limit applies immediately. A higher limit applies after a 24-hour cooling-off period.",
    },
    {
      question: "How does self-exclusion work?",
      answer:
        "You can self-exclude for 6 months, 1 year, 5 years, or permanently from Responsible Play in your dashboard. While you are excluded, your account is suspended, marketing emails stop, and you cannot enter competitions. Contact us if you need help after a temporary exclusion expires.",
    },
  ],
  referrals: [
    {
      question: "How do referrals work?",
      answer:
        "Share your referral link from the dashboard. When a friend joins with your link and makes a qualifying purchase, you can earn free tickets.",
    },
    {
      question: "Where do free referral tickets go?",
      answer:
        "They are added to your referral ticket wallet. At checkout you can apply those tickets to items in your basket before you pay.",
    },
  ],
  payment: [
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit and debit cards including Visa, Mastercard, and American Express. Apple Pay and Google Pay are also supported for faster checkout.",
    },
    {
      question: "Is my payment information secure?",
      answer:
        "Absolutely. All payments are processed through our secure payment platform. We never store your card details.",
    },
    {
      question: "Can I use a promo code?",
      answer:
        "Yes, you can enter a promo code at checkout for discounts or bonus tickets. Promo codes cannot be combined with other offers and have expiry dates.",
    },
  ],
  delivery: [
    {
      question: "Do you ship internationally?",
      answer:
        "Yes, we ship to most countries worldwide. International shipping costs and delivery times vary by destination. All customs duties and import taxes are the responsibility of the recipient.",
    },
    {
      question: "What happens if I'm not home for delivery?",
      answer:
        "The courier will usually attempt delivery twice before returning the package. We recommend providing a safe location or office address for prize deliveries.",
    },
  ],
};

export const FAQ_SUPPORT_EMAIL = LEGAL_CONTACT_EMAIL;
