import EnvironmentConfig from './EnvironmentConfig';

export default interface EnvironmentDefinition {
  name: string
  stack: string
  config: EnvironmentConfig[]
}
