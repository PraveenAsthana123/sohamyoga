#!/usr/bin/env python3
"""
Extract a full ChatGPT shared conversation (chatgpt.com/share/<id>) prompt by
prompt, in order, as structured JSON.

ChatGPT share pages don't expose a public REST API for this — the transcript
is embedded server-side in the HTML as a React Router 7 "turbo-stream" payload:
a flat JSON array of "chunks" where objects/arrays reference other chunks by
index (e.g. {"_1": 2} means "a key equal to chunk[1]'s string value, pointing
to chunk[2]") instead of repeating strings inline. This dedupes repeated
strings (role names, key names) across a long conversation, but means you
can't just regex the page for readable text — you have to decode the chunk
graph.

Usage:
    python3 chatgpt_share_extract.py <share_url_or_id> [--out FILE.json]
    python3 chatgpt_share_extract.py 6a8d1a3e-99ac-83e8-8333-fa4ee07cb670

Output: JSON with {title, messages: [{index, role, create_time, text}, ...]}
in linear conversation order (the visible branch — ChatGPT conversations can
branch on regeneration; only the branch actually rendered in the share link
is included, matching what a human reading the shared page would see).
"""
import argparse
import json
import re
import sys
import urllib.request

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def extract_enqueued_strings(html: str, marker: str) -> list[str]:
    """Pull the JS string-literal arguments passed to streamController.enqueue(...).

    Can't use a naive regex here: the payload itself contains escaped quotes
    followed by parens (e.g. inside code samples), which breaks a lazy
    `"(.*?)"` match well before the real end of the string. This walks the
    string byte-by-byte respecting backslash escapes instead.
    """
    results = []
    pos = 0
    while True:
        idx = html.find(marker, pos)
        if idx == -1:
            break
        i = idx + len(marker)
        if i >= len(html) or html[i] != '"':
            pos = idx + len(marker)
            continue
        j = i + 1
        n = len(html)
        while j < n:
            c = html[j]
            if c == "\\":
                j += 2
                continue
            if c == '"':
                break
            j += 1
        results.append(html[i + 1 : j])
        pos = j + 1
    return results


def decode_turbo_stream(chunk_text: str):
    """Decode a turbo-stream chunk array into a plain Python object.

    Wire format (as observed on chatgpt.com share pages, 2026):
      - The whole payload is one JSON array. arr[i] is "chunk i".
      - A dict chunk like {"_1": 2, "_3": -5} encodes an object whose
        entries are (decode(key_chunk), decode_ref(value)) pairs — the "_N"
        key names the CHUNK HOLDING THE REAL KEY STRING, not the key itself.
      - A list chunk's elements are references to resolve the same way.
      - Negative integers used as refs are sentinels (undefined/hole/etc in
        the original turbo-stream protocol) — collapsed to None here since
        conversation content never needs them.
      - Bare strings/numbers/bools/null at the top level are literals.
    """
    arr = json.loads(chunk_text)
    memo: dict[int, object] = {}
    in_progress: set[int] = set()

    def decode_ref(x):
        if isinstance(x, int):
            if x < 0:
                return None
            return decode(x)
        return x

    def decode(i):
        if i in memo:
            return memo[i]
        if i in in_progress:
            return None  # defensive cycle guard; not expected in practice
        in_progress.add(i)
        v = arr[i]
        if isinstance(v, dict):
            out = {}
            for k, val in v.items():
                if k.startswith("_"):
                    key = decode(int(k[1:]))
                    out[key] = decode_ref(val)
                else:
                    out[k] = val
            result = out
        elif isinstance(v, list):
            result = [decode_ref(el) for el in v]
        else:
            result = v
        in_progress.discard(i)
        memo[i] = result
        return result

    return decode(0)


def find_share_data(root: dict) -> dict:
    """Locate the share route's conversation payload inside the decoded loaderData tree."""
    loader_data = root.get("loaderData", {})
    for route_key, route_val in loader_data.items():
        if not isinstance(route_val, dict):
            continue
        server_response = route_val.get("serverResponse")
        if isinstance(server_response, dict) and "data" in server_response:
            data = server_response["data"]
            if isinstance(data, dict) and "linear_conversation" in data:
                return data
    raise RuntimeError(
        "Could not find conversation data in decoded payload — "
        "ChatGPT may have changed their share-page format."
    )


def extract_conversation(url_or_id: str) -> dict:
    if url_or_id.startswith("http"):
        url = url_or_id
    else:
        url = f"https://chatgpt.com/share/{url_or_id}"

    html = fetch_html(url)
    calls = extract_enqueued_strings(html, "streamController.enqueue(")
    if not calls:
        raise RuntimeError(
            "No streamController.enqueue(...) payload found — page structure "
            "may have changed, or this isn't a chatgpt.com/share/ URL."
        )

    # The first (largest) enqueue call carries the full loader payload; later
    # calls are typically just stream-boundary close signals.
    biggest = max(calls, key=len)
    chunk_text = json.loads('"' + biggest + '"').rstrip("\n")
    decoded_root = decode_turbo_stream(chunk_text)
    share_data = find_share_data(decoded_root)

    messages = []
    for i, node in enumerate(share_data.get("linear_conversation", [])):
        msg = node.get("message")
        if not msg:
            continue
        content = msg.get("content") or {}
        parts = content.get("parts") or []
        text = "\n".join(p for p in parts if isinstance(p, str)).strip()
        if not text:
            continue
        role = (msg.get("author") or {}).get("role", "unknown")
        if msg.get("metadata", {}).get("is_visually_hidden_from_conversation"):
            continue  # hidden system/bootstrap turns, not real prompts
        messages.append(
            {
                "index": len(messages),
                "role": role,
                "create_time": msg.get("create_time"),
                "text": text,
            }
        )

    return {
        "title": share_data.get("title"),
        "conversation_id": share_data.get("conversation_id"),
        "message_count": len(messages),
        "messages": messages,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url_or_id", help="Full chatgpt.com/share/... URL, or just the share ID")
    ap.add_argument("--out", help="Write JSON to this file instead of stdout")
    args = ap.parse_args()

    result = extract_conversation(args.url_or_id)
    out_text = json.dumps(result, indent=2, ensure_ascii=False)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out_text)
        print(f"Wrote {result['message_count']} messages to {args.out}", file=sys.stderr)
    else:
        print(out_text)


if __name__ == "__main__":
    main()
