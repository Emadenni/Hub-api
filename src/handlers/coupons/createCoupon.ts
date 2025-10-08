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

    // 1) Crea coupon
    const coupon = await stripe.coupons.create({
      amount_off: amount * 100,
      currency,
      duration: "once",
      name: `Promo ${code}`,
    });

    // 2) Prova a creare promotion code
    let promoCode;
    try {
      promoCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        max_redemptions: 1,
      });
    } catch (err: any) {
      if (err.type === "StripeInvalidRequestError" && err.code === "promotion_code_already_exists") {
        console.warn("⚠️ Promotion code già esistente:", code);
        return {
          statusCode: 409, // Conflict
          body: JSON.stringify({ error: `Codice '${code}' già esistente` }),
        };
      }
      throw err; // altri errori li rilancio
    }

    console.log("✅ Created coupon:", coupon.id, "and promoCode:", promoCode.code);

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
