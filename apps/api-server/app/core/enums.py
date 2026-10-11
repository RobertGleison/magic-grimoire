from enum import StrEnum


class DeckStatus(StrEnum):
    PENDING    = "pending"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"
    CANCELLED  = "cancelled"


class TaskStatus(StrEnum):
    QUEUED     = "queued"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"
    CANCELLED  = "cancelled"


class TaskProgress(StrEnum):
    PROCESSING      = "processing"
    SEARCHING_CARDS = "searching_cards"
    COMPOSING_DECK  = "composing_deck"
    ENRICHING       = "enriching"
    COMPLETED       = "completed"
    FAILED          = "failed"
    CANCELLED       = "cancelled"


class DeckFormat(StrEnum):
    STANDARD  = "standard"
    MODERN    = "modern"
    PIONEER   = "pioneer"
    LEGACY    = "legacy"
    COMMANDER = "commander"


class MTGColor(StrEnum):
    WHITE     = "W"
    BLUE      = "U"
    BLACK     = "B"
    RED       = "R"
    GREEN     = "G"
    COLORLESS = "C"


class TaskType(StrEnum):
    GENERATE_DECK = "generate_deck"
