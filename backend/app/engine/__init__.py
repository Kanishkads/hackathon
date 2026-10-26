"""LocalShield AI - Engine Package.

Exports the SensitiveEntityDetector, DetectedEntity, Masker, and MaskResult.
"""

from app.engine.detector import (
    Confidence,
    DetectedEntity,
    EntityType,
    SensitiveEntityDetector,
)
from app.engine.masker import MaskResult, Masker

__all__ = [
    "Confidence",
    "DetectedEntity",
    "EntityType",
    "SensitiveEntityDetector",
    "MaskResult",
    "Masker",
]
