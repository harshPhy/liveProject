import { AttributeValue } from "@aws-sdk/client-dynamodb";

export enum EnvironmentStatus {
  REGISTERED = 'REGISTERED',
  COMMITTED = 'COMMITTED',
  DEPLOYED = 'DEPLOYED',
  MARKED = 'MARKED',
  FAILED = 'FAILED',
}

export interface Environment {
  environment: string;
  stack: string;
  status: keyof typeof EnvironmentStatus;
  config: { [key: string]: string };
  note?: string;
}

export interface AttributeValueObjectMap {
  [key: string]: AttributeValue
}

export interface Dictionary {
  [key: string]: string
}

export interface UpdateEnvironmentStateOptions {
  tableName: string;
  status: string;
  note?: string;
}
