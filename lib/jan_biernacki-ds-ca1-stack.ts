import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";

import { generateBatch } from "../shared/utils";
import { movies, movieCasts } from "../seed/movies";
import { UserPool } from "aws-cdk-lib/aws-cognito";

import { Construct } from 'constructs';

import { AuthApi } from './auth-api'
import { AppApi } from './app-api'

import * as iam from 'aws-cdk-lib/aws-iam';


export class JanBiernackiDsCa1Stack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ca1Fn = new lambdanode.NodejsFunction(this, "Ca1Fn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/ca1.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });


    //Tables
    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Movies",
    });

    const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "actorName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieCast",
    });

    movieCastsTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
    });

    const movieTranslationsTable = new dynamodb.Table(this, "MovieTranslationsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // e.g., "MOVIE#<movieId>"
      sortKey: { name: "language", type: dynamodb.AttributeType.STRING }, // e.g., "fr" for French
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieTranslations",
    });



    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviesTable.tableName]: generateBatch(movies),
            [movieCastsTable.tableName]: generateBatch(movieCasts),  // Added
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [moviesTable.tableArn, movieCastsTable.tableArn],  // Includes movie cast
      }),
    });



    //Lambdas
    const getMovieByIdFn = new lambdanode.NodejsFunction(this, "GetMovieByIdFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/getMovieById.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        CAST_TABLE_NAME: movieCastsTable.tableName,
        TRANSLATION_TABLE_NAME: movieTranslationsTable.tableName,
        REGION: 'eu-west-1',
      },
    });

    const getAllMoviesFn = new lambdanode.NodejsFunction(
      this,
      "GetAllMoviesFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getAllMovies.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );
    
    const getMovieCastMembersFn = new lambdanode.NodejsFunction(
      this,
      "GetCastMemberFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieCastMembers.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieCastsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const newMovieFn = new lambdanode.NodejsFunction(this, "AddMovieFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/addMovie.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const deleteMovieFn = new lambdanode.NodejsFunction(this, "DeleteMovieFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/deleteMovie.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        MOVIES_TABLE_NAME: moviesTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const updateMovieFn = new lambdanode.NodejsFunction(this, "UpdateMovieFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/updateMovie.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: "eu-west-1",
      },
    });
    

    //IAM Roles
    //adding permissions to allow for translation
    getMovieByIdFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["translate:TranslateText"],
      resources: ["*"], // You can restrict this to specific resources if needed
    }));

    newMovieFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem'],
      resources: [movieTranslationsTable.tableArn],  // Grant PutItem permissions on the MovieTranslations table
    }));
    
    

    // Permissions
    moviesTable.grantReadData(getMovieCastMembersFn);
    moviesTable.grantReadData(getMovieByIdFn);
    moviesTable.grantReadData(getAllMoviesFn);
    moviesTable.grantReadWriteData(deleteMovieFn);
    moviesTable.grantReadWriteData(newMovieFn)
    moviesTable.grantReadWriteData(updateMovieFn);
    
    movieCastsTable.grantReadData(getMovieCastMembersFn);
    movieCastsTable.grantReadData(getMovieByIdFn)

    movieTranslationsTable.grantReadWriteData(getMovieByIdFn);

    // REST API 
    const api = new apig.RestApi(this, "RestAPI", {
      description: "ca1 api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });
    
    const moviesEndpoint = api.root.addResource("movies");
    moviesEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllMoviesFn, { proxy: true })
    );
    
    const movieEndpoint = moviesEndpoint.addResource("{movieId}");
    movieEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieByIdFn, { proxy: true })
    );


    const movieCastEndpoint = moviesEndpoint.addResource("cast");
    movieCastEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieCastMembersFn, { proxy: true })
    );

    const translationEndpoint = movieEndpoint.addResource("translation");
    translationEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieByIdFn, { proxy: true })
    );

    moviesEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieFn, { proxy: true })
    );

    moviesEndpoint.addMethod(
      "DELETE",
      new apig.LambdaIntegration(deleteMovieFn, { proxy: true })
    );

    movieEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(updateMovieFn, { proxy: true })
    );


    //authenticatioon
    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolId = userPool.userPoolId;

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    const userPoolClientId = appClient.userPoolClientId;

    new AuthApi(this, 'AuthServiceApi', {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
    });

    new AppApi(this, 'AppApi', {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
    } );
    
  }
}