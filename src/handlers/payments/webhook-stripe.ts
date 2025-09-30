import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

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

      // 👉 Calcolo totale
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

      // 👉 Aggiorna ordine a "paid"
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

      // 👉 Gestione stock prodotti
      const orderItems = session.metadata?.items
        ? JSON.parse(session.metadata.items)
        : [];

      console.log("📦 Items ricevuti dal metadata:", orderItems);

      for (const item of orderItems) {
        const pid = item.productId || item.id;
        if (pid) {
          console.log(`🔽 Scala stock prodotto: ${pid} (qty: ${item.qty})`);
          await decreaseStock(pid, item.qty || 1);
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err: any) {
    console.error("❌ Webhook Error:", err);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
}

/**
 * Scala stock nel DB per i prodotti non infiniti.
 * - Se stock >= 9999 → prodotto "infinito", non scala.
 * - Se stock arriva a 0 o meno → resetta a 10 (ciclo).
 */
async function decreaseStock(productId: string, qty: number) {
  const res = await db.send(
    new GetCommand({
      TableName: process.env.PRODUCTS_TABLE!,
      Key: { productId },
    })
  );

  if (!res.Item) {
    console.log(`⚠️ Nessun prodotto trovato con ID ${productId}`);
    return;
  }

  let stock = res.Item.stock ?? 0;

  if (stock < 9999) {
    let newStock = stock - qty;
    if (newStock <= 0) {
      newStock = 10; // reset ciclico
    }

    await db.send(
      new UpdateCommand({
        TableName: process.env.PRODUCTS_TABLE!,
        Key: { productId },
        UpdateExpression: "SET stock = :s",
        ExpressionAttributeValues: { ":s": newStock },
      })
    );

    console.log(
      `✅ Stock aggiornato per ${productId}: ${stock} → ${newStock}`
    );
  } else {
    console.log(`ℹ️ Prodotto ${productId} ha stock infinito, non scalato.`);
  }
}
