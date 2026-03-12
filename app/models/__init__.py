"""Model registry — import all models so Base.metadata sees them."""

from app.models.sora import (  # noqa: F401
    SoraVersion,
    GrcMatrix,
    SailMatrix,
    OsoCatalogue,
    OsoSailRequirement,
    CountryRule,
    GrcMitigation,
)
from app.models.dma import (  # noqa: F401
    DmaDimension,
    DmaQuestion,
    DmaAssessment,
    DmaResponseEntry,
    DmaDimensionScore,
)