import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.dynamo.js";

function driverIdOf(c) {
  const v = c.driverId ?? c.driverRef;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export const handler = async (event) => {
  const tableName = process.env.DRIVERS_STANDINGS_TABLE;

  try {
    console.log("RAW EVENT:", JSON.stringify(event));

    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    const raceResult = snsMessage.race;

    console.log("RACE RECEIVED:", raceResult);

    const raceSeason = raceResult.season;

    const params = {
      TableName: tableName,
      Key: {
        season: raceSeason,
      },
    };

    const result = await ddb.send(new GetCommand(params));

    const driversstanding = result.Item;
    console.log(driversstanding);

    const pointsByPosition = {
      1: 25,
      2: 18,
      3: 15,
      4: 12,
      5: 10,
      6: 8,
      7: 6,
      8: 4,
      9: 2,
      10: 1,
    };

    if (driversstanding) {
      raceResult.competitors.forEach((competitor) => {
        if (competitor.position <= 10) {
          const did = driverIdOf(competitor);
          if (did == null) return;
          const currentDriver = driversstanding.competitors.find(
            (c) => driverIdOf(c) === did
          );
          if (!currentDriver) return;

          currentDriver.points += pointsByPosition[competitor.position];

          if (competitor.position === 1) {
            currentDriver.winNumber += 1;
          }
        }
      });

      driversstanding.competitors.sort((a, b) => b.points - a.points);

      driversstanding.competitors.forEach((competitor, index) => {
        competitor.position = index + 1;
      });

      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            season: driversstanding.season,
          },
          UpdateExpression: `
            SET competitors = :competitors
          `,
          ExpressionAttributeValues: {
            ":competitors": driversstanding.competitors,
          },
          ConditionExpression: "attribute_exists(season)",
          ReturnValues: "ALL_NEW",
        })
      );

      return {
        statusCode: 201,
        body: JSON.stringify({
          message: "Drivers standing updated successfully",
        }),
      };
    }

    const newCompetitors = [];
    raceResult.competitors.forEach((competitor) => {
      const did = driverIdOf(competitor);
      if (did == null) return;
      newCompetitors.push({
        driverId: did,
        position: 1,
        points: 0,
        winNumber: 0,
      });
    });

    const newStanding = {
      season: raceSeason,
      competitors: newCompetitors,
    };

    raceResult.competitors.forEach((competitor) => {
      if (competitor.position <= 10) {
        const did = driverIdOf(competitor);
        if (did == null) return;
        const currentDriver = newStanding.competitors.find(
          (c) => driverIdOf(c) === did
        );
        if (!currentDriver) return;

        currentDriver.points += pointsByPosition[competitor.position];

        if (competitor.position === 1) {
          currentDriver.winNumber += 1;
        }
      }
    });

    newStanding.competitors.sort((a, b) => b.points - a.points);

    newStanding.competitors.forEach((competitor, index) => {
      competitor.position = index + 1;
    });

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: newStanding,
        ConditionExpression: "attribute_not_exists(season)",
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Drivers standing created successfully",
        driversstanding: newStanding,
      }),
    };
  } catch (error) {
    return {
      statusCode: error.name === "ConditionalCheckFailedException" ? 409 : 500,
      body: JSON.stringify({
        message:
          error.name === "ConditionalCheckFailedException"
            ? "Drivers standing already exists"
            : error.message,
      }),
    };
  }
};
