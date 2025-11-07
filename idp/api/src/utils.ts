import fs from 'fs/promises';
import { AttributeValue, DynamoDBClient, GetItemCommand, GetItemCommandOutput, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb";
import {
  AttributeValueObjectMap,
  Dictionary,
  Environment,
  EnvironmentStatus,
  UpdateEnvironmentStateOptions,
} from './interface'
import { absoluteTerraformDir } from './terraform'

export function formatEnvironmentForDynamoDB(environment: Environment) {
  return {
    "environment": {
      S: environment.environment,
    },
    "stack": {
      S: environment.stack,
    },
    "status": {
      S: environment.status,
    },
    "owner": {
      S: environment.owner,
    },
    "config": {
      M: convertDictionaryToAttributeValueObjectMap(environment.config),
    },
    "note": {
      S: environment.note || ''
    }
  }
}

// Convert a dictionary (objects with string keys and string values) of configuration
// into the `AttributeValue` format that DynamoDB requires
// See: https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html)
// E.g. `{ "foo": "bar" }` becomes `{ "foo": { S: "bar" }}`
export function convertDictionaryToAttributeValueObjectMap(dictionary?: Dictionary): AttributeValueObjectMap {
  const output: AttributeValueObjectMap = {};
  if (typeof dictionary === "object" && dictionary !== null) {
    Object.entries(dictionary).map(([key, val]) => {
      output[key] = {
        S: val
      }
    })
  }
  return output;
}

export function formatDynamoDBEnvironmentForResponse(item: { [key: string]: AttributeValue }): Environment {
  return {
    environment: item.environment.S!,
    stack: item.stack.S!,
    status: item.status.S as EnvironmentStatus,
    owner: item.owner.S!,
    config: convertAttributeValueObjectMapToDictionary(item.config.M),
    note: item.note?.S || '',
  }
}

export function convertAttributeValueObjectMapToDictionary(objectMap?: AttributeValueObjectMap): Dictionary {
  const output: Dictionary = {};
  if (typeof objectMap === "object" && objectMap !== null) {
    Object.entries(objectMap).map(([key, val]) => {
      output[key] = val.S || ''
    })
  }
  return output;
}

export function generateUpdateEnvironmentParams(environment: string, options: UpdateEnvironmentStateOptions): UpdateItemCommandInput {
  return {
    ExpressionAttributeNames: {
      "#S": "status",
      "#N": "note",
    }, 
    ExpressionAttributeValues: {
      ":s": {
        S: options.status
      },
      ":n": {
        S: options.note || ''
      }
    }, 
    Key: {
      "environment": {
        S: environment,
      }
    },
    TableName: options.tableName,
    UpdateExpression: "SET #S = :s, #N = :n",
    ConditionExpression: "attribute_exists(environment)",
    ReturnValues: 'ALL_NEW',
  }
}

export function generateCDKStackCodeSnippet(environment: Environment) {
  return `new ${environment.stack}(app, "${environment.environment}", {
  ...getBaseConfig(devBase),
  owner: "${environment.owner}",
  ${Object.entries(environment.config).map(([key, val]) => `${key}: "${val}"`).join(",\n  ")}
})`;
}

export function addCDKSnippetToFile(originalContent: string, snippet: string) {
  const newFileData = new Uint8Array(Buffer.from(originalContent.replace("app.synth();\n", snippet + "\napp.synth();\n")));
  return fs.writeFile(`${absoluteTerraformDir}/main.ts`, newFileData, { encoding: 'utf8' });
}

export function removeCDKSnippetFromFile(originalContent: string, snippet: string) {
  const newFileData = new Uint8Array(Buffer.from(originalContent.replace(snippet, '')));
  return fs.writeFile(`${absoluteTerraformDir}/main.ts`, newFileData, { encoding: 'utf8' });
}

export async function getEnvironment(name: string, dynamodbTablename: string, client: DynamoDBClient) {
  const getItemCommand = new GetItemCommand({
    Key: {
      environment: {
        S: name
      },
    },
    TableName: dynamodbTablename,
  })

  const environment: GetItemCommandOutput = await client.send(getItemCommand);
  if (!environment.Item) {
    return null
  }

  return formatDynamoDBEnvironmentForResponse(environment.Item);
}