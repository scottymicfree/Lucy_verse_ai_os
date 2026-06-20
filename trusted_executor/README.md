WASM Trusted Executor
=====================

This service runs WebAssembly modules inside a Wasmtime runtime.

Usage:
- POST /execute with JSON {"lang":"wasm", "code":"<base64 wasm bytes>"}

Security:
- Runs non-root user
- No host filesystem access by design (the container should enforce this)
- Uses wasmtime bindings when available; otherwise requires wasmtime CLI in the image

Note: Replace the Python fallback execution and ensure the container image is built minimal and secure.
