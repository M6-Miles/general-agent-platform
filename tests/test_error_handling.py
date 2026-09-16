import asyncio

from fastapi import Request

from app.errors import unhandled_exception_handler


def _request() -> Request:
    scope = {"type": "http", "method": "GET", "path": "/", "headers": []}
    request = Request(scope)
    request.state.request_id = "req_test"
    return request


def test_unhandled_error_is_generic_and_does_not_leak_details():
    response = asyncio.run(unhandled_exception_handler(_request(), RuntimeError("SELECT password FROM users")))
    assert response.status_code == 500
    assert b"Internal Server Error" in response.body
    assert b"SELECT" not in response.body
    assert b"password" not in response.body
