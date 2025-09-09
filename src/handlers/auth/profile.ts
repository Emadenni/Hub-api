import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { verifyToken } from "../../lib/verifyToken";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const userPoolId = process.env.COGNITO_USER_POOL_ID!;
const clientId = process.env.COGNITO_APP_CLIENT_ID!;
const region = process.env.AWS_REGION!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // 1️⃣ prendo il sessionId dal cookie
    const cookies = event.cookies || [];
    const sessionCookie = cookies.find((c) => c.startsWith("sessionId="));
    if (!sessionCookie) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing sessionId" }) };
    }

    const sessionId = sessionCookie.split("=")[1];

    // 2️⃣ recupero refreshToken da DynamoDB
    const res = await db.send(
      new GetCommand({
        TableName: "hub_sessions",
        Key: { sessionId },
      })
    );

    if (!res.Item?.refreshToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid session" }) };
    }

    const refreshToken = res.Item.refreshToken;

    // 3️⃣ scambio refreshToken con nuovi token Cognito
    const authRes = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: clientId,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })
    );

    const idToken = authRes.AuthenticationResult?.IdToken;
    if (!idToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Failed to refresh token" }) };
    }

    // 4️⃣ verifico l’idToken
    const decoded = await verifyToken(idToken, userPoolId, region);

    const userId = decoded.sub!;
    const email = decoded.email;
    const name = decoded.name;

    // 5️⃣ risposta con dati utente
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: userId,
        email,
        name,
      }),
    };
  } catch (err) {
    console.error("Errore /auth/profile:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
