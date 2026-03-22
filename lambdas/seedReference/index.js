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
    .filter((r) => r.circuitId != null && !Number.isNaN(Number(r.circuitId)))
    .map((r) => ({
      circuitId: Number(r.circuitId),
      slug: r.circuitRef != null ? String(r.circuitRef) : undefined,
      name: r.name,
      location: r.location,
      country: r.country,
      lat: r.lat,
      lng: r.lng,
      alt: r.alt,
      url: r.url,
    }));

  const constructorItems = constructors
    .filter(
      (r) => r.constructorId != null && !Number.isNaN(Number(r.constructorId))
    )
    .map((r) => ({
      constructorId: Number(r.constructorId),
      slug: r.constructorRef != null ? String(r.constructorRef) : undefined,
      name: r.name,
      nationality: r.nationality,
      url: r.url,
    }));

  const driverItems = drivers
    .filter((r) => r.driverId != null && !Number.isNaN(Number(r.driverId)))
    .map((r) => ({
      driverId: Number(r.driverId),
      slug: r.driverRef != null ? String(r.driverRef) : undefined,
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
