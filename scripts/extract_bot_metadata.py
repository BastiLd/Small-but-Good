#!/usr/bin/env python3
# Run: python scripts/extract_bot_metadata.py
# Warning: update BOT_FILES paths before running. This script redacts token-like strings,
# but do not commit raw secrets or private data from local bot projects.

import ast
import json
import re
from datetime import datetime, timezone
from pathlib import Path

BOT_FILES = [
    r"D:\Discord Bot - Kopie\karten.py",
    r"D:\Discord Bot - Kopie\bot.py",
    r"D:\Discord Bot - Kopie\db.py",
    r"D:\Discord Bot - Kopie\config.py",
]

OUTPUT_PATH = Path("data") / "bot_metadata.json"
BOT_ID = "nexus-battle"

TOKEN_PATTERN = re.compile(r"(?<![A-Za-z0-9])[A-Za-z0-9_\-]{21,}(?![A-Za-z0-9])")
TABLE_RE = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?[`\"\[]?([a-zA-Z_][\w]*)[`\"\]]?\s*\((.*?)\)",
    re.IGNORECASE | re.DOTALL,
)

COMMAND_DECORATOR_MARKERS = (
    ".command",
    "commands.command",
    ".slash_command",
    "app_commands.command",
)

SECRET_KEYWORDS = {
    "token",
    "secret",
    "password",
    "passwd",
    "api_key",
    "apikey",
    "auth",
    "private_key",
}

CONFIG_HINT_KEYS = {
    "prefix",
    "invite",
    "community",
    "support",
    "guild",
    "server",
    "url",
    "link",
}

CARD_VAR_NAMES = {"cards", "card_data", "CARDS"}


def safe_read(path_str):
    path = Path(path_str)
    if not path.exists() or not path.is_file():
        return None, f"missing: {path_str}"
    try:
        return path.read_text(encoding="utf-8", errors="ignore"), None
    except Exception as exc:
        return None, f"read error: {path_str} ({exc})"


def safe_unparse(node):
    try:
        return ast.unparse(node)
    except Exception:
        return ""


def redact_string(value):
    return TOKEN_PATTERN.sub("<REDACTED_TOKEN>", value)


def sanitize(obj):
    if isinstance(obj, str):
        return redact_string(obj)
    if isinstance(obj, list):
        return [sanitize(item) for item in obj]
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    return obj


def get_immediate_comment_above(lines, lineno):
    idx = max(0, lineno - 2)
    comments = []
    while idx >= 0:
        line = lines[idx].strip()
        if not line:
            if comments:
                break
            idx -= 1
            continue
        if line.startswith("#"):
            comments.append(line.lstrip("#").strip())
            idx -= 1
            continue
        break
    comments.reverse()
    return comments[0] if comments else ""


def parse_ast(source):
    try:
        return ast.parse(source)
    except SyntaxError:
        return None


def infer_bot_name(modules):
    candidates = []

    for module in modules:
        tree = module.get("tree")
        source = module.get("source", "")
        if not tree:
            continue

        doc = ast.get_docstring(tree)
        if doc:
            first = doc.strip().splitlines()[0].strip()
            if first:
                candidates.append(first)

        for node in tree.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id.lower() in {"bot_name", "name", "botname"}:
                        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                            candidates.append(node.value.value.strip())

        inst_match = re.search(
            r"^\s*(\w+)\s*=\s*(?:commands\.)?(?:AutoShardedBot|Bot|Client)\s*\(",
            source,
            flags=re.MULTILINE,
        )
        if inst_match:
            candidates.append(inst_match.group(1).replace("_", " ").title())

    clean = [c for c in (redact_string(c) for c in candidates) if c]
    return clean[0] if clean else "Nexus Battle Bot"


def extract_literal(value_node):
    try:
        return ast.literal_eval(value_node)
    except Exception:
        return None


def extract_card_data(modules):
    samples = []

    for module in modules:
        tree = module.get("tree")
        if not tree:
            continue

        for node in ast.walk(tree):
            if not isinstance(node, ast.Assign):
                continue

            target_names = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if not any(name in CARD_VAR_NAMES for name in target_names):
                continue

            literal = extract_literal(node.value)
            if literal is None:
                continue

            if isinstance(literal, list):
                for item in literal[:20]:
                    samples.append(sanitize(item))
            elif isinstance(literal, dict):
                for idx, (k, v) in enumerate(literal.items()):
                    if idx >= 20:
                        break
                    samples.append({"key": sanitize(k), "value": sanitize(v)})
            elif isinstance(literal, tuple):
                for item in literal[:20]:
                    samples.append(sanitize(item))

            if samples:
                return samples[:20]

    return samples[:20]


def get_decorator_core(decorator):
    if isinstance(decorator, ast.Call):
        return decorator.func
    return decorator


def get_decorator_name(decorator):
    core = get_decorator_core(decorator)
    name = safe_unparse(core)
    return name.lower() if name else ""


def is_command_decorator(decorator):
    name = get_decorator_name(decorator)
    return any(marker in name for marker in COMMAND_DECORATOR_MARKERS)


def decorator_kwarg(decorator, key):
    if not isinstance(decorator, ast.Call):
        return None
    for kw in decorator.keywords:
        if kw.arg == key and isinstance(kw.value, ast.Constant):
            return kw.value.value
    return None


def command_signature(name, is_slash, prefix):
    if is_slash:
        return f"/{name}"
    if prefix:
        return f"{prefix}{name}"
    return f"/{name}"


def extract_commands(modules, prefix):
    results = []
    seen = set()

    for module in modules:
        tree = module.get("tree")
        lines = module.get("source", "").splitlines()
        if not tree:
            continue

        for node in ast.walk(tree):
            if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
                continue

            decorators = [d for d in node.decorator_list if is_command_decorator(d)]
            if not decorators:
                continue

            decorator_names = [get_decorator_name(d) for d in decorators]
            is_slash = any("slash_command" in name or "app_commands.command" in name for name in decorator_names)

            explicit_name = None
            for deco in decorators:
                explicit_name = decorator_kwarg(deco, "name")
                if explicit_name:
                    break

            cmd_name = (explicit_name or node.name).replace("_", "-")
            if cmd_name in seen:
                continue
            seen.add(cmd_name)

            doc = ast.get_docstring(node) or ""
            desc = ""
            if doc.strip():
                desc = doc.strip().splitlines()[0].strip()
            if not desc:
                desc = get_immediate_comment_above(lines, getattr(node, "lineno", 1))
            if not desc:
                desc = f"Command '{cmd_name}'"

            results.append(
                {
                    "name": sanitize(cmd_name),
                    "signature": sanitize(command_signature(cmd_name, is_slash, prefix)),
                    "desc": sanitize(desc),
                }
            )

    return results


def collect_sql_strings(tree):
    sql_strings = []
    if not tree:
        return sql_strings

    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            s = node.value
            low = s.lower()
            if "create table" in low or "execute(" in low or "insert into" in low or "select " in low:
                sql_strings.append(s)
    return sql_strings


def parse_columns(columns_blob):
    columns = []
    for raw in columns_blob.split(","):
        line = raw.strip().strip("\n").strip()
        if not line:
            continue
        upper = line.upper()
        if upper.startswith(("PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT")):
            continue
        col_name = re.split(r"\s+", line)[0].strip("`\"[]")
        if col_name:
            columns.append(col_name)
    return columns


def extract_db_info(modules):
    tables = {}

    for module in modules:
        if not module.get("path", "").lower().endswith("db.py"):
            continue

        sql_sources = []
        tree = module.get("tree")
        source = module.get("source", "")
        sql_sources.extend(collect_sql_strings(tree))
        sql_sources.append(source)

        for sql in sql_sources:
            for match in TABLE_RE.finditer(sql):
                table_name = match.group(1)
                cols = parse_columns(match.group(2))
                if table_name not in tables:
                    tables[table_name] = []
                if cols:
                    existing = set(tables[table_name])
                    for col in cols:
                        if col not in existing:
                            tables[table_name].append(col)
                            existing.add(col)

        fallback_tables = re.findall(
            r"(?:from|into|update|join)\s+[`\"\[]?([a-zA-Z_][\w]*)",
            source,
            flags=re.IGNORECASE,
        )
        for t in fallback_tables:
            tables.setdefault(t, [])

    return tables


def is_safe_config_key(key):
    lower = key.lower()
    if any(secret in lower for secret in SECRET_KEYWORDS):
        return False
    return any(hint in lower for hint in CONFIG_HINT_KEYS)


def extract_config(modules):
    config = {}

    for module in modules:
        tree = module.get("tree")
        if not tree:
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                literal = extract_literal(node.value)

                for target in node.targets:
                    if not isinstance(target, ast.Name):
                        continue
                    key = target.id
                    if not is_safe_config_key(key):
                        continue

                    if isinstance(literal, (str, int, float, bool)):
                        config[key.lower()] = sanitize(str(literal))

                if isinstance(literal, dict):
                    for k, v in literal.items():
                        if not isinstance(k, str) or not is_safe_config_key(k):
                            continue
                        if isinstance(v, (str, int, float, bool)):
                            config[k.lower()] = sanitize(str(v))

    return config


def infer_prefix(config):
    for key in ("prefix", "command_prefix", "bot_prefix"):
        if key in config and config[key]:
            return str(config[key])
    return "/"


def infer_descriptions(bot_name, commands, cards_sample, module_doc):
    if module_doc:
        first_sentence = module_doc.strip().split(".")[0].strip()
        if first_sentence:
            short_desc = f"{redact_string(first_sentence)}."
        else:
            short_desc = f"{bot_name} is a Discord bot project."
    else:
        short_desc = f"{bot_name} is a Discord bot project."

    long_desc = (
        f"{bot_name} appears to provide {len(commands)} command(s)"
        f" and includes {len(cards_sample)} extracted card/game metadata sample item(s)."
    )
    return sanitize(short_desc), sanitize(long_desc)


def module_docstring(modules):
    for module in modules:
        tree = module.get("tree")
        if not tree:
            continue
        doc = ast.get_docstring(tree)
        if doc:
            return doc
    return ""


def make_cards_fallback_from_db(db_tables):
    fallback = []
    for table_name, cols in db_tables.items():
        fallback.append({"table": table_name, "columns": cols[:20]})
        if len(fallback) >= 20:
            break
    return fallback


def load_modules(paths):
    modules = []
    warnings = []
    read_ok = 0

    for file_path in paths:
        source, error = safe_read(file_path)
        if error:
            warnings.append(error)
            continue

        tree = parse_ast(source)
        modules.append({"path": file_path, "source": source, "tree": tree})
        read_ok += 1
        if tree is None:
            warnings.append(f"parse warning: {file_path}")

    return modules, warnings, read_ok


def main():
    modules, warnings, read_ok = load_modules(BOT_FILES)

    bot_name = infer_bot_name(modules)
    config = extract_config(modules)
    prefix = infer_prefix(config)
    commands = extract_commands(modules, prefix)
    cards_sample = extract_card_data(modules)
    db_tables_map = extract_db_info(modules)

    if not cards_sample:
        cards_sample = make_cards_fallback_from_db(db_tables_map)

    doc = module_docstring(modules)
    short_desc, long_desc = infer_descriptions(bot_name, commands, cards_sample, doc)

    metadata = {
        "id": BOT_ID,
        "name": sanitize(bot_name),
        "short_description": short_desc,
        "long_description": long_desc,
        "commands": sanitize(commands),
        "cards_sample": sanitize(cards_sample[:20]),
        "config": sanitize(config),
        "db_tables": sorted(sanitize(list(db_tables_map.keys()))),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Read {read_ok}/{len(BOT_FILES)} files successfully.")
    if warnings:
        for w in warnings:
            print(f"Warning: {w}")
    print(f"Wrote metadata JSON: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()