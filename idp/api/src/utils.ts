import fs from 'fs/promises';
import { AttributeValue, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb";
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
    "id": {
      S: environment.environment,
    },
    "environment": {
      S: environment.environment,
    },
    "stack": {
      S: environment.stack,
    },
    "status": {
      S: environment.status,
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
      "id": {
        S: environment,
      }
    },
    TableName: options.tableName,
    UpdateExpression: "SET #S = :s, #N = :n",
    ConditionExpression: "attribute_exists(id)",
    ReturnValues: 'ALL_NEW',
  }
}

export function generateCDKStackCodeSnippet(environment: Environment) {
  const configEntries = Object.entries(environment.config).map(([key, val]) => `  ${key}: ${val}`).join(",\n");
  return `new ${environment.stack}(app, "${environment.environment}", {
${configEntries}
})`;
}

export function addCDKSnippetToFile(originalContent: string, snippet: string, stackClassName: string) {
  // Determine the correct import path
  let importStatement: string;
  if (stackClassName === 'BaseStack') {
    importStatement = `import ${stackClassName} from "./base";`;
  } else {
    importStatement = `import ${stackClassName} from "./contrib/${stackClassName}";`;
  }

  let updatedContent = originalContent;

  if (!originalContent.includes(importStatement) && !originalContent.includes(`import ${stackClassName} from`)) {
    // Add import after existing imports
    const lastImportIndex = originalContent.lastIndexOf('import');
    const endOfLineIndex = originalContent.indexOf('\n', lastImportIndex);
    updatedContent = originalContent.slice(0, endOfLineIndex + 1) + importStatement + '\n' + originalContent.slice(endOfLineIndex + 1);
  }

  // Add the snippet before app.synth()
  updatedContent = updatedContent.replace("app.synth();", snippet + "\n\napp.synth();");

  const newFileData = new Uint8Array(Buffer.from(updatedContent));
  return fs.writeFile(`${absoluteTerraformDir}/main.ts`, newFileData, { encoding: 'utf8' });
}

export function removeCDKSnippetFromFile(originalContent: string, snippet: string) {
  const newFileData = new Uint8Array(Buffer.from(originalContent.replace(snippet, '')));
  return fs.writeFile(`${absoluteTerraformDir}/main.ts`, newFileData, { encoding: 'utf8' });
}
