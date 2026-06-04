import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://cosphere_user:cosphere_password@localhost:5432/cosphere_db"
)

# Strip ?schema=public or ?options=... — SQLAlchemy uses connect_args instead
# but we handle search_path via the connect event below
clean_url = DATABASE_URL.split("?")[0]

engine = create_engine(clean_url)

# Ensure SQLAlchemy always queries the 'public' schema (same as Prisma)
@event.listens_for(engine, "connect")
def set_search_path(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("SET search_path TO public")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
