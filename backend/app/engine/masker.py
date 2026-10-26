"""LocalShield AI - Sensitive Value Masker.

Replaces detected sensitive values with structured placeholders (e.g., [EMAIL_1], [PHONE_1])
while ensuring that repeated instances of the same value share the same placeholder.
Guarantees that sensitive values are never logged or printed.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from app.engine.detector import DetectedEntity, SensitiveEntityDetector


@dataclass
class MaskResult:
    """Encapsulates the result of a prompt masking operation.

    Attributes:
        sanitized_text: The prompt with all sensitive entities replaced by placeholders.
        mapping: Dictionary mapping placeholders to original values (held in memory).
        entities: List of all DetectedEntity occurrences identified.
        stats: Count of total masked occurrences grouped by entity type.
    """
    sanitized_text: str
    mapping: Dict[str, str] = field(default_factory=dict)
    entities: List[DetectedEntity] = field(default_factory=list)
    stats: Dict[str, int] = field(default_factory=dict)

    def __repr__(self) -> str:
        """Safe string representation that redacts sensitive values.

        Prevents accidental leakage in terminal outputs or log aggregators.
        """
        redacted_mapping = {placeholder: "[REDACTED]" for placeholder in self.mapping}
        return (
            f"MaskResult("
            f"sanitized_text={self.sanitized_text!r}, "
            f"placeholders={list(self.mapping.keys())}, "
            f"redacted_mapping={redacted_mapping}, "
            f"stats={self.stats})"
        )


class Masker:
    """Masks detected sensitive values with consistent, numbered placeholders."""

    def __init__(self, detector: Optional[SensitiveEntityDetector] = None):
        """Initializes the Masker with an optional SensitiveEntityDetector instance."""
        self.detector = detector or SensitiveEntityDetector()

    def mask(self, text: str, entities: Optional[List[DetectedEntity]] = None) -> MaskResult:
        """Sanitizes text by replacing sensitive entities with placeholders.

        Rules:
        - Format: [ENTITY_TYPE_INDEX], e.g., [EMAIL_1], [PHONE_1], [API_KEY_1].
        - Repeated occurrences of the exact same value and entity type receive
          the exact same placeholder within this scan.
        - Non-overlapping entities are replaced safely from left to right.

        Args:
            text: Original prompt text.
            entities: Optional pre-detected entities. If None, detector.detect(text) is called.

        Returns:
            A MaskResult containing sanitized_text, placeholder-to-value mapping,
            and detection statistics.
        """
        if not text:
            return MaskResult(sanitized_text="", mapping={}, entities=[], stats={})

        if entities is None:
            entities = self.detector.detect(text)

        if not entities:
            return MaskResult(sanitized_text=text, mapping={}, entities=[], stats={})

        # Track placeholder assignments per (entity_type, value) pair
        # to ensure identical values share the same placeholder.
        value_to_placeholder: Dict[Tuple[str, str], str] = {}
        placeholder_to_value: Dict[str, str] = {}
        type_counters: Dict[str, int] = {}
        stats: Dict[str, int] = {}

        # First pass: assign placeholders deterministically
        for entity in entities:
            stats[entity.entity_type] = stats.get(entity.entity_type, 0) + 1
            key = (entity.entity_type, entity.value)

            if key not in value_to_placeholder:
                current_count = type_counters.get(entity.entity_type, 0) + 1
                type_counters[entity.entity_type] = current_count
                placeholder = f"[{entity.entity_type}_{current_count}]"
                value_to_placeholder[key] = placeholder
                placeholder_to_value[placeholder] = entity.value

        # Second pass: reconstruct the sanitized string using slice chunks
        chunks: List[str] = []
        last_index = 0

        for entity in entities:
            # Skip any malformed or overlapping spans that might slip through
            if entity.start < last_index:
                continue

            # Append clean text before this entity
            chunks.append(text[last_index:entity.start])

            # Append the assigned placeholder
            placeholder = value_to_placeholder[(entity.entity_type, entity.value)]
            chunks.append(placeholder)

            # Advance index to end of replaced sensitive value
            last_index = entity.end

        # Append remaining text after the last entity
        chunks.append(text[last_index:])
        sanitized_text = "".join(chunks)

        return MaskResult(
            sanitized_text=sanitized_text,
            mapping=placeholder_to_value,
            entities=entities,
            stats=stats
        )
