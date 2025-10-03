import { APIGatewayProxyHandler } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({ region: process.env.AWS_REGION || "eu-central-1" });

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("📩 RAW EVENT:", JSON.stringify(event, null, 2));

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing body" }),
    };
  }

  let data: any;
  try {
    data = JSON.parse(event.body);
  } catch (err) {
    console.error("❌ JSON parse error:", err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON format" }),
    };
  }

  const { code, amount, currency } = data;
  if (!code || !amount || !currency) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing code, amount or currency" }),
    };
  }

  try {
    const invokeCmd = new InvokeCommand({
      FunctionName: process.env.CREATE_COUPON_LAMBDA || "hub-api-dev-createCoupon",
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify({ body: JSON.stringify({ code, amount, currency }) })),
    });

    const response = await lambda.send(invokeCmd);

    const payload = response.Payload ? JSON.parse(new TextDecoder().decode(response.Payload)) : null;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Coupon request processed", result: payload }),
    };
  } catch (err: any) {
    console.error("Error invoking createCoupon:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
