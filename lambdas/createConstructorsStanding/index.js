import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.dynamo.js";

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

function uniqueConstructorsFromRace(competitors) {
  const seen = new Set();
  const list = [];
  for (const c of competitors || []) {
    const id = c.constructorRef ?? c.constructorId;
    if (id && !seen.has(id)) {
      seen.add(id);
      list.push({
        constructorRef: id,
        position: 1,
        points: 0,
        winNumber: 0,
      });
    }
  }
  return list;
}

function applyRacePoints(standingCompetitors, raceCompetitors) {
  for (const competitor of raceCompetitors || []) {
    if (competitor.position > 10) continue;
    const pts = pointsByPosition[competitor.position];
    if (pts == null) continue;
    const cr = competitor.constructorRef ?? competitor.constructorId;
    const current = standingCompetitors.find(
      (x) => (x.constructorRef ?? x.constructorId) === cr
    );
    if (!current) continue;
    current.points += pts;
    if (competitor.position === 1) current.winNumber += 1;
  }
  standingCompetitors.sort((a, b) => b.points - a.points);
  standingCompetitors.forEach((c, i) => {
    c.position = i + 1;
  });
}

export const handler = async (event) => {
  const tableName = process.env.CONSTRUCTORS_STANDINGS_TABLE;

  try {
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    const raceResult = snsMessage.race;
    const raceSeason = raceResult.season;

    const getParams = {
      TableName: tableName,
      Key: { season: raceSeason },
    };

    const result = await ddb.send(new GetCommand(getParams));
    const existing = result.Item;

    if (existing) {
      applyRacePoints(existing.competitors, raceResult.competitors);

      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { season: existing.season },
          UpdateExpression: "SET competitors = :competitors",
          ExpressionAttributeValues: {
            ":competitors": existing.competitors,
          },
          ConditionExpression: "attribute_exists(season)",
        })
      );

      return {
        statusCode: 201,
        body: JSON.stringify({
          message: "Constructors standing updated successfully",
        }),
      };
    }

    const newCompetitors = uniqueConstructorsFromRace(raceResult.competitors);
    if (newCompetitors.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Aucun constructorRef dans les résultats de course",
        }),
      };
    }

    const newStanding = {
      season: raceSeason,
      competitors: newCompetitors,
    };

    applyRacePoints(newStanding.competitors, raceResult.competitors);

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
        message: "Constructors standing created successfully",
        constructorsstanding: newStanding,
      }),
    };
  } catch (error) {
    return {
      statusCode:
        error.name === "ConditionalCheckFailedException" ? 409 : 500,
      body: JSON.stringify({
        message:
          error.name === "ConditionalCheckFailedException"
            ? "Constructors standing already exists"
            : error.message,
      }),
    };
  }
};
