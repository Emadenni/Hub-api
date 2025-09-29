import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import jwt from "jsonwebtoken";
import { verifyToken } from "../../lib/verifyToken";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const JWT_SECRET = process.env.JWT_SECRET!;
const clientId = process.env.COGNITO_APP_CLIENT_ID!;
const userPoolId = process.env.COGNITO_USER_POOL_ID!;
const region = process.env.AWS_REGION!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;
    if (!body?.code) {
      return { statusCode: 400, body: JSON.stringify({ error: "code required" }) };
    }

    // Recupera l’item con sessionId = code
    const res = await db.send(new GetCommand({
      TableName: "hub_sessions",
      Key: { sessionId: body.code },
    }));

    if (!res.Item?.refreshToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired code" }) };
    }

    const refreshToken = res.Item.refreshToken as string;

    // Elimina subito (one-time)
    await db.send(new DeleteCommand({
      TableName: "hub_sessions",
      Key: { sessionId: body.code },
    }));

    // 🔑 Usa il refreshToken per ottenere idToken da Cognito
    const authRes = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: clientId,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })
    );

    const idToken = authRes.AuthenticationResult?.IdToken;
    if (!idToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unable to refresh user data" }) };
    }

    // Decodifica l’idToken
    const decoded = await verifyToken(idToken, userPoolId, region);

    const userId = decoded.sub;
    const email = decoded.email;
    const name = decoded.name;

    // 🔥 Crea sessionToken con refreshToken + dati utente
    const sessionToken = jwt.sign(
      { refreshToken, sub: userId, email, name },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionToken }),
    };
  } catch (err: any) {
    console.error("❌ /auth/exchange error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error", details: err.message }),
    };
  }
};
