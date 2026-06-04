import strawberry
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from .database import SessionLocal
from . import models

@strawberry.type
class TaskStatusMetrics:
    status: str
    count: int

@strawberry.type
class TaskPriorityMetrics:
    priority: str
    count: int

@strawberry.type
class AssigneeWorkload:
    assigneeName: str
    taskCount: int

@strawberry.type
class ProjectAnalytics:
    projectId: int
    projectName: str
    totalTasks: int
    completedTasks: int
    completionPercentage: float
    statusDistribution: List[TaskStatusMetrics]
    priorityDistribution: List[TaskPriorityMetrics]
    workloadDistribution: List[AssigneeWorkload]
    overdueTasksCount: int
    activeUsersCount: int  # We can set this from Redis presence if available

# Query resolvers
@strawberry.type
class Query:
    @strawberry.field
    def project_analytics(self, project_id: int) -> Optional[ProjectAnalytics]:
        db: Session = SessionLocal()
        try:
            # 1. Fetch Project
            project = db.query(models.Project).filter(models.Project.id == project_id).first()
            if not project:
                return None

            # 2. Fetch Tasks of the project
            tasks = db.query(models.Task).filter(models.Task.projectId == project_id).all()
            total_tasks = len(tasks)
            if total_tasks == 0:
                return ProjectAnalytics(
                    projectId=project_id,
                    projectName=project.name,
                    totalTasks=0,
                    completedTasks=0,
                    completionPercentage=0.0,
                    statusDistribution=[],
                    priorityDistribution=[],
                    workloadDistribution=[],
                    overdueTasksCount=0,
                    activeUsersCount=0
                )

            completed_tasks = sum(1 for t in tasks if t.status == "DONE")
            completion_percentage = (completed_tasks / total_tasks) * 100.0

            # 3. Status Distribution
            status_map = {}
            for t in tasks:
                status_map[t.status] = status_map.get(t.status, 0) + 1
            status_dist = [TaskStatusMetrics(status=s, count=c) for s, c in status_map.items()]

            # 4. Priority Distribution
            priority_map = {}
            for t in tasks:
                priority_map[t.priority] = priority_map.get(t.priority, 0) + 1
            priority_dist = [TaskPriorityMetrics(priority=p, count=c) for p, c in priority_map.items()]

            # 5. Workload Distribution (Assignee)
            workload_map = {}
            for t in tasks:
                name = t.assignee.name if t.assignee else "Unassigned"
                workload_map[name] = workload_map.get(name, 0) + 1
            workload_dist = [AssigneeWorkload(assigneeName=name, taskCount=count) for name, count in workload_map.items()]

            # 6. Overdue Tasks (dueDate is in past and status is not DONE)
            now = datetime.now() # Naive compare
            overdue_count = 0
            for t in tasks:
                if t.dueDate and t.status != "DONE":
                    # Remove timezone info for comparison if SQLite or Postgres stores it as timezone-naive
                    due = t.dueDate.replace(tzinfo=None) if t.dueDate.tzinfo else t.dueDate
                    if due < now:
                        overdue_count += 1

            # Fetch active user presence from Redis dynamically
            import redis
            import os
            import json
            active_users_count = 0
            r = None
            try:
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
                r = redis.Redis.from_url(redis_url, decode_responses=True)
                presence_key = f"project:{project_id}:presence"
                active_users = r.hgetall(presence_key)
                active_users_count = len(active_users)
            except Exception as e:
                print("Failed to fetch presence from Redis for Analytics:", e)
            finally:
                if r is not None:
                    r.close()

            return ProjectAnalytics(
                projectId=project_id,
                projectName=project.name,
                totalTasks=total_tasks,
                completedTasks=completed_tasks,
                completionPercentage=round(completion_percentage, 1),
                statusDistribution=status_dist,
                priorityDistribution=priority_dist,
                workloadDistribution=workload_dist,
                overdueTasksCount=overdue_count,
                activeUsersCount=active_users_count
            )

        finally:
            db.close()

schema = strawberry.Schema(query=Query)
