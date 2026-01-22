FROM node:20-alpine AS build
RUN npm install -g pnpm@8
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
COPY . /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @delivery-tracker/server build-with-deps

FROM public.ecr.aws/lambda/nodejs:20

WORKDIR ${LAMBDA_TASK_ROOT}

RUN npm install -g pnpm@8
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/server/dist packages/server/dist

CMD ["packages/server/dist/lambda.handler"]
