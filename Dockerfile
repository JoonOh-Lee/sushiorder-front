# 1단계 : 빌드
FROM node:20-alpine AS builder
WORKDIR /app

# package.json 먼저 복사 (의존성 캐싱용)
COPY package.json package-lock.json ./
RUN npm ci

# 나머지 소스 복사 후 빌드
COPY .  .
RUN npm run build

# 2단계 : nginx로 서빙
FROM nginx:alpine

# 커스텀 nginx 설정으로 교체 (SPA 라우팅용)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드 결과물을 nginx 기본 서빙 경로에 복사
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]