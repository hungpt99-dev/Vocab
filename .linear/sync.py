#!/usr/bin/env python3
"""Sync helper: move Linear issues between states and add comments.

Usage:
  python3 .linear/sync.py state VOC-6 "In Progress"
  python3 .linear/sync.py comment VOC-6 "message"
  python3 .linear/sync.py list
"""
import json, os, sys, urllib.request

KEY = os.environ["LINEAR_API_KEY"]
TEAM = "546a43a3-c483-4412-a8ef-bd5fb0656fa0"
URL = "https://api.linear.app/graphql"
STATES = {
    "Todo": "d7d4a2e2-3c83-4c1c-b54f-84fb02496e6c",
    "In Progress": "1b5f941f-2144-41d3-a288-152f13b663a9",
    "Done": "c4bfa3eb-afd5-43d5-8adb-065f6adb59f8",
    "Backlog": "9373e24b-d2a2-45d1-aec4-98372aac14ec",
    "Canceled": "c5128fd4-4bde-49e7-987c-6026b220bbf4",
}


def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        out = json.load(r)
    if "errors" in out:
        raise SystemExit(json.dumps(out["errors"], indent=2))
    return out["data"]


def resolve(identifier):
    d = gql("""query($t:ID!){ issues(filter:{team:{id:{eq:$t}}}, first:250){
                 nodes{ id identifier title state{ name } } } }""", {"t": TEAM})
    for n in d["issues"]["nodes"]:
        if n["identifier"].upper() == identifier.upper():
            return n
    raise SystemExit(f"issue {identifier} not found")


def set_state(identifier, state):
    issue = resolve(identifier)
    gql("""mutation($id:String!,$s:String!){ issueUpdate(id:$id, input:{stateId:$s}){ success } }""",
        {"id": issue["id"], "s": STATES[state]})
    print(f"{identifier} -> {state}")


def comment(identifier, body):
    issue = resolve(identifier)
    gql("""mutation($i:String!,$b:String!){ commentCreate(input:{issueId:$i, body:$b}){ success } }""",
        {"i": issue["id"], "b": body})
    print(f"commented on {identifier}")


def listing():
    d = gql("""query($t:ID!){ issues(filter:{team:{id:{eq:$t}}}, first:250){
                 nodes{ identifier title state{ name } } } }""", {"t": TEAM})
    nodes = sorted(d["issues"]["nodes"], key=lambda n: int(n["identifier"].split("-")[1]))
    for n in nodes:
        print(f"{n['identifier']:<8} {n['state']['name']:<12} {n['title']}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "state":
        set_state(sys.argv[2], sys.argv[3])
    elif cmd == "comment":
        comment(sys.argv[2], sys.argv[3])
    elif cmd == "list":
        listing()
    else:
        raise SystemExit(__doc__)
