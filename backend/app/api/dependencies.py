from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session


from app.database import get_db
from app.models.user import User
from app.services.auth_service import decode_access_token, get_user_by_id

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency for protected routes.

    Usage::

        @router.get("/me")
        def me(user: User = Depends(get_current_user)):
            ...

    Raises 401 when the token is missing, malformed, expired, or refers to a
    non-existent / inactive user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id_str = decode_access_token(credentials.credentials)
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception

    user = get_user_by_id(db, user_id)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    return user
