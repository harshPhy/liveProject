import { Fn } from "cdktf";
import BaseStack from "../../base";
import { PetAppStackBaseConfig } from "./interface";

export default function(base: BaseStack): PetAppStackBaseConfig {
    return ({
        repository: "harshPhy/petapp",
        profile:"default",
        vpcId: base.vpc.vpcIdOutput,
        publicSecurityGroup: base.publicSecurityGroup,
        appSecurityGroup: base.appSecurityGroup,
        publicSubnets: Fn.tolist(base.vpc.publicSubnetsOutput),
        appSubnets: Fn.tolist(base.vpc.privateSubnetsOutput),
        ecsClusterName: base.ecsCluster.clusterName || ""
    })
}