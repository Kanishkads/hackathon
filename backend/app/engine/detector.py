"""LocalShield AI - Sensitive Entity Detector.

Detects sensitive information such as email addresses, phone numbers,
recognizable API keys, and password-like assignments using regular expressions
and rule-based heuristics.
"""

from dataclasses import dataclass
from enum import Enum
import re
from typing import List, Optional, Tuple


class EntityType(str, Enum):
    """Enumeration of supported sensitive entity types."""
    PERSON = "PERSON"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    API_KEY = "API_KEY"
    PASSWORD = "PASSWORD"


class Confidence(str, Enum):
    """Confidence levels for detection results."""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass(frozen=True)
class DetectedEntity:
    """Represents a single detected sensitive entity in the text.

    Attributes:
        entity_type: Category of the sensitive data (e.g. EMAIL, PHONE).
        value: The raw detected string.
        start: Zero-based character start index in original text.
        end: Zero-based character end index in original text.
        confidence: Assessment of match certainty (HIGH, MEDIUM, LOW).
        rule_name: Identifier of the rule or pattern that matched.
    """
    entity_type: str
    value: str
    start: int
    end: int
    confidence: str
    rule_name: str

    def __repr__(self) -> str:
        """Safe string representation that never exposes raw sensitive values."""
        return (
            f"DetectedEntity("
            f"type={self.entity_type}, "
            f"span=({self.start}, {self.end}), "
            f"len={len(self.value)}, "
            f"confidence={self.confidence}, "
            f"rule={self.rule_name})"
        )


class SensitiveEntityDetector:
    """Detects sensitive entities in user-provided text using pattern rules."""

    # 1. Email pattern: RFC 5322 compliant subset
    EMAIL_PATTERN = re.compile(
        r'\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b'
    )

    # 2. Phone pattern: captures formatted domestic and international phone numbers
    PHONE_PATTERN = re.compile(
        r'(?:(?<=\s)|(?<=^)|(?<=[(]))(?:\+\d{1,3}[-.\s]*)?(?:\(\d{2,4}\)|\d{2,4})[-.\s]*\d{2,4}[-.\s]*\d{2,9}(?=(?:[\s,.;:!?)]|$))'
    )

    # Date pattern to prevent treating dates (e.g. 2026-10-26) as phone numbers
    DATE_PATTERN = re.compile(r'^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$')

    # IP address pattern to prevent treating IPv4 as phone numbers
    IP_PATTERN = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')

    # Version string pattern (e.g., 3.12.10)
    VERSION_PATTERN = re.compile(r'^\d+\.\d+\.\d+$')

    # 3. Recognizable vendor API key patterns
    OPENAI_KEY_PATTERN = re.compile(
        r'\b(?:sk-[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{20,})\b'
    )
    AWS_ACCESS_KEY_PATTERN = re.compile(r'\bAKIA[0-9A-Z]{16}\b')
    GITHUB_TOKEN_PATTERN = re.compile(r'\bgh[pousr]_[A-Za-z0-9_]{36,}\b')
    SLACK_TOKEN_PATTERN = re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{10,}\b')
    BEARER_TOKEN_PATTERN = re.compile(
        r'(?i)\bBearer\s+(?P<val>[A-Za-z0-9_\-\.]{20,})\b'
    )

    # Generic API Key / Access Token assignment (e.g., api_key = "...", access_token: "...")
    GENERIC_API_KEY_PATTERN = re.compile(
        r'(?i)\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret)\s*[:=]\s*(["\']?)(?P<val>[A-Za-z0-9_\-.~+/=]{16,})\1'
    )

    # 4. Password-like assignments (e.g., password = "...", db_pass: "...", passwd="...")
    PASSWORD_ASSIGNMENT_PATTERN = re.compile(
        r'(?i)\b(?P<key>password|passwd|pwd|db_pass|database_password|secret_key|app_secret)\s*[:=]\s*(["\']?)(?P<val>[^\s"\'`;\n]{6,})\2'
    )

    # Values that look like placeholders or booleans, not real passwords
    IGNORED_PASSWORD_VALUES = {
        "placeholder", "your_password", "your_password_here",
        "password", "secret", "null", "none", "true", "false",
        "undefined", "changeme", "example"
    }

    # 5. Personal name patterns (with honorifics, titles, or explicit declarations)
    PERSON_TITLE_PATTERN = re.compile(
        r'\b(?:Mr\.|Mrs\.|Ms\.|Miss|Dr\.|Prof\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b'
    )
    PERSON_CONTEXT_PATTERN = re.compile(
        r'(?i)\b(?:my\s+name\s+is|name\s+is|named|contact\s+person\s*:?|patient\s+name\s*:?|customer\s+name\s*:?|client\s+name\s*:?|employee\s*:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b'
    )
    IGNORED_NAME_WORDS = {
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
        "January", "February", "March", "April", "May", "June", "July", "August",
        "September", "October", "November", "December",
        "LocalShield", "Localshield", "Google", "DeepMind", "Microsoft", "OpenAI",
        "Amazon", "FastAPI", "React", "Python", "Windows", "GitHub", "Slack",
        "Security", "Policy", "Gateway", "Audit", "Server", "Database", "Project",
        "Please", "Thank", "Thanks", "Hello", "Dear", "Report", "Overview",
        "United", "States", "New", "York", "San", "Francisco", "North", "South"
    }

    def detect(self, text: str) -> List[DetectedEntity]:
        """Scans the input text and returns all detected sensitive entities.

        Overlapping matches are resolved by prioritizing specific rules,
        confidence levels, and longer matches. Repeated values are detected
        at each occurrence.

        Args:
            text: The user prompt or text to analyze.

        Returns:
            A list of DetectedEntity objects sorted by their start index.
        """
        if not text or not isinstance(text, str):
            return []

        candidates: List[DetectedEntity] = []

        # Run all detection rules
        candidates.extend(self._detect_persons(text))
        candidates.extend(self._detect_emails(text))
        candidates.extend(self._detect_phones(text))
        candidates.extend(self._detect_api_keys(text))
        candidates.extend(self._detect_passwords(text))

        # Resolve overlapping matches deterministically
        return self._resolve_overlaps(candidates)


    def _detect_emails(self, text: str) -> List[DetectedEntity]:
        """Detects email addresses."""
        results = []
        for match in self.EMAIL_PATTERN.finditer(text):
            value = match.group()
            start, end = match.span()

            # Verify no consecutive dots in domain
            domain = value.split('@')[-1]
            if ".." in domain:
                continue

            # Standard confidence evaluation
            tld = domain.split('.')[-1].lower()
            confidence = Confidence.HIGH.value if len(tld) >= 2 else Confidence.MEDIUM.value

            results.append(
                DetectedEntity(
                    entity_type=EntityType.EMAIL.value,
                    value=value,
                    start=start,
                    end=end,
                    confidence=confidence,
                    rule_name="email_pattern"
                )
            )
        return results

    def _detect_phones(self, text: str) -> List[DetectedEntity]:
        """Detects formatted domestic and international phone numbers."""
        results = []
        for match in self.PHONE_PATTERN.finditer(text):
            raw_val = match.group().strip()
            # Clean outer punctuation that might have been included
            cleaned_val = raw_val.rstrip(".,;:!?")
            if not cleaned_val:
                continue

            # Check if this match is actually a date, IP, or version
            if (self.DATE_PATTERN.match(cleaned_val) or
                self.IP_PATTERN.match(cleaned_val) or
                self.VERSION_PATTERN.match(cleaned_val)):
                continue

            # Count actual digits
            digits = [c for c in cleaned_val if c.isdigit()]
            digit_count = len(digits)

            # E.164 standard: 7 to 15 digits
            if digit_count < 7 or digit_count > 15:
                continue

            # Determine confidence
            has_country_code = cleaned_val.startswith('+')
            has_parens = '(' in cleaned_val and ')' in cleaned_val
            has_separators = any(sep in cleaned_val for sep in ['-', '.', ' '])

            if (has_country_code or has_parens or (has_separators and digit_count >= 10)):
                confidence = Confidence.HIGH.value
            elif digit_count >= 7 and has_separators:
                confidence = Confidence.MEDIUM.value
            else:
                confidence = Confidence.LOW.value

            start = match.start()
            end = start + len(cleaned_val)

            results.append(
                DetectedEntity(
                    entity_type=EntityType.PHONE.value,
                    value=cleaned_val,
                    start=start,
                    end=end,
                    confidence=confidence,
                    rule_name="phone_pattern"
                )
            )
        return results

    def _detect_api_keys(self, text: str) -> List[DetectedEntity]:
        """Detects vendor-specific API keys, bearer tokens, and generic key assignments."""
        results = []

        # 1. Vendor patterns (High confidence)
        vendor_rules = [
            (self.OPENAI_KEY_PATTERN, "openai_api_key"),
            (self.AWS_ACCESS_KEY_PATTERN, "aws_access_key"),
            (self.GITHUB_TOKEN_PATTERN, "github_token"),
            (self.SLACK_TOKEN_PATTERN, "slack_token"),
        ]

        for pattern, rule_name in vendor_rules:
            for match in pattern.finditer(text):
                results.append(
                    DetectedEntity(
                        entity_type=EntityType.API_KEY.value,
                        value=match.group(),
                        start=match.start(),
                        end=match.end(),
                        confidence=Confidence.HIGH.value,
                        rule_name=rule_name
                    )
                )

        # 2. Bearer tokens
        for match in self.BEARER_TOKEN_PATTERN.finditer(text):
            val = match.group("val")
            start = match.start("val")
            end = match.end("val")
            results.append(
                DetectedEntity(
                    entity_type=EntityType.API_KEY.value,
                    value=val,
                    start=start,
                    end=end,
                    confidence=Confidence.HIGH.value,
                    rule_name="bearer_token"
                )
            )

        # 3. Generic assignments (e.g. api_key = "...")
        for match in self.GENERIC_API_KEY_PATTERN.finditer(text):
            val = match.group("val")
            start = match.start("val")
            end = match.end("val")

            # Avoid false positives for trivial repeated characters or common placeholders
            if val.lower() in self.IGNORED_PASSWORD_VALUES:
                continue

            confidence = Confidence.HIGH.value if len(val) >= 24 else Confidence.MEDIUM.value
            results.append(
                DetectedEntity(
                    entity_type=EntityType.API_KEY.value,
                    value=val,
                    start=start,
                    end=end,
                    confidence=confidence,
                    rule_name="generic_api_key_assignment"
                )
            )

        return results

    def _detect_passwords(self, text: str) -> List[DetectedEntity]:
        """Detects password assignments in configuration lines or prompts."""
        results = []
        for match in self.PASSWORD_ASSIGNMENT_PATTERN.finditer(text):
            key = match.group("key").lower()
            val = match.group("val")
            start = match.start("val")
            end = match.end("val")

            # Ignore obvious placeholders
            if val.lower() in self.IGNORED_PASSWORD_VALUES or val.startswith("["):
                continue

            confidence = (
                Confidence.HIGH.value
                if key in {"password", "passwd", "database_password", "db_pass"}
                else Confidence.MEDIUM.value
            )

            results.append(
                DetectedEntity(
                    entity_type=EntityType.PASSWORD.value,
                    value=val,
                    start=start,
                    end=end,
                    confidence=confidence,
                    rule_name="password_assignment"
                )
            )
        return results

    def _detect_persons(self, text: str) -> List[DetectedEntity]:
        """Detects personal names when confidently identifiable via honorifics or explicit declarations."""
        results = []

        # 1. Title/honorific match (High confidence)
        for match in self.PERSON_TITLE_PATTERN.finditer(text):
            name_val = match.group(1).strip()
            name_parts = name_val.split()
            if any(part in self.IGNORED_NAME_WORDS for part in name_parts):
                continue

            start = match.start(1)
            end = match.end(1)
            results.append(
                DetectedEntity(
                    entity_type=EntityType.PERSON.value,
                    value=name_val,
                    start=start,
                    end=end,
                    confidence=Confidence.HIGH.value,
                    rule_name="person_title_prefix"
                )
            )

        # 2. Contextual declaration match (High/Medium confidence)
        for match in self.PERSON_CONTEXT_PATTERN.finditer(text):
            intro_text = text[match.start():match.start(1)].lower()
            name_val = match.group(1).strip()
            name_parts = name_val.split()
            if any(part in self.IGNORED_NAME_WORDS for part in name_parts):
                continue

            start = match.start(1)
            end = match.end(1)
            is_explicit = any(k in intro_text for k in ("my name is", "contact person", "patient", "customer"))
            confidence = Confidence.HIGH.value if is_explicit else Confidence.MEDIUM.value

            results.append(
                DetectedEntity(
                    entity_type=EntityType.PERSON.value,
                    value=name_val,
                    start=start,
                    end=end,
                    confidence=confidence,
                    rule_name="person_contextual_declaration"
                )
            )

        return results

    def _resolve_overlaps(self, candidates: List[DetectedEntity]) -> List[DetectedEntity]:
        """Resolves overlapping entity spans.

        Prioritizes:
        1. Confidence rank: HIGH > MEDIUM > LOW
        2. Rule specificity: vendor/named rules over generic assignment rules
        3. Match length: longer span preferred
        4. Position: earlier match preferred
        """
        if not candidates:
            return []

        confidence_weights = {
            Confidence.HIGH.value: 3,
            Confidence.MEDIUM.value: 2,
            Confidence.LOW.value: 1,
        }

        def priority_key(entity: DetectedEntity) -> Tuple[int, int, int, int]:
            conf_weight = confidence_weights.get(entity.confidence, 0)
            # Give specific rules higher precedence than generic assignment rules
            specificity = 1 if "generic" in entity.rule_name else 2
            span_length = entity.end - entity.start
            return (conf_weight, specificity, span_length, -entity.start)

        # Sort candidates by descending priority
        sorted_candidates = sorted(candidates, key=priority_key, reverse=True)

        accepted: List[DetectedEntity] = []
        for candidate in sorted_candidates:
            # Check for span collision with any already accepted entity
            has_overlap = False
            for accepted_entity in accepted:
                # Two spans [s1, e1) and [s2, e2) overlap if max(s1, s2) < min(e1, e2)
                if max(candidate.start, accepted_entity.start) < min(candidate.end, accepted_entity.end):
                    has_overlap = True
                    break

            if not has_overlap:
                accepted.append(candidate)

        # Return sorted by character start position
        return sorted(accepted, key=lambda e: e.start)
