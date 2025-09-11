import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import jwt from "jsonwebtoken";
import { verifyToken } from "../../lib/verifyToken";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const clientId = process.env.COGNITO_APP_CLIENT_ID!;
const userPoolId = process.env.COGNITO_USER_POOL_ID!;
const region = process.env.AWS_REGION!;
const jwtSecret = process.env.JWT_SECRET!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // 1️⃣ Legge Authorization header
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing Authorization header" }) };
    }

    const token = authHeader.substring("Bearer ".length);

    // 2️⃣ Verifica il JWT e recupera refreshToken
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

    // 3️⃣ Scambia refreshToken con nuovi token Cognito
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

    // 4️⃣ Verifica e decodifica l’idToken Cognito
    const cognitoDecoded = await verifyToken(idToken, userPoolId, region);

    const userId = cognitoDecoded.sub!;
    const email = cognitoDecoded.email;
    const name = cognitoDecoded.name;

    // 5️⃣ Risposta con dati utente
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: userId,
        email,
        name,
      }),
    };
  } catch (err: any) {
    console.error("Errore /auth/profile:", err.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error", details: err.message }),
    };
  }
};
