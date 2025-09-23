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

    const { title, desc, price, image, tags = [], stock = 0 } = JSON.parse(event.body);

    if (!title?.en || !title?.it) {
      return { statusCode: 400, body: "title must have en and it" };
    }
    if (!desc?.en || !desc?.it) {
      return { statusCode: 400, body: "desc must have en and it" };
    }

    const productId = uuidv4();

    const cmd = new PutItemCommand({
      TableName: tableName,
      Item: {
        productId: { S: productId },
        title: { M: { en: { S: title.en }, it: { S: title.it } } },
        desc: { M: { en: { S: desc.en }, it: { S: desc.it } } },
        price: { N: price.toString() },
        image: { S: image },
        tags: { SS: tags },
        stock: { N: stock.toString() },
        createdAt: { S: new Date().toISOString() },
      },
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
