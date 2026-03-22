import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { ddb } from "./db.dynamo.js";

const snsClient = new SNSClient({});

function parsePayload(event) {
  if (event.requestContext?.http) {
    const raw = event.body;
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }
  return event;
}

function jsonResponse(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function num(x) {
  const n = Number(x);
  return Number.isNaN(n) ? null : n;
}

export const handler = async (event) => {
  const racesTable = process.env.RACES_TABLE;
  const topicArn = process.env.RACE_EVENTS_TOPIC_ARN;
  const seasonsTable = process.env.SEASONS_TABLE;
  const circuitsTable = process.env.CIRCUITS_TABLE;
  const driversTable = process.env.DRIVERS_TABLE;
  const constructorsTable = process.env.CONSTRUCTORS_TABLE;

  try {
    const body = parsePayload(event);
    if (!body?.season || !Array.isArray(body?.competitors)) {
      return jsonResponse(400, {
        message:
          "Body JSON: { season, circuitId (nombre), competitors: [{ driverId, constructorId, position }] }",
      });
    }

    const circuitId = num(body.circuitId);
    if (circuitId == null) {
      return jsonResponse(400, {
        message: "circuitId numerique requis (voir GET /circuits.circuitId)",
      });
    }

    const season = String(body.season);

    const seasonOut = await ddb.send(
      new GetCommand({ TableName: seasonsTable, Key: { season } })
    );
    if (!seasonOut.Item) {
      return jsonResponse(400, {
        message: "Saison inexistante: creez-la avec POST /seasons",
      });
    }

    const seasonDriverIds = new Set(
      (seasonOut.Item.driverIds ?? []).map((x) => Number(x))
    );
    const seasonConstructorIds = new Set(
      (seasonOut.Item.constructorIds ?? []).map((x) => Number(x))
    );

    const circuitOut = await ddb.send(
      new GetCommand({
        TableName: circuitsTable,
        Key: { circuitId },
      })
    );
    if (!circuitOut.Item) {
      return jsonResponse(400, {
        message: "circuitId inconnu dans les donnees de reference",
      });
    }

    const normalizedCompetitors = [];
    for (const comp of body.competitors) {
      const driverId = num(comp.driverId);
      const constructorId = num(comp.constructorId);
      const pos = num(comp.position);
      if (driverId == null || constructorId == null || pos == null) {
        return jsonResponse(400, {
          message: "Chaque concurrent doit avoir driverId, constructorId, position (nombres)",
        });
      }
      if (!seasonDriverIds.has(driverId)) {
        return jsonResponse(400, {
          message: `driverId ${driverId} non inscrit pour cette saison (POST /seasons)`,
        });
      }
      if (!seasonConstructorIds.has(constructorId)) {
        return jsonResponse(400, {
          message: `constructorId ${constructorId} non inscrit pour cette saison`,
        });
      }

      const [dItem, cItem] = await Promise.all([
        ddb.send(new GetCommand({ TableName: driversTable, Key: { driverId } })),
        ddb.send(
          new GetCommand({
            TableName: constructorsTable,
            Key: { constructorId },
          })
        ),
      ]);
      if (!dItem.Item) {
        return jsonResponse(400, {
          message: `driverId inconnu: ${driverId} (voir GET /drivers)`,
        });
      }
      if (!cItem.Item) {
        return jsonResponse(400, {
          message: `constructorId inconnu: ${constructorId} (voir GET /constructors)`,
        });
      }

      normalizedCompetitors.push({
        driverId,
        constructorId,
        position: pos,
      });
    }

    const race = {
      season,
      circuitId,
      competitors: normalizedCompetitors,
      createdAt: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: racesTable,
        Item: race,
        ConditionExpression:
          "attribute_not_exists(season) AND attribute_not_exists(circuitId)",
      })
    );

    await snsClient.send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({
          eventType: "RACE_CREATED",
          race: race,
        }),
      })
    );

    return jsonResponse(201, {
      message: "Course enregistree, evenement SNS publie",
      race,
    });
  } catch (error) {
    return jsonResponse(
      error.name === "ConditionalCheckFailedException" ? 409 : 500,
      {
        message:
          error.name === "ConditionalCheckFailedException"
            ? "Une course existe deja pour cette saison sur ce circuit"
            : error.message,
      }
    );
  }
};
