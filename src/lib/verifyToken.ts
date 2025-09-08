// lib/verifyToken.ts
import jwt, { JwtPayload } from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";
import axios from "axios";

const cache: { [key: string]: any } = {};

/**
 * Verifica un token Cognito JWT (idToken o accessToken)
 * @param token - il JWT da verificare
 * @param userPoolId - es: eu-west-1_XXXXXX
 * @param region - es: eu-west-1
 */
export async function verifyToken(
  token: string,
  userPoolId: string,
  region: string
): Promise<JwtPayload> {
  const decoded: any = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error("Token non valido");
  }

  const kid = decoded.header.kid;

  // scarica le JWKS di Cognito (cache locale per non rifare sempre la chiamata)
  const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
  if (!cache[jwksUrl]) {
    const { data } = await axios.get(jwksUrl);
    cache[jwksUrl] = data.keys;
  }

  const key = cache[jwksUrl].find((k: any) => k.kid === kid);
  if (!key) {
    throw new Error("Chiave pubblica non trovata");
  }

  const pem = jwkToPem(key);

  return new Promise((resolve, reject) => {
    jwt.verify(token, pem, { algorithms: ["RS256"] }, (err, payload) => {
      if (err) return reject(err);
      resolve(payload as JwtPayload);
    });
  });
}
