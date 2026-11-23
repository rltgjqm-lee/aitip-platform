export const onRequestGet = ({ env }) => Response.json({
  db: !!env.DB,
  pub: env.MEDIA_PUBLIC?.constructor?.name ?? null,
  priv: env.MEDIA_PRIVATE?.constructor?.name ?? null,
  envKeys: Object.keys(env || {})
});
