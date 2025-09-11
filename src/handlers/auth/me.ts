import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import jwt from "jsonwebtoken";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const clientId = process.env.COGNITO_APP_CLIENT_ID!;
const jwtSecret = process.env.JWT_SECRET!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("Event headers:", event.headers);

    // 1️⃣ Legge Authorization header
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing Authorization header" }) };
    }

    const token = authHeader.substring("Bearer ".length);

    // 2️⃣ Verifica il JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      console.error("Invalid JWT:", err);
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired session" }) };
    }

    const refreshToken = decoded.refreshToken;
    if (!refreshToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "No refreshToken in session" }) };
    }

    // 3️⃣ Usa il refreshToken per prendere nuovi token da Cognito
    const authRes = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: clientId,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })
    );

    const idToken = authRes.AuthenticationResult?.IdToken;
    const accessToken = authRes.AuthenticationResult?.AccessToken;

    if (!idToken || !accessToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unable to refresh tokens" }) };
    }

    // 4️⃣ Risposta allo store
    return {
      statusCode: 200,
      body: JSON.stringify({
        idToken,
        accessToken,
      }),
    };
  } catch (err: any) {
    console.error("Errore /auth/me:", err.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: err.message }),
    };
  }
};
