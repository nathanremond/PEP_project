import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as cpactions from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";

export interface PepPipelineStackProps extends cdk.StackProps {
  /** Connexion GitHub (Developer Tools > Connections) — état "Available". */
  readonly githubConnectionArn: string;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly githubBranch?: string;
}

/**
 * Déclenché par un push / merge sur la branche configurée (ex. main).
 * CodeBuild exécute `cdk deploy PepF1Stack` : toute modification de pep-stack.ts ou des lambdas
 * est appliquée au prochain run après merge.
 */
export class PepPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PepPipelineStackProps) {
    super(scope, id, props);

    const branch = props.githubBranch ?? "main";
    const sourceOutput = new codepipeline.Artifact("Source");

    const sourceAction = new cpactions.CodeStarConnectionsSourceAction({
      actionName: "GitHub_Source",
      owner: props.githubOwner,
      repo: props.githubRepo,
      branch,
      connectionArn: props.githubConnectionArn,
      output: sourceOutput,
      triggerOnPush: true,
    });

    const buildRole = new iam.Role(this, "CodeBuildDeployRole", {
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
      // IAM n'accepte qu'un sous-ensemble de caracteres (pas de tire long ni certains Unicode).
      description:
        "PEP CodeBuild: CDK deploy PepF1Stack. Broad permissions; narrow in production.",
    });
    buildRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
    );

    const deployProject = new codebuild.PipelineProject(this, "CdkDeployProject", {
      projectName: "pep-cdk-deploy",
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      environmentVariables: {
        NPM_CONFIG_PRODUCTION: { value: "false" },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": { nodejs: "20" },
            commands: ["node --version", "npm --version"],
          },
          build: {
            commands: [
              "cd aws",
              "npm ci",
              "npx cdk deploy PepF1Stack --require-approval never",
            ],
          },
        },
      }),
    });

    const pipeline = new codepipeline.Pipeline(this, "MainPipeline", {
      pipelineName: "pep-main-pipeline",
      restartExecutionOnUpdate: true,
      crossAccountKeys: false,
    });

    pipeline.addStage({ stageName: "Source", actions: [sourceAction] });

    pipeline.addStage({
      stageName: "Deploy",
      actions: [
        new cpactions.CodeBuildAction({
          actionName: "CdkDeploy",
          project: deployProject,
          input: sourceOutput,
        }),
      ],
    });

    new cdk.CfnOutput(this, "PipelineConsoleUrl", {
      description: "Ouvre la console pour voir les exécutions",
      value: `https://${this.region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipeline.pipelineName}/view`,
    });
  }
}
