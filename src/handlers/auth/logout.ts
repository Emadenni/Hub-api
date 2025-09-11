import { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  try {
    // Ora non c’è più nulla da cancellare sul backend
    // Basta dire al client di eliminare il sessionToken da localStorage
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Logged out" }),
    };
  } catch (err: any) {
    console.error("❌ Errore /auth/logout:", err.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: err.message }),
    };
  }
};
