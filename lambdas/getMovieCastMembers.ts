import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event));

    const queryParams = event.queryStringParameters;
    if (!queryParams) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing query parameters" }),
      };
    }

    if (!queryParams.movieId) {
        return {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: "Missing movieId parameter" }),
        };
      }
      const movieId = parseInt(queryParams.movieId);
      
    if (!movieId) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing or invalid movieId parameter" }),
      };
    }

    // Set up the query to retrieve cast members
    let commandInput: QueryCommandInput = {
      TableName: process.env.CAST_TABLE_NAME,
      KeyConditionExpression: "movieId = :m",
      ExpressionAttributeValues: { ":m": movieId },
    };

    if ("roleName" in queryParams) {
      commandInput = {
        ...commandInput,
        IndexName: "roleIx",
        KeyConditionExpression: "movieId = :m and begins_with(roleName, :r) ",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": queryParams.roleName,
        },
      };
    } else if ("actorName" in queryParams) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m and begins_with(actorName, :a) ",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":a": queryParams.actorName,
        },
      };
    }

    const castOutput = await ddbDocClient.send(new QueryCommand(commandInput));
    const responseBody: any = { cast: castOutput.Items };

    // If `facts=true`, fetch movie metadata and add to the response
    if (queryParams.facts === "true") {
      const movieDetailsOutput = await ddbDocClient.send(
        new GetCommand({
          TableName: process.env.MOVIES_TABLE_NAME,
          Key: { id: movieId },
          ProjectionExpression: "title, genreIds, overview",
        })
      );

      if (movieDetailsOutput.Item) {
        responseBody.movieDetails = {
          title: movieDetailsOutput.Item.title,
          genreIds: movieDetailsOutput.Item.genreIds,
          overview: movieDetailsOutput.Item.overview,
        };
      } else {
        console.log(`Movie metadata not found for movieId: ${movieId}`);
      }
    }

    // Return the combined response with cast and optionally movie details
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error }),
    };
  }
};

function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = { wrapNumbers: false };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}