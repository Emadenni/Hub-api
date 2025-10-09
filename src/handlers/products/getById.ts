import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const tableName = process.env.PRODUCTS_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const productId = event.pathParameters?.id;
    if (!productId) {
      return { statusCode: 400, body: "Missing productId in path" };
    }

    const cmd = new GetItemCommand({
      TableName: tableName,
      Key: { productId: { S: productId } },
    });

    const res = await client.send(cmd);
    if (!res.Item) {
      return { statusCode: 404, body: "Product not found" };
    }

    const item = res.Item;

    const product = {
      productId: item.productId.S,
      title: {
        en: item.title?.M?.en?.S,
        it: item.title?.M?.it?.S,
      },
      desc: {
        en: item.desc?.M?.en?.S,
        it: item.desc?.M?.it?.S,
      },
      longDesc: item.longDesc
        ? {
            en: item.longDesc.M?.en?.S,
            it: item.longDesc.M?.it?.S,
          }
        : null,
      features: item.features?.L
        ? item.features.L.map((f: any) => ({
            en: f.M?.en?.S,
            it: f.M?.it?.S,
          }))
        : [],
      price: Number(item.price?.N),
      image: item.image?.S,
      tags: item.tags?.SS || [],
      stock: Number(item.stock?.N || 0),
      weightKg: item.weightKg ? Number(item.weightKg.N) : null,
      volumeCm3: item.volumeCm3 ? Number(item.volumeCm3.N) : null,
      createdAt: item.createdAt?.S,
      updatedAt: item.updatedAt?.S || null,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(product),
    };
  } catch (err) {
    console.error("Error fetching product", err);
    return { statusCode: 500, body: "Error fetching product" };
  }
};
