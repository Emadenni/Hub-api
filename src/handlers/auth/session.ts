import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../../lib/db";
import { v4 as uuidv4 } from "uuid";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;

    if (!body?.refreshToken) {
      return { statusCode: 400, body: JSON.stringify({ error: "refreshToken required" }) };
    }

    const sessionId = uuidv4();
    const ttl = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 giorni

    await db.send(
      new PutCommand({
        TableName: "hub_sessions",
        Item: {
          sessionId,
          refreshToken: body.refreshToken,
          ttl,
        },
      })
    );

    return {
      statusCode: 204,
      cookies: [
        `sessionId=${sessionId}; Path=/; HttpOnly; Secure; SameSite=None`,
      ],
    };
  } catch (err) {
    console.error("Errore /auth/session:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};
