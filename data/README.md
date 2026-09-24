# FlyWire 783 data directory

The exact source file is intentionally not committed to git because it is 852 MB.
Place it here with this exact filename:

```text
proofread_connections_783.feather
```

From the repository root, run:

```bash
python3 tools/download_dataset.py
```

The downloader resumes interrupted transfers and verifies the Zenodo-published MD5:

```text
f48f972d262323a102aed49af1396b8a
```

The local server reads only the proofread connection columns and the browser receives
only the requested root ID's neighborhood. The UI shows a clearly labelled deterministic
preview until the verified Feather file is present.
