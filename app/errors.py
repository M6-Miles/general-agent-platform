from uuid import uuid4

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def error_payload(request: Request, code: str, message: str, status_code: int, headers: dict[str, str] | None = None, details: dict | None = None) -> JSONResponse:
    request_id = getattr(request.state, "request_id", f"req_{uuid4().hex}")
    error = {"code": code, "message": message, "requestId": request_id}
    if details:
        error["details"] = details
    return JSONResponse(status_code=status_code, headers=headers, content={"error": error})


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        code = str(exc.detail.get("code") or "HTTP_ERROR")
        message = str(exc.detail.get("message") or code.replace("_", " ").title())
        extras = {key: value for key, value in exc.detail.items() if key not in {"code", "message"}}
        return error_payload(request, code, message, exc.status_code, headers=dict(exc.headers or {}), details=extras or None)
    code = str(exc.detail)
    return error_payload(request, code, code.replace("_", " ").title(), exc.status_code, headers=dict(exc.headers or {}))


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return error_payload(request, "VALIDATION_ERROR", "Request validation failed", 422)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a stable response without exposing implementation details."""
    return error_payload(request, "INTERNAL_SERVER_ERROR", "Internal Server Error", 500)
