import { Construct } from "constructs";
import { Fn, TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { EcrRepository } from "@cdktf/provider-aws/lib/ecr-repository";
import { IamPolicy } from "@cdktf/provider-aws/lib/iam-policy";
import { Lb } from "@cdktf/provider-aws/lib/lb";
import { LbTargetGroup } from "@cdktf/provider-aws/lib/lb-target-group";
import { LbListener } from "@cdktf/provider-aws/lib/lb-listener";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { CodebuildProject } from "@cdktf/provider-aws/lib/codebuild-project";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";

import BaseStack from "../../base";

interface PetAppStackConfig {
  profile: string;
  region?: string;
  baseStack: BaseStack;
}

export default class PetAppStack extends TerraformStack {
  public readonly repository: EcrRepository;
  //@ts-ignore
  public readonly loadBalancer: Lb;
  //@ts-ignore
  public readonly targetGroup: LbTargetGroup;
  //@ts-ignore
  public readonly listener: LbListener;
  public readonly taskDefinition: EcsTaskDefinition;
  public readonly ecsService: EcsService;

  constructor(scope: Construct, name: string, config: PetAppStackConfig) {
    super(scope, name);

    // AWS Provider configuration
    new AwsProvider(this, "aws", {
      region: config.region || "us-east-1",
      profile: config.profile,
    });

    // PetApp resources will be defined here
    const repository = new EcrRepository(this, "petapp-repo", {
      name: "petapp-repo",
      imageTagMutability: "MUTABLE",
      imageScanningConfiguration: {
        scanOnPush: true,
      }
    });
    this.repository = repository;

    new IamPolicy(this,"codeBuildEcsPushPolicy", {
      name: "codebuild-ecs-push-policy",
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "ecr:GetAuthorizationToken",
              "ecr:BatchCheckLayerAvailability",
              "ecr:PutImage",
              "ecr:InitiateLayerUpload",
              "ecr:UploadLayerPart",
              "ecr:CompleteLayerUpload"
            ],
            Resource: "*",
          },
        ],
      }),
    });

    // // Application Load Balancer
    // const loadBalancer = new Lb(this, "petapp-alb", {
    //   name: "petapp-alb",
    //   internal: false,
    //   loadBalancerType: "application",
    //   securityGroups: [config.baseStack.publicSecurityGroups.securityGroupIdOutput],
    //   subnets: Fn.tolist(config.baseStack.vpc.publicSubnetsOutput),
    //   enableDeletionProtection: false,
    //   tags: {
    //     Name: "petapp-alb",
    //     Environment: "development",
    //   },
    // });
    // this.loadBalancer = loadBalancer;

    // // Target Group
    // const targetGroup = new LbTargetGroup(this, "petapp-target-group", {
    //   name: "petapp-target-group",
    //   port: 8000,
    //   protocol: "HTTP",
    //   targetType: "ip",
    //   vpcId: config.baseStack.vpc.vpcIdOutput,
    //   healthCheck: {
    //     enabled: true,
    //     path: "/",
    //     protocol: "HTTP",
    //     healthyThreshold: 2,
    //     unhealthyThreshold: 2,
    //     timeout: 5,
    //     interval: 30,
    //   },
    //   tags: {
    //     Name: "petapp-target-group",
    //     Environment: "development",
    //   },
    // });
    // this.targetGroup = targetGroup;

    // Listener
    // const listener = new LbListener(this, "petapp-listener", {
    //   loadBalancerArn: loadBalancer.arn,
    //   port: 80,
    //   protocol: "HTTP",
    //   defaultAction: [
    //     {
    //       type: "forward",
    //       targetGroupArn: targetGroup.arn,
    //     },
    //   ],
    // });
    // this.listener = listener;

    const taskExecutionRole = new IamRole(this, "petapp-task-execution-role", {
      name: "petapp-task-execution-role",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "ecs-tasks.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, "petapp-task-execution-policy", {
      role: taskExecutionRole.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    const taskRole = new IamRole(this, "petapp-task-role", {
      name: "petapp-task-role",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "ecs-tasks.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      }),
    });

    const taskDefinition = new EcsTaskDefinition(this, "petapp-task-def", {
      family: "petapp-task-def",
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      cpu: "256",
      memory: "512",
      executionRoleArn: taskExecutionRole.arn,
      taskRoleArn: taskRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: "petapp-container",
          image: `${repository.repositoryUrl}:latest`,
          portMappings: [
            {
              containerPort: 8000,
              protocol: "tcp",
            },
          ],
          essential: true,
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": "/ecs/petapp",
              "awslogs-region": config.region || "us-east-1",
              "awslogs-stream-prefix": "ecs",
              "awslogs-create-group": "true",
            },
          }
        },
      ]),
    });
    this.taskDefinition = taskDefinition;

    const ecsService = new EcsService(this, "petapp-ecs-service", {
      name: "petapp-ecs-service",
      cluster: config.baseStack.ecsCluster.clusterNameOutput,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: Fn.tolist(config.baseStack.vpc.publicSubnetsOutput),
        securityGroups: [config.baseStack.publicSecurityGroups.securityGroupIdOutput],
        assignPublicIp: false,
      },

      // loadBalancer: [
      //   {
      //     targetGroupArn: targetGroup.arn,
      //     containerName: "petapp-container",
      //     containerPort: 8000,
      //   },
      // ],
      // dependsOn: [listener],
    });
    this.ecsService = ecsService;


    // Codebuild project and S3 bucket can be defined here for CI/CD

    const artifactBucket = new S3Bucket(this, "petapp-artifact-bucket", {
      bucketPrefix: "petapp-artifacts-",
    });

    const codeBuildRole = new IamRole(this, "petapp-codebuild-role", {
      name: "petapp-codebuild-role",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "codebuild.amazonaws.com",
            },
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, "codeBuildS3PolicyPetApp", {
      role: codeBuildRole.name!,
      policyArn: "arn:aws:iam::aws:policy/AmazonS3FullAccess",
    });

    new IamRolePolicyAttachment(this, "codeBuildLogsPolicyPetApp", {
      role: codeBuildRole.name!,
      policyArn: "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess",
    });

    new CodebuildProject(this, "petapp-codebuild-project", {
      name: "petapp-codebuild-project",
      serviceRole: codeBuildRole.arn,
      artifacts: {
        type: "S3",
        location: artifactBucket.bucket,
        packaging: "ZIP",
        name: "build-artifact.zip",
      },
      environment: {
        computeType: "BUILD_GENERAL1_SMALL",
        image: "aws/codebuild/standard:7.0",
        type: "LINUX_CONTAINER"
      },
      source: {
        type: "GITHUB",
        location: "https://github.com/harshPhy/liveProject.git",
        buildspec: "apps/petapp/buildspec.yml",
      },
    });

  }
}
