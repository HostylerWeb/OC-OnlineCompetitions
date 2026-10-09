import { formatOrderNumber } from "@oc/utils";
import { Button, Hr, Row, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

interface ShopItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  image?: string;
}

interface ShopOrderConfirmationProps {
  userName: string;
  orderNumber: number;
  orderDate: string;
  items: ShopItem[];
  subtotal: number;
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    country: string;
  };
  frontendUrl: string;
}

function safeMoney(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export function ShopOrderConfirmationEmail({
  userName,
  orderNumber,
  orderDate,
  items,
  subtotal,
  total,
  shippingAddress,
  frontendUrl,
}: ShopOrderConfirmationProps) {
  return (
    <BaseEmail
      preview={`Your Online Competitions order confirmation (${formatOrderNumber(orderNumber)})`}
      frontendUrl={frontendUrl}
    >
      <Text className={emailStyles.heading.className}>Order Confirmed</Text>

      <Text className={emailStyles.paragraph.className}>
        Thanks {userName}, your order has been placed.
      </Text>

      <Section
        className="mb-[16px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[20px]"
        style={{ borderWidth: "1px", borderStyle: "solid" }}
      >
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Order Number
        </Text>
        <Text className="m-0 mb-[16px] text-[15px] font-mono font-semibold text-[#FFFFFF]">
          {formatOrderNumber(orderNumber)}
        </Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Order Date
        </Text>
        <Text className="m-0 text-[15px] font-semibold text-[#FFFFFF]">{orderDate}</Text>
      </Section>

      <Hr className={emailStyles.divider.className} />

      <Text className="mb-[16px] text-[17px] font-semibold text-[#FFFFFF]">Items</Text>

      <Section className="mb-[8px]">
        <Row>
          <Text className="m-0 text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
            Product
          </Text>
        </Row>
      </Section>

      {(items ?? []).map((item, index) => {
        const itemTotal = safeMoney(item.unitPrice) * item.quantity;
        return (
          <Section
            key={index}
            className="mb-[8px] rounded-[8px] border border-[#27272A] bg-[#0A0A0B] p-[12px]"
            style={{ borderWidth: "1px", borderStyle: "solid" }}
          >
            <Row>
              <Text className="m-0 text-[14px] text-[#FFFFFF]">{item.name}</Text>
            </Row>
            <Row className="mt-[4px]">
              <Text className="m-0 text-[12px] text-[#A1A1AA]">
                SKU: {item.sku} &nbsp;|&nbsp; Qty: {item.quantity} &nbsp;|&nbsp; Price: £
                {safeMoney(item.unitPrice).toFixed(2)} &nbsp;|&nbsp; Total: £{itemTotal.toFixed(2)}
              </Text>
            </Row>
          </Section>
        );
      })}

      <Hr className={emailStyles.divider.className} />

      <Section className="mt-[16px]">
        <Row className="mb-[4px]">
          <Text className="m-0 text-[14px] text-[#FFFFFF]">Subtotal:</Text>
          <Text className="m-0 text-right text-[14px] text-[#FFFFFF]">
            £{safeMoney(subtotal).toFixed(2)}
          </Text>
        </Row>
        <Row
          className="mt-[12px] pt-[12px]"
          style={{ borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#27272A" }}
        >
          <Text className="m-0 text-[17px] font-semibold text-[#D4AF37]">Total:</Text>
          <Text className="m-0 text-right text-[17px] font-semibold text-[#D4AF37]">
            £{safeMoney(total).toFixed(2)}
          </Text>
        </Row>
      </Section>

      <Hr className={emailStyles.divider.className} />

      <Text className="mb-[12px] text-[17px] font-semibold text-[#FFFFFF]">Shipping Address</Text>

      <Section
        className="mb-[16px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[16px]"
        style={{ borderWidth: "1px", borderStyle: "solid" }}
      >
        <Text className="m-0 text-[14px] text-[#FFFFFF]">
          {shippingAddress.firstName} {shippingAddress.lastName}
        </Text>
        <Text className="m-0 text-[14px] text-[#FFFFFF]">{shippingAddress.addressLine1}</Text>
        {shippingAddress.addressLine2 && (
          <Text className="m-0 text-[14px] text-[#FFFFFF]">{shippingAddress.addressLine2}</Text>
        )}
        <Text className="m-0 text-[14px] text-[#FFFFFF]">
          {shippingAddress.city}, {shippingAddress.postcode}
        </Text>
        <Text className="m-0 text-[14px] text-[#FFFFFF]">{shippingAddress.country}</Text>
      </Section>

      <Section className="my-[24px] text-center">
        <Button
          href={`${frontendUrl}/orders/${orderNumber}`}
          className={emailStyles.button.className}
        >
          View Order
        </Button>
      </Section>

      <Hr className={emailStyles.divider.className} />

      <Text className={emailStyles.muted.className}>
        If you have any questions about your order, please contact our support team.
      </Text>
    </BaseEmail>
  );
}

export default ShopOrderConfirmationEmail;
