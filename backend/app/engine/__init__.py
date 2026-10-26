"""LocalShield AI - Engine Package.

Exports the SensitiveEntityDetector, DetectedEntity, Masker, MaskResult,
ResponseUnmasker, and UnmaskResult.
"""

from app.engine.detector import (
    Confidence,
    DetectedEntity,
    EntityType,
    SensitiveEntityDetector,
)
from app.engine.masker import MaskResult, Masker
from app.engine.unmasker import ResponseUnmasker, UnmaskResult

__all__ = [
    "Confidence",
    "DetectedEntity",
    "EntityType",
    "SensitiveEntityDetector",
    "MaskResult",
    "Masker",
    "ResponseUnmasker",
    "UnmaskResult",
]
