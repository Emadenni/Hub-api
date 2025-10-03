import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { code, amount, currency } = body;

    if (!code || !amount || !currency) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid input" }),
      };
    }

    console.log("➡️ Creating coupon & promotion code:", { code, amount, currency });

    // 1) Crea coupon con un nome leggibile
    const coupon = await stripe.coupons.create({
      amount_off: amount * 100, // Stripe vuole centesimi
      currency,
      duration: "once",
      name: `Promo ${code}`, // 👈 così non vedi più "Not provided"
    });

    // 2) Crea promotion code collegato al coupon
    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,               // 👈 questo è il codice che l'utente digita
      max_redemptions: 1, // utilizzabile una sola volta
    });

    console.log("✅ Created coupon:", coupon.id, "and promoCode:", promoCode.code);

    // Risposta pulita
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Coupon e codice promozionale creati con successo",
        coupon: {
          id: coupon.id,
          name: coupon.name,
          amount: `${amount} ${currency.toUpperCase()}`,
          duration: coupon.duration,
        },
        promotionCode: {
          id: promoCode.id,
          code: promoCode.code,
          maxRedemptions: promoCode.max_redemptions,
          valid: promoCode.active,
        },
      }),
    };
  } catch (err: any) {
    console.error("❌ Error creating coupon/promo:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
