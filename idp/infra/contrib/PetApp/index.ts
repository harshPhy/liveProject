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
import { DataAwsIamPolicyDocument } from "@cdktf/provider-aws/lib/data-aws-iam-policy-document";
import { DataAwsCallerIdentity } from "@cdktf/provider-aws/lib/data-aws-caller-identity";

import { CodebuildWebhook } from "@cdktf/provider-aws/lib/codebuild-webhook";
import { SecurityGroup } from "../../.gen/modules/security-group";
interface PetAppStackConfig {
  profile: string;
  region?: string;
  vpcId: string;
  publicSecurityGroup: SecurityGroup;
  appSecurityGroup: SecurityGroup;
  publicSubnets: string[] | undefined;
  appSubnets: string[] | undefined;
  ecsClusterName: string | undefined;
  repository: string;
  branch: string;
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

    const callerIdentity = new DataAwsCallerIdentity(this, "current");

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

    // Add CloudWatch Logs permissions for log group creation
    const cloudwatchLogsPolicy = new IamPolicy(this, "petapp-cloudwatch-logs-policy", {
      name: "petapp-cloudwatch-logs-policy",
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents"
            ],
            Resource: "arn:aws:logs:*:*:log-group:/ecs/petapp*"
          }
        ]
      })
    });

    new IamRolePolicyAttachment(this, "petapp-cloudwatch-logs-policy-attachment", {
      role: taskExecutionRole.name,
      policyArn: cloudwatchLogsPolicy.arn
    });

    const taskRole = new IamRole(this, "petapp-role", {
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
      cluster: config.ecsClusterName,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      forceNewDeployment: true,
      networkConfiguration: {
        subnets: Fn.tolist(config.publicSubnets),
        securityGroups: [config.publicSecurityGroup.securityGroupIdOutput],
        assignPublicIp: true,
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
    const codeBuildServiceRoleAssumeRolePolicyDocument = new DataAwsIamPolicyDocument(this, "codebuildServiceRoleAssumeRolePolicyDocument", {
      statement: [
        {
          effect: "Allow",
          actions: ["sts:AssumeRole"],
          principals: [
            {
              type: "Service",
              identifiers: ["codebuild.amazonaws.com"],
            },
          ],
        },
      ],
    });

    const codebuildServiceRole = new IamRole(this, "petAppcodeBuildServiceRole", {
      name: "petAppcodeBuildServiceRole",
      assumeRolePolicy: codeBuildServiceRoleAssumeRolePolicyDocument.json,
    });

    const codebuildServiceRolePolicy = new IamPolicy(this, "codebuildServiceRolePolicy", {
      policy: Fn.jsonencode({
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Action": [
              "cloudwatch:*",
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
              "s3:PutObject",
              "s3:GetObject",
              "s3:GetObjectVersion",
              "s3:GetBucketAcl",
              "s3:GetBucketLocation",

              "ec2:CreateNetworkInterface",
              "ec2:DescribeNetworkInterfaces",
              "ec2:DeleteNetworkInterface",
              "ec2:DescribeSubnets",
              "ec2:DescribeSecurityGroups",
              "ec2:DescribeVpcs",
              "ec2:CreateNetworkInterfacePermission",

              "ecs:UpdateService"
            ],
            "Resource": ["*"]
          }
        ]
      })
    });

    const customCodebuildPolicyAttachment = new IamRolePolicyAttachment(this,"codebuildServiceRolePolicyAttachement", {
      role: codebuildServiceRole.name,
      policyArn: codebuildServiceRolePolicy.arn
    });

    const ecrCodebuildPolicyAttachment = new IamRolePolicyAttachment(this,"codebuildServiceRoleRolePolicyAttachmentAmazonEC2ContainerRegistryFullAccess", {
      role: codebuildServiceRole.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
    });

    const adminCodebuildPolicyAttachment = new IamRolePolicyAttachment(this, "codebuildServiceRoleRolePolicyAttachmentAdministratorAccess", {
      role: codebuildServiceRole.name,
      policyArn: "arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess",
    });

    const codebuildProject = new CodebuildProject(this, "project", {
      dependsOn: [customCodebuildPolicyAttachment, ecrCodebuildPolicyAttachment, adminCodebuildPolicyAttachment ],
      name: "petapp-codebuild-project",
      serviceRole: codebuildServiceRole.arn,
      artifacts: {type:"NO_ARTIFACTS"},
      environment: {
        computeType: 'BUILD_GENERAL1_SMALL',
        image: 'aws/codebuild/standard:6.0',
        type: 'LINUX_CONTAINER',
        imagePullCredentialsType: 'CODEBUILD',
        privilegedMode: true
      },
      source: {
        type: "GITHUB",
        location: `https://github.com/${config.repository}.git`,
        gitCloneDepth: 1,
        gitSubmodulesConfig: {
          fetchSubmodules: true
        },
        reportBuildStatus: true,
        buildspec:`
version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws --version
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin ${callerIdentity.accountId}.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com

  build:
    commands:
      - echo Building the Docker image...
      - docker build -t ${repository.repositoryUrl}:latest .
  post_build:
    commands:
      - echo Pushing the Docker image...
      - docker push ${repository.repositoryUrl}:latest
      - aws ecs update-service --cluster ${config.ecsClusterName} --service ${ecsService.name} --force-new-deployment
`        
      }
    })

    new CodebuildWebhook(this, "petapp-codebuild-webhook", {
      projectName: codebuildProject.name,
      buildType: "BUILD",
      filterGroup: [{
        filter: [{
          type: "EVENT",
          pattern: "PUSH",
        },{
          type: "HEAD_REF",
          pattern: config.branch,
        }]
      }]
    });
  }
}
