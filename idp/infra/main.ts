import { App, Fn } from "cdktf";
import BaseStack from "./base";
import PetAppStack from "./contrib/PetApp";

const app = new App();

// Create base infrastructure stack
const baseStack = new BaseStack(app, "infra", {
  profile: "default"
});

// Create PetApp stack with reference to base stack
new PetAppStack(app, "petapp", {
  profile: "default",
  vpcId: baseStack.vpc.vpcIdOutput,
  publicSecurityGroup: baseStack.publicSecurityGroup,
  appSecurityGroup: baseStack.appSecurityGroup,
  publicSubnets: Fn.tolist(baseStack.vpc.publicSubnetsOutput),
  appSubnets: Fn.tolist(baseStack.vpc.privateSubnetsOutput),
  ecsClusterName: baseStack.ecsCluster.clusterName,
  repository: "harshPhy/liveProject",
  branch: "main",
})

new BaseStack(app, "hello", {
  profile: "default"
})

app.synth();