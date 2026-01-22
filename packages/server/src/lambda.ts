import type * as winston from "winston";
import { ApolloServer } from "@apollo/server";
import {
  ApolloServerErrorCode,
  unwrapResolverError,
} from "@apollo/server/errors";
import { typeDefs, resolvers, type AppContext } from "@delivery-tracker/api";
import {
  DefaultCarrierRegistry,
  logger as coreLogger,
} from "@delivery-tracker/core";
import { initLogger } from "./logger";

const serverRootLogger: winston.Logger = coreLogger.rootLogger.child({
  module: "server",
});

const server = new ApolloServer({
  typeDefs,
  resolvers: resolvers.resolvers,
  formatError: (formattedError, error) => {
    const extensions = formattedError.extensions ?? {};
    switch (extensions.code) {
      case "INTERNAL":
      case "BAD_REQUEST":
      case "NOT_FOUND":
      case ApolloServerErrorCode.INTERNAL_SERVER_ERROR:
        extensions.code = "INTERNAL";
        break;
      case ApolloServerErrorCode.GRAPHQL_PARSE_FAILED:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.PERSISTED_QUERY_NOT_FOUND:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.PERSISTED_QUERY_NOT_SUPPORTED:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.BAD_USER_INPUT:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.OPERATION_RESOLUTION_FAILURE:
        extensions.code = "BAD_REQUEST";
        break;
      default:
        extensions.code = "INTERNAL";
        break;
    }

    if (extensions.code === "INTERNAL") {
      serverRootLogger.error("internal error response", {
        formattedError,
        error: unwrapResolverError(error),
      });
    }

    return {
      ...formattedError,
      extensions,
      message:
        extensions.code === "INTERNAL"
          ? "Internal error"
          : formattedError.message,
    };
  },
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
  errors?: ReadonlyArray<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
}

export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  if (!initialized) {
    initLogger();
    await server.start();
    await carrierRegistry.init();
    initialized = true;
  }

  const appContext: AppContext = {
    carrierRegistry,
  };

  const result = await server.executeOperation(
    {
      query: event.query,
      variables: event.variables,
      operationName: event.operationName,
    },
    { contextValue: { appContext } }
  );

  if (result.body.kind === "single") {
    return result.body.singleResult;
  }
  return { errors: [{ message: "Incremental delivery not supported" }] };
};
