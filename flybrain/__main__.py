"""Command line entry point: python -m flybrain <command>"""

from __future__ import annotations

import argparse
import sys

from . import sources


def cmd_doctor(args: argparse.Namespace) -> int:
    print("FlyWire 2D simulator — environment check\n")
    ok = sources.zenodo_reachable()
    print(f"  zenodo.org reachable ........ {'yes' if ok else 'NO'}")
    if not ok:
        print("      -> canonical download unavailable from this host;")
        print("         `fetch` will use the git mirrors instead.")
    try:
        import numpy, pyarrow, flask  # noqa: F401
        print("  numpy / pyarrow / flask ..... yes")
    except ImportError as exc:
        print(f"  numpy / pyarrow / flask ..... MISSING ({exc.name})")
    print()
    print(sources.describe())
    built = sources.BUILD_DIR / "connectome.npz"
    print()
    print(f"  build artefact .............. {'present' if built.exists() else 'missing'}")
    if built.exists():
        print(f"      {built}  ({built.stat().st_size/1e6:.1f} MB)")
    return 0


def cmd_fetch(args: argparse.Namespace) -> int:
    keys = args.only or list(sources.MIRRORS)
    for key in keys:
        spec = sources.MIRRORS[key]
        if sources.have(key) and not args.force:
            print(f"[fetch] {spec.name}: already present")
            continue
        print(f"[fetch] {spec.name} <- {spec.repo}")
        path = sources.fetch_mirror(key, force=args.force)
        print(f"        {path} ({path.stat().st_size/1e6:.1f} MB)")
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    from .build import build

    build(min_syn=args.min_syn, edge_source=args.edges)
    return 0


def cmd_info(args: argparse.Namespace) -> int:
    from .engine import Connectome

    cx = Connectome()
    print(f"neurons        {cx.n:,}")
    print(f"connections    {cx.n_edges:,}  (syn_count >= {cx.min_syn})")
    print(f"total synapses {int(cx.weight.sum()):,}")
    print("\nby super class:")
    import numpy as np

    for i, name in enumerate(cx.super_class_names):
        c = int((cx.super_class == i).sum())
        if c:
            print(f"  {name:22s} {c:>7,}")
    print("\nby neurotransmitter:")
    for i, name in enumerate(cx.nt_names):
        c = int((cx.nt == i).sum())
        if c:
            print(f"  {name:22s} {c:>7,}")
    exc = float((cx.sign > 0).mean()) * 100
    print(f"\nexcitatory neurons {exc:.1f}%   inhibitory {100-exc:.1f}%")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    from .validate import run

    return 0 if run() else 1


def cmd_serve(args: argparse.Namespace) -> int:
    from .server import create_app

    app = create_app()
    print(f"serving on http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, threaded=True, debug=False)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="flybrain", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("doctor", help="check network, deps and data").set_defaults(
        func=cmd_doctor
    )

    f = sub.add_parser("fetch", help="download the connectome tables")
    f.add_argument("--only", nargs="*", choices=list(sources.MIRRORS))
    f.add_argument("--force", action="store_true")
    f.set_defaults(func=cmd_fetch)

    b = sub.add_parser("build", help="compile the tables into data/build/connectome.npz")
    b.add_argument("--min-syn", type=int, default=5)
    b.add_argument("--edges", choices=["auto", "parquet", "codex"], default="auto")
    b.set_defaults(func=cmd_build)

    sub.add_parser("info", help="print connectome statistics").set_defaults(func=cmd_info)

    sub.add_parser(
        "validate", help="run reproducible checks on the model"
    ).set_defaults(func=cmd_validate)

    s = sub.add_parser("serve", help="run the 2D simulator website")
    s.add_argument("--host", default="0.0.0.0")
    s.add_argument("--port", type=int, default=8000)
    s.set_defaults(func=cmd_serve)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
