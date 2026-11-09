"""Compare the node ladder with the Python reference BY VALUE, then prove the comparison can fail.

Usage: python3 compare-ladder.py node.json python.json
Exit 0 only if every value agrees (floats to 1e-9 relative) AND a planted 0.1% fault is caught.
"""
import json, sys, copy


def walk(a, b, path, bad):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                bad.append(path + "/" + k + " missing on one side")
            else:
                walk(a[k], b[k], path + "/" + k, bad)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            bad.append(path + " length %d vs %d" % (len(a), len(b)))
        for i, (x, y) in enumerate(zip(a, b)):
            walk(x, y, "%s[%d]" % (path, i), bad)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if abs(a - b) > 1e-9 * max(1.0, abs(a), abs(b)):
            bad.append("%s %r vs %r" % (path, a, b))
    elif a != b:
        bad.append("%s %r vs %r" % (path, a, b))


def compare(a, b):
    bad = []
    walk(a, b, "", bad)
    return bad


def main():
    a = json.load(open(sys.argv[1]))
    b = json.load(open(sys.argv[2]))
    bad = compare(a, b)
    n = [0]

    def count(x):
        if isinstance(x, dict):
            for v in x.values():
                count(v)
        elif isinstance(x, list):
            for v in x:
                count(v)
        else:
            n[0] += 1
    count(a)
    planted = copy.deepcopy(a)
    planted["simulator"]["vendor"]["netAnnual"] *= 1.001
    caught = bool(compare(planted, b))
    print("values compared: %d, disagreements: %d, planted 0.1%% fault caught: %s" % (n[0], len(bad), caught))
    for line in bad[:20]:
        print("  " + line)
    sys.exit(0 if (not bad and caught) else 1)


if __name__ == "__main__":
    main()
