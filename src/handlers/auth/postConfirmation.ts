import { Handler, PostConfirmationConfirmSignUpTriggerEvent } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler: Handler<
  PostConfirmationConfirmSignUpTriggerEvent,
  PostConfirmationConfirmSignUpTriggerEvent
> = async (event) => {
  try {
    const attrs = event.request.userAttributes;
    const userId = attrs.sub;
    const email = attrs.email ?? "";
    const name = attrs.name ?? "";

    await client.send(
      new PutItemCommand({
        TableName: "hub_users",
        Item: {
          userId: { S: userId },
          email: { S: email },
          name: { S: name },
          createdAt: { S: new Date().toISOString() },
          points: { N: "0" },
        },
        ConditionExpression: "attribute_not_exists(userId)",
      })
    );

    console.log(`✅ PostConfirmation: creato hub_users/${userId}`);
    return event; // obbligatorio
  } catch (err) {
    console.error("❌ PostConfirmation error:", err);
    return event;
  }
};
