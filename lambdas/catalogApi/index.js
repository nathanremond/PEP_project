import { ScanCommand, GetCommand, PutCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.dynamo.js";

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  const raw = event.body;
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function scanAll(tableName) {
  const items = [];
  let startKey;
  do {
    const out = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: startKey,
      })
    );
    items.push(...(out.Items ?? []));
    startKey = out.LastEvaluatedKey;
  } while (startKey);
  return items;
}

function num(x) {
  const n = Number(x);
  return Number.isNaN(n) ? null : n;
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const path = event.rawPath || "";

  const circuitsTable = process.env.CIRCUITS_TABLE;
  const constructorsTable = process.env.CONSTRUCTORS_TABLE;
  const driversTable = process.env.DRIVERS_TABLE;
  const seasonsTable = process.env.SEASONS_TABLE;

  try {
    if (method === "GET" && path === "/circuits") {
      const items = await scanAll(circuitsTable);
      items.sort((a, b) => Number(a.circuitId) - Number(b.circuitId));
      return json(200, { items });
    }

    if (method === "GET" && path === "/constructors") {
      const items = await scanAll(constructorsTable);
      items.sort((a, b) => Number(a.constructorId) - Number(b.constructorId));
      return json(200, { items });
    }

    if (method === "GET" && path === "/drivers") {
      const items = await scanAll(driversTable);
      items.sort((a, b) => String(a.surname).localeCompare(String(b.surname)));
      return json(200, { items });
    }

    if (method === "GET" && path === "/seasons") {
      const items = await scanAll(seasonsTable);
      items.sort((a, b) => String(b.season).localeCompare(String(a.season)));
      return json(200, { items });
    }

    const seasonMatch = path.match(/^\/seasons\/([^/]+)$/);
    if (method === "GET" && seasonMatch) {
      const season = decodeURIComponent(seasonMatch[1]);
      const out = await ddb.send(
        new GetCommand({
          TableName: seasonsTable,
          Key: { season },
        })
      );
      if (!out.Item) return json(404, { message: "Saison introuvable" });
      return json(200, out.Item);
    }

    if (method === "POST" && path === "/seasons") {
      const body = parseBody(event);
      if (!body?.season || !Array.isArray(body.driverIds) || !Array.isArray(body.constructorIds)) {
        return json(400, {
          message:
            "Body attendu: { season: string, driverIds: number[], constructorIds: number[] }",
        });
      }

      const season = String(body.season);
      const driverIds = [...new Set(body.driverIds.map(num).filter((n) => n != null))];
      const constructorIds = [
        ...new Set(body.constructorIds.map(num).filter((n) => n != null)),
      ];

      if (driverIds.length === 0 || constructorIds.length === 0) {
        return json(400, {
          message: "Au moins un pilote et un constructeur (ids numeriques) requis",
        });
      }

      const driverKeys = driverIds.map((driverId) => ({ driverId }));
      const consKeys = constructorIds.map((constructorId) => ({ constructorId }));

      async function batchGetKeys(tableName, keys) {
        const out = [];
        for (let i = 0; i < keys.length; i += 100) {
          const chunk = keys.slice(i, i + 100);
          const res = await ddb.send(
            new BatchGetCommand({
              RequestItems: { [tableName]: { Keys: chunk } },
            })
          );
          out.push(...(res.Responses?.[tableName] ?? []));
        }
        return out;
      }

      const dItems = await batchGetKeys(driversTable, driverKeys);
      const cItems = await batchGetKeys(constructorsTable, consKeys);
      if (dItems.length !== driverIds.length) {
        return json(400, {
          message: "Certains driverIds sont invalides (voir GET /drivers)",
        });
      }
      if (cItems.length !== constructorIds.length) {
        return json(400, {
          message: "Certains constructorIds sont invalides (voir GET /constructors)",
        });
      }

      const item = {
        season,
        driverIds,
        constructorIds,
        createdAt: new Date().toISOString(),
      };

      await ddb.send(
        new PutCommand({
          TableName: seasonsTable,
          Item: item,
          ConditionExpression: "attribute_not_exists(season)",
        })
      );

      return json(201, { message: "Saison creee", season: item });
    }

    return json(404, { message: "Route inconnue" });
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") {
      return json(409, { message: "Cette saison existe deja" });
    }
    console.error(e);
    return json(500, { message: e.message });
  }
};
