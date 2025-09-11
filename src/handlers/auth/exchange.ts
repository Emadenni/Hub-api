import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const JWT_SECRET = process.env.JWT_SECRET!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = event.body ? JSON.parse(event.body) : null;
  if (!body?.code) {
    return { statusCode: 400, body: JSON.stringify({ error: "code required" }) };
  }

  // Recupera l’item con sessionId = code
  const res = await db.send(new GetCommand({
    TableName: "hub_sessions",
    Key: { sessionId: body.code },
  }));

  if (!res.Item?.refreshToken) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired code" }) };
  }

  // elimina subito (one-time)
  await db.send(new DeleteCommand({
    TableName: "hub_sessions",
    Key: { sessionId: body.code },
  }));

  // crea un sessionToken firmato
  const sessionToken = jwt.sign(
    { refreshToken: res.Item.refreshToken },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ sessionToken }),
  };
};
