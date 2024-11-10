import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ddbDocClient = createDDbDocClient();
const translateClient = new TranslateClient({});
const ajv = new Ajv();
const isValidQueryParams = ajv.compile(schema.definitions["MovieByIdQueryParams"] || {});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("Event received:", JSON.stringify(event));
    const queryParams = event.queryStringParameters || {};

    // Validate query parameters
    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Invalid query parameters" }),
      };
    }

    const movieId = parseInt(event.pathParameters?.movieId || "0", 10);
    if (!movieId) {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing or invalid movie ID" }),
      };
    }

    // Retrieve movie metadata from DynamoDB
    console.log("Fetching movie data from DynamoDB.");
    const movieData = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: movieId },
      })
    );

    if (!movieData.Item) {
      console.error("Movie not found for ID:", movieId);
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Movie not found" }),
      };
    }

    let responseBody = { data: movieData.Item };

    // If language query parameter is provided, perform translation
    if (queryParams.language) {
      const language = queryParams.language;
      console.log(`Requested translation for language: ${language}`);

      // Translate original title
      const titleTranslation = await translateClient.send(
        new TranslateTextCommand({
          Text: movieData.Item.original_title,
          SourceLanguageCode: "en",
          TargetLanguageCode: language,
        })
      );

      // Translate overview
      const overviewTranslation = await translateClient.send(
        new TranslateTextCommand({
          Text: movieData.Item.overview,
          SourceLanguageCode: "en",
          TargetLanguageCode: language,
        })
      );

      // Add the translated title and overview to the response
      responseBody.data.title = titleTranslation.TranslatedText;
      responseBody.data.overview = overviewTranslation.TranslatedText;
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    console.error("Error during handler execution:", error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  return DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true },
    unmarshallOptions: { wrapNumbers: false },
  });
}
