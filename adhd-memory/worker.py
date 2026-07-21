"""
Temporal Worker — runs DreamCycleWorkflow activities.
Start as a separate process alongside the FastAPI app.
"""

import os
import asyncio
from temporalio.client import Client
from temporalio.worker import Worker

from workflows import DreamCycleWorkflow, decay_sweep, archive_to_okf, promote_to_graph

TASK_QUEUE = "adhd-memory-tasks"


async def main():
    temporal_host = os.environ.get("TEMPORAL_HOST", "temporal:7233")
    
    print(f"Connecting to Temporal at {temporal_host}...")
    client = await Client.connect(temporal_host)
    
    print("Starting Dream Cycle worker...")
    worker = Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[DreamCycleWorkflow],
        activities=[decay_sweep, archive_to_okf, promote_to_graph],
    )
    
    # Register the cron schedule
    from temporalio.client import Schedule, ScheduleActionStartWorkflow, ScheduleSpec
    
    try:
        await client.create_schedule(
            "dream-cycle-cron",
            Schedule(
                action=ScheduleActionStartWorkflow(
                    DreamCycleWorkflow.run,
                    args=["agent-launch-pad"],
                    task_queue=TASK_QUEUE,
                ),
                spec=ScheduleSpec(cron="0 3 * * *"),  # 03:00 AM daily
            ),
        )
        print("Registered dream-cycle-cron schedule (03:00 AM daily)")
    except Exception as e:
        print(f"Schedule may already exist: {e}")
    
    print("Worker started. Waiting for tasks...")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
