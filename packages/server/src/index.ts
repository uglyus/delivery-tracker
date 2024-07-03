import type * as winston from "winston";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
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
import { validateApiKey } from "./auth";

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

async function main(): Promise<void> {
  const carrierRegistry = new DefaultCarrierRegistry();
  await carrierRegistry.init();

  const appContext: AppContext = {
    carrierRegistry,
  };

  const PORT = process.env.PORT ?? 4000;

  const { url } = await startStandaloneServer(server, {
    context: async ({ req, res }) => {
      const apiKey = req.headers["x-api-key"] as string | undefined;

      if (!validateApiKey(apiKey)) {
        throw new Error("유효하지 않은 API 키입니다");
      }

      return {
        appContext,
      };
    },
    listen: { port: +PORT },
  });
  serverRootLogger.info(`🚀 Server ready at ${url}`);
}

initLogger();
main().catch((err) => {
  serverRootLogger.error("Uncaught error", {
    error: err,
  });
});
