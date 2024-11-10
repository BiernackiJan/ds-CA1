import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["Movie"] || {});

const ddbDocClient = createDdbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    // Print Event
    console.log("[EVENT]", JSON.stringify(event));
    
    const movieId = event.pathParameters?.movieId;
    const body = event.body ? JSON.parse(event.body) : undefined;
    
    if (!movieId || !body) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing movie ID or request body" }),
      };
    }

    if (!isValidBodyParams(body)) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect body format. Must match Movie schema`,
          schema: schema.definitions["Movie"],
        }),
      };
    }

    const commandOutput = await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: parseInt(movieId, 10) },
        UpdateExpression: "SET #title = :title, #overview = :overview",
        ExpressionAttributeNames: {
          "#title": "title",
          "#overview": "overview",
        },
        ExpressionAttributeValues: {
          ":title": body.title,
          ":overview": body.overview,
        },
        ReturnValues: "ALL_NEW" as const,
      })
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "Movie updated successfully", data: commandOutput.Attributes }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDdbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
