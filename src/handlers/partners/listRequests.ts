import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async () => {
  try {
    const tableName = process.env.PARTNERS_REQUESTS_TABLE!;
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
      })
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(result.Items ?? []),
    };
  } catch (err) {
    console.error("❌ Error listing partner requests:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to list partner requests" }),
    };
  }
};
