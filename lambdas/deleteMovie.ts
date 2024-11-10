import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();


export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));


    const movieId = event.pathParameters ? event.pathParameters.movieId : undefined;
    if (!movieId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing movieId parameter" }),
      };
    }

    const movieIdNumber = parseInt(movieId, 10);
    if (isNaN(movieIdNumber)) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Invalid movieId parameter" }),
      };
    }

    const deleteCommand = new DeleteCommand({
      TableName: process.env.MOVIES_TABLE_NAME,
      Key: { id: movieIdNumber },
    });

    await ddbDocClient.send(deleteCommand);

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: `Movie with ID ${movieId} deleted successfully.` }),
    };
  } catch (error: any) {
    console.error("Error deleting movie:", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: `Failed to delete movie`,
       }),
    };
  }
};

function createDDbDocClient() {
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
