import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const TABLE = process.env.PARTNERS_REQUESTS_TABLE || "partners_requests";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing request id" }) };
    }

    await client.send(
      new DeleteItemCommand({
        TableName: TABLE,
        Key: { requestId: { S: id } },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Request ${id} deleted` }),
    };
  } catch (err: any) {
    console.error("❌ deleteRequest error", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to delete request" }) };
  }
};
