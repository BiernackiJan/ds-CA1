## Serverless REST Assignment - Distributed Systems.

__Name:__ Jan Biernacki

__Demo:__ https://youtu.be/SnEGoqrDpZ0

### Context.

I chose to use movies as my context for the web API. THe attributes I chose to use in the schema are;

* `id`: Unique identifier for the movie.
* `title`: The title of the movie.
* `genre_ids`: The genre id's of the movie.
* `original_language`: The original language of the movie
* `original_title`: The original title of the movie.
* `adult`: Whether the movie is made for adult or not.
* `overview`: overview of the movie
* `popularity`: The popularity of the movie.
* `poster_path`: The path to the poster of the movie.
* `release_date`: The release date of the movie.
* `video`: Wether the movie is a video or not.
* `vote_average`: The average vote of the movie.
* `vote_count`: The number of votes

### App API endpoints.

* **GET** /dev/movies - endpoint to retrieve all movies in the Movies table
* **POST** /dev/movies - endpoint to add a new movie protected by JWT token so only logged in users can add new movies

* **DELETE** /dev/movies/{movieId} - endpoint to delete movie by Id with authorisation if user created this movie
* **GET** /dev/movies/{movieId} - endpoint to retrieve movie by Id
* **PUT** /dev/movies/{movieId} - endpoint to update movie by Id if logged in user created the movie

* **GET** /dev/movies/{movieId}/cast - endpoint to retrieve movie cast with filtering options

* **GET** /dev/movies/{movieId}/translation?language="" - endpoint to translate movie title and description to the specified language


### Update constraint (if relevant).

Protected endpoints for adding, updating and deleting movies are protected by JWT token. Only logged in users can add new movies, only users who created the movie can update or delete it.This is done by checking their ID against the Id used when the movie was added

### Translation persistence (if relevant).

Translations are persisted in the database. When a user requests a translation, the system will check if the translation already exists in the database. If it does, it will return the existing translation. If it doesnt, it will create a new translation and return it while adding it to the translation database.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
