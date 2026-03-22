import * as path from "path";
import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { SnsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as triggers from "aws-cdk-lib/triggers";

const LAMBDA_PROJECT_ROOT = path.join(__dirname, "..", "..", "lambdas");
const DATA_DIR = path.join(__dirname, "..", "..", "data");

const nodeBundling = {
  forceDockerBundling: false,
  minify: true,
  sourceMap: false,
};

export class PepStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const refCircuitsTable = new dynamodb.Table(this, "PepRefCircuitsTable", {
      // Nom sans "ref" : donnees maitres CSV. Renommer permet le remplacement CFN (changement de cle).
      tableName: "pep-circuits",
      partitionKey: { name: "circuitId", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const refDriversTable = new dynamodb.Table(this, "PepRefDriversTable", {
      tableName: "pep-drivers",
      partitionKey: { name: "driverId", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const refConstructorsTable = new dynamodb.Table(
      this,
      "PepRefConstructorsTable",
      {
        tableName: "pep-constructors",
        partitionKey: {
          name: "constructorId",
          type: dynamodb.AttributeType.NUMBER,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const seasonsTable = new dynamodb.Table(this, "PepSeasonsTable", {
      tableName: "pep-seasons",
      partitionKey: { name: "season", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const racesTable = new dynamodb.Table(this, "PepRacesTable", {
      tableName: "pep-races",
      partitionKey: { name: "season", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "circuitId", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const driversStandingsTable = new dynamodb.Table(
      this,
      "PepDriversStandingsTable",
      {
        tableName: "pep-driversstandings",
        partitionKey: { name: "season", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const constructorsStandingsTable = new dynamodb.Table(
      this,
      "PepConstructorsStandingsTable",
      {
        tableName: "pep-constructorsstandings",
        partitionKey: { name: "season", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const raceEventsTopic = new sns.Topic(this, "PepRaceEventsTopic", {
      topicName: "pep-race-events",
      displayName: "pep-race-events",
    });

    const referenceCsvBucket = new s3.Bucket(this, "PepReferenceCsvBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    const csvDeployment = new s3deploy.BucketDeployment(
      this,
      "PepDeployReferenceCsv",
      {
        sources: [s3deploy.Source.asset(DATA_DIR)],
        destinationBucket: referenceCsvBucket,
        memoryLimit: 512,
      }
    );

    const seedReferenceFn = new lambda_nodejs.NodejsFunction(
      this,
      "PepSeedReferenceFn",
      {
        functionName: "pep-seed-reference",
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(LAMBDA_PROJECT_ROOT, "seedReference", "index.js"),
        timeout: cdk.Duration.minutes(5),
        memorySize: 1024,
        bundling: nodeBundling,
        environment: {
          SEED_BUCKET: referenceCsvBucket.bucketName,
          CIRCUITS_TABLE: refCircuitsTable.tableName,
          DRIVERS_TABLE: refDriversTable.tableName,
          CONSTRUCTORS_TABLE: refConstructorsTable.tableName,
        },
      }
    );
    referenceCsvBucket.grantRead(seedReferenceFn);
    refCircuitsTable.grantWriteData(seedReferenceFn);
    refDriversTable.grantWriteData(seedReferenceFn);
    refConstructorsTable.grantWriteData(seedReferenceFn);

    new triggers.Trigger(this, "PepSeedReferenceTrigger", {
      handler: seedReferenceFn,
      invocationType: triggers.InvocationType.REQUEST_RESPONSE,
      executeAfter: [csvDeployment],
    });

    const catalogFn = new lambda_nodejs.NodejsFunction(this, "PepCatalogApiFn", {
      functionName: "pep-catalog-api",
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(LAMBDA_PROJECT_ROOT, "catalogApi", "index.js"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      bundling: nodeBundling,
      environment: {
        CIRCUITS_TABLE: refCircuitsTable.tableName,
        DRIVERS_TABLE: refDriversTable.tableName,
        CONSTRUCTORS_TABLE: refConstructorsTable.tableName,
        SEASONS_TABLE: seasonsTable.tableName,
      },
    });
    refCircuitsTable.grantReadData(catalogFn);
    refDriversTable.grantReadData(catalogFn);
    refConstructorsTable.grantReadData(catalogFn);
    seasonsTable.grantReadWriteData(catalogFn);

    const createRaceFn = new lambda_nodejs.NodejsFunction(this, "PepCreateRaceFn", {
      functionName: "pep-create-race",
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(LAMBDA_PROJECT_ROOT, "createRace", "index.js"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: nodeBundling,
      environment: {
        RACES_TABLE: racesTable.tableName,
        RACE_EVENTS_TOPIC_ARN: raceEventsTopic.topicArn,
        SEASONS_TABLE: seasonsTable.tableName,
        CIRCUITS_TABLE: refCircuitsTable.tableName,
        DRIVERS_TABLE: refDriversTable.tableName,
        CONSTRUCTORS_TABLE: refConstructorsTable.tableName,
      },
    });
    racesTable.grantWriteData(createRaceFn);
    raceEventsTopic.grantPublish(createRaceFn);
    seasonsTable.grantReadData(createRaceFn);
    refCircuitsTable.grantReadData(createRaceFn);
    refDriversTable.grantReadData(createRaceFn);
    refConstructorsTable.grantReadData(createRaceFn);

    const createDriversStandingFn = new lambda_nodejs.NodejsFunction(
      this,
      "PepCreateDriversStandingFn",
      {
        functionName: "pep-create-drivers-standing",
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(LAMBDA_PROJECT_ROOT, "createDriversStanding", "index.js"),
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        bundling: nodeBundling,
        environment: {
          DRIVERS_STANDINGS_TABLE: driversStandingsTable.tableName,
        },
      }
    );
    driversStandingsTable.grantReadWriteData(createDriversStandingFn);
    createDriversStandingFn.addEventSource(
      new SnsEventSource(raceEventsTopic)
    );

    const createConstructorsStandingFn = new lambda_nodejs.NodejsFunction(
      this,
      "PepCreateConstructorsStandingFn",
      {
        functionName: "pep-create-constructors-standing",
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          LAMBDA_PROJECT_ROOT,
          "createConstructorsStanding",
          "index.js"
        ),
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        bundling: nodeBundling,
        environment: {
          CONSTRUCTORS_STANDINGS_TABLE: constructorsStandingsTable.tableName,
        },
      }
    );
    constructorsStandingsTable.grantReadWriteData(createConstructorsStandingFn);
    createConstructorsStandingFn.addEventSource(
      new SnsEventSource(raceEventsTopic)
    );

    const httpApi = new apigwv2.HttpApi(this, "PepHttpApi", {
      apiName: "pep-http-api",
      description: "PEP F1 — reference CSV, saisons, courses",
      corsPreflight: {
        allowHeaders: ["Content-Type"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
      },
    });

    const catalogIntegration = new HttpLambdaIntegration(
      "PepCatalogIntegration",
      catalogFn
    );

    httpApi.addRoutes({
      path: "/circuits",
      methods: [apigwv2.HttpMethod.GET],
      integration: catalogIntegration,
    });
    httpApi.addRoutes({
      path: "/drivers",
      methods: [apigwv2.HttpMethod.GET],
      integration: catalogIntegration,
    });
    httpApi.addRoutes({
      path: "/constructors",
      methods: [apigwv2.HttpMethod.GET],
      integration: catalogIntegration,
    });
    httpApi.addRoutes({
      path: "/seasons",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: catalogIntegration,
    });
    httpApi.addRoutes({
      path: "/seasons/{season}",
      methods: [apigwv2.HttpMethod.GET],
      integration: catalogIntegration,
    });

    httpApi.addRoutes({
      path: "/races",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "PepCreateRaceIntegration",
        createRaceFn
      ),
    });

    new cdk.CfnOutput(this, "PepHttpApiUrl", {
      description: "Base URL API",
      value: httpApi.url ?? "",
    });

    new cdk.CfnOutput(this, "PepRacesTableName", {
      value: racesTable.tableName,
    });

    new cdk.CfnOutput(this, "PepDriversStandingsTableName", {
      value: driversStandingsTable.tableName,
    });

    new cdk.CfnOutput(this, "PepConstructorsStandingsTableName", {
      value: constructorsStandingsTable.tableName,
    });

    new cdk.CfnOutput(this, "PepRaceEventsTopicArn", {
      value: raceEventsTopic.topicArn,
    });
  }
}
