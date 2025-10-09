import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({});
const tableName = process.env.PRODUCTS_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!event.body) {
      return { statusCode: 400, body: "Missing body" };
    }

    const {
      title,
      desc,
      price,
      image,
      tags = [],
      stock = 0,
      longDesc,
      features,
      weightKg,
      volumeCm3,
    } = JSON.parse(event.body);

    if (!title?.en || !title?.it) {
      return { statusCode: 400, body: "title must have en and it" };
    }

    if (!desc?.en || !desc?.it) {
      return { statusCode: 400, body: "desc must have en and it" };
    }

    const productId = uuidv4();

    const item: any = {
      productId: { S: productId },
      title: { M: { en: { S: title.en }, it: { S: title.it } } },
      desc: { M: { en: { S: desc.en }, it: { S: desc.it } } },
      price: { N: price.toString() },
      image: { S: image },
      tags: { SS: tags },
      stock: { N: stock.toString() },
      createdAt: { S: new Date().toISOString() },
      updatedAt: { S: new Date().toISOString() },
    };

    // ✅ longDesc (multilingua)
    if (longDesc?.en && longDesc?.it) {
      item.longDesc = {
        M: {
          en: { S: longDesc.en },
          it: { S: longDesc.it },
        },
      };
    }

    // ✅ features (lista multilingua)
    if (Array.isArray(features) && features.length > 0) {
      item.features = {
        L: features
          .filter((f: any) => f && (f.en || f.it))
          .map((f: { en: string; it: string }) => ({
            M: {
              en: { S: f.en },
              it: { S: f.it },
            },
          })),
      };
    }

    // ✅ weightKg e volumeCm3
    if (typeof weightKg === "number") {
      item.weightKg = { N: weightKg.toString() };
    }

    if (typeof volumeCm3 === "number") {
      item.volumeCm3 = { N: volumeCm3.toString() };
    }

    const cmd = new PutItemCommand({
      TableName: tableName,
      Item: item,
    });

    await client.send(cmd);

    return {
      statusCode: 201,
      body: JSON.stringify({ productId }),
    };
  } catch (err) {
    console.error("Error adding product", err);
    return { statusCode: 500, body: "Error adding product" };
  }
};
