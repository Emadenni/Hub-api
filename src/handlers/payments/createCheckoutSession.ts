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

    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (couponCode) {
      try {
        const coupon = await stripe.coupons.retrieve(couponCode);
        if ((coupon as any).valid) {
          discounts = [{ coupon: coupon.id }];
        }
      } catch (err) {
        console.warn("⚠️ Errore retrieving coupon:", couponCode, err);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
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
      // 👉 niente customer_email, Stripe chiede direttamente
      metadata: {
        userId: body.userId || "guest",
      },
    });

    await db.send(
      new PutCommand({
        TableName: process.env.ORDERS_TABLE!,
        Item: {
          orderId: session.id,
          userId: body.userId || "guest",
          items,
          amountTotal: session.amount_total || 0,
          currency: session.currency || "eur",
          coupon: couponCode || null,
          status: "pending",
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
