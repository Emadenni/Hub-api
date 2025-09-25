import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const ddbClient = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(ddbClient);

export async function handler(event: any) {
  const sig = event.headers["stripe-signature"];

  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;

      console.log("✅ Checkout completato:", session.id);

      await db.send(
        new UpdateCommand({
          TableName: process.env.ORDERS_TABLE!,
          Key: { orderId: session.id },
          UpdateExpression:
            "SET #s = :s, #e = :e, #pi = :pi, #amt = :amt, updatedAt = :u",
          ExpressionAttributeNames: {
            "#s": "status",
            "#e": "email",
            "#pi": "paymentIntentId",
            "#amt": "amountTotal",
          },
          ExpressionAttributeValues: {
            ":s": "paid",
            ":e": session.customer_details?.email || null,
            ":pi": session.payment_intent?.toString() || null,
            ":amt": session.amount_total || 0,
            ":u": new Date().toISOString(),
          },
        })
      );
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
}
