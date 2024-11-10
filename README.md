# Welcome to My Distributed Systems TypeScript CA1


### Main endpoints 

* **GET** /dev/movies - endpoint to retrieve all movies in the Movies table
* **POST** /dev/movies - endpoint to add a new movie protected by JWT token so only logged in users can add new movies

* **DELETE** /dev/movies/{movieId} - endpoint to delete movie by Id with authorisation if user created this movie
* **GET** /dev/movies/{movieId} - endpoint to retrieve movie by Id
* **PUT** /dev/movies/{movieId} - endpoint to update movie by Id if logged in user created the movie

* **GET** /dev/movies/{movieId}/cast - endpoint to retrieve movie cast with filtering options

* **GET** /dev/movies/{movieId}/translation?language="" - endpoint to translate movie title and description to the specified language

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
