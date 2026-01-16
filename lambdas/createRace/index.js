import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { ddb } from "./db.dynamo.js";

const snsClient = new SNSClient({ region: "eu-west-3" });

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
    
    await snsClient.send(
      new PublishCommand({
        TopicArn: process.env.RACE_TO_DRIVERS_STANDING_TOPIC_ARN,
        Message: JSON.stringify({
          eventType: "RACE_CREATED",
          race: race,
        }),
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