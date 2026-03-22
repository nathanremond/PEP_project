import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.dynamo.js";

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
    
    if (driversstanding) {
      //Calcul des points
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

      raceResult.competitors.forEach((competitor) => {
        if (competitor.position <= 10) {
          const dr =
            competitor.driverRef ?? competitor.driverId;
          const currentDriver = driversstanding.competitors.find(
            (c) => (c.driverRef ?? c.driverId) === dr
          );
          if (!currentDriver) return;

          currentDriver.points += pointsByPosition[competitor.position];

          if (competitor.position === 1) {
            currentDriver.winNumber += 1;
          }
        }
      });

      //Modifier le classement
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
            ":competitors": driversstanding.competitors
          },
          ConditionExpression: "attribute_exists(season)",
          ReturnValues: "ALL_NEW"
        })
      );

      return {
        statusCode: 201,
        body: JSON.stringify({
          message: "Drivers standing updated successfully"
        })
      };
    } else {
      //Création du classement
      const newCompetitors = [];
      raceResult.competitors.forEach((competitor) => {
        const dr = competitor.driverRef ?? competitor.driverId;
        newCompetitors.push({
          driverRef: dr,
          position: 1,
          points: 0,
          winNumber: 0,
        });
      });

      const newStanding = {
        season: raceSeason,
        competitors: newCompetitors,
      };

      //Calcul des points
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

      raceResult.competitors.forEach((competitor) => {
        if (competitor.position <= 10) {
          const dr = competitor.driverRef ?? competitor.driverId;
          const currentDriver = newStanding.competitors.find(
            (c) => (c.driverRef ?? c.driverId) === dr
          );
          if (!currentDriver) return;

          currentDriver.points += pointsByPosition[competitor.position];

          if (competitor.position === 1) {
            currentDriver.winNumber += 1;
          }
        }
      });

      //Calcul des positions
      newStanding.competitors.sort((a, b) => b.points - a.points);

      newStanding.competitors.forEach((competitor, index) => {
        competitor.position = index + 1;
      })

      //Création du classement
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
    }
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