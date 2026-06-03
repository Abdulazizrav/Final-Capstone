from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class User(Base):
    __tablename__ = "User"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, name="createdAt")

    # Relations
    owned_projects = relationship("Project", back_populates="owner")
    tasks = relationship("Task", back_populates="assignee")
    messages = relationship("ChatMessage", back_populates="user")

class Project(Base):
    __tablename__ = "Project"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, name="createdAt")
    ownerId = Column(Integer, ForeignKey("User.id"), nullable=False, name="ownerId")

    # Relations
    owner = relationship("User", back_populates="owned_projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="project", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "Task"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="TODO", nullable=False)
    priority = Column(String, default="MEDIUM", nullable=False)
    dueDate = Column(DateTime, nullable=True, name="dueDate")
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, name="createdAt")
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, name="updatedAt")
    projectId = Column(Integer, ForeignKey("Project.id"), nullable=False, name="projectId")
    assigneeId = Column(Integer, ForeignKey("User.id"), nullable=True, name="assigneeId")

    # Relations
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="tasks")

class ChatMessage(Base):
    __tablename__ = "ChatMessage"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, name="createdAt")
    projectId = Column(Integer, ForeignKey("Project.id"), nullable=False, name="projectId")
    userId = Column(Integer, ForeignKey("User.id"), nullable=False, name="userId")

    # Relations
    project = relationship("Project", back_populates="messages")
    user = relationship("User", back_populates="messages")
