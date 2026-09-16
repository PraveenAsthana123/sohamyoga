"""LangSmith tracing configuration — sets up environment for trace capture.

Call configure_langsmith() at app startup. If LANGCHAIN_API_KEY is not set
or is the placeholder value, tracing is silently disabled — no crash, no spam.
"""

import os


def configure_langsmith() -> bool:
    """Enable LangSmith tracing if LANGCHAIN_API_KEY is configured.

    Reads from environment variables set via backend/.env.
    Does nothing (and returns False) if the key is missing or is the
    example placeholder string.

    Returns:
        True if tracing was successfully enabled, False otherwise.
    """
    api_key = os.getenv("LANGCHAIN_API_KEY", "")
    if api_key and api_key != "your_langsmith_key_here":
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_PROJECT"] = os.getenv(
            "LANGCHAIN_PROJECT", "sohamyoga-ai-platform"
        )
        os.environ.setdefault(
            "LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com"
        )
        return True
    return False


def get_langsmith_status() -> dict:
    """Return the current LangSmith configuration status.

    Returns:
        Dict with keys: configured (bool), tracing_enabled (bool),
        project (str), endpoint (str).
    """
    return {
        "configured": bool(
            os.getenv("LANGCHAIN_API_KEY")
            and os.getenv("LANGCHAIN_API_KEY") != "your_langsmith_key_here"
        ),
        "tracing_enabled": os.getenv("LANGCHAIN_TRACING_V2") == "true",
        "project": os.getenv("LANGCHAIN_PROJECT", "sohamyoga-ai-platform"),
        "endpoint": os.getenv(
            "LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com"
        ),
    }
