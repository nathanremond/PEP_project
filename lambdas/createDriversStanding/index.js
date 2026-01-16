import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.dynamo.js";

export const handler = async (event) => {
  try {
    const raceResult = event;
    
    const raceSeason = raceResult.season;
   
    const params = {
      TableName: "driversstandings",
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
          const currentDriver = driversstanding.competitors.find(
            (c) => c.driverId === competitor.driverId
          );

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
          TableName: "driversstandings",
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
        newCompetitors.push({
          driverId: competitor.driverId,
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
          const currentDriver = newStanding.competitors.find(
            (c) => c.driverId === competitor.driverId
          );

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
          TableName: "driversstandings",
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