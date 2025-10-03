import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

export async function handler(event: any) {
  try {
    const body = JSON.parse(event.body || "{}");

    if (!body.name || !body.email || !body.idea) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required fields" }),
      };
    }

    const requestId = uuidv4();
    const createdAt = new Date().toISOString();

    const params = {
      TableName: process.env.PARTNERS_REQUESTS_TABLE || "partners_requests",
      Item: {
        requestId: { S: requestId },
        name: { S: body.name },
        email: { S: body.email },
        idea: { S: body.idea },
        createdAt: { S: createdAt },
      },
    };

    await client.send(new PutItemCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Request saved successfully",
        requestId,
      }),
    };
  } catch (err: any) {
    console.error("❌ Error saving request:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: err.message,
      }),
    };
  }
}
