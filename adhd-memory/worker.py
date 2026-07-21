"""
Temporal Worker — runs DreamCycleWorkflow activities.
Start as a separate process alongside the FastAPI app.
"""

import os
import asyncio
from temporalio.client import Client

from workflows import DreamCycleWorkflow, decay_sweep, archive_to_okf, promote_to_graph


async def main():
    temporal_host = os.environ.get("TEMPORAL_HOST", "temporal:7233")
    
    print(f"Connecting to Temporal at {temporal_host}...")
    client = await Client.connect(temporal_host)
    
    print("Starting Dream Cycle worker...")
    await client.start_worker(
        workflows=[DreamCycleWorkflow],
        activities=[decay_sweep, archive_to_okf, promote_to_graph],
        task_queue="adhd-memory-tasks",
    )
    
    print("Worker started. Waiting for tasks...")
    
    # Register the cron schedule
    from temporalio.client import Schedule, ScheduleActionStartWorkflow, ScheduleSpec
    
    try:
        await client.create_schedule(
            "dream-cycle-cron",
            Schedule(
                action=ScheduleActionStartWorkflow(
                    DreamCycleWorkflow.run,
                    args=["agent-launch-pad"],
                    task_queue="adhd-memory-tasks",
                ),
                spec=ScheduleSpec(cron="0 3 * * *"),  # 03:00 AM daily
            ),
        )
        print("Registered dream-cycle-cron schedule (03:00 AM daily)")
    except Exception as e:
        print(f"Schedule may already exist: {e}")
    
    # Keep running
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())
