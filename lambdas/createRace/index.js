import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.dynamo.js";

export const handler = async (event) => {
  try {
    const race = {
        circuitId: event.circuitId,
        season: event.season,
        competitors: event.competitors,
    };

    await ddb.send(
      new PutCommand({
        TableName: "races",
        Item: race,
        ConditionExpression: "attribute_not_exists(season)",
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Race created successfully",
        race: race
      }),
    };
  } catch (error) {

    return {
      statusCode: error.name === "ConditionalCheckFailedException" ? 409 : 500,
      body: JSON.stringify({
        message:
          error.name === "ConditionalCheckFailedException"
            ? "Race already exists"
            : error.message,
      }),
    };
  }
};