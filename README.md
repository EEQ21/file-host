# Fike

Minimal anonymous file hosting. Upload a file, get a share link. No accounts.

## Features

- Up to **1 GB** per file (configurable)
- Any file type; files stored as opaque blobs (never executed)
- Share page (`/:id`) and direct download (`/d/:id`)
- Streaming uploads and downloads (no full-file buffering)
- **Local disk** or **S3-compatible** storage (AWS, R2, MinIO)
- Configurable file expiration via environment variables
- Rate limiting and security headers

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

See [`.env.example`](.env.example). Important variables:

| Variable | Description |
|----------|-------------|
| `APP_URL` | Public URL used in generated links |
| `MAX_FILE_SIZE` | Max bytes per file (default 1 GB) |
| `FILE_EXPIRATION_DAYS` | `0` = never expire |
| `STORAGE_TYPE` | `local` or `s3` |

### S3 / MinIO

```bash
docker compose up -d minio
```

Create a bucket `fike` in the MinIO console (port 9001), then:

```env
STORAGE_TYPE=s3
S3_ENDPOINT=http://127.0.0.1:9000
S3_BUCKET=fike
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_REGION=us-east-1
```

For production at scale, consider **direct-to-S3 multipart uploads** (presigned URLs) so the app server is not in the data path for every byte.

## Scripts

- `npm run dev` - development with hot reload
- `npm run build` && `npm start` - production

## API

- `POST /api/upload` - multipart field `file`
- `GET /api/files/:id` - metadata
- `GET /:id` - file page
- `GET /d/:id` - download stream

## License

[MIT](LICENSE)
