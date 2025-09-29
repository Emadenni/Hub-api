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

      console.log("✅ Checkout completed:", session.id);

      let amountCents = session.amount_total ?? 0;
      let amountTotal = session.amount_total ?? null;

      if (!amountCents && session.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(
          session.payment_intent as string
        );
        amountCents = pi.amount ?? 0;
        amountTotal = pi.amount ?? null;
      }

      const amountEur = amountCents / 100;

      // 👉 Aggiorna ordine
      await db.send(
        new UpdateCommand({
          TableName: process.env.ORDERS_TABLE!,
          Key: { orderId: session.id },
          UpdateExpression: `
            SET #s = :s,
                #e = :e,
                #pi = :pi,
                #amt_total = :amt_t,
                #amt_cents = :amt_c,
                #amt_eur = :amt_e,
                updatedAt = :u
          `,
          ExpressionAttributeNames: {
            "#s": "status",
            "#e": "email",
            "#pi": "paymentIntentId",
            "#amt_total": "amountTotal",
            "#amt_cents": "amountCents",
            "#amt_eur": "amountEur",
          },
          ExpressionAttributeValues: {
            ":s": "paid",
            ":e": session.customer_details?.email || null,
            ":pi": session.payment_intent || null,
            ":amt_t": amountTotal,
            ":amt_c": amountCents,
            ":amt_e": amountEur,
            ":u": new Date().toISOString(),
          },
        })
      );

      // 👉 Recupera userId da metadata
      const userId = session.metadata?.userId || "guest";

      if (userId !== "guest") {
        console.log(`🔗 Associo ordine ${session.id} a utente ${userId}`);

        // Aggiorna tabella hub_users aggiungendo orderId a purchases
        await db.send(
          new UpdateCommand({
            TableName: process.env.USERS_TABLE!, // es: "hub_users"
            Key: { userId },
            UpdateExpression: "SET purchases = list_append(if_not_exists(purchases, :empty), :o)",
            ExpressionAttributeValues: {
              ":o": [session.id],
              ":empty": [],
            },
          })
        );
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
}
