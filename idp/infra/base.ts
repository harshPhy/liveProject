import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { DynamodbTable } from "@cdktf/provider-aws/lib/dynamodb-table";
// import { Instance } from "@cdktf/provider-aws/lib/instance";
import { EcsCluster } from "./.gen/modules/ecs-cluster";
// import { IamServiceLinkedRole } from "@cdktf/provider-aws/lib/iam-service-linked-role";
// import { DataAwsAmi } from "@cdktf/provider-aws/lib/data-aws-ami";
import { Vpc } from "./.gen/modules/vpc";
import { SecurityGroup } from "./.gen/modules/security-group";

interface BaseStackConfig {
  profile: string;
}

export default class BaseStack extends TerraformStack {
  public readonly vpc: Vpc;
  public readonly publicSecurityGroup: SecurityGroup;
  public readonly appSecurityGroup: SecurityGroup;
  public readonly dataSecurityGroup: SecurityGroup;
  public readonly ecsCluster: EcsCluster;
  public readonly dynamoDB: DynamodbTable;

  constructor(scope: Construct, name: string, config: BaseStackConfig) {
    super(scope, name);

    // AWS Provider must be initialized first
    new AwsProvider(this, "aws", {
      region: "us-east-1",
      profile: config.profile,
    });

    const vpc = new Vpc(this, "vpc", {
      name: "idp-dev-vpc",
      cidr: "10.1.0.0/16",
      azs: ["us-east-1a", "us-east-1b", "us-east-1c"],
      publicSubnets: ["10.1.0.0/24", "10.1.1.0/24", "10.1.2.0/24"],
      privateSubnets: ["10.1.4.0/24", "10.1.5.0/24", "10.1.6.0/24"],
      databaseSubnets: ["10.1.8.0/24", "10.1.9.0/24", "10.1.10.0/24"],
      enableNatGateway: true,
      singleNatGateway: true,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: {
        Environment: "development"
      }
    });
    this.vpc = vpc;
    
    const securityGroup: { [key: string]: SecurityGroup } = {};


    securityGroup.public = new SecurityGroup(this, "public",{
      name: "idp-dev-public-sg",
      vpcId: vpc.vpcIdOutput,
      ingressWithSelf: [{ rule: "all-all" }],
      egressWithSelf: [{ rule: "all-all" }],
      ingressCidrBlocks: ["0.0.0.0/0"],
      ingressRules: ["http-80-tcp", "https-443-tcp"],
      egressCidrBlocks: ["0.0.0.0/0"],
      egressRules: ["all-all"],
    })

    securityGroup.app = new SecurityGroup(this, "app",{
      name: "idp-dev-app-sg",
      vpcId: vpc.vpcIdOutput,
      ingressWithSelf: [{ rule: "all-all" }],
      egressCidrBlocks: ["0.0.0.0/0"],
      egressRules: ["all-all"],
      computedIngressWithSourceSecurityGroupId: [{
        rule: "all-all",
        source_security_group_id: securityGroup.public.securityGroupIdOutput,
      }],
      numberOfComputedIngressWithSourceSecurityGroupId: 1
    })

    securityGroup.data = new SecurityGroup(this, "data",{
      name: "idp-dev-data-sg",
      vpcId: vpc.vpcIdOutput,
      ingressWithSelf: [{ rule: "all-all" }],
      egressCidrBlocks: ["0.0.0.0/0"],
      egressRules: ["all-all"],
      computedIngressWithSourceSecurityGroupId: [{
        rule: "all-all",
        source_security_group_id: securityGroup.app.securityGroupIdOutput,
      }],
      numberOfComputedIngressWithSourceSecurityGroupId: 1
    })

    this.publicSecurityGroup = securityGroup.public;
    this.appSecurityGroup = securityGroup.app;
    this.dataSecurityGroup = securityGroup.data;

    // new IamServiceLinkedRole(this, "iam_service_ecs_linked_role", {
    //   awsServiceName: "ecs.amazonaws.com",
    //   description: "IAM Service Linked Role for ECS to manage AWS service resources on your behalf."
    // });

    const ecsCluster = new EcsCluster(this, "ecs_cluster", {
      clusterName: "idp-dev-ecs-cluster",
      clusterSetting: [
        {
          name: "containerInsights",
          value: "enabled"
        }
      ],
      tags: {
        Environment: "development",
        ManagedBy: "cdktf"
      }
    });

    this.ecsCluster = ecsCluster;

    const dynamoDB = new DynamodbTable(this, "dynamodb_table", {
      name: "idp-dev-dynamodb-table",
      billingMode: "PAY_PER_REQUEST",
      hashKey: "environment",
      attribute: [
        {
          name: "environment",
          type: "S"
        }
      ],
      tags: {
        Environment: "development"
      }
    });

    this.dynamoDB = dynamoDB;

    // const ami = new DataAwsAmi(this, "latest-amazon-linux-2-ami", {
    //   mostRecent: true,
    //   owners: ["amazon"],
    //   filter: [{
    //       name: "name",
    //       values: ["amzn2-ami-hvm-*-gp2"]
    //     }]
    // });

    // new Instance(this, "activation", {
    //   ami: ami.id,
    //   instanceType: "t3.micro",
    //   subnetId: `\${${vpc.fqn}.public_subnets[0]}`,
    //   tags: {
    //     Name: "idp-dev-activation-instance",
    //     Environment: "development",
    //     Purpose: "ECS task limit workaround"
    //   }
    // });
  }
}
