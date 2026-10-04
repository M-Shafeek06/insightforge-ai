from sqlalchemy import create_engine

from app.services.settings import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
