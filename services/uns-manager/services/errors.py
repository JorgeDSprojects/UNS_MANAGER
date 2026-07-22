from dataclasses import dataclass

from fastapi import HTTPException


@dataclass(slots=True)
class DomainError(Exception):
    status_code: int
    message: str

    def __str__(self) -> str:
        return self.message


def to_http_exception(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)
