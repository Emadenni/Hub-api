import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const tableName = process.env.PRODUCTS_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!event.body) return { statusCode: 400, body: "Missing body" };
    const { productId, title, desc, price, image, tags, stock } = JSON.parse(event.body);

    if (!productId) {
      return { statusCode: 400, body: "Missing productId" };
    }

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

    const cmd = new UpdateItemCommand({
      TableName: tableName,
      Key: { productId: { S: productId } },
      UpdateExpression: "SET " + updates.join(", "),
      ExpressionAttributeNames: expAttrNames,
      ExpressionAttributeValues: expAttrValues,
    });

    await client.send(cmd);

    return { statusCode: 200, body: JSON.stringify({ productId }) };
  } catch (err) {
    console.error("Error updating product", err);
    return { statusCode: 500, body: "Error updating product" };
  }
};
