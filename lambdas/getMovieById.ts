import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
    const body = event.body ? JSON.parse(event.body) : undefined;

    // Validate query parameters
    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Invalid query parameters", errors: isValidQueryParams.errors }),
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

    let responseBody = { data: movieData.Item, queryParams: {} };
    responseBody.queryParams = queryParams;


    // If language query parameter is provided, perform translation
    if (queryParams.language) {
      const language = queryParams.language;

      console.log(`Requested translation for language: ${language}`);


       // Check if translation exists in cache table
       const cachedTranslation = await ddbDocClient.send(
        new GetCommand({
          TableName: process.env.TRANSLATION_TABLE_NAME,
          Key: { PK: `MOVIE#${movieId}`, language },
        })
      );

      if (cachedTranslation.Item) {
        console.log("Translation found in cache.");
        responseBody.data.title = cachedTranslation.Item.title;
        responseBody.data.overview = cachedTranslation.Item.overview;


      } else {
        console.log("No cached translation found; proceeding with translation.");


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


      const translatedData = {
        PK: `MOVIE#${movieId}`,
        language, 
        title: titleTranslation.TranslatedText,  // Hardcoded for testing
        overview: overviewTranslation.TranslatedText, // Hardcoded for testing
        body
      };

      await ddbDocClient.send(
        new PutCommand({
          TableName: process.env.TRANSLATION_TABLE_NAME,
          Item: translatedData,
        })
      );
      console.log("Cached the translated text in DynamoDB.");
    }
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
      body: JSON.stringify({
        error: "Internal Server Error",
        details: error.message || JSON.stringify(error),
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
