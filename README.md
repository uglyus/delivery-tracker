# Uglyus Delivery Tracker

Delivery and Shipping Tracking Service

## Usage
### Cloud (Managed Service)
Visit : https://tracker.delivery/docs/try

문서 참조 : https://tracker.delivery

Self-hosted Uglyus Delivery Tracker API를 위한 요청을 하기 위해서 header에 `x-api-key`를 추가해야 합니다.

### 예시

```
curl --request POST \
  --url 'http://localhost:4000/graphql' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: 1234567890' \
  --data '{"query":"query Track(\n  $carrierId: ID!,\n  $trackingNumber: String!\n) {\n  track(\n    carrierId: $carrierId,\n    trackingNumber: $trackingNumber\n  ) {\n    lastEvent {\n      time\n      status {\n        code\n      }\n    }\n  }\n}","variables":{"carrierId":"kr.cjlogistics","trackingNumber":"1234567890"}}'
```

## Deployment - Heroku

Heroku에서 PORT설정이 항상 바뀌기 때문에 PORT 설정을 해줘야 합니다.

참고 : [Why is my Node.js app crashing with an R10 error?](https://help.heroku.com/P1AVPANS/why-is-my-node-js-app-crashing-with-an-r10-error)

```
heroku login
heroku container:login
heroku create [app-name]
heroku stack:set container -a [app-name]
docker build --platform linux/amd64 -t registry.heroku.com/[app-name]/web .
docker push registry.heroku.com/[app-name]/web
heroku container:release web -a [app-name]
heroku open -a [app-name]
```

