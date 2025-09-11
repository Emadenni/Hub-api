import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../../lib/db";
import { v4 as uuidv4 } from "uuid";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = event.body ? JSON.parse(event.body) : null;
  if (!body?.refreshToken) {
    return { statusCode: 400, body: JSON.stringify({ error: "refreshToken required" }) };
  }

  const sessionId = uuidv4(); // 👈 chiave primaria
  const ttl = Math.floor(Date.now() / 1000) + 300; // valido 5 minuti

  await db.send(new PutCommand({
    TableName: "hub_sessions",
    Item: { sessionId, refreshToken: body.refreshToken, ttl, type: "exchange" }, // 👈 aggiunto type
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ code: sessionId }), // 👈 ritorna sessionId come code
  };
};
