from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import SessionLocal
from backend.crud import workspace as crud_workspace
from backend.schemas import workspace as schemas_workspace

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/workspaces/", response_model=List[schemas_workspace.Workspace])
def read_workspaces(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    workspaces = crud_workspace.get_workspaces(db, skip=skip, limit=limit)
    return workspaces

@router.post("/workspaces/", response_model=schemas_workspace.Workspace)
def create_workspace(workspace: schemas_workspace.WorkspaceCreate, db: Session = Depends(get_db)):
    # Assuming a authenticated user with id=1
    return crud_workspace.create_workspace(db=db, workspace=workspace, owner_id=1)
