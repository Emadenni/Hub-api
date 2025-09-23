import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const tableName = process.env.PRODUCTS_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async () => {
  try {
    const cmd = new ScanCommand({ TableName: tableName });
    const res = await client.send(cmd);

    const products = (res.Items || []).map((item) => ({
      productId: item.productId.S,
      title: {
        en: item.title.M?.en.S,
        it: item.title.M?.it.S,
      },
      desc: {
        en: item.desc.M?.en.S,
        it: item.desc.M?.it.S,
      },
      price: Number(item.price.N),
      image: item.image.S,
      tags: item.tags?.SS || [],
      stock: Number(item.stock?.N || 0),
      createdAt: item.createdAt?.S,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(products),
    };
  } catch (err) {
    console.error("Error fetching products", err);
    return { statusCode: 500, body: "Error fetching products" };
  }
};
