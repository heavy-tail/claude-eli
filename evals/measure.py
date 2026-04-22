"""
Read evals/snapshots/results.json (produced by llm_run.py) and report
preservation rate per skill — what fraction of technical artifacts
(code, commands, URLs, paths, env vars, CLI flags, error messages,
version numbers) from the BASELINE answer survive verbatim in each arm's
answer.

Why baseline as reference: baseline (no system prompt) is the natural
"full technical" answer with all artifacts intact. Each arm (terse,
eli, etc.) reduces or rephrases — preservation answers "did the arm
keep the technical specifics intact while changing the prose around them?"

For ELI, target preservation = ~100% on every category.
The whole product claim is "we change what Claude *says*, not what Claude
*writes* in code-shaped artifacts."

Also reports output length delta per arm (ELI should be longer than
baseline, since plain-language explanations cost prose; we surface this
honestly).

Tokenizer note: tiktoken o200k_base is OpenAI's tokenizer, used as a
size approximation. Absolute Claude token counts will differ; comparisons
between arms remain meaningful.

Run: uv run --with tiktoken python evals/measure.py
"""

from __future__ import annotations

import json
import re
import statistics
from pathlib import Path

import tiktoken

ENCODING = tiktoken.get_encoding("o200k_base")
SNAPSHOT = Path(__file__).parent / "snapshots" / "results.json"


# ---------- Artifact extraction (regex-based for v1) ------------------------
#
# Each extractor returns a list of strings. The preservation check is
# substring containment in the arm's answer text.

CODE_BLOCK = re.compile(r"```[\s\S]*?```")
INLINE_CODE = re.compile(r"`([^`\n]+)`")
URL = re.compile(r"https?://\S+")
# Crude file-path detector: relative paths starting with ./ ~/ or known suffixes
PATH = re.compile(
    r"(?:[\./~][\w./-]+|\b[\w-]+\.(?:js|ts|tsx|jsx|py|rs|go|md|json|yaml|yml|toml|html|css|sh|env|bash|ps1|sql|conf|lock|xml))"
)
# ALL_CAPS_WITH_UNDERSCORES, 3+ chars (env var convention)
ENV_VAR = re.compile(r"\b[A-Z][A-Z0-9_]{2,}\b")
# Short and long flags: -p, --prod, --no-cache
FLAG = re.compile(r"(?<![a-zA-Z0-9_-])(--?[a-zA-Z][a-zA-Z0-9-]*)")
# Semantic version-ish: 1.2, 1.2.3, v1.2.3
VERSION = re.compile(r"\bv?\d+\.\d+(?:\.\d+)?\b")
# Standard JS / Python / generic error patterns. Stop at the first comma so
# we don't accidentally pull in surrounding prose that legitimately differs
# between arms (e.g. baseline appends "check your .env.local" while eli
# appends "it's like opening an empty drawer"). The error itself — the
# preserved part — ends before the next comma.
ERROR = re.compile(
    r"\b(?:[A-Z][a-zA-Z]+Error|Exception|Warning):[^,\n]+"
)


def _strip_fences(text: str) -> str:
    """Remove fenced code blocks so subsequent regex hits don't double-count."""
    return CODE_BLOCK.sub("", text)


def extract(kind: str, text: str) -> list[str]:
    if kind == "code_block":
        return CODE_BLOCK.findall(text)
    if kind == "inline_code":
        return INLINE_CODE.findall(_strip_fences(text))
    if kind == "url":
        return URL.findall(text)
    if kind == "path":
        return PATH.findall(text)
    if kind == "env_var":
        return ENV_VAR.findall(text)
    if kind == "flag":
        return FLAG.findall(text)
    if kind == "version":
        return VERSION.findall(text)
    if kind == "error":
        return ERROR.findall(text)
    raise ValueError(f"unknown kind: {kind}")


KINDS = ["code_block", "inline_code", "url", "path", "env_var", "flag", "version", "error"]


def preservation_rate(items: list[str], target: str) -> float | None:
    """Fraction of items that appear verbatim as substrings in target.
    Returns None if the source had nothing of this kind."""
    if not items:
        return None
    preserved = sum(1 for item in items if item in target)
    return preserved / len(items)


def stats(values: list[float]) -> tuple[float, float, float, float]:
    """median, mean, min, max — ignores Nones."""
    clean = [v for v in values if v is not None]
    if not clean:
        return (float("nan"), float("nan"), float("nan"), float("nan"))
    return (
        statistics.median(clean),
        statistics.mean(clean),
        min(clean),
        max(clean),
    )


def fmt_pct(x: float) -> str:
    if x != x:  # NaN
        return "—"
    return f"{x * 100:.0f}%"


def fmt_delta_pct(x: float) -> str:
    """Signed percentage for length delta vs baseline."""
    sign = "+" if x >= 0 else "−"
    return f"{sign}{abs(x) * 100:.0f}%"


def count_tokens(text: str) -> int:
    return len(ENCODING.encode(text))


def main() -> None:
    if not SNAPSHOT.exists():
        print(f"No snapshot at {SNAPSHOT}. Run `python evals/llm_run.py` first.")
        return

    data = json.loads(SNAPSHOT.read_text())
    arms: dict[str, list[str]] = data["arms"]
    meta = data.get("metadata", {})
    prompts: list[str] = data["prompts"]

    if "__baseline__" not in arms:
        print("ERROR: snapshot is missing __baseline__ arm — cannot measure preservation.")
        return

    baseline = arms["__baseline__"]

    # ---- Header ----------
    print(f"_Generated: {meta.get('generated_at', '?')}_")
    print(f"_Model: {meta.get('model', '?')} · CLI: {meta.get('claude_cli_version', '?')}_")
    print(f"_n = {len(prompts)} prompts, single run per arm_")
    print()

    # ---- Length delta vs baseline ----------
    print("## Output length vs baseline")
    print()
    print("| Arm | Total tokens | Δ vs baseline |")
    print("|-----|--------------|----------------|")
    base_total = sum(count_tokens(o) for o in baseline)
    print(f"| **__baseline__** | {base_total} | (reference) |")
    for arm, outputs in arms.items():
        if arm == "__baseline__":
            continue
        total = sum(count_tokens(o) for o in outputs)
        delta = (total - base_total) / base_total if base_total else 0.0
        print(f"| **{arm}** | {total} | {fmt_delta_pct(delta)} |")
    print()
    print("_ELI should run longer than baseline (analogies cost prose); terse should run shorter._")
    print()

    # ---- Preservation rate per artifact kind ----------
    print("## Preservation rate (vs baseline)")
    print()
    print("For each prompt, we extract artifacts (code, URLs, env vars, CLI flags, etc.) from the")
    print("BASELINE answer, then check what fraction appears verbatim in the arm's answer.")
    print("Higher = better. **ELI target = ~100% on every category.**")
    print()
    header = "| Arm | " + " | ".join(KINDS) + " | Overall |"
    sep = "|-----|" + "|".join("---" for _ in KINDS) + "|---------|"
    print(header)
    print(sep)

    for arm, outputs in arms.items():
        if arm == "__baseline__":
            continue
        cells = []
        per_prompt_means = []  # one mean preservation per prompt across kinds
        for kind in KINDS:
            rates: list[float] = []
            for base_text, arm_text in zip(baseline, outputs):
                items = extract(kind, base_text)
                rate = preservation_rate(items, arm_text)
                if rate is not None:
                    rates.append(rate)
            if not rates:
                cells.append("—")
            else:
                med, _mean, _lo, _hi = stats(rates)
                cells.append(fmt_pct(med))

        # Overall: per-prompt average across non-empty kinds
        for base_text, arm_text in zip(baseline, outputs):
            kind_rates = []
            for kind in KINDS:
                items = extract(kind, base_text)
                r = preservation_rate(items, arm_text)
                if r is not None:
                    kind_rates.append(r)
            if kind_rates:
                per_prompt_means.append(sum(kind_rates) / len(kind_rates))
        overall = (
            f"{statistics.median(per_prompt_means) * 100:.0f}%"
            if per_prompt_means else "—"
        )
        print(f"| **{arm}** | " + " | ".join(cells) + f" | {overall} |")

    print()
    print("_Cells show the median preservation rate across prompts that contained that kind._")
    print(f"_Source: {SNAPSHOT.name}. Refresh with `python evals/llm_run.py`._")


if __name__ == "__main__":
    main()
