import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orders } from "@/db/schema";
import { getSettings } from "@/lib/store";
import { DELIVERY_LABELS, STATUS_LABELS, formatXAF, waLink } from "@/lib/utils";

/**
 * Transactional messaging (§5, §12.2).
 *
 * Every message is written to `notifications` first, then delivery is
 * attempted. If no provider key is configured the row stays queued rather than
 * failing — staff can still see exactly what should go out, and the WhatsApp
 * deep link on the order page lets them send it by hand. This keeps the shop
 * usable before the business has signed up with a provider.
 */

type Channel = "email" | "whatsapp" | "sms";

async function record(row: {
  orderId?: number | null;
  appointmentId?: number | null;
  channel: Channel;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  error?: string;
}) {
  await db.insert(notifications).values({
    orderId: row.orderId ?? null,
    appointmentId: row.appointmentId ?? null,
    channel: row.channel,
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    status: row.status,
    error: row.error ?? "",
  });
}

/** Sends through Resend when RESEND_API_KEY is present; queues otherwise. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  orderId?: number | null;
  appointmentId?: number | null;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await record({ ...opts, recipient: opts.to, channel: "email", status: "queued" });
    return { ok: false, queued: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "OSSZ Collections <hello@osszcollections.cm>",
        to: [opts.to],
        subject: opts.subject,
        text: opts.body,
      }),
    });
    await record({
      ...opts,
      recipient: opts.to,
      channel: "email",
      status: res.ok ? "sent" : "failed",
      error: res.ok ? "" : `HTTP ${res.status}`,
    });
    return { ok: res.ok, queued: false };
  } catch (error) {
    await record({
      ...opts,
      recipient: opts.to,
      channel: "email",
      status: "failed",
      error: String(error).slice(0, 200),
    });
    return { ok: false, queued: false };
  }
}

/**
 * Queues the WhatsApp copy of a status update. At v1 the hand-off is a wa.me
 * deep link (§5), so this records the exact wording for staff to send; the
 * upgrade path to the Cloud API only changes this function.
 */
export async function queueWhatsApp(opts: {
  to: string;
  body: string;
  orderId?: number | null;
  appointmentId?: number | null;
}) {
  await record({
    orderId: opts.orderId,
    appointmentId: opts.appointmentId,
    channel: "whatsapp",
    recipient: opts.to,
    subject: "",
    body: opts.body,
    status: "queued",
  });
  return waLink(opts.to, opts.body);
}

function statusLine(status: string, locale: "en" | "fr" = "en"): string {
  const en: Record<string, string> = {
    placed: "We have received your order and it is being prepared.",
    processing: "Your order is being prepared in our Akwa atelier.",
    ready: "Your order is ready.",
    out_for_delivery: "Your order is on its way to you.",
    delivered: "Your order has been delivered. We hope you love it.",
    returned: "Your return has been received.",
    cancelled: "Your order has been cancelled.",
  };
  const fr: Record<string, string> = {
    placed: "Nous avons bien reçu votre commande, elle est en préparation.",
    processing: "Votre commande est en préparation dans notre atelier d'Akwa.",
    ready: "Votre commande est prête.",
    out_for_delivery: "Votre commande est en route.",
    delivered: "Votre commande a été livrée. Nous espérons qu'elle vous plaira.",
    returned: "Votre retour a bien été reçu.",
    cancelled: "Votre commande a été annulée.",
  };
  return (locale === "fr" ? fr : en)[status] ?? STATUS_LABELS[status] ?? status;
}

/** Order confirmation on both channels (§6.5 step 6). */
export async function notifyOrderPlaced(orderId: number) {
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) return;
  const settings = await getSettings();

  const body = [
    `Dear ${order.customerName},`,
    ``,
    `Thank you for your order with OSSZ Collections.`,
    ``,
    `Order number: ${order.orderNumber}`,
    `Total: ${formatXAF(order.total)}`,
    `Delivery: ${DELIVERY_LABELS[order.deliveryMethod] ?? order.deliveryMethod} — ${order.deliveryZone}`,
    ``,
    `You may follow your order at any time here:`,
    `https://osszcollections.cm/order/${order.orderNumber}`,
    ``,
    `With warm regards,`,
    `OSSZ Collections · ${settings.store_address}`,
  ].join("\n");

  await sendEmail({
    to: order.guestEmail,
    subject: `Your OSSZ order ${order.orderNumber}`,
    body,
    orderId,
  });

  if (order.guestPhone) {
    await queueWhatsApp({
      to: order.guestPhone,
      body: `Thank you for your order with OSSZ Collections. Order ${order.orderNumber}, total ${formatXAF(order.total)}. We will message you as it progresses.`,
      orderId,
    });
  }
}

/** Status change on both channels (§12.2). */
export async function notifyOrderStatus(orderId: number, status: string) {
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) return;
  const line = statusLine(status);

  await sendEmail({
    to: order.guestEmail,
    subject: `OSSZ order ${order.orderNumber} — ${STATUS_LABELS[status] ?? status}`,
    body: `Dear ${order.customerName},\n\n${line}\n\nOrder ${order.orderNumber}\nhttps://osszcollections.cm/order/${order.orderNumber}\n\nWith warm regards,\nOSSZ Collections`,
    orderId,
  });

  if (order.guestPhone) {
    await queueWhatsApp({
      to: order.guestPhone,
      body: `OSSZ Collections — order ${order.orderNumber}: ${line}`,
      orderId,
    });
  }
}

/** Appointment confirmation / reminder (§6.7). */
export async function notifyAppointment(opts: {
  appointmentId: number;
  contact: string;
  name: string;
  reference: string;
  when: string;
  kind: "requested" | "confirmed" | "cancelled" | "rescheduled";
}) {
  const verb = {
    requested: "has been received",
    confirmed: "is confirmed",
    cancelled: "has been cancelled",
    rescheduled: "has been moved",
  }[opts.kind];

  const body = `Dear ${opts.name},\n\nYour appointment ${opts.reference} ${verb} for ${opts.when}.\n\nWith warm regards,\nOSSZ Collections`;

  if (opts.contact.includes("@")) {
    await sendEmail({
      to: opts.contact,
      subject: `OSSZ appointment ${opts.reference}`,
      body,
      appointmentId: opts.appointmentId,
    });
  } else {
    await queueWhatsApp({ to: opts.contact, body, appointmentId: opts.appointmentId });
  }
}
