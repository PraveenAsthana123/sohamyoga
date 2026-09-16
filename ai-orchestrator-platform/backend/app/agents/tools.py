"""LangChain tools that agents can invoke.

Each tool is decorated with @tool so LangChain/LangGraph can use it in
ReAct-style agent loops. Tools degrade gracefully when Ollama or the
sohamyoga PostgreSQL DB is unreachable — they return structured error
dicts rather than raising, so the supervisor can route around failures.
"""

import json
import os
from typing import Any

import httpx

from langchain_core.tools import tool

_OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
_OLLAMA_MODEL = "llama3.2"
_PG_DSN = os.getenv(
    "SOHAMYOGA_PG_DSN",
    "postgresql://postgres:postgres@127.0.0.1:5437/sohamyoga",
)

# Character limits per platform
_PLATFORM_LIMITS: dict[str, int] = {
    "twitter": 280,
    "x": 280,
    "instagram": 2200,
    "facebook": 63206,
    "linkedin": 3000,
    "youtube": 5000,
    "pinterest": 500,
    "tiktok": 2200,
}

# Known best posting windows (fallback when no DB data exists)
_DEFAULT_POSTING_WINDOWS: dict[str, dict[str, Any]] = {
    "instagram": {"day_of_week": "Wednesday", "hour": 11, "timezone": "local"},
    "facebook": {"day_of_week": "Thursday", "hour": 13, "timezone": "local"},
    "twitter": {"day_of_week": "Tuesday", "hour": 9, "timezone": "local"},
    "x": {"day_of_week": "Tuesday", "hour": 9, "timezone": "local"},
    "linkedin": {"day_of_week": "Tuesday", "hour": 10, "timezone": "local"},
    "youtube": {"day_of_week": "Friday", "hour": 15, "timezone": "local"},
    "pinterest": {"day_of_week": "Saturday", "hour": 14, "timezone": "local"},
    "tiktok": {"day_of_week": "Friday", "hour": 19, "timezone": "local"},
}


def _call_ollama(prompt: str, system: str = "") -> str:
    """Call Ollama generate endpoint and return the response string.

    Args:
        prompt: User-facing prompt text.
        system: Optional system/role prompt.

    Returns:
        Model response text, or an error string if Ollama is unreachable.
    """
    payload: dict[str, Any] = {
        "model": _OLLAMA_MODEL,
        "prompt": f"{system}\n\n{prompt}" if system else prompt,
        "stream": False,
    }
    try:
        resp = httpx.post(
            f"{_OLLAMA_BASE}/api/generate",
            json=payload,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except httpx.ConnectError:
        return "__OLLAMA_DOWN__"
    except Exception as exc:  # pragma: no cover
        return f"__OLLAMA_ERROR__: {exc}"


def _ollama_unavailable(response: str) -> bool:
    """Return True if the Ollama response signals it was unreachable."""
    return response.startswith("__OLLAMA_DOWN__") or response.startswith("__OLLAMA_ERROR__")


@tool
def generate_social_post(platform: str, topic: str, tone: str = "professional") -> str:
    """Generate a social media post for a given platform and topic.

    Args:
        platform: Target platform (instagram, twitter, linkedin, facebook, etc.).
        topic: Subject or theme of the post.
        tone: Writing tone — professional, casual, motivational, educational.

    Returns:
        Generated post text respecting platform character limits, or an error
        dict string if Ollama is unavailable.
    """
    limit = _PLATFORM_LIMITS.get(platform.lower(), 2000)
    platform_notes = {
        "twitter": "Include 1-2 hashtags. Must be under 280 characters.",
        "x": "Include 1-2 hashtags. Must be under 280 characters.",
        "instagram": "Include 5-10 relevant hashtags. Engaging, visual storytelling. Under 2200 chars.",
        "linkedin": "Professional tone. Paragraph format. 1-3 hashtags. Under 3000 chars.",
        "facebook": "Conversational. Can include emojis. Under 1000 chars for best reach.",
        "youtube": "Video description format. Include timestamps if relevant. Under 5000 chars.",
        "tiktok": "Short, punchy, trend-aware. Include hashtags. Under 150 chars for caption.",
        "pinterest": "Descriptive, keyword-rich. Under 500 chars.",
    }.get(platform.lower(), f"Under {limit} chars.")

    system = (
        f"You are a social media content expert specializing in yoga and wellness brands. "
        f"Write in a {tone} tone."
    )
    prompt = (
        f"Write a {platform} post about: {topic}\n\n"
        f"Platform requirements: {platform_notes}\n"
        f"Return ONLY the post text — no explanation, no labels."
    )
    result = _call_ollama(prompt, system)
    if _ollama_unavailable(result):
        return json.dumps({
            "status": "ollama_unavailable",
            "message": "Ollama is not reachable. Start Ollama with: ollama serve",
            "platform": platform,
            "topic": topic,
        })
    # Trim to limit as a safety net
    return result[:limit]


@tool
def analyze_platform_performance(platform: str, days: int = 7) -> dict:
    """Get platform analytics summary for the last N days.

    Queries the sohamyoga PostgreSQL analytics tables. Falls back to a
    stub response if the DB is unreachable.

    Args:
        platform: Social platform name.
        days: Number of days to look back.

    Returns:
        Dict with keys: platform, period_days, impressions, engagement_rate,
        follower_change, top_post_url, source.
    """
    try:
        import psycopg2  # type: ignore[import-not-found]
        import psycopg2.extras  # type: ignore[import-not-found]

        conn = psycopg2.connect(_PG_DSN, connect_timeout=5)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                COUNT(*) AS post_count,
                COALESCE(SUM(impressions), 0) AS impressions,
                COALESCE(AVG(engagement_rate), 0) AS engagement_rate,
                COALESCE(SUM(new_followers), 0) AS follower_change
            FROM social_post_analytics
            WHERE platform = %s
              AND recorded_at >= NOW() - INTERVAL '%s days'
            """,
            (platform.lower(), days),
        )
        row = cur.fetchone() or {}
        cur.execute(
            """
            SELECT post_url FROM social_post_analytics
            WHERE platform = %s AND recorded_at >= NOW() - INTERVAL '%s days'
            ORDER BY engagement_rate DESC LIMIT 1
            """,
            (platform.lower(), days),
        )
        top = cur.fetchone()
        conn.close()
        return {
            "platform": platform,
            "period_days": days,
            "impressions": int(row.get("impressions", 0)),
            "engagement_rate": round(float(row.get("engagement_rate", 0)), 4),
            "follower_change": int(row.get("follower_change", 0)),
            "post_count": int(row.get("post_count", 0)),
            "top_post_url": top["post_url"] if top else None,
            "source": "sohamyoga_db",
        }
    except Exception as exc:
        # Graceful fallback — DB may not be migrated yet or psycopg2 not installed
        return {
            "platform": platform,
            "period_days": days,
            "impressions": 0,
            "engagement_rate": 0.0,
            "follower_change": 0,
            "post_count": 0,
            "top_post_url": None,
            "source": "fallback",
            "note": f"DB unreachable: {exc}",
        }


@tool
def classify_review_sentiment(text: str) -> dict:
    """Classify review text as positive/neutral/negative with confidence score.

    Args:
        text: Raw review text to classify.

    Returns:
        Dict with keys: sentiment, confidence, suggested_response, source.
        Falls back to keyword heuristic if Ollama is unavailable.
    """
    system = (
        "You are a sentiment analysis expert for a yoga studio. "
        "Respond ONLY with valid JSON, no markdown, no explanation."
    )
    prompt = (
        f"Classify the sentiment of this customer review for a yoga studio:\n\n"
        f'"{text}"\n\n'
        "Respond with this exact JSON structure:\n"
        '{"sentiment": "positive|neutral|negative", "confidence": 0.0-1.0, '
        '"key_issues": ["list", "of", "issues"], '
        '"suggested_response": "a polite 1-2 sentence reply"}'
    )
    result = _call_ollama(prompt, system)
    if _ollama_unavailable(result):
        # Keyword fallback so the tool is never completely dead
        text_lower = text.lower()
        positive_words = {"great", "amazing", "excellent", "love", "wonderful", "fantastic", "perfect", "best"}
        negative_words = {"terrible", "awful", "bad", "horrible", "worst", "disappointed", "poor", "rude"}
        pos_count = sum(1 for w in positive_words if w in text_lower)
        neg_count = sum(1 for w in negative_words if w in text_lower)
        if pos_count > neg_count:
            sentiment, confidence = "positive", 0.65
        elif neg_count > pos_count:
            sentiment, confidence = "negative", 0.65
        else:
            sentiment, confidence = "neutral", 0.55
        return {
            "sentiment": sentiment,
            "confidence": confidence,
            "key_issues": [],
            "suggested_response": "Thank you for your feedback. We appreciate you taking the time to share your experience.",
            "source": "keyword_fallback",
        }

    try:
        parsed = json.loads(result)
        parsed["source"] = "ollama"
        return parsed
    except json.JSONDecodeError:
        # Best-effort extraction if model returned malformed JSON
        sentiment = "positive" if "positive" in result.lower() else (
            "negative" if "negative" in result.lower() else "neutral"
        )
        return {
            "sentiment": sentiment,
            "confidence": 0.5,
            "key_issues": [],
            "suggested_response": "Thank you for your review.",
            "source": "ollama_parse_error",
            "raw": result[:500],
        }


@tool
def get_best_posting_time(platform: str) -> dict:
    """Return optimal posting times for a platform based on past performance.

    Queries sohamyoga analytics for historical engagement by hour/day.
    Falls back to research-backed defaults if DB is unavailable.

    Args:
        platform: Social platform name.

    Returns:
        Dict with recommended_day, recommended_hour, confidence, source.
    """
    try:
        import psycopg2  # type: ignore[import-not-found]
        import psycopg2.extras  # type: ignore[import-not-found]

        conn = psycopg2.connect(_PG_DSN, connect_timeout=5)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Find the hour/day combo with highest average engagement
        cur.execute(
            """
            SELECT
                EXTRACT(DOW FROM posted_at) AS dow,
                EXTRACT(HOUR FROM posted_at) AS hour,
                AVG(engagement_rate) AS avg_engagement,
                COUNT(*) AS sample_size
            FROM social_post_analytics
            WHERE platform = %s AND engagement_rate IS NOT NULL
            GROUP BY dow, hour
            HAVING COUNT(*) >= 3
            ORDER BY avg_engagement DESC
            LIMIT 1
            """,
            (platform.lower(),),
        )
        row = cur.fetchone()
        conn.close()
        if row:
            days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            return {
                "platform": platform,
                "recommended_day": days[int(row["dow"])],
                "recommended_hour": int(row["hour"]),
                "avg_engagement_rate": round(float(row["avg_engagement"]), 4),
                "sample_size": int(row["sample_size"]),
                "confidence": "high" if int(row["sample_size"]) >= 10 else "medium",
                "source": "sohamyoga_db",
            }
    except Exception:
        pass  # fall through to default

    default = _DEFAULT_POSTING_WINDOWS.get(platform.lower(), {"day_of_week": "Tuesday", "hour": 10, "timezone": "local"})
    return {
        "platform": platform,
        "recommended_day": default.get("day_of_week", "Tuesday"),
        "recommended_hour": default.get("hour", 10),
        "avg_engagement_rate": None,
        "sample_size": 0,
        "confidence": "low",
        "source": "research_defaults",
        "note": "Based on industry research; collect more data for platform-specific recommendations.",
    }


@tool
def adapt_content_for_platform(
    content: str, source_platform: str, target_platform: str
) -> str:
    """Adapt content from one platform's format to another.

    Handles character limit changes, hashtag density, and tone adjustments
    automatically.

    Args:
        content: Original content to adapt.
        source_platform: Platform the content was written for.
        target_platform: Platform to adapt the content for.

    Returns:
        Adapted content string respecting target platform requirements,
        or an error dict string if Ollama is unavailable.
    """
    target_limit = _PLATFORM_LIMITS.get(target_platform.lower(), 2000)
    target_notes = {
        "twitter": "Shorten to under 280 chars. Use 1-2 hashtags only.",
        "x": "Shorten to under 280 chars. Use 1-2 hashtags only.",
        "instagram": "Add 5-10 hashtags. Make it visual and storytelling-oriented.",
        "linkedin": "Professional tone. Remove casual language. 1-3 hashtags.",
        "facebook": "Conversational. Can be slightly longer. Encourage engagement.",
        "youtube": "Expand into a description. Add sections with keywords.",
        "tiktok": "Make it trend-aware and punchy. Add relevant hashtags.",
        "pinterest": "Descriptive and keyword-rich. Focus on the visual element.",
    }.get(target_platform.lower(), f"Adapt for {target_platform}. Under {target_limit} chars.")

    system = "You are a social media content adaptation expert for yoga and wellness brands."
    prompt = (
        f"Adapt this {source_platform} content for {target_platform}:\n\n"
        f"ORIGINAL ({source_platform}):\n{content}\n\n"
        f"Requirements for {target_platform}: {target_notes}\n\n"
        "Return ONLY the adapted post text — no explanation, no labels."
    )
    result = _call_ollama(prompt, system)
    if _ollama_unavailable(result):
        return json.dumps({
            "status": "ollama_unavailable",
            "message": "Ollama is not reachable. Start Ollama with: ollama serve",
            "source_platform": source_platform,
            "target_platform": target_platform,
        })
    return result[:target_limit]
