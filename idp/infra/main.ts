import { App } from "cdktf";
import BaseStack from "./base";
import PetAppStack, { getBaseConfig } from "./contrib/PetApp";

const app = new App();

// Create base infrastructure stack
const baseStack = new BaseStack(app, "infra", {
  profile: "default",

});

// Create PetApp stack with reference to base stack
new PetAppStack(app, "petapp", {
  ...getBaseConfig(baseStack),
  owner: "admin",
  branch: "main",
})


app.synth();