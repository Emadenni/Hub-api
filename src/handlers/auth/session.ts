import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../../lib/db";
import { noContentResponse, jsonResponse } from "../../lib/response";
import { v4 as uuidv4 } from "uuid";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;

    if (!body?.refreshToken) {
      return jsonResponse(400, { error: "refreshToken required" });
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
      headers: {
        "Set-Cookie": `sessionId=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      },
      body: "",
    };
  } catch (err) {
    console.error("Errore /auth/session:", err);
    return jsonResponse(500, { error: "Internal Server Error" });
  }
};
