from typing import AsyncGenerator, Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db_session

# Dependency for Async Database Session
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]
