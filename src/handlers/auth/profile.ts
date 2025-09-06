import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { verifyToken } from "../../lib/verifyToken";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const userPoolId = process.env.COGNITO_USER_POOL_ID!;
const region = process.env.AWS_REGION!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Missing token" }),
      };
    }

    const token = authHeader.replace("Bearer ", "");

    // ✅ Verifica token con Cognito
    const decoded = await verifyToken(token, userPoolId, region);

    const userId = decoded.sub!;
    const email = decoded.email;
    const name = decoded.name;

    // ✅ Recupera extra da hub_users
    const userRes = await client.send(
      new GetItemCommand({
        TableName: "hub_users",
        Key: { userId: { S: userId } }, // 👈 deve corrispondere alla PK della tabella
      })
    );

    const user = userRes.Item ? unmarshall(userRes.Item) : {};

    return {
      statusCode: 200,
      body: JSON.stringify({
        id: userId,
        email,
        name,
        ...user,
      }),
    };
  } catch (err: any) {
    console.error("Errore /auth/profile:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
