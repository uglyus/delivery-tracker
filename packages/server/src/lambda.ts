import type * as winston from "winston";
import {
  execute,
  parse,
  validate,
  type ExecutionResult,
  type GraphQLError,
  type GraphQLFormattedError,
} from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs, resolvers, type AppContext } from "@delivery-tracker/api";
import {
  DefaultCarrierRegistry,
  logger as coreLogger,
} from "@delivery-tracker/core";
import { initLogger } from "./logger";

const serverRootLogger: winston.Logger = coreLogger.rootLogger.child({
  module: "server",
});

const schema = makeExecutableSchema({
  typeDefs,
  resolvers: resolvers.resolvers,
});

const carrierRegistry = new DefaultCarrierRegistry();
let initialized = false;

interface LambdaEvent {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

interface LambdaResponse {
  data?: Record<string, unknown> | null;
  errors?: readonly GraphQLFormattedError[];
}

function formatError(error: GraphQLError): GraphQLFormattedError {
  const extensions: Record<string, unknown> = { ...(error.extensions ?? {}) };
  const originalCode = extensions.code;

  switch (originalCode) {
    case "INTERNAL":
    case "BAD_REQUEST":
    case "NOT_FOUND":
      break;
    case "GRAPHQL_PARSE_FAILED":
    case "GRAPHQL_VALIDATION_FAILED":
    case "BAD_USER_INPUT":
      extensions.code = "BAD_REQUEST";
      break;
    default:
      extensions.code = "INTERNAL";
      break;
  }

  if (extensions.code === "INTERNAL") {
    serverRootLogger.error("internal error response", {
      message: error.message,
      originalError: error.originalError,
    });
  }

  return {
    message: extensions.code === "INTERNAL" ? "Internal error" : error.message,
    locations: error.locations,
    path: error.path,
    extensions,
  };
}

export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  if (!initialized) {
    initLogger();
    await carrierRegistry.init();
    initialized = true;
  }

  const appContext: AppContext = {
    carrierRegistry,
  };

  let document;
  try {
    document = parse(event.query);
  } catch (syntaxError) {
    return {
      errors: [
        {
          message: (syntaxError as Error).message,
          extensions: { code: "BAD_REQUEST" },
        },
      ],
    };
  }

  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    return {
      errors: validationErrors.map((error) => ({
        message: error.message,
        locations: error.locations,
        extensions: { code: "BAD_REQUEST" },
      })),
    };
  }

  const result: ExecutionResult = await execute({
    schema,
    document,
    variableValues: event.variables,
    operationName: event.operationName,
    contextValue: { appContext },
  });

  return {
    data: result.data as Record<string, unknown> | null | undefined,
    errors: result.errors?.map(formatError),
  };
};
