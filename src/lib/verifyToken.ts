// lib/verifyToken.ts
import jwt, { JwtPayload } from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";

const cache: { [key: string]: any } = {};

/**
 * Verifica un token Cognito JWT (idToken o accessToken)
 * @param token - il JWT da verificare
 * @param userPoolId - es: eu-central-1_xxxxx
 * @param region - es: eu-central-1
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

  // scarica le JWKS di Cognito (con cache locale)
  const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
  if (!cache[jwksUrl]) {
    const res = await fetch(jwksUrl);
    if (!res.ok) {
      throw new Error(`Errore nel fetch delle JWKS: ${res.status}`);
    }
    const data = await res.json();
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
