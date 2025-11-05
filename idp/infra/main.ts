import { App } from "cdktf";
import BaseStack from "./base";
import PetAppStack from "./contrib/PetApp";

const app = new App();

// Create base infrastructure stack
const baseStack = new BaseStack(app, "infra", {
  profile: "default"
});

// Create PetApp stack with reference to base stack
// @ts-ignore
const petAppStack = new PetAppStack(app, "petapp", {
  profile: "default",
  baseStack: baseStack
});

app.synth();