from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Identity
from app.profiles.model import Profile


async def upsert_profile(db: AsyncSession, identity: Identity) -> None:
    """Record the caller's current public name and avatar. Not committed here:
    it rides the caller's transaction."""
    values = {"display_name": identity.display_name, "avatar_url": identity.avatar_url}
    await db.execute(
        insert(Profile)
        .values(user_id=identity.user_id, **values)
        .on_conflict_do_update(index_elements=[Profile.user_id], set_={**values, "updated_at": func.now()})
    )
