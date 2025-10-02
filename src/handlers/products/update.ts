import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const tableName = process.env.PRODUCTS_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const pathId = event.pathParameters?.id;
    if (!pathId) {
      return { statusCode: 400, body: "Missing productId in path" };
    }

    if (!event.body) {
      return { statusCode: 400, body: "Missing body" };
    }

    const { title, desc, price, image, tags, stock, longDesc, features } = JSON.parse(event.body);

    const updates: string[] = [];
    const expAttrNames: Record<string, string> = {};
    const expAttrValues: Record<string, any> = {};

    if (title) {
      updates.push("#t = :title");
      expAttrNames["#t"] = "title";
      expAttrValues[":title"] = {
        M: { en: { S: title.en }, it: { S: title.it } },
      };
    }

    if (desc) {
      updates.push("#d = :desc");
      expAttrNames["#d"] = "desc";
      expAttrValues[":desc"] = {
        M: { en: { S: desc.en }, it: { S: desc.it } },
      };
    }

    if (price !== undefined) {
      updates.push("#p = :price");
      expAttrNames["#p"] = "price";
      expAttrValues[":price"] = { N: price.toString() };
    }

    if (image) {
      updates.push("#i = :image");
      expAttrNames["#i"] = "image";
      expAttrValues[":image"] = { S: image };
    }

    if (tags) {
      updates.push("#tags = :tags");
      expAttrNames["#tags"] = "tags";
      expAttrValues[":tags"] = { SS: tags };
    }

    if (stock !== undefined) {
      updates.push("#s = :stock");
      expAttrNames["#s"] = "stock";
      expAttrValues[":stock"] = { N: stock.toString() };
    }

    if (longDesc) {
      updates.push("#ld = :longDesc");
      expAttrNames["#ld"] = "longDesc";
      expAttrValues[":longDesc"] = {
        M: { en: { S: longDesc.en }, it: { S: longDesc.it } },
      };
    }

    // ✅ FIX FEATURES
    if (features) {
      updates.push("#f = :features");
      expAttrNames["#f"] = "features";
      expAttrValues[":features"] = {
        L: features
          .filter((f: any) => f && (f.en || f.it)) // togli null o vuoti
          .map((f: { en: string; it: string }) => ({
            M: {
              en: { S: f.en },
              it: { S: f.it },
            },
          })),
      };
    }

    if (updates.length === 0) {
      return { statusCode: 400, body: "No fields to update" };
    }

    const cmd = new UpdateItemCommand({
      TableName: tableName,
      Key: { productId: { S: pathId } },
      UpdateExpression: "SET " + updates.join(", "),
      ExpressionAttributeNames: expAttrNames,
      ExpressionAttributeValues: expAttrValues,
    });

    await client.send(cmd);

    return {
      statusCode: 200,
      body: JSON.stringify({ productId: pathId, updated: true }),
    };
  } catch (err) {
    console.error("Error updating product", err);
    return { statusCode: 500, body: "Error updating product" };
  }
};
