import 'dotenv/config';
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

async function main() {
  const tables = await client.send(new ListTablesCommand({}));
  console.log("Tabelle trovate:", tables.TableNames);
}

main().catch(console.error);
