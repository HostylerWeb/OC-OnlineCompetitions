FROM alpine:3.20
ARG MC_RELEASE=RELEASE.2025-08-13T08-35-41Z
RUN apk add --no-cache ca-certificates curl \
  && curl -fsSL "https://github.com/minio/mc/releases/download/${MC_RELEASE}/mc.linux-amd64.${MC_RELEASE}" -o /usr/local/bin/mc \
  && chmod +x /usr/local/bin/mc
ENTRYPOINT ["/usr/local/bin/mc"]
