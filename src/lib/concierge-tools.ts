import { and, asc, desc, eq, gte, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, orderItems, orders, productVariants, products } from "@/db/schema";
import { getSettings, listDeliveryZones, listFaqs, listProducts } from "@/lib/store";
import { formatDateTime, formatXAF, makeReference, STATUS_LABELS, waLink } from "@/lib/utils";

export type ToolResult = { text: string; data?: unknown };

export const TOOL_DEFINITIONS = [
  {
    name: "search_products",
    description:
      "Search the live OSSZ catalogue by free text, colour, size or price range. Always use this before mentioning any product or price.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Words describing the piece, e.g. 'green evening dress'" },
        colour: { type: "string" },
        size: { type: "string" },
        max_price: { type: "number", description: "Maximum price in FCFA" },
      },
    },
  },
  {
    name: "check_stock",
    description: "Check live availability and sizes for one product, identified by its name or slug.",
    input_schema: {
      type: "object" as const,
      properties: { product: { type: "string" } },
      required: ["product"],
    },
  },
  {
    name: "get_order_status",
    description: "Look up an order using the order number plus the email or phone used at checkout.",
    input_schema: {
      type: "object" as const,
      properties: { order_number: { type: "string" }, contact: { type: "string" } },
      required: ["order_number", "contact"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Request an in-store styling or fitting appointment. Confirm the details with the visitor before calling this.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        contact: { type: "string", description: "Phone or email" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM in 24h" },
        service: { type: "string" },
      },
      required: ["name", "contact", "date", "time"],
    },
  },
  {
    name: "reschedule_appointment",
    description:
      "Move an existing appointment to a new slot. Requires the reference (APT-XXXX) and the contact used to book. Confirm the new time with the visitor first.",
    input_schema: {
      type: "object" as const,
      properties: {
        reference: { type: "string" },
        contact: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM in 24h" },
      },
      required: ["reference", "contact", "date", "time"],
    },
  },
  {
    name: "cancel_appointment",
    description:
      "Cancel an appointment. Requires the reference and the contact used to book. Always confirm with the visitor before calling.",
    input_schema: {
      type: "object" as const,
      properties: { reference: { type: "string" }, contact: { type: "string" } },
      required: ["reference", "contact"],
    },
  },
  {
    name: "get_delivery_info",
    description: "Return the current delivery zones, fees and estimated timelines.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_faq_answer",
    description: "Answer from the store's published FAQ and policies (returns, payment, hours, location).",
    input_schema: {
      type: "object" as const,
      properties: { topic: { type: "string" } },
      required: ["topic"],
    },
  },
  {
    name: "escalate_to_whatsapp",
    description:
      "Hand the visitor to a human on WhatsApp with a short summary of the conversation. Returns a wa.me link.",
    input_schema: {
      type: "object" as const,
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  },
];

export async function runTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "search_products": {
      const results = await listProducts({
        q: typeof input.query === "string" && input.query ? input.query : undefined,
        colour: typeof input.colour === "string" && input.colour ? input.colour : undefined,
        size: typeof input.size === "string" && input.size ? input.size : undefined,
        maxPrice: typeof input.max_price === "number" ? input.max_price : undefined,
        limit: 6,
      });
      if (results.length === 0) {
        const fallback = await listProducts({ limit: 4, sort: "popular" });
        return {
          text:
            "No exact match in the live catalogue. Current favourites: " +
            fallback.map((p) => `${p.name} (${formatXAF(p.basePrice)}) /product/${p.slug}`).join("; "),
          data: fallback,
        };
      }
      return {
        text: results
          .map(
            (p) =>
              `${p.name} — ${formatXAF(p.basePrice)} — sizes ${p.sizes.join("/")} — colours ${p.colours.join(
                "/",
              )} — ${p.inStock ? "in stock" : "sold out"} — /product/${p.slug}`,
          )
          .join("\n"),
        data: results,
      };
    }

    case "check_stock": {
      const term = `%${String(input.product ?? "")}%`;
      const found = (
        await db
          .select()
          .from(products)
          .where(and(eq(products.isPublished, true), or(ilike(products.name, term), ilike(products.slug, term))))
          .limit(1)
      )[0];
      if (!found) return { text: "That piece is not in the live catalogue." };
      const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, found.id))
        .orderBy(asc(productVariants.id));
      const lines = variants
        .map(
          (v) =>
            `${v.size} / ${v.colour}: ${v.stockQty > 0 ? `${v.stockQty} available` : "sold out"} — ${formatXAF(
              v.priceOverride ?? found.basePrice,
            )}`,
        )
        .join("\n");
      return {
        text: `${found.name} (/product/${found.slug})\n${lines}`,
        data: { slug: found.slug, name: found.name },
      };
    }

    case "get_order_status": {
      const number = String(input.order_number ?? "").trim().toUpperCase();
      const contact = String(input.contact ?? "").trim();
      const order = (await db.select().from(orders).where(eq(orders.orderNumber, number)).limit(1))[0];
      if (!order) return { text: "No order was found with that number." };
      const matches =
        order.guestEmail.toLowerCase() === contact.toLowerCase() ||
        order.guestPhone.replace(/\D/g, "") === contact.replace(/\D/g, "");
      if (!matches) {
        return { text: "The contact detail does not match that order. Ask the visitor to confirm it." };
      }
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      return {
        text: `Order ${order.orderNumber} — status: ${STATUS_LABELS[order.status] ?? order.status}. Total ${formatXAF(
          order.total,
        )}. Delivery: ${order.deliveryZone}. Items: ${items
          .map((i) => `${i.quantity} × ${i.productName} (${i.variantLabel})`)
          .join(", ")}.`,
        data: { status: order.status, orderNumber: order.orderNumber },
      };
    }

    case "book_appointment": {
      const date = String(input.date ?? "");
      const time = String(input.time ?? "");
      const start = new Date(`${date}T${time}:00`);
      if (Number.isNaN(start.getTime())) return { text: "That date or time could not be read." };
      if (start.getTime() < Date.now()) return { text: "That slot is in the past — please offer another." };
      const clash = (
        await db
          .select()
          .from(appointments)
          .where(and(eq(appointments.slotStart, start), eq(appointments.status, "confirmed")))
          .limit(1)
      )[0];
      if (clash) return { text: "That slot is already taken. Please offer a different time." };
      const reference = makeReference("APT");
      await db.insert(appointments).values({
        reference,
        guestName: String(input.name ?? "Guest"),
        guestContact: String(input.contact ?? ""),
        service: String(input.service ?? "Styling session"),
        slotStart: start,
        slotEnd: new Date(start.getTime() + 60 * 60 * 1000),
        status: "requested",
        notes: "Booked via the OSSZ Concierge",
      });
      return {
        text: `Appointment ${reference} requested for ${formatDateTime(start)}. A stylist will confirm shortly.`,
        data: { reference },
      };
    }

    case "reschedule_appointment": {
      const ref = String(input.reference ?? "").trim().toUpperCase();
      const contact = String(input.contact ?? "").trim();
      const existing = (
        await db.select().from(appointments).where(eq(appointments.reference, ref)).limit(1)
      )[0];
      if (!existing) return { text: "No appointment was found with that reference." };
      const matches =
        existing.guestContact.toLowerCase() === contact.toLowerCase() ||
        existing.guestContact.replace(/\D/g, "") === contact.replace(/\D/g, "");
      if (!matches) {
        return { text: "That contact detail does not match the booking. Ask the visitor to confirm it." };
      }
      const start = new Date(`${String(input.date ?? "")}T${String(input.time ?? "")}:00`);
      if (Number.isNaN(start.getTime())) return { text: "That date or time could not be read." };
      if (start.getTime() < Date.now()) return { text: "That slot is in the past — please offer another." };
      const clash = (
        await db
          .select()
          .from(appointments)
          .where(and(eq(appointments.slotStart, start), eq(appointments.status, "confirmed")))
          .limit(1)
      )[0];
      if (clash) return { text: "That slot is taken. Please offer a different time." };
      await db
        .update(appointments)
        .set({ slotStart: start, slotEnd: new Date(start.getTime() + 3600000), status: "requested" })
        .where(eq(appointments.id, existing.id));
      return { text: `Appointment ${ref} moved to ${formatDateTime(start)}. A stylist will confirm shortly.` };
    }

    case "cancel_appointment": {
      const ref = String(input.reference ?? "").trim().toUpperCase();
      const contact = String(input.contact ?? "").trim();
      const existing = (
        await db.select().from(appointments).where(eq(appointments.reference, ref)).limit(1)
      )[0];
      if (!existing) return { text: "No appointment was found with that reference." };
      const matches =
        existing.guestContact.toLowerCase() === contact.toLowerCase() ||
        existing.guestContact.replace(/\D/g, "") === contact.replace(/\D/g, "");
      if (!matches) {
        return { text: "That contact detail does not match the booking. Ask the visitor to confirm it." };
      }
      await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, existing.id));
      return { text: `Appointment ${ref} has been cancelled. The visitor is welcome to book again at any time.` };
    }

    case "get_delivery_info": {
      const [zones, settings] = await Promise.all([listDeliveryZones(), getSettings()]);
      return {
        text:
          zones
            .map((z) => `${z.name}: ${z.fee === 0 ? "free" : formatXAF(z.fee)} — ${z.etaLabel}`)
            .join("\n") +
          `\nComplimentary Douala delivery above ${formatXAF(Number(settings.free_delivery_threshold))}.`,
        data: zones,
      };
    }

    case "get_faq_answer": {
      const topic = String(input.topic ?? "").toLowerCase();
      const [all, settings] = await Promise.all([listFaqs(), getSettings()]);
      const hit = all.filter(
        (f) =>
          f.question.toLowerCase().includes(topic) ||
          f.answer.toLowerCase().includes(topic) ||
          f.category.toLowerCase().includes(topic),
      );
      const chosen = hit.length ? hit.slice(0, 3) : all.slice(0, 3);
      return {
        text:
          chosen.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") +
          `\n\nStore: ${settings.store_address}. Hours: ${settings.business_hours}.`,
        data: chosen,
      };
    }

    case "escalate_to_whatsapp": {
      const settings = await getSettings();
      const summary = String(input.summary ?? "A visitor would like to speak with the OSSZ team.");
      return {
        text: `WhatsApp link ready: ${waLink(settings.whatsapp_number, `Hello OSSZ Collections. ${summary}`)}`,
        data: {
          link: waLink(settings.whatsapp_number, `Hello OSSZ Collections. ${summary}`),
          number: settings.whatsapp_number,
        },
      };
    }

    default:
      return { text: "Unknown tool." };
  }
}

export async function buildSystemPrompt(): Promise<string> {
  const settings = await getSettings();
  return `You are the OSSZ Concierge, the official AI shopping assistant for OSSZ Collections, a fashion boutique based in Douala, Cameroon.

Your personality: warm, gracious, attentive, and precise — like a trusted boutique host. You are polite from your very first word to your very last, no matter how a visitor speaks to you.

Your job: help visitors browse and find products, understand sizing and care, place or track orders, book fitting/styling appointments, and answer questions about delivery, payment, and returns.

Rules you always follow:
1. Keep replies short and easy to read. Ask one question at a time.
2. Never state a price, stock level, or delivery date from memory — always use your tools to check the real, current information.
3. Confirm details back to the visitor before booking, changing, or cancelling anything.
4. If you cannot fully resolve a request, or the visitor asks for a person, warmly offer to connect them with the OSSZ team on WhatsApp at ${settings.whatsapp_number}, and summarise the conversation so they don't have to repeat themselves.
5. Never discuss topics unrelated to OSSZ Collections, and never provide legal, medical, or financial advice.
6. Close every conversation graciously, thanking the visitor for their time, whether or not you handed them off to WhatsApp.

Useful context: the boutique is at ${settings.store_address}. Opening hours: ${settings.business_hours}. Product links look like /product/<slug> — share them as plain paths.`;
}

/* ------------------------------------------------------------------ */
/* Deterministic fallback used when no LLM key is configured           */
/* ------------------------------------------------------------------ */

export async function fallbackReply(message: string): Promise<{ reply: string; escalated: boolean }> {
  const text = message.toLowerCase();
  const settings = await getSettings();

  const wantsHuman = /human|person|whatsapp|call|agent|speak to someone|manager/.test(text);
  if (wantsHuman) {
    const link = waLink(
      settings.whatsapp_number,
      `Hello OSSZ Collections. I was speaking with the Concierge and would like to continue with your team. My question: ${message}`,
    );
    return {
      reply: `Of course — our team would be glad to help you personally. You may reach us on WhatsApp here: ${link}\n\nThank you for visiting OSSZ Collections; it has been a pleasure to assist you.`,
      escalated: true,
    };
  }

  if (/^(hi|hello|hey|good (morning|afternoon|evening)|bonjour|bonsoir|salut)\b/.test(text.trim())) {
    return {
      reply:
        "Good day, and welcome to OSSZ Collections. I would be glad to help you find a piece, check a size, track an order, or arrange a fitting. What may I do for you?",
      escalated: false,
    };
  }

  if (/^(thank|thanks|merci|that is all|nothing else|bye|goodbye)/.test(text.trim())) {
    return {
      reply:
        "It has been a pleasure to assist you. Should anything else arise, I am here at any hour — and our team is always reachable on WhatsApp. Thank you for visiting OSSZ Collections.",
      escalated: false,
    };
  }

  if (/size|fit|measure|taille|sizing|care|wash|iron|fabric/.test(text)) {
    const faq = await runTool("get_faq_answer", { topic: "sizing" });
    return {
      reply: `${faq.text}\n\nIf you tell me the piece you have in mind, I will check the exact sizes we hold in stock.`,
      escalated: false,
    };
  }

  if (/deliver|shipping|ship|livraison/.test(text)) {
    const info = await runTool("get_delivery_info", {});
    return { reply: `Certainly. Here is our current delivery information:\n\n${info.text}\n\nMay I help with anything else?`, escalated: false };
  }

  if (/order|track|commande/.test(text) && /osz-/i.test(message)) {
    const number = (message.match(/OSZ-[A-Z0-9]+/i) ?? [""])[0];
    return {
      reply: `Thank you. I can check order ${number.toUpperCase()} straight away — could you kindly confirm the email address or phone number used at checkout?`,
      escalated: false,
    };
  }

  if (/return|refund|exchange|payment|pay|momo|orange|mtn|card|hour|open|where|located/.test(text)) {
    const faq = await runTool("get_faq_answer", { topic: text.slice(0, 40) });
    return { reply: `${faq.text}\n\nIs there anything else I may look into for you?`, escalated: false };
  }

  if (/appointment|fitting|styling|book|rendez/.test(text)) {
    return {
      reply:
        "It would be a pleasure to arrange that. May I have your name, a contact number, and the date and time you would prefer? You may also book directly at /appointments.",
      escalated: false,
    };
  }

  const results = await runTool("search_products", { query: message.slice(0, 60) });
  return {
    reply: `Here is what I found in our live catalogue:\n\n${results.text}\n\nWould you like me to check sizes or availability for any of these?`,
    escalated: false,
  };
}
