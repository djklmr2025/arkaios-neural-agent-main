from pydantic import BaseModel
from typing import List, Optional

class WorkspaceBase(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceCreate(WorkspaceBase):
    pass

class Workspace(WorkspaceBase):
    id: int
    owner_id: int

    class Config:
        orm_mode = True
