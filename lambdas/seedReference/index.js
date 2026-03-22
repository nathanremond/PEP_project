import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { parse } from "csv-parse/sync";

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function csvCast(value) {
  if (value === "\\N" || value === "") return null;
  const n = Number(value);
  if (value !== "" && !Number.isNaN(n) && String(n) === String(value).trim()) return n;
  return value;
}

async function loadCsv(bucket, key) {
  const out = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const text = await out.Body.transformToString("utf-8");
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    cast: csvCast,
  });
}

async function batchWriteAll(tableName, items) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }
  for (const chunk of chunks) {
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((Item) => ({ PutRequest: { Item } })),
        },
      })
    );
  }
}

export const handler = async () => {
  const bucket = process.env.SEED_BUCKET;
  const circuitsTable = process.env.CIRCUITS_TABLE;
  const constructorsTable = process.env.CONSTRUCTORS_TABLE;
  const driversTable = process.env.DRIVERS_TABLE;

  const circuits = await loadCsv(bucket, "circuits.csv");
  const constructors = await loadCsv(bucket, "constructors.csv");
  const drivers = await loadCsv(bucket, "drivers.csv");

  const circuitItems = circuits
    .filter((r) => r.circuitRef)
    .map((r) => ({
      circuitRef: String(r.circuitRef),
      circuitId: r.circuitId != null ? Number(r.circuitId) : null,
      name: r.name,
      location: r.location,
      country: r.country,
      lat: r.lat,
      lng: r.lng,
      alt: r.alt,
      url: r.url,
    }));

  const constructorItems = constructors
    .filter((r) => r.constructorRef)
    .map((r) => ({
      constructorRef: String(r.constructorRef),
      constructorId: r.constructorId != null ? Number(r.constructorId) : null,
      name: r.name,
      nationality: r.nationality,
      url: r.url,
    }));

  const driverItems = drivers
    .filter((r) => r.driverRef)
    .map((r) => ({
      driverRef: String(r.driverRef),
      driverId: r.driverId != null ? Number(r.driverId) : null,
      number: r.number,
      code: r.code,
      forename: r.forename,
      surname: r.surname,
      dob: r.dob,
      nationality: r.nationality,
      url: r.url,
    }));

  await batchWriteAll(circuitsTable, circuitItems);
  await batchWriteAll(constructorsTable, constructorItems);
  await batchWriteAll(driversTable, driverItems);

  return {
    circuits: circuitItems.length,
    constructors: constructorItems.length,
    drivers: driverItems.length,
  };
};
