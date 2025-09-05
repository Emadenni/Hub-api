export function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

export function noContentResponse() {
  return {
    statusCode: 204,
    headers: {},
    body: "",
  };
}
