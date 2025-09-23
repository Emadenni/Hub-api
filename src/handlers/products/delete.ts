import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const tableName = process.env.PRODUCTS_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!event.body) return { statusCode: 400, body: "Missing body" };
    const { productId } = JSON.parse(event.body);

    if (!productId) {
      return { statusCode: 400, body: "Missing productId" };
    }

    const cmd = new DeleteItemCommand({
      TableName: tableName,
      Key: { productId: { S: productId } },
    });

    await client.send(cmd);

    return { statusCode: 200, body: `Deleted product ${productId}` };
  } catch (err) {
    console.error("Error deleting product", err);
    return { statusCode: 500, body: "Error deleting product" };
  }
};
