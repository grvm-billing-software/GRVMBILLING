# GRVM Medical Centre — Hospital Billing & Reception

FastAPI + React + MongoDB app for OPD/IPD registration, billing, medicines inventory, family dispatch, discharge with revisit reminders, and a bilingual (Hindi/English) WhatsApp outbox.

## Run locally
**Backend**
```
cd backend
cp .env.example .env   # fill in MONGO_URL, APP_PASSWORD, EMERGENT_LLM_KEY (photo uploads)
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```
**Frontend**
```
cd frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
yarn install && yarn start
```

## Deploy on Render
Use **New → Blueprint** with this repo (`render.yaml`). Set `MONGO_URL` (MongoDB Atlas), `APP_PASSWORD`, `EMERGENT_LLM_KEY`, `CORS_ORIGINS` (frontend URL) and, on the frontend, `REACT_APP_BACKEND_URL` (backend URL).
