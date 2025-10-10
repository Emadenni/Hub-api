import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const ddbClient = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(ddbClient);

// 🌍 Tipi lingua e struttura etichette
type Locale = "it" | "en";
type ShippingLabel = { it: string; en: string };

type ShippingRate = {
  maxKg: number;
  priceCents: number;
  label: ShippingLabel;
};

// 📦 Tariffe spedizione bilingue
const shippingRates: Record<"italy" | "europe", ShippingRate[]> = {
  italy: [
    {
      maxKg: 1,
      priceCents: 490,
      label: {
        it: "Spedizione nazionale fino a 1 kg",
        en: "National shipping up to 1 kg",
      },
    },
    {
      maxKg: 5,
      priceCents: 690,
      label: {
        it: "Spedizione nazionale fino a 5 kg",
        en: "National shipping up to 5 kg",
      },
    },
    {
      maxKg: 10,
      priceCents: 1190,
      label: {
        it: "Spedizione nazionale fino a 10 kg",
        en: "National shipping up to 10 kg",
      },
    },
  ],
  europe: [
    {
      maxKg: 1,
      priceCents: 1890,
      label: {
        it: "Spedizione Europa fino a 1 kg",
        en: "Europe shipping up to 1 kg",
      },
    },
    {
      maxKg: 5,
      priceCents: 2390,
      label: {
        it: "Spedizione Europa fino a 5 kg",
        en: "Europe shipping up to 5 kg",
      },
    },
    {
      maxKg: 10,
      priceCents: 2690,
      label: {
        it: "Spedizione Europa fino a 10 kg",
        en: "Europe shipping up to 10 kg",
      },
    },
  ],
};

export async function handler(event: any) {
  try {
    const body = JSON.parse(event.body || "{}");
    const urls = (process.env.FRONTEND_URLS || "").split(",");
    const origin = event.headers?.origin;
    const baseUrl = urls.includes(origin) ? origin : urls[0];

    const items = body.items || [];
    const couponCode = body.coupon;
    const userId = body.userId && body.userId !== "guest" ? body.userId : "guest";
    const email: string = body.email ?? "";
    const name: string = body.name ?? "";

    // 🌐 lingua inviata dal frontend
    const locale: Locale = body.locale === "en" ? "en" : "it";

    const shippingAddress = {
      country: body.shippingCountry,
      city: body.shippingCity,
      postalCode: body.shippingPostalCode,
      addressLine: body.shippingAddress,
    };

    const totalWeight = items.reduce(
      (acc: number, item: any) => acc + (item.weightKg || 0) * item.qty,
      0
    );

    // 🇮🇹🇪🇺 Determina area (Italia / Europa)
    const area =
      shippingAddress.country === "IT" ||
      shippingAddress.country?.toLowerCase() === "italia"
        ? "italy"
        : "europe";

    // 📦 Seleziona la fascia corretta
    const rates = shippingRates[area];
    const shippingRate =
      rates.find((rate) => totalWeight <= rate.maxKg) || rates[rates.length - 1];

    // 🔠 Etichetta localizzata
    const shippingLabel = shippingRate.label[locale];

    // 🎟️ Codice sconto (se presente)
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (couponCode) {
      try {
        const promo = await stripe.promotionCodes.list({
          code: couponCode,
          active: true,
          limit: 1,
        });
        if (promo.data.length > 0) {
          discounts = [{ promotion_code: promo.data[0].id }];
        }
      } catch {
        console.warn("⚠️ Errore durante la ricerca del codice promozionale");
      }
    }

    // Solo ID e quantità nei metadati
    const metaItems = items.map((i: any) => ({
      productId: i.productId,
      qty: i.qty,
    }));

    // 💳 Crea sessione Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale, // ✅ mostra il checkout nella lingua corretta
      payment_method_types: ["card"],
      customer_creation: "always",
      line_items: [
        ...items.map((item: any) => ({
          price_data: {
            currency: "eur",
            product_data: {
              name:
                typeof item.title === "object"
                  ? item.title[locale] || item.title["it"]
                  : item.title,
              images: item.image ? [item.image] : [],
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.qty,
        })),
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: shippingLabel,
            },
            unit_amount: shippingRate.priceCents,
          },
          quantity: 1,
        },
      ],
      discounts,
      success_url: `${baseUrl}/success?lang=${locale}`,
      cancel_url: `${baseUrl}/cancel?lang=${locale}`,
      metadata: {
        userId,
        email,
        name,
        items: JSON.stringify(metaItems),
        shipping: JSON.stringify(shippingAddress),
        shippingLabel,
      },
    });

    // 💾 Salva ordine su DynamoDB
    await db.send(
      new PutCommand({
        TableName: process.env.ORDERS_TABLE!,
        Item: {
          orderId: session.id,
          userId,
          email,
          name,
          items,
          coupon: couponCode ?? null,
          status: "pending",
          amountCents:
            items.reduce(
              (acc: number, item: any) =>
                acc + Math.round(item.price * 100) * item.qty,
              0
            ) + shippingRate.priceCents,
          shippingCents: shippingRate.priceCents,
          totalWeightKg: totalWeight,
          shippingLabel,
          shippingAddress,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err: any) {
    console.error("❌ Stripe checkout error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
