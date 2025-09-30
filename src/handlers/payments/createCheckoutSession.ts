import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
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
    const userId = body.userId && body.userId !== "guest" ? body.userId : "guest";

    const email: string = body.email ?? "";
    const name: string = body.name ?? "";

    console.log("📦 Items ricevuti dal frontend:", JSON.stringify(items, null, 2));

    // 👉 Gestione coupon
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (couponCode) {
      try {
        const coupon = await stripe.coupons.retrieve(couponCode);
        if ((coupon as any).valid) {
          discounts = [{ coupon: coupon.id }];
        }
      } catch {
        console.warn("⚠️ Coupon non valido:", couponCode);
      }
    }

    // 👉 Costruisci payload pulito per metadata
    const metaItems = items.map((i: any) => ({
      productId: i.productId, // 👈 ID che useremo nel webhook
      qty: i.qty,
    }));

    console.log("📝 Metadata.items da salvare in Stripe:", JSON.stringify(metaItems, null, 2));

    // 👉 Crea sessione Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_creation: "always",
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
        userId,
        email,
        name,
        items: JSON.stringify(metaItems),
      },
    });

    console.log("✅ Sessione Stripe creata:", session.id);

    // 👉 Salva ordine pending
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
          amountCents: items.reduce(
            (acc: number, item: any) => acc + Math.round(item.price * 100) * item.qty,
            0
          ),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );

    console.log("💾 Ordine salvato in DynamoDB come pending:", session.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err: any) {
    console.error("❌ Errore createCheckoutSession:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
