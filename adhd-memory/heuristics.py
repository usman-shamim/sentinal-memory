"""
Heuristics — SNARC Salience Scorer + Ebbinghaus Decay Function.
Pure heuristics, no LLM required. Runs in <10ms.
"""

import math
from typing import Dict


def calculate_snarc(event: dict) -> Dict[str, float]:
    """
    Calculate the 5 SNARC dimensions from event data.
    Returns dict with surprise, novelty, arousal, reward, conflict.
    """
    surprise = 0.0
    novelty = 0.5  # Placeholder: would use 1 - max_cosine_sim in production
    arousal = 0.0
    reward = 0.0
    conflict = 0.0

    # Arousal: Did something break or succeed dramatically?
    status_code = event.get("status_code", 200)
    if status_code >= 500:
        arousal = 1.0
    elif status_code >= 400:
        arousal = 0.6
    elif event.get("status") == "completed":
        arousal = 0.3

    # Reward: Was a user goal achieved?
    if event.get("task_type") == "user_approval":
        reward = 0.8
    elif event.get("confidence_combined", 1.0) > 0.8:
        reward = 0.4

    # Conflict: Did an agent fail to reach a consensus?
    if event.get("confidence_combined", 1.0) < 0.4:
        conflict = 0.7

    return {
        "surprise": surprise,
        "novelty": novelty,
        "arousal": arousal,
        "reward": reward,
        "conflict": conflict,
    }


def calculate_salience(event: dict) -> float:
    """
    Calculate overall SNARC salience score (0.0 to 1.0).
    Weighted sum: surprise(0.25) + novelty(0.30) + arousal(0.20) + reward(0.15) + conflict(0.10)
    """
    snarc = calculate_snarc(event)
    
    salience = (
        (0.25 * snarc["surprise"])
        + (0.30 * snarc["novelty"])
        + (0.20 * snarc["arousal"])
        + (0.15 * snarc["reward"])
        + (0.10 * snarc["conflict"])
    )
    
    return min(max(salience, 0.0), 1.0)


def apply_decay(current_decay: float, stability: float, hours_passed: float) -> float:
    """
    Ebbinghaus Decay Function: R = e^(-t/S)
    
    Args:
        current_decay: Current decay score (0.0 to 1.0)
        stability: Resistance to decay (grows with hits, starts at 1.0)
        hours_passed: Hours since last access
    
    Returns:
        New decay score (floored at 0.0)
    """
    decay_rate = 1.0 / max(stability, 0.1)  # Prevent division by zero
    new_decay = current_decay * math.exp(-decay_rate * hours_passed)
    return max(new_decay, 0.0)
