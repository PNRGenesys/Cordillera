"""Runtime configuration read from environment variables.

Nothing is hardcoded: every value comes from the environment (injected by
docker compose or a local `.env` file). MercadoPago credentials are declared
here as placeholders so the payment integration can be wired in later without
touching this module's shape.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed settings for the middleware service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Port the middleware listens on inside the container.
    port: int = Field(default=8000, alias="PORT")

    # Base URL of the Fastify API this middleware forwards to. In the container
    # group the service name resolves over the compose network.
    api_base_url: str = Field(
        default="http://host.docker.internal:3000",
        alias="API_BASE_URL",
    )

    # MercadoPago credentials. Placeholders for now; the payment integration is
    # a follow-up change. Empty by default so the service still boots for /health.
    mercadopago_access_token: str = Field(
        default="", alias="MERCADOPAGO_ACCESS_TOKEN"
    )
    mercadopago_public_key: str = Field(default="", alias="MERCADOPAGO_PUBLIC_KEY")
    mercadopago_webhook_secret: str = Field(
        default="", alias="MERCADOPAGO_WEBHOOK_SECRET"
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance so the environment is read once."""

    return Settings()
