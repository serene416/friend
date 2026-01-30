from celery import Celery
import os

R_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

app = Celery('tasks', broker=R_URL, backend=R_URL)

@app.task
def crawl_place(place_name):
    print(f"Crawling data for {place_name}")
    return {"status": "success", "data": "dummy data"}
