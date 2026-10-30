FROM golang:1.27.3-alpine AS builder
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /out/server ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget && adduser -D -u 10001 app && mkdir -p /var/log/nutrisnap && chown app /var/log/nutrisnap
ENV TZ=America/Sao_Paulo
WORKDIR /app
COPY --from=builder /out/server .
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/api/v1/health || exit 1
CMD ["./server"]
