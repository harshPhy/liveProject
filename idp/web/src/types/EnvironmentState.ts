import EnvironmentDefinition from './EnvironmentDefinition';
import { EnvironmentStatus } from './EnvironmentStatus';

export default interface EnvironmentState extends EnvironmentDefinition {
  status: EnvironmentStatus
  note: string
}
