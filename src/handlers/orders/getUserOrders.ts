import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

const ORDERS_TABLE = process.env.ORDERS_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("👉 Query params:", event.queryStringParameters);

    const userId = event.queryStringParameters?.userId;
    const status = event.queryStringParameters?.status;

    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing userId" }) };
    }

    const query: any = {
      TableName: ORDERS_TABLE,
      IndexName: "userId-index", // ⚠️ deve esistere già
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: {
        ":u": userId,
      },
    };

    if (status) {
      query.FilterExpression = "status = :s";
      query.ExpressionAttributeValues[":s"] = status;
    }

    const res = await db.send(new QueryCommand(query));

    return {
      statusCode: 200,
      body: JSON.stringify(res.Items || []),
    };
  } catch (err: any) {
    console.error("❌ getUserOrders error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
