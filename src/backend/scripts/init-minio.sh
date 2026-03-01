#!/bin/sh
# MinIO bucket initialization script.
# Runs via an init container (minio/mc) after the MinIO service starts.

set -e

echo "Waiting for MinIO to be ready..."
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" 2>/dev/null; do
  sleep 1
done

echo "Creating bucket: ${MINIO_BUCKET:-prosearc}"
mc mb --ignore-existing "local/${MINIO_BUCKET:-prosearc}"

echo "MinIO initialization complete."
