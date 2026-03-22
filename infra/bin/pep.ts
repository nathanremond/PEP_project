#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PepPipelineStack } from "../lib/pipeline-stack";
import { PepStack } from "../lib/pep-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new PepStack(app, "PepF1Stack", {
  stackName: "pep-f1",
  description:
    "PEP F1 — DynamoDB (pep-*), SNS pep-race-events, Lambdas pep-*, API pep-http-api",
  env,
});

/**
 * Stack pipeline : uniquement si les contextes GitHub sont fournis.
 * En CodeBuild (merge sur main), ces contextes ne sont pas là → seule PepF1Stack est déployée.
 */
const githubConnectionArn = app.node.tryGetContext("githubConnectionArn") as
  | string
  | undefined;
const githubOwner = app.node.tryGetContext("githubOwner") as string | undefined;
const githubRepo = app.node.tryGetContext("githubRepo") as string | undefined;

if (githubConnectionArn && githubOwner && githubRepo) {
  new PepPipelineStack(app, "PepPipelineStack", {
    stackName: "pep-pipeline",
    description:
      "PEP CodePipeline: merge main, CodeBuild, cdk deploy PepF1Stack",
    env,
    githubConnectionArn,
    githubOwner,
    githubRepo,
    githubBranch:
      (app.node.tryGetContext("githubBranch") as string | undefined) ?? "main",
  });
}
