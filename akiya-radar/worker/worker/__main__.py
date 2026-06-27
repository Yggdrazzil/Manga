"""Worker entrypoint.

In the MVP the worker stays alive and idle (no live crawling). It logs a
heartbeat so the Docker service has a clear running state. Crawl jobs are
triggered manually and added in later milestones.
"""

from __future__ import annotations

import logging
import os
import time

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("akiya.worker")


def main() -> None:
    interval = int(os.environ.get("WORKER_HEARTBEAT_SECONDS", "3600"))
    logger.info("Akiya Radar worker started (idle MVP mode). No live crawling.")
    while True:
        logger.info("worker heartbeat — waiting for manual crawl triggers")
        time.sleep(interval)


if __name__ == "__main__":
    main()
