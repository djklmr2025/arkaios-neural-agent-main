from sqlalchemy.orm import Session
from backend.models.workspace import Workspace
from backend.schemas.workspace import WorkspaceCreate

def get_workspaces(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Workspace).offset(skip).limit(limit).all()

def create_workspace(db: Session, workspace: WorkspaceCreate, owner_id: int):
    db_workspace = Workspace(**workspace.dict(), owner_id=owner_id)
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)
    return db_workspace
