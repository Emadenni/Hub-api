import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // 1) Leggi il cookie sessionId
    const cookies = event.cookies || [];
    const sessionCookie = cookies.find((c) => c.startsWith("sessionId="));

    if (sessionCookie) {
      const sessionId = sessionCookie.split("=")[1];

      // 2) Cancella la sessione da DynamoDB
      await db.send(
        new DeleteCommand({
          TableName: "hub_sessions",
          Key: { sessionId },
        })
      );
    }

    // 3) Invalida il cookie lato client
    return {
      statusCode: 200,
      cookies: [
        "sessionId=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0",
      ],
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("❌ Errore /auth/logout:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
