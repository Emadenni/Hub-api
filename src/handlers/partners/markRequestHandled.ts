import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const TABLE = process.env.PARTNERS_REQUESTS_TABLE || "partners_requests";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing request id" }) };
    }

    await client.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: { requestId: { S: id } },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": { S: "handled" } },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Request ${id} marked as handled` }),
    };
  } catch (err: any) {
    console.error("❌ markRequestHandled error", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to update request" }) };
  }
};
