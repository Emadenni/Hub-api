import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// DynamoDB v3 client
const ddbClient = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(ddbClient);

export async function handler(event: any) {
  try {
    const body = JSON.parse(event.body || "{}");
    const urls = (process.env.FRONTEND_URLS || "").split(",");
    const origin = event.headers?.origin;
    const baseUrl = urls.includes(origin) ? origin : urls[0];

    const items = body.items || [];
    const couponCode = body.coupon;

    // 👉 Gestione coupon
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (couponCode) {
      try {
        const coupon = await stripe.coupons.retrieve(couponCode);
        if ((coupon as any).valid) {
          discounts = [{ coupon: coupon.id }];
        }
      } catch (err) {
        console.warn("⚠️ Errore coupon:", couponCode, err);
      }
    }

    // 👉 Calcola subtotale
    const subtotalCents = items.reduce(
      (acc: number, item: any) => acc + Math.round(item.price * 100) * item.qty,
      0
    );
    const subtotalEur = subtotalCents / 100;

    // 👉 Crea sessione Stripe: raccoglie sempre email e crea customer
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_creation: "always", // 👈 forza raccolta email
      line_items: items.map((item: any) => ({
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
      discounts,
      success_url: `${baseUrl}/success`,
      cancel_url: `${baseUrl}/cancel`,
      metadata: {
        userId: body.userId || "guest",
      },
    });

    // 👉 Salva ordine su DynamoDB come "pending"
    await db.send(
      new PutCommand({
        TableName: process.env.ORDERS_TABLE!,
        Item: {
          orderId: session.id,
          userId: body.userId || "guest",
          items,
          coupon: couponCode || null,
          status: "pending",
          amountCents: subtotalCents,
          amountEur: subtotalEur,
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
    console.error("❌ Stripe error in createCheckoutSession:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
