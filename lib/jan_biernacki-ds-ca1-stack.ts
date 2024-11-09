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

export class JanBiernackiDsCa1Stack extends cdk.Stack {
  private auth: apig.IResource;
  private userPoolId: string;
  private userPoolClientId: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


  //   //authenticatioon
  //   const userPool = new UserPool(this, "UserPool", {
  //     signInAliases: { username: true, email: true },
  //     selfSignUpEnabled: true,
  //     removalPolicy: cdk.RemovalPolicy.DESTROY,
  //   });

  //   this.userPoolId = userPool.userPoolId;

  //   const appClient = userPool.addClient("AppClient", {
  //     authFlows: { userPassword: true },
  //   });

  //   this.userPoolClientId = appClient.userPoolClientId;

  //   const authApi = new apig.RestApi(this, "AuthServiceApi", {
  //     description: "Authentication Service RestApi",
  //     endpointTypes: [apig.EndpointType.REGIONAL],
  //     defaultCorsPreflightOptions: {
  //       allowOrigins: apig.Cors.ALL_ORIGINS,
  //     },
  //   });


  //   this.auth = authApi.root.addResource("auth");


  //   this.addAuthRoute(
  //     "signup",
  //     "POST",
  //     "SignupFn",
  //     'signup.ts'
  //   );

  //   this.addAuthRoute(
  //     "confirm_signup",
  //     "POST",
  //     "ConfirmFn",
  //     "confirm-signup.ts"
  //   );

  // }

  

  // private addAuthRoute(
  //   resourceName: string,
  //   method: string,
  //   fnName: string,
  //   fnEntry: string,
  //   allowCognitoAccess?: boolean
  // ): void {
  //   const commonFnProps = {
  //     architecture: lambda.Architecture.ARM_64,
  //     timeout: cdk.Duration.seconds(10),
  //     memorySize: 128,
  //     runtime: lambda.Runtime.NODEJS_18_X,
  //     handler: "handler",
  //     environment: {
  //       USER_POOL_ID: this.userPoolId,
  //       CLIENT_ID: this.userPoolClientId,
  //       REGION: cdk.Aws.REGION
  //     },
  //   };
    
  //   const resource = this.auth.addResource(resourceName);
    
  //   const fn = new node.NodejsFunction(this, fnName, {
  //     ...commonFnProps,
  //     entry: `${__dirname}/../lambdas/auth/${fnEntry}`,
  //   });

  //   resource.addMethod(method, new apig.LambdaIntegration(fn));

    const ca1Fn = new lambdanode.NodejsFunction(this, "Ca1Fn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/ca1.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    const ca1FnURL = ca1Fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      cors: {
        allowedOrigins: ["*"],
      },
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
    const getMovieByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMovieById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviesTable.tableName,
          CAST_TABLE_NAME: movieCastsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

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


    const getMovieByIdURL = getMovieByIdFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    const getAllMoviesURL = getAllMoviesFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    const getMovieCastMembersURL = getMovieCastMembersFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });  

    // Permissions
    moviesTable.grantReadData(getMovieCastMembersFn);
    moviesTable.grantReadData(getMovieByIdFn);
    moviesTable.grantReadData(getAllMoviesFn);
    moviesTable.grantReadWriteData(deleteMovieFn);
    moviesTable.grantReadWriteData(newMovieFn)

    movieCastsTable.grantReadData(getMovieCastMembersFn);
    movieCastsTable.grantReadData(getMovieByIdFn)


    // REST API 
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
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

    moviesEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieFn, { proxy: true })
    );

    moviesEndpoint.addMethod(
      "DELETE",
      new apig.LambdaIntegration(deleteMovieFn, { proxy: true })
    );
    


    new cdk.CfnOutput(this, "CA1 Function Url", { value: ca1FnURL.url });
    new cdk.CfnOutput(this, "Get Movie Function Url", { value: getMovieByIdURL.url });
    new cdk.CfnOutput(this, "Get All Movies Function Url", { value: getAllMoviesURL.url });
    new cdk.CfnOutput(this, "Get Movie Cast Url", { value: getMovieCastMembersURL.url, });
  }
}
