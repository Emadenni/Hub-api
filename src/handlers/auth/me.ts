import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const clientId = process.env.COGNITO_APP_CLIENT_ID!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("Event cookies:", event.cookies);
    console.log("Event headers:", event.headers);

    const cookies = event.cookies || [];
    const sessionCookie = cookies.find((c) => c.startsWith("sessionId="));
    if (!sessionCookie) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing sessionId cookie" }) };
    }

    const sessionId = sessionCookie.split("=")[1];
    console.log("SessionId:", sessionId);

    // Recupera la refreshToken da hub_sessions
    const res = await db.send(
      new GetCommand({
        TableName: "hub_sessions",
        Key: { sessionId }, // 👈 qui lib-dynamodb fa già il marshalling
      })
    );

    console.log("DynamoDB result:", res);

    if (!res.Item?.refreshToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid session" }) };
    }

    // Scambia refreshToken con nuovi token
    const authRes = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: clientId,
        AuthParameters: {
          REFRESH_TOKEN: res.Item.refreshToken,
        },
      })
    );

    console.log("Cognito authRes:", authRes);

    const idToken = authRes.AuthenticationResult?.IdToken;
    const accessToken = authRes.AuthenticationResult?.AccessToken;

    if (!idToken || !accessToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unable to refresh tokens" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        idToken,
        accessToken,
      }),
    };
  } catch (err: any) {
    console.error("Errore /auth/me:", err.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error", details: err.message }) };
  }
};
