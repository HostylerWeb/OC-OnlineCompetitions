import { formatOrderNumber, formatTicketNumber } from "@oc/utils";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import type { EmailTemplateProps, OrderItem } from "../types";
import { BaseEmail, emailStyles } from "./base";

function safeMoney(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export function OrderConfirmationEmail({
  userName,
  orderId,
  orderNumber,
  orderDate,
  items,
  subtotal,
  discount,
  total,
  settings,
  frontendUrl,
  isGuest,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  const safeOrderId =
    typeof orderNumber === "number" && Number.isFinite(orderNumber)
      ? formatOrderNumber(orderNumber)
      : orderId && Number.isFinite(Number(orderId))
        ? formatOrderNumber(Number(orderId))
        : "N/A";
  return (
    <BaseEmail
      preview={`Your Online Competitions order #${safeOrderId} is confirmed!`}
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Text className={emailStyles.heading.className}>Order Confirmed!</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        Thank you for your order! Your tickets have been secured and you&apos;re now entered into
        the competition. Good luck!
      </Text>
      <Section
        className="mb-[16px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[20px]"
        style={{ borderWidth: "1px", borderStyle: "solid" }}
      >
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Order Number
        </Text>
        <Text className="m-0 mb-[16px] text-[15px] font-semibold text-[#FFFFFF]">
          #{safeOrderId}
        </Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Order Date
        </Text>
        <Text className="m-0 text-[15px] font-semibold text-[#FFFFFF]">{orderDate}</Text>
      </Section>
      <Hr className={emailStyles.divider.className} />
      <Text className="mb-[16px] text-[17px] font-semibold text-[#FFFFFF]">Order Details</Text>
      {(items ?? []).map((item: OrderItem, index: number) => {
        const qty = safeMoney(item.quantity);
        const unit = safeMoney(item.unitPrice);
        const total = safeMoney(item.totalPrice);
        const tickets = Array.isArray(item.ticketNumbers)
          ? item.ticketNumbers.map(formatTicketNumber).join(", ")
          : "";
        return (
          <Section
            key={index}
            className="mb-[12px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[16px]"
            style={{ borderWidth: "1px", borderStyle: "solid" }}
          >
            <Text className="m-0 mb-[8px] text-[15px] font-semibold text-[#FFFFFF]">
              {item.competitionTitle}
            </Text>
            <Text className="m-0 mb-[8px] text-[14px] text-[#A1A1AA]">
              {qty} ticket{qty > 1 ? "s" : ""} @ £{unit.toFixed(2)} each
            </Text>
            <Text className="m-0 mb-[8px] text-[14px] font-semibold text-[#D4AF37]">
              Ticket Numbers: {tickets}
            </Text>
            <Text className="m-0 text-right text-[15px] font-semibold text-[#FFFFFF]">
              £{total.toFixed(2)}
            </Text>
          </Section>
        );
      })}
      <Hr className={emailStyles.divider.className} />
      <Section className="mt-[16px]">
        <Text className="flex justify-between text-[14px] text-[#FFFFFF]">
          <span>Subtotal:</span>
          <span>£{safeMoney(subtotal).toFixed(2)}</span>
        </Text>
        {discount && safeMoney(discount) > 0 && (
          <Text className="flex justify-between text-[14px] text-[#22C55E]">
            <span>Discount:</span>
            <span>-£{safeMoney(discount).toFixed(2)}</span>
          </Text>
        )}
        <Text
          className="mt-[12px] flex justify-between border-t border-[#27272A] pt-[12px] text-[17px] font-semibold text-[#D4AF37]"
          style={{ borderTopWidth: "1px", borderTopStyle: "solid" }}
        >
          <span>Total:</span>
          <span>£{safeMoney(total).toFixed(2)}</span>
        </Text>
      </Section>
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.paragraph.className}>
        {isGuest
          ? "Your ticket details are included above. We'll notify you of any wins via email."
          : "You can view your tickets and track draw dates in your dashboard."}
      </Text>
      {!isGuest && (
        <Section className="my-[24px] text-center">
          <Button
            href={`${frontendUrl}/dashboard/tickets`}
            className={emailStyles.button.className}
          >
            View My Tickets
          </Button>
        </Section>
      )}
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Questions about your order? Contact us at{" "}
        <Link href={`mailto:${supportAddress}`} className="text-[#D4AF37] no-underline">
          {supportAddress}
        </Link>
      </Text>
      <Text className={emailStyles.paragraph.className}>
        Good luck!
        <br />
        The Online Competitions Team
      </Text>
    </BaseEmail>
  );
}

export default OrderConfirmationEmail;
