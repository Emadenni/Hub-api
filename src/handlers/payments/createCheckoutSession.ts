import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {});

export async function handler(event: any) {
  try {
    const body = JSON.parse(event.body || "{}");

    // 1. lista dal .env
    const urls = (process.env.FRONTEND_URLS || "").split(",");

    // 2. prendi l'origin della request (se httpApi lo include)
    const origin = event.headers?.origin;

    // 3. se l’origin è nella lista, usalo; altrimenti fallback al primo
    const baseUrl = urls.includes(origin) ? origin : urls[0];

    // 4. gestiamo coupon
    let discounts: { coupon: string }[] = [];
    if (body.coupon) {
      try {
        const coupon = await stripe.coupons.retrieve(body.coupon);
        if (!coupon.valid) {
          console.warn("⚠️ Coupon non valido:", body.coupon);
        } else {
          discounts = [{ coupon: body.coupon }];
        }
      } catch (err) {
        console.warn("⚠️ Coupon non trovato o errore:", body.coupon, err);
      }
    }

    // 5. crea sessione di checkout
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: body.items.map((item: any) => ({
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
      discounts, // ✅ aggiunto se valido
      success_url: `${baseUrl}/success`,
      cancel_url: `${baseUrl}/cancel`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err: any) {
    console.error("❌ Stripe error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
