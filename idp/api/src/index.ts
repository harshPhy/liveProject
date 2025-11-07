import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import express, { json } from 'express';
import cors from 'cors';
import * as OpenApiValidator from 'express-openapi-validator';
import { DeleteItemCommand, DynamoDBClient, PutItemCommand, ScanCommand, UpdateItemCommand, UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";
import passport from 'passport';
import jwt from 'jsonwebtoken';

import git, { resetToRemote } from './git';
import { User } from './sqlite';
import { jwtSecret } from './auth';
import { EnvironmentStatus, UpdateEnvironmentStateOptions } from './interface'
import { absoluteTerraformDir } from './terraform'
import {
  addCDKSnippetToFile,
  formatDynamoDBEnvironmentForResponse,
  formatEnvironmentForDynamoDB,
  generateCDKStackCodeSnippet,
  generateUpdateEnvironmentParams,
  getEnvironment,
  removeCDKSnippetFromFile,
} from './utils';

const port = process.env.PORT || 3456;
const dynamodbTablename = process.env.DYNAMODB_TABLE_NAME;

if (!dynamodbTablename) {
  process.exit(1);
}

const client = new DynamoDBClient({
  region: "us-east-1"
});

function updateEnvironment(name: string, options: UpdateEnvironmentStateOptions) {
  const updateEnvironmentParams = generateUpdateEnvironmentParams(name, options)
  return client.send(new UpdateItemCommand(updateEnvironmentParams));
}

const app = express()
app.use(cors({
  origin: process.env.APP_ORIGIN || false,
}))
app.use(json())
app.use(
  OpenApiValidator.middleware({
    apiSpec: path.resolve(__dirname, '../openapi.yaml'),
  }),
);
app.use(passport.initialize());

app.get('/healthz', (_, res) => {
  res.status(200).end()
});

app.post('/token', passport.authenticate('local', { session: false }), (req, res) => {
  if (!req.user) {
    return res.status(401).end();
  }
  const token = jwt.sign({ sub: (req.user as User).username }, jwtSecret);
  res.status(200).json({ token });
});

app.post('/environments',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {

    const params = {
      Item: formatEnvironmentForDynamoDB({
        ...req.body,
        status: EnvironmentStatus.REGISTERED,
        owner: (req.user as User).username,
      }),
      TableName: dynamodbTablename,
      ConditionExpression: "attribute_not_exists(environment)",
    }

    try {
      await client.send(new PutItemCommand(params));
    } catch (err: any) {
      // If environment with the same name already exists
      if (err.name === 'ConditionalCheckFailedException') {
        console.log(`Environment ${req.body.environment} already exists`);
        res.status(409).end();
        return;
      }
      // Any other kinds of errors
      console.error('Error creating environment in DynamoDB:', err);
      res.status(500).end();
      return;
    }

    res.status(202).end();

    try {
      await resetToRemote()
      const fileContents = await fs.readFile(`${absoluteTerraformDir}/main.ts`, { encoding: 'utf8' })
      const cdkSnippet = generateCDKStackCodeSnippet({
        ...req.body,
        owner: (req.user as User).username,
      })
      if (!fileContents.includes(cdkSnippet)) {
        await addCDKSnippetToFile(fileContents, cdkSnippet);
        await git.add('./*').commit(`Add environment ${req.body.environment}`).push('origin', 'main');
        await updateEnvironment(req.body.environment, {
          status: 'COMMITTED',
          tableName: dynamodbTablename,
        })
      }

      const childProcess = spawn('cdktf', ['deploy', req.body.environment, '--auto-approve', '--ignore-missing-stack-dependencies'], { cwd: absoluteTerraformDir, stdio: 'pipe' });

      // In our infra code, we are outputing the DNS name of our load balancer.
      // We will store that here and display on the frontend, so the developers
      //   would know how to reach their environment
      let lastStdOutLines: string[] = [];
      const LINES_TO_STORE = 1;

      childProcess.stderr.on('data', (data: Buffer) => {
        console.log(`stderr: ${data}`);
      })

      childProcess.stdout.on('data', (data: Buffer) => {
        console.log(`stdout: ${data}`);
        lastStdOutLines.push(data.toString());
        if (lastStdOutLines.length > LINES_TO_STORE) {
          lastStdOutLines.shift()
        }
      })

      childProcess.on('close', async (code) => {
        if (code !== 0) {
          console.error(`cdktf deploy failed for ${req.body.environment} with code ${code}`);
          updateEnvironment(req.body.environment, {
            status: 'FAILED',
            tableName: dynamodbTablename,
            note: `cdktf deploy returned with code ${code}`,
          })
          return;
        }

        updateEnvironment(req.body.environment, {
          status: 'DEPLOYED',
          tableName: dynamodbTablename,
          note: lastStdOutLines.join("\n"),
        })
      });
    } catch (err: any) {
      console.error(err);
      updateEnvironment(req.body.environment, {
        status: 'FAILED',
        tableName: dynamodbTablename,
        note: (err as Error).toString()
      })
      return;
    }
  });

app.get('/environments', async (_, res) => {
  const params = {
    TableName: dynamodbTablename,
  }
  let data;
  try {
    data = await client.send(new ScanCommand(params))
  } catch (err: any) {
    console.error('Error scanning environments from DynamoDB:', err);
    res.status(500).end();
    return;
  };

  if (data && data.Items) {
    res.status(200).json(data.Items.map(formatDynamoDBEnvironmentForResponse));
    return;
  }
  console.error('DynamoDB scan returned no items');
  res.status(500).end();
});

app.delete('/environments/:name',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {

    const environment = await getEnvironment(req.params.name, dynamodbTablename, client)
    if (!environment) {
      console.log(`Environment ${req.params.name} not found`);
      return res.status(404).end();
    }
    if (!environment.owner) {
      console.error(`Environment ${req.params.name} has no owner`);
      return res.status(500).end();
    }
    if (environment.owner !== (req.user as User).username) {
      console.log(`User ${(req.user as User).username} not authorized to delete environment ${req.params.name} owned by ${environment.owner}`);
      return res.status(403).end();
    }

    let environmentData: UpdateItemCommandOutput;
    // Mark environment for deletion
    try {
      environmentData = await updateEnvironment(req.params.name, {
        status: 'MARKED',
        tableName: dynamodbTablename,
      })
    } catch (err: any) {
      // Environment with the name does not exists
      if (err.name === 'ConditionalCheckFailedException') {
        console.log(`Environment ${req.params.name} does not exist for deletion`);
        res.status(404).end();
        return;
      }
      console.error('Error marking environment for deletion:', err);
      res.status(500).end();
      return;
    }
    res.status(202).end();

    const childProcess = spawn('cdktf', ['destroy', req.params.name, '--auto-approve', '--ignore-missing-stack-dependencies'], { cwd: absoluteTerraformDir, stdio: 'pipe' });

    childProcess.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    })

    childProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    })

    childProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`cdktf destroy failed for ${req.params.name} with code ${code}`);
        updateEnvironment(req.params.name, {
          status: 'MARKED',
          tableName: dynamodbTablename,
          note: `cdktf destroy returned with code ${code}`,
        })
        return;
      }

      if (environmentData.Attributes) {
        try {
          await resetToRemote()
          const fileContents = await fs.readFile(`${absoluteTerraformDir}/main.ts`, { encoding: 'utf8' })
          const oldEnvironment = formatDynamoDBEnvironmentForResponse(environmentData.Attributes);
          const cdkSnippet = generateCDKStackCodeSnippet(oldEnvironment)
          if (fileContents.includes(cdkSnippet)) {
            await removeCDKSnippetFromFile(fileContents, cdkSnippet);
            await git.add('./*').commit(`Remove environment ${req.params.name}`).push('origin', 'main');
          }
          await updateEnvironment(req.params.name, {
            status: 'MARKED',
            tableName: dynamodbTablename,
          })
        } catch (err: any) {
          console.error(err);
          await updateEnvironment(req.params.name, {
            status: 'MARKED',
            tableName: dynamodbTablename,
            note: (err as Error).toString(),
          })
          return;
        }
      } else {
        await updateEnvironment(req.params.name, {
          status: 'MARKED',
          tableName: dynamodbTablename,
          note: 'environmentData is undefined',
        })
      }

      // Actually delete the item from DynamoDB
      const params = {
        Key: {
          "environment": {
            S: req.params.name,
          },
        },
        TableName: dynamodbTablename,
        ConditionExpression: "attribute_exists(environment)", // Only delete if it exists
      }
      try {
        await client.send(new DeleteItemCommand(params))
      } catch (err: any) {
        console.error(err);
        return;
      }
    })
  })

const server = app.listen(port, () => {
  console.log(`API listening on port ${port}`)
})

function signalHandler(signal: string) {
  console.log(`${signal} received. Shutting down.`);
  server.close(() => {
    console.log('Express server closed. Exiting.');
    process.exit(0);
  })
}

process.on('SIGTERM', () => signalHandler('SIGTERM'));
process.on('SIGINT', () => signalHandler('SIGINT'));

process.on('warning', e => console.error(e.stack));
