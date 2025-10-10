import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const ddbClient = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(ddbClient);

// Tariffe spedizione aggiornate (senza margine extra)
const shippingRates = {
  italy: [
    { maxKg: 1, priceCents: 490, label: "Nazionale fino a 1 kg" },
    { maxKg: 5, priceCents: 690, label: "Nazionale fino a 5 kg" },
    { maxKg: 10, priceCents: 1190, label: "Nazionale fino a 10 kg" },
  ],
  europe: [
    { maxKg: 1, priceCents: 1890, label: "Europa fino a 1 kg" },
    { maxKg: 5, priceCents: 2390, label: "Europa fino a 5 kg" },
    { maxKg: 10, priceCents: 2690, label: "Europa fino a 10 kg" },
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

    const shippingAddress = {
      country: body.shippingCountry,
      city: body.shippingCity,
      postalCode: body.shippingPostalCode,
      addressLine: body.shippingAddress,
    };

    const totalWeight = items.reduce((acc: number, item: any) => acc + (item.weightKg || 0) * item.qty, 0);

    // Determina area (italy / europe)
    const area = shippingAddress.country === "IT" || shippingAddress.country === "Italia" ? "italy" : "europe";

    // Seleziona la fascia corretta
    const rates = shippingRates[area];
    const shippingRate = rates.find((rate) => totalWeight <= rate.maxKg) || rates[rates.length - 1];

    // Codice sconto (se presente)
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
      } catch {}
    }

    const metaItems = items.map((i: any) => ({
      productId: i.productId,
      qty: i.qty,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_creation: "always",
      line_items: [
        ...items.map((item: any) => ({
          price_data: {
            currency: "eur",
            product_data: {
              name: item.title,
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
              name: shippingRate.label,
            },
            unit_amount: shippingRate.priceCents,
          },
          quantity: 1,
        },
      ],
      discounts,
      success_url: `${baseUrl}/success`,
      cancel_url: `${baseUrl}/cancel`,
      metadata: {
        userId,
        email,
        name,
        items: JSON.stringify(metaItems),
        shipping: JSON.stringify(shippingAddress),
        shippingLabel: shippingRate.label,
      },
    });

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
            items.reduce((acc: number, item: any) => acc + Math.round(item.price * 100) * item.qty, 0) +
            shippingRate.priceCents,
          shippingCents: shippingRate.priceCents,
          totalWeightKg: totalWeight,
          shippingLabel: shippingRate.label,
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
