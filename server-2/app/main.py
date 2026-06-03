import os
import json
import redis
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter
from .graphql_schema import schema

app = FastAPI(title="CoSphere Analytics Service", version="1.0.0")

# Allow CORS for frontends and tools
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graphql_router = GraphQLRouter(schema)
app.include_router(graphql_router, prefix="/graphql")

# Redis Background Event Subscriber (Microservice Communication)
def redis_event_subscriber():
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    print(f"[FastAPI Listener] Connecting to Redis at {redis_url}...", flush=True)
    try:
        r = redis.Redis.from_url(redis_url, decode_responses=True)
        pubsub = r.pubsub()
        pubsub.subscribe("workspace:events")
        print("[FastAPI Listener] Successfully subscribed to 'workspace:events' channel.", flush=True)
        
        for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    payload = json.loads(message["data"])
                    print(f"\n=======================================================", flush=True)
                    print(f"[MICROSERVICE COMMUNICATION EVENT DETECTED]", flush=True)
                    print(f"Event: {payload.get('event')}", flush=True)
                    print(f"Project ID: {payload.get('projectId')}", flush=True)
                    print(f"Task ID: {payload.get('taskId')}", flush=True)
                    print(f"Timestamp: {payload.get('timestamp')}", flush=True)
                    print(f"Details: Status updated to '{payload.get('status')}' (Priority: {payload.get('priority')})", flush=True)
                    print(f"=======================================================\n", flush=True)
                    # In a production app, we would invalidate the caching layer in redis
                    # for this project's analytics, forcing a fresh compute on next request.
                except Exception as parse_err:
                    print(f"[FastAPI Listener] Error parsing message data: {parse_err}", flush=True)
    except Exception as connection_err:
        print(f"[FastAPI Listener] Redis connection or subscription failed: {connection_err}", flush=True)

@app.on_event("startup")
def startup_event():
    # Start Redis subscription listener in a daemon background thread
    listener_thread = threading.Thread(target=redis_event_subscriber, daemon=True)
    listener_thread.start()
    print("[FastAPI Startup] Microservice background thread started.", flush=True)

@app.get("/")
def read_root():
    return {"service": "cosphere-analytics-graphql", "status": "active"}
