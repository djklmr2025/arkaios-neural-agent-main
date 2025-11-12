from sqlmodel import create_engine, Session
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv, find_dotenv
import os

# Load environment variables from the nearest .env file (project root or backend)
load_dotenv(find_dotenv())


# Prefer explicit DB_CONNECTION_STRING if present; otherwise build Postgres URL if possible,
# and finally fall back to a local SQLite database for development.
conn_str = os.getenv('DB_CONNECTION_STRING')
if conn_str:
    DATABASE_URL = conn_str
else:
    user = os.getenv('DB_USERNAME') or ''
    password = os.getenv('DB_PASSWORD') or ''
    host = os.getenv('DB_HOST') or 'localhost'
    port = os.getenv('DB_PORT') or '5432'
    dbname = os.getenv('DB_DATABASE') or ''
    if user and password and dbname:
        DATABASE_URL = f'postgresql://{user}:{password}@{host}:{port}/{dbname}'
    else:
        # Safe fallback for local development
        DATABASE_URL = 'sqlite:///neuralagent.db'

# For SQLite, allow usage across threads in FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=True, connect_args=connect_args)

SessionLocal = sessionmaker(class_=Session, bind=engine, autocommit=False, autoflush=False)


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
