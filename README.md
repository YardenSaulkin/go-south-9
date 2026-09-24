# go-south-9
Team 9's Go-south project for the hackathon

## Docker

Build both production images with:

```bash
docker compose build
```

Run the frontend and backend containers with:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require' \
docker compose up
```

The frontend is available at `http://localhost:8080` and the backend at
`http://localhost:3000`. `DATABASE_URL` must point to the application's
PostgreSQL database before backend requests that access data will work.

To use a different browser-visible backend URL, set `VITE_API_URL` when
building the frontend image:

```bash
VITE_API_URL='https://api.example.com' docker compose build frontend
```

